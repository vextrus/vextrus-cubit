"""S19-B5's invented sheets: one frame in model space at 1:50 per sheet, drawn by the repo's hand-built
`Sheets` (no toolchain), with one plan view: a grid of lines at its paper box, its title 12 mm under it
and each line of its title stack 10 mm below the one before, as `ts15e3/sheet.py` draws them. The views
are read by 17's `views.find` and the sheets compared by 19b's `conflicts.find`, the harness's stages.

Every number, title and storey line here is invented: it keeps only the shape the readers parse (a
title naming its drawing alone, a scale note, then a line of storey words). They prove mechanics only.

The Sheet's number, title and stated storey words are set on the candidate the sheet finder returns
(`dataclasses.replace`), so the test, not the title block's reading, says what the Sheet states.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any

from engine.geometry.placement import chain, chain_transform
from engine.recognise import conflicts, sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import (
    Continuation,
    SheetCandidate,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)

SCALE = 50.0
ORIGIN = (10_000.0, 0.0)
BOX = (40.0, 200.0, 560.0, 560.0)
"""Where the plan goes on the paper (mm): room under it for its title and three lines."""


@dataclass(frozen=True)
class Sheet:
    """One invented sheet: its number, its title block's title and stated storey words (None: it
    states none), its plan's title and the lines under that title, top down."""

    number: str
    title: str
    stated: str | None
    plan: str
    lines: Sequence[str] = ()
    discipline: str = "structural"


def _grid(d: Sheets, box: tuple[float, float, float, float]) -> None:
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1))
        d.line((x0, y), (x1, y))


def read(drawn: Sheet) -> tuple[SheetCandidate, list[ViewCandidate]]:
    """The sheet as the sheet finder reads it (its number, title and storey words as given, its group
    `set`) and the views `views.find` reads on it, its title block left out."""
    d = Sheets(source_name="invented.dwg")
    block = frame_block(d)
    ox, oy = ORIGIN
    insert = d.insert(block, (ox, oy, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: drawn.title, 2: drawn.number}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)
    x0, y0, x1, y1 = BOX
    _grid(d, (ox + x0 * SCALE, oy + y0 * SCALE, ox + x1 * SCALE, oy + y1 * SCALE))
    d.text(drawn.plan, (ox + x0 * SCALE, oy + (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
    for k, line in enumerate(drawn.lines):
        d.text(line, (ox + x0 * SCALE, oy + (y0 - 22 - 10 * k) * SCALE, 0.0), height=5.0 * SCALE)
    artefact = d.artefact()
    found = sheets.find(artefact, drawn.discipline, DEFAULT)
    assert len(found) == 1, "the invented frame is one sheet"
    sheet = replace(
        found[0],
        number=Sourced(drawn.number, ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced(drawn.title, ValueSource.TITLE_BLOCK_TEXT),
        storeys_as_stated=None
        if drawn.stated is None
        else Sourced(drawn.stated, ValueSource.TITLE_BLOCK_TEXT),
        group="set",
    )
    got = views.find(artefact, sheet, views.default_conventions())
    shown = [v for v in got if v.kind is not ViewKind.TITLE_BLOCK]
    assert len(shown) == 1, f"the plan is read once: {[v.title for v in shown]}"
    return sheet, shown


def plan_of(drawn: Sheet) -> ViewCandidate:
    """The plan view read on the sheet."""
    (view,) = read(drawn)[1]
    assert view.kind is ViewKind.PLAN, f"{drawn.plan!r} reads as a plan, not {view.kind}"
    return view


def compare(drawn: Sequence[Sheet]) -> list[Any]:
    """`conflicts.find` (the harness's stage) on the sheets, each with the views read on it."""
    pairs = [read(s) for s in drawn]
    found: list[Any] = conflicts.find([s for s, _ in pairs], [v for _, v in pairs], DEFAULT)
    return found


def _numbers(candidates: Sequence[object]) -> list[str]:
    return [s.number.value for s in candidates if isinstance(s, SheetCandidate) and s.number is not None]


def continuations(found: Sequence[Any]) -> list[list[str]]:
    """Each Continuation's sheet numbers."""
    return [_numbers(c.sheets) for c in found if isinstance(c, Continuation)]


def same_titles(found: Sequence[Any]) -> list[list[str]]:
    """Each `same_title` Conflict's sheet numbers."""
    return [_numbers(c.candidates) for c in found if getattr(c, "kind", None) == conflicts.SAME_TITLE]
