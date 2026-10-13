"""S22-FL5's acceptance, defect 2 (#659): what an architectural plan's storeys mean. m0-screens 6.8:
architectural plans are "floor to floor". An architectural plan with no structural subject reads
`floor_to_floor`; an architectural plan whose subject is a slab or a beam (a slab outline) reads at floor
level; a plan whose title names a ceiling level keeps that meaning; structural plans are unchanged (a
column or shear-wall plan floor to floor, every other at floor level).

The seam: `engine.recognise.views.find` on a hand-built ReadArtefact of the given Discipline
(`drawing.read`). Every title and storey word here is invented.

    uv run pytest engine/recognise/tests/acceptance/ts22fl5 -rf
"""

import pytest

from engine.recognise.types import StoreysMeaning, ViewCandidate, ViewKind

from .drawing import Sheet, plans

AT_FLOOR = "engine.recognise.views.storeys read an architectural plan at floor level"


def plan_of(title: str, discipline: str = "architectural") -> ViewCandidate:
    found = plans(Sheet("A-21", "GENERAL ARRANGEMENT", None, title, discipline))
    assert [v.title for v in found] == [title], f"{title!r} reads as one titled plan"
    return found[0]


@pytest.mark.parametrize(
    ("title", "storeys"),
    [
        ("3RD FLOOR FURNITURE LAYOUT PLAN", ("floor_3",)),
        ("2ND TO 4TH FLOOR DOOR & WINDOW PLAN", ("floor_2", "floor_3", "floor_4")),
        ("3RD FLOOR BATHROOMS QUIXOTIC PLAN", ("floor_3",)),
    ],
    ids=["no-subject", "openings", "toilets"],
)
def test_an_architectural_plan_with_no_structural_subject_reads_floor_to_floor(
    title: str, storeys: tuple[str, ...]
) -> None:
    plan = plan_of(title)

    assert plan.storeys == storeys
    assert plan.storeys_meaning is StoreysMeaning.FLOOR_TO_FLOOR, AT_FLOOR


@pytest.mark.parametrize(
    "title",
    ["3RD FLOOR SLAB OUTLINE PLAN", "3RD FLOOR BEAM LAYOUT PLAN"],
    ids=["slab-outline", "beam"],
)
def test_an_architectural_slab_or_beam_plan_reads_at_floor_level(title: str) -> None:
    plan = plan_of(title)

    assert plan.storeys == ("floor_3",)
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_an_architectural_plan_titled_at_ceiling_level_keeps_ceiling_level() -> None:
    plan = plan_of("CEILING LEVEL DOOR & WINDOW PLAN, 2ND FLOOR")

    assert plan.storeys == ("floor_2",)
    assert plan.storeys_meaning is StoreysMeaning.AT_CEILING_LEVEL


@pytest.mark.parametrize(
    ("title", "meaning"),
    [
        ("3RD FLOOR COLUMN LAYOUT PLAN", StoreysMeaning.FLOOR_TO_FLOOR),
        ("3RD FLOOR SHEAR WALL LAYOUT PLAN", StoreysMeaning.FLOOR_TO_FLOOR),
        ("3RD FLOOR SLAB LAYOUT PLAN", StoreysMeaning.AT_FLOOR_LEVEL),
        ("3RD FLOOR BEAM LAYOUT PLAN", StoreysMeaning.AT_FLOOR_LEVEL),
        ("3RD FLOOR LAYOUT PLAN", StoreysMeaning.AT_FLOOR_LEVEL),
    ],
    ids=["column", "shear-wall", "slab", "beam", "no-subject"],
)
def test_a_structural_plans_meaning_is_unchanged(title: str, meaning: StoreysMeaning) -> None:
    plan = plan_of(title, "structural")

    assert plan.storeys == ("floor_3",)
    assert plan.storeys_meaning is meaning


def test_a_13_fragment_architectural_title_gives_a_floor_to_floor_plan() -> None:
    """Both defects at once: A-39's shape, its one-line title read whole, its storeys floor to floor."""
    title = "2ND, 3RD, 4TH, 5TH, 6TH, 7TH & 8TH FLOOR WORKING-DRAWING FURNITURE LAYOUT PLAN"
    found = plans(Sheet("A-39", "FURNITURE LAYOUT PLAN", None, title))

    assert [(v.title, v.storeys_meaning) for v in found] == [(title, StoreysMeaning.FLOOR_TO_FLOOR)], (
        "engine.recognise.views did not take the one-line title as the plan's title"
    )
    assert found[0].kind is ViewKind.PLAN
