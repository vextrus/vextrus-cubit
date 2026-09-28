"""The sandboxed child's output, read strictly: every field present, of its type, and nothing else.

The child parsed a hostile file, so what it wrote is untrusted too (engine/read/sandbox.py): this
module is the only reader of it, and refuses any shape `walk.py` does not write.
"""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from engine.read._json import Fields
from engine.read.pdf.types import Box, TextSource

EXTRAS = ("scripts", "launches", "links", "remote", "files")
_ROTATIONS = (0, 90, 180, 270)
_KINDS = ("truetype", "type1", "type0", "type3", "unreadable")


@dataclass(frozen=True)
class ItemFacts:
    text: str
    source: TextSource
    index: int
    box: Box
    size: float | None
    angle: float | None
    mirrored: bool
    font: str | None


@dataclass(frozen=True)
class PageFacts:
    number: int
    readable: bool
    rotate: int
    width: float
    height: float
    crop: Box
    objects: int
    strokes: int
    fills: int
    chars: int
    hidden_chars: int
    unmapped_chars: int
    images: int
    picture_share: float
    """The share of the page its images cover, 0 to 1 (`coverage.py`)."""
    fonts: tuple[tuple[str, str, bool], ...]
    layers: tuple[str, ...]
    shx_comments: int
    items: tuple[ItemFacts, ...]


@dataclass(frozen=True)
class DocumentFacts:
    producer: str | None
    creator: str | None
    extras: dict[str, int]
    pages: tuple[PageFacts, ...]


def parse(data: object) -> DocumentFacts:
    """The child's facts, or `ValueError` for anything `walk.py` does not write."""
    fields = Fields(data, "pdf facts")
    extras = Fields(fields.mapping("extras"), "pdf extras")
    counts = {name: _count(extras, name) for name in EXTRAS}
    extras.done()
    facts = DocumentFacts(
        producer=fields.optional_string("producer"),
        creator=fields.optional_string("creator"),
        extras=counts,
        pages=tuple(_page(page) for page in fields.array("pages")),
    )
    fields.done()
    if [page.number for page in facts.pages] != list(range(1, len(facts.pages) + 1)):
        raise ValueError("pdf facts: pages are not numbered 1 to n in order")
    return facts


def _page(data: object) -> PageFacts:
    fields = Fields(data, "pdf page")
    rotate = fields.integer("rotate")
    if rotate not in _ROTATIONS:
        raise fields.fail("rotate", "0, 90, 180 or 270")
    page = PageFacts(
        number=fields.integer("number"),
        readable=_boolean(fields, "readable"),
        rotate=rotate,
        width=_size(fields, "width"),
        height=_size(fields, "height"),
        crop=_box(fields.raw("crop"), "crop"),
        objects=_count(fields, "objects"),
        strokes=_count(fields, "strokes"),
        fills=_count(fields, "fills"),
        chars=_count(fields, "chars"),
        hidden_chars=_count(fields, "hidden_chars"),
        unmapped_chars=_count(fields, "unmapped_chars"),
        images=_count(fields, "images"),
        picture_share=_share(fields),
        fonts=tuple(_font(font) for font in fields.array("fonts")),
        layers=tuple(_string(name, "layer") for name in fields.array("layers")),
        shx_comments=_count(fields, "shx_comments"),
        items=tuple(_item(item) for item in fields.array("items")),
    )
    fields.done()
    if sum(item.source is TextSource.SHX_COMMENT for item in page.items) != page.shx_comments:
        raise ValueError("pdf page: its SHX comments and its comment items differ")
    return page


def _item(data: object) -> ItemFacts:
    fields = Fields(data, "pdf text item")
    try:
        source = TextSource(fields.string("source"))
    except ValueError:
        raise fields.fail("source", "a text source") from None
    item = ItemFacts(
        text=fields.string("text"),
        source=source,
        index=_count(fields, "index"),
        box=_box(fields.raw("box"), "box"),
        size=_optional_number(fields, "size"),
        angle=_optional_number(fields, "angle"),
        mirrored=_boolean(fields, "mirrored"),
        font=fields.optional_string("font"),
    )
    fields.done()
    if not item.text or (item.source is TextSource.SHX_COMMENT) != (item.size is None):
        raise ValueError("pdf text item: empty, or a size that does not fit its source")
    return item


def _font(data: object) -> tuple[str, str, bool]:
    if not isinstance(data, list) or len(data) != 3:
        raise ValueError(f"pdf font: expected a name, a kind and embedded, got {data!r}")
    name, kind, embedded = data
    if kind not in _KINDS or not isinstance(embedded, bool):
        raise ValueError(f"pdf font: {data!r}")
    return _string(name, "font"), kind, embedded


def _string(value: object, what: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"pdf {what}: expected a name, got {value!r}")
    return value


def _count(fields: Fields, key: str) -> int:
    value = fields.integer(key)
    if value < 0:
        raise fields.fail(key, "a count")
    return value


def _boolean(fields: Fields, key: str) -> bool:
    value = fields.raw(key)
    if not isinstance(value, bool):
        raise fields.fail(key, "true or false")
    return value


def _number(value: object, what: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError(f"pdf {what}: expected a finite number, got {value!r}")
    try:
        number = float(value)  # an integer too large for a float raises OverflowError
    except OverflowError:
        raise ValueError(f"pdf {what}: {value!r} is too large") from None
    if not math.isfinite(number):
        raise ValueError(f"pdf {what}: expected a finite number, got {value!r}")
    return number


def _size(fields: Fields, key: str) -> float:
    value = _number(fields.raw(key), key)
    if value < 0:
        raise fields.fail(key, "a size, 0 or more")
    return value


def _share(fields: Fields) -> float:
    value = _number(fields.raw("picture_share"), "picture_share")
    if not 0 <= value <= 1:
        raise fields.fail("picture_share", "a share from 0 to 1")
    return value


def _optional_number(fields: Fields, key: str) -> float | None:
    value = fields.raw(key)
    return None if value is None else _number(value, key)


def _box(value: object, what: str) -> Box:
    if not isinstance(value, list) or len(value) != 4:
        raise ValueError(f"pdf {what}: expected four numbers, got {value!r}")
    x0, y0, x1, y1 = (_number(v, what) for v in value)
    if x1 < x0 or y1 < y0:
        raise ValueError(f"pdf {what}: {value!r} is not a box")
    return x0, y0, x1, y1


def refusal(data: Mapping[str, Any]) -> str | None:
    """The reason the child refused the file (`{"refused": reason}`), or none when it read it."""
    if set(data) == {"refused"} and isinstance(data["refused"], str):
        return data["refused"]
    return None
