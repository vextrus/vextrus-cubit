"""17's plan boxes (session 08's scored loop): what a plan's box takes in, on invented A1 sheets at 1:1,
proving mechanics only, never a reading (docs/sdlc.md)."""

import pytest

from engine.recognise import views
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


def test_a_plan_cut_apart_where_its_grid_was_taken_out_is_one_plan() -> None:
    """A plan's body, apart from the row of grid ends its title lies under, joined only by grid lines
    long enough to read as dividers: one plan, its box both."""
    d = Sheets()
    grid(d, (100, 250, 500, 540))  # the body, 50 mm over the row
    for x in (100, 200, 300, 400, 500):
        d.line((x, 150), (x, 200))  # the grid's ends and their bubbles' row
    d.line((100, 175), (500, 175))
    d.text("FIRST FLOOR PLAN", (100, 138, 0.0), height=6.0)
    for x in (150, 250, 350, 450):
        d.line((x, 150), (x, 540))  # 390 mm: over 0.6 of the sheet's height
    (plan,) = drawn(d, one_sheet(d))
    assert (plan.kind, plan.title) == (ViewKind.PLAN, "FIRST FLOOR PLAN")
    assert near(plan.box, (100, 138, 500, 540))


def test_a_plan_takes_no_notes_its_grid_lines_run_into() -> None:
    """Notes with no title beside a plan, a grid line running into them: two views."""
    d = Sheets()
    grid(d, (60, 200, 400, 540))
    d.text("FIRST FLOOR PLAN", (60, 188, 0.0), height=6.0)
    for i in range(12):
        d.text(f"{i + 1}. ALL WORK TO THE ENGINEER'S APPROVAL", (560, 520 - 14 * i, 0.0), height=5.0)
    d.line((40, 400), (620, 400))  # 580 mm: a divider, into the notes
    found = drawn(d, one_sheet(d))
    assert [v.kind for v in found] == [ViewKind.PLAN, ViewKind.NOTES]
    assert found[0].box.x1 < found[1].box.x0


def test_a_plan_grows_along_at_most_its_longest_grid_lines_per_round(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A hostile sheet may rule any number of long lines across a plan: a round weighs only the
    longest `MAX_REACH_LINES`, and there are at most `MAX_REACH_ROUNDS` rounds."""
    monkeypatch.setattr(views, "MAX_REACH_LINES", 2)
    monkeypatch.setattr(views, "MAX_REACH_ROUNDS", 1)
    d = Sheets()
    grid(d, (100, 250, 500, 500))
    d.text("FIRST FLOOR PLAN", (100, 238, 0.0), height=6.0)
    d.line((100, 300), (650, 300))  # 550 mm, the longest
    d.line((90, 350), (620, 350))  # 530 mm
    d.line((60, 400), (570, 400))  # 510 mm, reaching farthest left: not weighed
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (90, 238, 650, 500))
