"""17's plan boxes (session 08's scored loop): what a plan's box takes in, on invented A1 sheets at 1:1,
proving mechanics only, never a reading (docs/sdlc.md)."""

from engine.recognise.tests.drawing import Sheets
from engine.recognise.tests.test_views import drawn, grid, near, one_sheet
from engine.recognise.types import ViewKind


def test_a_line_running_off_the_sheet_is_no_part_of_a_plan() -> None:
    """A construction line left in the drawing, from the plan up past the frame's top edge."""
    d = Sheets()
    grid(d, (40, 300, 340, 520))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    d.line((200, 520), (200, 700))  # the frame's top is at 594
    (plan,) = drawn(d, one_sheet(d))
    assert plan.kind is ViewKind.PLAN
    assert near(plan.box, (40, 288, 340, 520))


def test_a_plans_box_takes_its_grid_lines_to_their_ends_and_its_marks_beside_it() -> None:
    """Grid lines long enough to read as dividers run past the plan's walls; a section's cut mark
    stands off their end, beside the plan."""
    d = Sheets()
    grid(d, (100, 250, 500, 500))
    d.text("FIRST FLOOR PLAN", (100, 238, 0.0), height=6.0)
    d.line((60, 375), (620, 375))  # a grid line: 560 mm, over 0.6 of the sheet's width
    d.line((635, 400), (650, 400))  # the cut mark, 15 mm off the line's end
    d.line((650, 400), (650, 410))
    d.text("A", (638, 402, 0.0), height=5.0)
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (60, 238, 650, 500))


def test_a_plans_box_grows_into_no_other_view() -> None:
    """A grid line running from the plan into a detail beside it, and a mark nearer the detail."""
    d = Sheets()
    grid(d, (60, 250, 460, 500))
    d.text("FIRST FLOOR PLAN", (60, 238, 0.0), height=6.0)
    grid(d, (560, 300, 700, 450))
    d.text("PILE CAP DETAIL", (560, 288, 0.0), height=6.0)
    d.line((40, 400), (680, 400))  # 640 mm: a divider, into the detail
    d.line((535, 330), (545, 330))  # a mark 75 mm off the plan and 15 mm off the detail
    d.text("B", (537, 332, 0.0), height=5.0)
    plan, detail = drawn(d, one_sheet(d))
    assert (plan.kind, detail.kind) == (ViewKind.PLAN, ViewKind.DETAIL)
    assert plan.box.x1 < detail.box.x0
    assert near(plan.box, (60, 238, 460, 500))
