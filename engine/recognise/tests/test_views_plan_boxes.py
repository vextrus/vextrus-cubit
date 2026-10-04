"""17's plan boxes (session 08's scored loop): what a plan's box takes in, on invented A1 sheets at 1:1,
proving mechanics only, never a reading (docs/sdlc.md)."""

from dataclasses import replace

import numpy as np
import pytest

from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.tests.test_views import CONVENTIONS, drawn, grid, near, one_sheet
from engine.recognise.types import ViewKind


def test_a_line_running_off_the_sheet_is_no_part_of_a_plan() -> None:
    """A construction line left in the drawing, from the plan up past the frame's top edge."""
    d = Sheets()
    grid(d, (40, 300, 340, 520))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    d.line((200, 150), (200, 700))  # 550 mm, over half the sheet's long side; the frame's top is 594
    (plan,) = drawn(d, one_sheet(d))
    assert plan.kind is ViewKind.PLAN
    assert near(plan.box, (40, 288, 340, 520))


def test_a_plan_drawn_to_the_frames_edge_or_past_it_is_still_a_plan() -> None:
    """Refuter, session 08: its lines ending on the edge, or cut there, are its drawing's."""
    for top in (594, 640):
        d = Sheets()
        grid(d, (40, 334, 340, top))
        d.text("GROUND FLOOR PLAN", (40, 322, 0.0), height=6.0)
        (plan,) = drawn(d, one_sheet(d))
        assert near(plan.box, (40, 322, 340, 594))


def test_a_plans_box_grows_into_no_title_block() -> None:
    """Refuter, session 08: a grid line running into the title block's box (the frame's right strip)."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    d.line((40, 430), (0.95 * 841, 430))
    sheet = one_sheet(d)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    (block,) = [v for v in found if v.kind is ViewKind.TITLE_BLOCK]
    (plan,) = [v for v in found if v.kind is ViewKind.PLAN]
    assert plan.box.x1 <= block.box.x0


def test_a_plan_takes_no_untitled_table_one_line_runs_into() -> None:
    """Refuter, session 08: a ruled table with no title (read as a plan by its lines) beside a plan,
    one long line across both: two views."""
    d = Sheets()
    grid(d, (40, 250, 380, 540))
    d.text("FIRST FLOOR PLAN", (40, 238, 0.0), height=6.0)
    grid(d, (470, 300, 640, 460))
    for i in range(8):
        d.text(f"C{i + 1}", (480 + 40 * (i % 4), 310 + 40 * (i // 4), 0.0), height=4.0)
    d.line((30, 400), (650, 400))
    found = drawn(d, one_sheet(d))
    assert len(found) == 2
    assert found[0].box.x1 < 470


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
    assert detail.box.x0 >= 555  # a mark is a plan's only: the detail takes none


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
    """Notes with no title beside a plan (clear of the title block), two grid lines running into them:
    two views."""
    d = Sheets()
    grid(d, (40, 200, 380, 540))
    d.text("FIRST FLOOR PLAN", (40, 188, 0.0), height=6.0)
    for i in range(12):
        d.text(f"{i + 1}. CURE FOR 14 DAYS", (500, 520 - 14 * i, 0.0), height=5.0)
    d.line((30, 400), (580, 400))  # 550 mm: a divider, into the notes
    d.line((30, 450), (580, 450))  # two of them: a grid's
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
    d.line((60, 400), (570, 400))  # 510 mm, reaching farthest left: not weighed (drawn first)
    d.line((90, 350), (620, 350))  # 530 mm
    d.line((100, 300), (650, 300))  # 550 mm, the longest
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (90, 238, 650, 500))


def test_a_diagonal_line_running_off_the_sheet_is_no_part_of_a_plan() -> None:
    """Reviewer, session 08 (F2): a line drawn long but cut short by the frame's edge (about 485 mm
    drawn, 300 on paper), not along the axes: it is judged by its length as drawn."""
    d = Sheets()
    grid(d, (40, 300, 340, 520))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    d.line((200, 400), (200 + 460 * 0.8, 400 + 460 * 0.6 + 40))
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (40, 288, 340, 520))


def test_a_plan_reaches_along_no_grid_line_running_off_the_paper() -> None:
    """A line along the axes, long enough to read as a divider but not as a construction line, from
    under the plan to the frame's top edge: the plan's box does not run along it."""
    d = Sheets()
    grid(d, (40, 300, 340, 520))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    d.line((200, 200), (200, 594))  # 394 mm: over 0.6 of the height, under 0.5 of the long side
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (40, 288, 340, 520))


def test_a_plan_takes_no_mark_off_its_corner_nor_a_long_piece_beside_it() -> None:
    """A mark diagonally off the plan's corner is beside no span of it; a piece beside it longer than
    `PLAN_MARK_MM` is no mark."""
    d = Sheets()
    grid(d, (100, 250, 500, 500))
    d.text("FIRST FLOOR PLAN", (100, 238, 0.0), height=6.0)
    d.line((512, 512), (520, 512))  # off the top right corner, within reach
    d.line((515, 300), (515, 340))  # 40 mm long, 15 mm off its right side
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (100, 238, 500, 500))


def test_a_plan_grows_again_along_the_grid_lines_of_the_plan_it_took() -> None:
    """A plan takes the untitled plan its grid lines run into; the next round, a grid line of the
    taken plan's runs its box farther."""
    d = Sheets()
    grid(d, (100, 300, 400, 540))
    d.text("FIRST FLOOR PLAN", (100, 288, 0.0), height=6.0)
    grid(d, (100, 100, 400, 220))  # the untitled body below
    for x in (150, 250):
        d.line((x, 100), (x, 540))  # 440 mm: dividers, into both
    d.line((100, 160), (660, 160))  # 560 mm, through the untitled body only
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (100, 100, 660, 540))


def test_a_diagonal_line_off_the_sheet_is_judged_as_drawn_beside_rules_in_the_title_block() -> None:
    """Re-check, session 08: short rules inside the title block's strip are left out of the paper's
    lines, and the lengths as drawn must be left out with them, never fall back to the cut length."""
    d = Sheets()
    grid(d, (40, 300, 340, 520))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    d.line((200, 400), (200 + 460 * 0.8, 400 + 460 * 0.6 + 40))
    for y in (60, 80, 100):  # short rules inside the title block's strip
        d.line((0.93 * 841, y), (0.98 * 841, y))
    (plan,) = drawn(d, one_sheet(d))
    assert near(plan.box, (40, 288, 340, 520))


def test_a_papers_lengths_are_one_per_segment() -> None:
    segments = np.array([[1.0, 1.0, 2.0, 2.0], [3.0, 3.0, 4.0, 4.0]])
    with pytest.raises(ValueError, match="one per segment"):
        views._Paper((0.0, 0.0, 10.0, 10.0), segments, [], lengths=np.array([1.0]))
    paper = views._Paper((0.0, 0.0, 10.0, 10.0), segments, [], lengths=np.array([1.0, 2.0]))
    with pytest.raises(ValueError, match="one per segment"):
        replace(paper, segments=segments[:1])
    with pytest.raises(ValueError, match="one per segment"):
        views._off_paper(segments, (0.0, 0.0, 10.0, 10.0), np.array([1.0]))


def test_a_layouts_line_cut_by_its_viewport_is_measured_on_paper_from_the_viewport() -> None:
    """A viewport flush with the frame's top shows part of a plan drawn far taller in model space: its
    grid lines, cut at the paper's top by the viewport, are as long as the viewport shows them (300
    mm), not as drawn (900 mm), so they stay the plan's."""
    d = Sheets()
    block = frame_block(d)
    layout = d.layout("A-01")
    insert = d.insert(block, owner=layout)
    d.attrib(insert, "A-01", value_at(2), height=5.0)
    d.attrib(insert, "FLOOR PLAN", value_at(0), height=5.0)
    grid(d, (0.0, 0.0, 30_000.0, 90_000.0))  # verticals 90 m: 900 mm on paper at 1:100
    d.text("TYPICAL FLOOR PLAN", (100.0, 282.0, 0.0), height=6.0, owner=layout)
    d.entity(
        "VIEWPORT",
        {"id": 2, "center": [250.0, 444.0, 0.0], "width": 400.0, "height": 300.0,
         "view_center_point": [15_000.0, 45_000.0, 0.0], "view_height": 30_000.0},
        owner=layout,
    )  # fmt: skip
    (sheet,) = [
        s for s in sheets.find(d.artefact(), "structural", DEFAULT) if s.location.layout == "A-01"
    ]
    (plan,) = [v for v in views.find(d.artefact(), sheet, CONVENTIONS) if v.kind is ViewKind.PLAN]
    assert plan.title == "TYPICAL FLOOR PLAN"
    assert plan.box.y1 > 590
