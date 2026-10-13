"""Ticket S24-B3's invented sheets: one frame in model space (the hand-built artefact of
engine/recognise/tests/drawing.py, as S22-FL7's sheets), its pieces drawn as grids (lines, no words) or
as a block of loose words in a box (words, few lines), the sheet's title in its title block, its
Discipline given as the Library gives a file's (General a notes Discipline, as the product reads it:
`read_propose.sheets.conventions`). Every title, word and number is invented."""

from collections.abc import Sequence
from dataclasses import replace

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import Sourced, ValueSource, ViewCandidate, ViewKind

SCALE = 50.0
LEFT = (40.0, 300.0, 200.0, 560.0)
MIDDLE = (240.0, 300.0, 400.0, 560.0)
RIGHT = (440.0, 300.0, 600.0, 560.0)
LOWER = (40.0, 60.0, 340.0, 240.0)
WHOLE = (40.0, 60.0, 640.0, 560.0)
GENERAL = "general"

type Box = tuple[float, float, float, float]
type Drawn = tuple[str | None, Box]

WORDS = (
    "ZQ ALPHA BRAVO CHARLIE DELTA ECHO FOXTROT GOLF HOTEL INDIA JULIET KILO LIMA MIKE NOVEMBER "
    "OSCAR PAPA QUEBEC ROMEO SIERRA TANGO UNIFORM VICTOR WHISKEY XRAY YANKEE ZULU"
)
"""Loose invented words, no kind's or heading's: a piece of more words than lines."""


def _grid(d: Sheets, box: Box) -> None:
    x0, y0, x1, y1 = box
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1))
        d.line((x0, y), (x1, y))


def _wordy(d: Sheets, box: Box) -> None:
    """A box of four lines holding many short lines of loose words (more words than lines)."""
    x0, y0, x1, y1 = box
    d.line((x0, y0), (x1, y0))
    d.line((x1, y0), (x1, y1))
    d.line((x1, y1), (x0, y1))
    d.line((x0, y1), (x0, y0))
    rows = 12
    for r in range(rows):
        y = y1 - (y1 - y0) * (r + 1) / (rows + 1)
        d.text(WORDS, (x0 + (x1 - x0) * 0.05, y, 0.0), height=(y1 - y0) / (rows * 3))


def read(
    discipline: str,
    sheet_title: str,
    drawn: Sequence[Drawn],
    wordy: tuple[Box, ...] = (),
    number: str = "G-41",
) -> list[ViewCandidate]:
    """The views (but the title block) 17 reads on a sheet of `discipline` titled `sheet_title`,
    read with the product's view conventions (General a notes Discipline)."""
    d = Sheets()
    block = frame_block(d)
    ox, oy = 10_000.0, 0.0
    insert = d.insert(block, (ox, oy, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: sheet_title, 2: number}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)

    def on(box: Box) -> Box:
        x0, y0, x1, y1 = box
        return (ox + x0 * SCALE, oy + y0 * SCALE, ox + x1 * SCALE, oy + y1 * SCALE)

    for view_title, box in drawn:
        _grid(d, on(box))
        if view_title is not None:
            x0, y0, _, _ = box
            d.text(view_title, (ox + x0 * SCALE, oy + (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
    for box in wordy:
        _wordy(d, on(box))
    found = sheets.find(d.artefact(), None, DEFAULT)
    assert len(found) == 1, "one sheet"
    sheet = replace(found[0], discipline=Sourced(discipline, ValueSource.FILE))
    conventions = replace(views.default_conventions(), notes_disciplines=(GENERAL,))
    read = views.find(d.artefact(), sheet, conventions)
    return [v for v in read if v.kind is not ViewKind.TITLE_BLOCK]
