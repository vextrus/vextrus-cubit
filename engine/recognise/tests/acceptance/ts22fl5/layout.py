"""S22-FL5's invented sheets with more on them than one plan: plans (each a grid of lines in a paper
box), texts placed anywhere on the paper, and rules (straight lines on the paper, a sheet's panes),
drawn by the repo's hand-built `Sheets` (no toolchain) in one A1 frame at 1:50, as `drawing.py` draws
its one plan. Places and heights are paper millimetres; a text's place is its insertion point.

Every title, note and number here is invented: it keeps only the shape the reader parses. They prove
mechanics only.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import Sourced, ValueSource, ViewCandidate, ViewKind

from .drawing import ORIGIN, SCALE

Box = tuple[float, float, float, float]
Point = tuple[float, float]


@dataclass(frozen=True)
class Text:
    """One line of text: its words, its insertion point and its height (paper mm)."""

    shown: str
    at: Point
    height: float = 6.0


def _paper(p: Point) -> tuple[float, float, float]:
    return (ORIGIN[0] + p[0] * SCALE, ORIGIN[1] + p[1] * SCALE, 0.0)


def _grid(d: Sheets, box: Box) -> None:
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line(_paper((x, y0))[:2], _paper((x, y1))[:2])
        d.line(_paper((x0, y))[:2], _paper((x1, y))[:2])


def read(
    plans: Sequence[Box],
    texts: Sequence[Text],
    rules: Sequence[tuple[Point, Point]] = (),
    discipline: str = "architectural",
) -> list[ViewCandidate]:
    """Every view `views.find` reads on the sheet (its title block left out); the sheet's number
    and title as the test gives them, the sheet stating no storeys of its own."""
    d = Sheets(source_name="invented.dwg")
    block = frame_block(d)
    insert = d.insert(block, _paper((0.0, 0.0)), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, shown in {0: "FLOOR PLANS", 2: "A-12"}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(shown, (x, y, 0.0), height=5.0 * SCALE)
    for box in plans:
        _grid(d, box)
    for a, b in rules:
        d.line(_paper(a)[:2], _paper(b)[:2])
    for t in texts:
        d.text(t.shown, _paper(t.at), height=t.height * SCALE)
    artefact = d.artefact()
    found = sheets.find(artefact, discipline, DEFAULT)
    assert len(found) == 1, "the invented frame is one sheet"
    sheet = replace(
        found[0],
        number=Sourced("A-12", ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced("FLOOR PLANS", ValueSource.TITLE_BLOCK_TEXT),
        storeys_as_stated=None,
        group="set",
    )
    got = views.find(artefact, sheet, views.default_conventions())
    return [v for v in got if v.kind is not ViewKind.TITLE_BLOCK]


def titled(found: Sequence[ViewCandidate]) -> list[tuple[ViewKind, str | None]]:
    """Each view's kind and title, in a fixed order (the reading order is not the promise)."""
    return sorted(((v.kind, v.title) for v in found), key=lambda p: (p[0].value, p[1] or ""))
