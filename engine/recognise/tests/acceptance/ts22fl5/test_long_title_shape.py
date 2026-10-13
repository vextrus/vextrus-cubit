"""S22-FL5's acceptance, defect 1 (#318, M0-FL5), amended after review 2: what makes a one-line text
of 13 to 16 words a view title is its shape on the sheet, not whether it states storeys. Such a line is
a view title when it passes every gate a short title passes (a view kind's word, not numbered, at least
the sheet's median height), stands alone in its column (no other line of the same lettering directly
over or under it; a scale line is not one) and no notes heading claims it. So:

- a long plan title naming a canopy or a cistern and no storey is the plan's title, its scale line
  under it or not;
- a long title stating storeys is read whole, with its storeys;
- a long line under a "NOTE:" heading stays the notes' line: the notes view stays, and the plan beside
  it keeps its own title (or stays untitled);
- a long title in one pane of a sheet ruled into panes is its plan's title;
- two or more long lines of the same lettering stacked one over the other are never a title.

The seam: `engine.recognise.views.find` on a hand-built ReadArtefact (`layout.read`). Every title and
note here is invented; only the shapes are the ticket's.

    uv run pytest engine/recognise/tests/acceptance/ts22fl5 -rf
"""

import pytest

from engine.recognise.types import ViewKind

from .layout import Box, Point, Text, read, titled

PLAN: Box = (40.0, 220.0, 420.0, 520.0)
UNDER: Point = (40.0, 208.0)
"""The plan's title stands 12 mm under its drawing."""

SHORT = "GROUND FLOOR FURNITURE LAYOUT PLAN"
ROOF = (
    "PERGOLA CANOPY AND SKYLIGHT HOOD EDGE PROFILE TOGETHER WITH PERIMETER BEAM ARRANGEMENT LAYOUT PLAN"
)
TANK = "FIRE SUMP AND RAINWATER CISTERN HOPPER PROFILE TOGETHER WITH EDGE BEAM ARRANGEMENT PLAN"
RANGE = "GROUND TO FOURTH FLOOR FURNITURE AND FINISHES LAYOUT PLAN OF RESIDENTIAL BLOCK C"
LIST = "2ND, 3RD, 4TH, 5TH, 6TH, 7TH & 8TH FLOOR WORKING-DRAWING FURNITURE LAYOUT PLAN"
NOTE = "LAYOUTS FOR LEVELS 4TH THROUGH 9TH FOLLOW THE 3RD FLOOR PLAN SAVE FOR KIOSK"
NOTE_2 = "LAYOUTS FOR LEVELS 10TH AND 11TH FOLLOW THE 3RD FLOOR PLAN SAVE FOR ATRIUM"

PANES: list[tuple[Point, Point]] = [
    ((5.0, 5.0), (668.0, 5.0)),
    ((5.0, 297.0), (668.0, 297.0)),
    ((5.0, 589.0), (668.0, 589.0)),
    ((5.0, 5.0), (5.0, 589.0)),
    ((336.0, 5.0), (336.0, 589.0)),
    ((668.0, 5.0), (668.0, 589.0)),
]
"""Three rules across the paper and three down: four panes, the title block beside them."""
PANE_PLAN: Box = (40.0, 80.0, 300.0, 260.0)
"""A plan in the lower-left pane, its title 14 mm under it."""

NOT_TITLED = "engine.recognise.views did not take the long one-line title as the plan's title"
NOTES_LOST = "engine.recognise.views took a notes line as a view title"
STACK_TITLED = "engine.recognise.views took a line of a stack as a view title"


def fragments(text: str) -> int:
    return len("".join(c if c.isalnum() else " " for c in text.casefold()).split())


def test_the_invented_lines_run_13_to_16_words() -> None:
    assert [fragments(t) for t in (ROOF, TANK, RANGE, LIST, NOTE, NOTE_2)] == [14, 13, 13, 13, 14, 14]


@pytest.mark.parametrize("title", [ROOF, TANK], ids=["canopy", "cistern"])
def test_a_long_plan_title_stating_no_storey_is_the_plans_title(title: str) -> None:
    found = read([PLAN], [Text(title, UNDER)])

    assert titled(found) == [(ViewKind.PLAN, title)], NOT_TITLED


def test_a_long_plan_title_with_its_scale_line_under_it_is_the_plans_title() -> None:
    found = read([PLAN], [Text(ROOF, UNDER), Text("SCALE 1:50", (40.0, 195.0), 5.6)])

    assert titled(found) == [(ViewKind.PLAN, ROOF)], NOT_TITLED


def test_a_long_title_stating_a_storey_range_is_read_whole_with_its_storeys() -> None:
    found = read([PLAN], [Text(RANGE, UNDER)])

    assert titled(found) == [(ViewKind.PLAN, RANGE)], NOT_TITLED
    assert found[0].storeys == ("ground", "floor_1", "floor_2", "floor_3", "floor_4")


def test_a_long_line_under_a_note_heading_stays_a_note_beside_a_titled_plan() -> None:
    found = read(
        [PLAN],
        [Text(SHORT, UNDER), Text("NOTE:", (440.0, 500.0), 7.0), Text(NOTE, (440.0, 488.0))],
    )

    assert titled(found) == [(ViewKind.NOTES, "NOTE:"), (ViewKind.PLAN, SHORT)], NOTES_LOST


def test_a_long_line_under_a_note_heading_stays_a_note_beside_an_untitled_plan() -> None:
    found = read([PLAN], [Text("NOTE:", (440.0, 500.0), 7.0), Text(NOTE, (440.0, 488.0))])

    assert titled(found) == [(ViewKind.NOTES, "NOTE:"), (ViewKind.PLAN, None)], NOTES_LOST


@pytest.mark.parametrize("title", [LIST, ROOF], ids=["stating-floors", "stating-no-storey"])
def test_a_long_title_in_a_pane_of_a_ruled_sheet_is_its_plans_title(title: str) -> None:
    found = read([PANE_PLAN], [Text(title, (40.0, 66.0), 5.0)], PANES)

    assert [(v.kind, v.title) for v in found if v.title == title] == [(ViewKind.PLAN, title)], NOT_TITLED


def test_a_plan_titled_in_a_pane_holds_the_storeys_its_title_states() -> None:
    found = read([PANE_PLAN], [Text(LIST, (40.0, 66.0), 5.0)], PANES)
    plans = [v for v in found if v.kind is ViewKind.PLAN and v.title == LIST]

    assert len(plans) == 1, NOT_TITLED
    assert plans[0].storeys == tuple(f"floor_{n}" for n in range(2, 9))


STACKS = {
    "two-titles-under-a-plan": [Text(RANGE, UNDER), Text(LIST, (40.0, 198.0))],
    "a-canopy-and-a-cistern-under-a-plan": [Text(ROOF, UNDER), Text(TANK, (40.0, 198.0))],
    "numbered-under-a-plan": [Text(f"1. {NOTE}", UNDER), Text(f"2. {NOTE_2}", (40.0, 198.0))],
    "three-under-a-plan": [
        Text(NOTE, UNDER),
        Text(NOTE_2, (40.0, 198.0)),
        Text(RANGE, (40.0, 188.0)),
    ],
}


@pytest.mark.parametrize("stack", list(STACKS.values()), ids=list(STACKS))
def test_a_stack_of_long_lines_of_one_lettering_is_never_a_title(stack: list[Text]) -> None:
    found = read([PLAN], stack)
    lines = {t.shown for t in stack}

    assert [v.title for v in found if v.title in lines] == [], STACK_TITLED


def test_a_stack_of_long_lines_beside_a_titled_plan_leaves_the_plan_its_title() -> None:
    found = read([PLAN], [Text(SHORT, UNDER), Text(NOTE, (440.0, 500.0)), Text(NOTE_2, (440.0, 490.0))])

    assert [(v.kind, v.title) for v in found if v.title is not None] == [(ViewKind.PLAN, SHORT)], (
        STACK_TITLED
    )
