"""S19-B5's acceptance, R2 (a storey's meaning): a plan whose title names "ceiling level" states its
storeys at ceiling level, a `StoreysMeaning` of its own (neither at floor level nor floor to floor), and
19b's `_Drawn` keys the storeys it compares with their meaning. The effect: two consecutive sheets of one
title whose plans both state one storey, one at ceiling level and one at floor level, are `same_title`,
not a Continuation.

The guards (green on the base): a floor-level plan keeps its meaning; two sheets of one title whose plans
both draw one storey at ceiling level still run on; a plan drawn in two halves across two sheets still
runs on.

The meaning's key and its words on the screen are not pinned here: the ticket fixes only that it is a
meaning of its own. Every number, title and storey word here is invented.

    uv run pytest engine/recognise/tests/acceptance/ts19b5
"""

import pytest

from engine.recognise.types import StoreysMeaning

from .drawing import Sheet, compare, continuations, plan_of, same_titles

TITLE = "WATER & SOIL PIPE PLAN, 2ND FLOOR"
STATED = "2ND FLOOR"
AT_FLOOR = "2ND FLOOR SOIL & WASTE PIPE PLAN"
AT_CEILING = "SOIL & WASTE PIPE PLAN AT 2ND FLOOR CEILING LEVEL"

NO_MEANING = "engine.recognise.views.storeys gave ceiling level no meaning of its own"
RAN_ON = "engine.recognise.conflicts ran on over floor and ceiling level"


def sheet(number: str, plan: str) -> Sheet:
    return Sheet(number, TITLE, STATED, plan, (), "plumbing")


@pytest.mark.parametrize(
    "title",
    [AT_CEILING, "CEILING LEVEL SOIL PIPE PLAN, 2ND FLOOR"],
    ids=["ceiling-level-after-the-storey", "ceiling-level-before-the-storey"],
)
def test_a_plan_titled_at_ceiling_level_states_its_storey_at_ceiling_level(title: str) -> None:
    plan = plan_of(sheet("P-12", title))

    assert plan.storeys == ("floor_2",)
    assert isinstance(plan.storeys_meaning, StoreysMeaning)
    assert plan.storeys_meaning not in (
        StoreysMeaning.AT_FLOOR_LEVEL,
        StoreysMeaning.FLOOR_TO_FLOOR,
    ), NO_MEANING


def test_a_plan_of_the_same_storey_not_naming_ceiling_level_stays_at_floor_level() -> None:
    plan = plan_of(sheet("P-11", AT_FLOOR))

    assert plan.storeys == ("floor_2",)
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_one_title_over_a_floor_level_and_a_ceiling_level_plan_of_one_storey_is_same_title() -> None:
    found = compare([sheet("P-11", AT_FLOOR), sheet("P-12", AT_CEILING)])

    assert (continuations(found), same_titles(found)) == ([], [["P-11", "P-12"]]), RAN_ON


def test_one_title_over_two_ceiling_level_plans_of_one_storey_still_runs_on() -> None:
    found = compare(
        [sheet("P-11", AT_CEILING), sheet("P-12", "CEILING LEVEL SOIL PIPE PLAN, 2ND FLOOR")]
    )

    assert continuations(found) == [["P-11", "P-12"]]
    assert same_titles(found) == []


def test_a_plan_drawn_in_two_halves_across_two_sheets_still_runs_on() -> None:
    title, stated = "SLAB OPENING PLAN, 3RD FLOOR", "3RD FLOOR"
    found = compare(
        [
            Sheet("S-31", title, stated, "3RD FLOOR SLAB OPENING PLAN, EAST HALF", ("SCALE 1:100",)),
            Sheet("S-32", title, stated, "3RD FLOOR SLAB OPENING PLAN, WEST HALF", ("SCALE 1:100",)),
        ]
    )

    assert continuations(found) == [["S-31", "S-32"]]
    assert same_titles(found) == []
