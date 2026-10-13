"""S22-FL5's acceptance, defect 1 (#318, G1 blocker M0-FL5): a plan's view title of one line, a
comma-joined floor list and hyphenated words making 13 to 16 alphanumeric fragments, is taken as the
plan's title. The sheet then gives one plan view, titled, with the storeys its title states (on main such
a line is no title: the drawing reads untitled and its storeys "not stated"). A line of 17 fragments or
more is still not a title (a paragraph).

The seam: `engine.recognise.views.find` on a hand-built ReadArtefact (`drawing.read`), the sheet stating
no storeys of its own, so every storey a plan holds is its own title's. Every title and storey word here
is invented; the fragment counts are the ticket's.

    uv run pytest engine/recognise/tests/acceptance/ts22fl5 -rf
"""

from engine.recognise.types import ViewKind

from .drawing import Sheet, read

THIRTEEN = "2ND, 3RD, 4TH, 5TH, 6TH, 7TH & 8TH FLOOR WORKING-DRAWING FURNITURE LAYOUT PLAN"
SIXTEEN = (
    "2ND, 3RD, 4TH, 5TH, 6TH, 7TH, 8TH, 9TH, 10TH & 11TH FLOOR WORKING-DRAWING FURNITURE LAYOUT PLAN"
)
SEVENTEEN = (
    "TYPICAL 2ND, 3RD, 4TH, 5TH, 6TH, 7TH, 8TH, 9TH, 10TH & 11TH FLOOR WORKING-DRAWING FURNITURE"
    " LAYOUT PLAN"
)

NOT_TITLED = "engine.recognise.views did not take the one-line title as the plan's title"


def fragments(text: str) -> int:
    return len("".join(c if c.isalnum() else " " for c in text.casefold()).split())


def sheet(plan: str) -> Sheet:
    return Sheet("A-39", "FURNITURE LAYOUT PLAN", None, plan)


def test_the_invented_titles_hold_the_fragment_counts_the_ticket_names() -> None:
    assert (fragments(THIRTEEN), fragments(SIXTEEN), fragments(SEVENTEEN)) == (13, 16, 17)


def test_a_one_line_plan_title_of_13_fragments_gives_one_plan_titled_by_it() -> None:
    _, found = read(sheet(THIRTEEN))

    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, THIRTEEN)], NOT_TITLED


def test_a_plan_titled_by_13_fragments_holds_the_storeys_its_title_states() -> None:
    _, found = read(sheet(THIRTEEN))
    plans = [v for v in found if v.kind is ViewKind.PLAN and v.title == THIRTEEN]

    assert len(plans) == 1, NOT_TITLED
    assert plans[0].storeys == tuple(f"floor_{n}" for n in range(2, 9))


def test_a_one_line_plan_title_of_16_fragments_gives_one_plan_titled_by_it() -> None:
    _, found = read(sheet(SIXTEEN))

    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, SIXTEEN)], NOT_TITLED


def test_a_plan_titled_by_16_fragments_holds_the_storeys_its_title_states() -> None:
    _, found = read(sheet(SIXTEEN))
    plans = [v for v in found if v.kind is ViewKind.PLAN and v.title == SIXTEEN]

    assert len(plans) == 1, NOT_TITLED
    assert plans[0].storeys == tuple(f"floor_{n}" for n in range(2, 12))


def test_a_line_of_17_fragments_is_still_not_a_title() -> None:
    _, found = read(sheet(SEVENTEEN))

    assert [v.title for v in found if v.title == SEVENTEEN] == []
    assert all(v.storeys == () for v in found)
