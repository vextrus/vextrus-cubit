"""The Trace's anchors: where on a drawing a figure was read (docs/architecture.md, Trace).

Named by the skeleton (01a) so the harness's types (06b) import them before the reader (04) filled
them, each to and from JSON, under the M0 plan's contract ("The ReadArtefact and the anchors"):

- `DwgAnchor`: the source file's sha256, the reader and its version, the sheet, the chain of insert
  handles (outermost first) and the entity's handle;
- `PdfAnchor`: the source file's sha256, the reader and its version, the page, the path's index and
  its box. The first three are every anchor's, so `drawings` keeps `source_sha256` and
  `reader_version` as real columns for either kind (docs/data-model.md, the Trace anchor).

An anchor is a value: it names a place in one file as one reader version read it. `sheet` is the
sheet's key within its file as the recogniser (13) gives it (a layout's name, or its key for a frame
in model space); the reader itself only ever says which layout an entity lies in. In JSON a box's
numbers are decimal strings, never floats (docs/data-model.md §2). An artefact an anchor names is
never deleted.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from engine.read._json import Fields, decimal_string, from_decimal_string

_HANDLE = re.compile(r"[0-9A-F]+")
_SHA256 = re.compile(r"[0-9a-f]{64}")


def _check_source(what: str, sha256: str, reader: str, version: str) -> None:
    if not _SHA256.fullmatch(sha256):
        raise ValueError(f"{what}: source_sha256 must be 64 lower-case hex digits, got {sha256!r}")
    if not reader or not version:
        raise ValueError(f"{what}: the reader and its version are required")


def is_handle(value: object) -> bool:
    """A DWG handle as the file writes it: upper-case hex digits, no prefix."""
    return isinstance(value, str) and bool(_HANDLE.fullmatch(value))


@dataclass(frozen=True)
class DwgAnchor:
    """A place in a DWG file: one entity, reached through a chain of inserts, on one sheet."""

    source_sha256: str
    reader: str
    reader_version: str
    sheet: str
    inserts: tuple[str, ...]
    handle: str

    def __post_init__(self) -> None:
        _check_source("dwg anchor", self.source_sha256, self.reader, self.reader_version)
        if not isinstance(self.sheet, str):
            raise ValueError(f"dwg anchor: sheet must be a string, got {self.sheet!r}")
        for handle in (*self.inserts, self.handle):
            if not is_handle(handle):
                raise ValueError(f"dwg anchor: {handle!r} is not an upper-case hex handle")

    def to_json(self) -> dict[str, Any]:
        return {
            "kind": "dwg",
            "source_sha256": self.source_sha256,
            "reader": self.reader,
            "reader_version": self.reader_version,
            "sheet": self.sheet,
            "inserts": list(self.inserts),
            "handle": self.handle,
        }

    @classmethod
    def from_json(cls, data: Mapping[str, object]) -> DwgAnchor:
        fields = _fields(data, "dwg")
        inserts = fields.array("inserts")
        anchor = cls(
            source_sha256=fields.string("source_sha256"),
            reader=fields.string("reader"),
            reader_version=fields.string("reader_version"),
            sheet=fields.raw("sheet"),
            inserts=tuple(inserts),
            handle=fields.raw("handle"),
        )
        fields.done()
        return anchor


@dataclass(frozen=True)
class PdfAnchor:
    """A place on a PDF page: one path by its index in the page's drawing order, and its box."""

    source_sha256: str
    reader: str
    reader_version: str
    page: int
    path_index: int
    box: tuple[float, float, float, float]

    def __post_init__(self) -> None:
        _check_source("pdf anchor", self.source_sha256, self.reader, self.reader_version)
        if not isinstance(self.page, int) or self.page < 1:
            raise ValueError(f"pdf anchor: page counts from 1, got {self.page!r}")
        if not isinstance(self.path_index, int) or self.path_index < 0:
            raise ValueError(f"pdf anchor: path_index counts from 0, got {self.path_index!r}")
        if len(self.box) != 4:
            raise ValueError(f"pdf anchor: box is (x0, y0, x1, y1), got {self.box!r}")

    def to_json(self) -> dict[str, Any]:
        return {
            "kind": "pdf",
            "source_sha256": self.source_sha256,
            "reader": self.reader,
            "reader_version": self.reader_version,
            "page": self.page,
            "path_index": self.path_index,
            "box": [decimal_string(value) for value in self.box],
        }

    @classmethod
    def from_json(cls, data: Mapping[str, object]) -> PdfAnchor:
        fields = _fields(data, "pdf")
        box = fields.array("box")
        if len(box) != 4:
            raise fields.fail("box", "four decimal strings")
        x0, y0, x1, y1 = (from_decimal_string(value, "pdf anchor box") for value in box)
        anchor = cls(
            source_sha256=fields.string("source_sha256"),
            reader=fields.string("reader"),
            reader_version=fields.string("reader_version"),
            page=fields.integer("page"),
            path_index=fields.integer("path_index"),
            box=(x0, y0, x1, y1),
        )
        fields.done()
        return anchor


Anchor = DwgAnchor | PdfAnchor
"""Either anchor; a union, so `isinstance(x, Anchor)` works."""


def _fields(data: object, kind: str) -> Fields:
    fields = Fields(data, f"{kind} anchor")
    if fields.string("kind") != kind:
        raise fields.fail("kind", repr(kind))
    return fields


def anchor_from_json(data: Mapping[str, object]) -> Anchor:
    """Either anchor from its JSON, picked by its `kind`."""
    kind = data.get("kind") if isinstance(data, Mapping) else None
    if kind == "dwg":
        return DwgAnchor.from_json(data)
    if kind == "pdf":
        return PdfAnchor.from_json(data)
    raise ValueError(f"anchor: unknown kind {kind!r}")
