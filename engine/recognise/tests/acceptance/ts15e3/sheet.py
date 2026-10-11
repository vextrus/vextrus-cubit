"""S15-E3's invented sheets: one frame in model space at 1:50, drawn by the repo's hand-built `Sheets`
(no toolchain), each view a grid of lines at its paper box, its title 12 mm under it and, when given, a
bracketed storeys line 22 mm under it, as `engine/recognise/tests/test_views.py`'s `model_sheet` draws
them. Every number, title and storey word is invented; they prove mechanics only.

The Sheet's title and its stated storey words are set on the candidate the sheet finder returns
(`dataclasses.replace`), so the test, not the title block's reading, says what the Sheet states.
"""

from dataclasses import dataclass, replace
from typing import Any

from engine.geometry.placement import chain, chain_transform
from engine.read.artefact import ReadArtefact
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import (
    SheetCandidate,
    SheetConventions,
    Sourced,
    StoreyWords,
    ValueSource,
    ViewCandidate,
    ViewKind,
)

SCALE = 50.0
ORIGIN = (10_000.0, 0.0)
PLACES = (
    (40.0, 300.0, 340.0, 560.0),
    (400.0, 300.0, 640.0, 560.0),
    (40.0, 40.0, 340.0, 240.0),
    (400.0, 40.0, 640.0, 240.0),
)
"""Where the views go on the paper (mm), in reading order: top row, then bottom row."""


@dataclass(frozen=True)
class Drawn:
    """A view: its title (None: drawn with no title) and the bracketed line under it (None: none)."""

    title: str | None
    line: str | None = None


@dataclass(frozen=True)
class Read:
    artefact: ReadArtefact
    sheet: SheetCandidate
    views: list[ViewCandidate]
    """The views read, the title block left out."""


def _grid(d: Sheets, box: tuple[float, float, float, float]) -> None:
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1))
        d.line((x0, y), (x1, y))


def read(
    drawn: list[Drawn],
    *,
    number: str = "S-31",
    title: str = "GENERAL ARRANGEMENT",
    stated: str | None = None,
    source_name: str = "invented.dwg",
    **find: Any,
) -> Read:
    """A Sheet numbered `number`, titled `title`, stating the storey words `stated` (None: none), one
    view per entry of `drawn`, read by `views.find(artefact, sheet, default view conventions,
    **find)`."""
    d = Sheets(source_name=source_name)
    block = frame_block(d)
    ox, oy = ORIGIN
    insert = d.insert(block, (ox, oy, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: title, 2: number}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)
    for view, (x0, y0, x1, y1) in zip(drawn, PLACES, strict=False):
        _grid(d, (ox + x0 * SCALE, oy + y0 * SCALE, ox + x1 * SCALE, oy + y1 * SCALE))
        if view.title is not None:
            d.text(view.title, (ox + x0 * SCALE, oy + (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
        if view.line is not None:
            d.text(view.line, (ox + x0 * SCALE, oy + (y0 - 22) * SCALE, 0.0), height=5.0 * SCALE)
    artefact = d.artefact()
    found = sheets.find(artefact, "structural", DEFAULT)
    assert len(found) == 1, "the invented frame is one sheet"
    sheet = replace(
        found[0],
        number=Sourced(number, ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced(title, ValueSource.TITLE_BLOCK_TEXT),
        storeys_as_stated=None if stated is None else Sourced(stated, ValueSource.TITLE_BLOCK_TEXT),
    )
    got = views.find(artefact, sheet, views.default_conventions(), **find)
    shown = [v for v in got if v.kind is not ViewKind.TITLE_BLOCK]
    assert len(shown) == len(drawn), f"each drawn view is read once: {[v.title for v in shown]}"
    return Read(artefact, sheet, shown)


def plans(found: list[ViewCandidate]) -> list[ViewCandidate]:
    return [v for v in found if v.kind is ViewKind.PLAN]


def with_storey_words(storey: str, *words: str) -> SheetConventions:
    """The default sheet conventions with `words` added to `storey`'s words: a Market's vocabulary,
    as data."""
    listed = tuple(
        StoreyWords(s.storey, (*s.words, *words)) if s.storey == storey else s
        for s in DEFAULT.storey_words
    )
    assert any(s.storey == storey for s in listed), f"{storey} is a storey of the default words"
    return replace(DEFAULT, storey_words=listed)
