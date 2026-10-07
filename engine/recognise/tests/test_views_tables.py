"""17's ruled tables (session 10's scored loop 2): a table ruled with rules long enough to read as
dividers is one view, on invented A1 sheets at 1:1, proving mechanics only, never a reading
(docs/sdlc.md)."""

import numpy as np
from numpy.typing import NDArray

from engine.recognise import views
from engine.recognise.tests.drawing import Sheets
from engine.recognise.tests.test_views import drawn, grid, near, one_sheet
from engine.recognise.types import ViewKind
from engine.recognise.views import paper as on_paper
from engine.recognise.views.segment import pieces as pieces_part

TABLE = (30.0, 60.0, 560.0, 560.0)  # 530 by 500 mm: its rules over 0.6 of the A1 frame's sides


def ruled(
    d: Sheets, box: tuple[float, float, float, float], rows: int, columns: int, run: float = 0
) -> None:
    """A table's rules, each across running `run` mm past its sides, and a drawing in each cell."""
    x0, y0, x1, y1 = box
    for i in range(rows + 1):
        y = y0 + (y1 - y0) * i / rows
        d.line((x0 - run, y), (x1 + run, y))
    for j in range(columns + 1):
        x = x0 + (x1 - x0) * j / columns
        d.line((x, y0), (x, y1))
    for i in range(rows):
        for j in range(columns):
            cx = x0 + (x1 - x0) * (j + 0.5) / columns
            cy = y0 + (y1 - y0) * (i + 0.5) / rows
            grid(d, (cx - 20, cy - 20, cx + 20, cy + 20))
            d.text(f"C{i}{j}", (cx - 20, cy - 35, 0.0), height=4.0)


def test_a_ruled_table_with_no_title_is_one_schedule() -> None:
    """A schedule drawn as a table: four rows, four columns, a section in each cell."""
    d = Sheets()
    ruled(d, TABLE, 4, 4)
    (table,) = drawn(d, one_sheet(d))
    assert table.kind is ViewKind.SCHEDULE
    assert near(table.box, TABLE)


def test_a_ruled_table_takes_the_schedule_title_over_it() -> None:
    d = Sheets()
    ruled(d, TABLE, 4, 4)
    d.text("BOLT SCHEDULE", (30, 566, 0.0), height=6.0)
    (table,) = drawn(d, one_sheet(d))
    assert table.kind is ViewKind.SCHEDULE
    assert table.title == "BOLT SCHEDULE"
    assert near(table.box, (30, 60, 560, 572))


def test_a_grid_of_dividers_between_titled_drawings_is_no_table() -> None:
    """The same rules dividing details each titled in its cell: the details stay views of their own."""
    d = Sheets()
    ruled(d, TABLE, 2, 2)
    for i, (x, y) in enumerate(((70, 120), (340, 120), (70, 370), (340, 370))):
        grid(d, (x, y + 20, x + 150, y + 150))
        d.text(f"DETAIL {i + 1}", (x, y + 8, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    assert all(v.kind is not ViewKind.SCHEDULE for v in found)
    assert sum(v.kind is ViewKind.DETAIL for v in found) == 4


def test_rules_running_past_the_tables_sides_rule_no_table() -> None:
    """Rules across running 60 mm past the rules down at both ends: dividers, not a table's."""
    d = Sheets()
    ruled(d, TABLE, 4, 4, run=60)
    assert pieces_part._tables(_segments(d), (0.0, 0.0, 841.0, 594.0)) == []


def test_too_few_rules_rule_no_table() -> None:
    d = Sheets()
    ruled(d, TABLE, 1, 4)  # two rules across
    assert pieces_part._tables(_segments(d), (0.0, 0.0, 841.0, 594.0)) == []
    d = Sheets()
    ruled(d, TABLE, 2, 2)
    assert pieces_part._tables(_segments(d), (0.0, 0.0, 841.0, 594.0)) == [TABLE]


def _segments(d: Sheets) -> NDArray[np.float64]:
    """The sheet's segments on paper."""
    artefact = d.artefact()
    paper = on_paper._paper(artefact, one_sheet(d), views.ViewBudget(artefact))
    assert paper is not None
    return paper.segments


def test_a_schedule_heading_takes_the_table_under_it_not_the_drawing_over_it() -> None:
    """A heading names its content under it: a drawing 4 mm over "SIGN SCHEDULE", its table under."""
    d = Sheets()
    grid(d, (400, 420, 600, 500))  # the drawing over the heading
    d.text("SIGN SCHEDULE", (400, 490 - 84, 0.0), height=6.0)
    grid(d, (400, 300, 600, 400))  # the table, 6 mm under the heading's baseline
    found = drawn(d, one_sheet(d))
    (schedule,) = [v for v in found if v.kind is ViewKind.SCHEDULE]
    assert near(schedule.box, (400, 300, 600, 412))


def test_grid_lines_running_past_each_other_to_their_marks_are_no_table() -> None:
    """Refuter, loop 2 (40): a plan's grid lines, five each way, each 8 mm past the outermost."""
    d = Sheets()
    x0, y0, x1, y1 = 40.0, 60.0, 600.0, 520.0
    for i in range(5):
        y = y0 + (y1 - y0) * i / 4
        d.line((x0 - 8, y), (x1 + 8, y))
        x = x0 + (x1 - x0) * i / 4
        d.line((x, y0 - 8), (x, y1 + 8))
    grid(d, (100, 100, 300, 300))  # walls
    assert pieces_part._tables(_segments(d), (0.0, 0.0, 841.0, 594.0)) == []
    assert all(v.kind is not ViewKind.SCHEDULE for v in drawn(d, one_sheet(d)))


def test_a_ruled_area_of_notes_is_no_table() -> None:
    """Review 1, loop 2 (55): notes in three columns inside one box split by two full-height
    dividers, a band across the top, no drawing: three notes views, no schedule over them."""
    d = Sheets()
    x0, y0, x1, y1 = 20, 30, 650, 570
    for x in (x0, 230, 440, x1):
        d.line((x, y0), (x, y1))
    for y in (y0, 540, y1):
        d.line((x0, y), (x1, y))
    for c, x in enumerate((30, 240, 450)):
        d.text("NOTES :", (x, 520, 0.0), height=4.0)
        for i in range(12):
            d.text(f"{i + 1}. A LINE OF WORDS {c}", (x, 510 - 7 * i, 0.0), height=2.8)
    found = drawn(d, one_sheet(d))
    assert not [v for v in found if v.kind is ViewKind.SCHEDULE]
    assert len([v for v in found if v.kind is ViewKind.NOTES]) == 3
