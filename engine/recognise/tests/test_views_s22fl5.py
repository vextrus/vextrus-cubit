"""S22-FL5's builder tests: what a plan's storeys mean by its sheet's Discipline, on the paths the
acceptance cases leave out (a storeys line under the title, the sheet title's storeys taken by its only
plan, a Discipline other than Architectural and Structural). The acceptance cases are in
`engine/recognise/tests/acceptance/ts22fl5/`; their invented sheets are reused here. Every title and
storey word is invented.

    uv run pytest engine/recognise/tests/test_views_s22fl5.py
"""

import pytest

from engine.recognise.tests.acceptance.ts22fl5.drawing import Sheet, plans
from engine.recognise.types import StoreysMeaning, StoreysSource, ViewKind
from engine.recognise.views import storeys


@pytest.mark.parametrize(
    ("discipline", "meaning"),
    [
        ("architectural", StoreysMeaning.FLOOR_TO_FLOOR),
        ("structural", StoreysMeaning.AT_FLOOR_LEVEL),
        ("plumbing", StoreysMeaning.AT_FLOOR_LEVEL),
        (None, StoreysMeaning.AT_FLOOR_LEVEL),
    ],
)
def test_a_storeys_line_under_the_title_means_what_the_discipline_says(
    discipline: str | None, meaning: StoreysMeaning
) -> None:
    found = storeys.read(
        "TOILET LAYOUT PLAN", ViewKind.PLAN, "toilet", ["2ND TO 6TH FLOOR"], discipline=discipline
    )

    assert found.source is StoreysSource.TITLE_LINE
    assert found.meaning is meaning


@pytest.mark.parametrize("subject", ["slab", "beam"])
def test_an_architectural_slab_or_beam_plans_line_reads_at_floor_level(subject: str) -> None:
    found = storeys.read(
        "PART PLAN", ViewKind.PLAN, subject, ["(2ND TO 6TH FLOOR)"], discipline="architectural"
    )

    assert found.meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_a_column_plan_runs_floor_to_floor_in_every_discipline() -> None:
    for discipline in ("architectural", "structural", "plumbing", None):
        found = storeys.read("3RD FLOOR COLUMN PLAN", ViewKind.PLAN, "column", discipline=discipline)
        assert found.meaning is StoreysMeaning.FLOOR_TO_FLOOR, discipline


def test_an_architectural_sheets_only_plan_takes_its_titles_storeys_floor_to_floor() -> None:
    (plan,) = plans(Sheet("A-31", "FURNITURE LAYOUT, 7TH FLOOR", "7TH FLOOR", "FURNITURE LAYOUT PLAN"))

    assert plan.storeys == ("floor_7",)
    assert plan.storeys_source is StoreysSource.SHEET_TITLE
    assert plan.storeys_meaning is StoreysMeaning.FLOOR_TO_FLOOR


def test_an_architectural_sheets_only_slab_plan_takes_its_titles_storeys_at_floor_level() -> None:
    (plan,) = plans(Sheet("A-32", "SLAB OUTLINE, 7TH FLOOR", "7TH FLOOR", "SLAB OUTLINE PLAN"))

    assert plan.storeys_source is StoreysSource.SHEET_TITLE
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_a_structural_sheets_only_plan_takes_its_titles_storeys_as_before() -> None:
    (plan,) = plans(
        Sheet("S-31", "FRAMING LAYOUT, 7TH FLOOR", "7TH FLOOR", "FRAMING LAYOUT PLAN", "structural")
    )

    assert plan.storeys_source is StoreysSource.SHEET_TITLE
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


@pytest.mark.parametrize(
    "title",
    ["3RD FLOOR WATER TANK BOTTOM SLAB OUTLINE PLAN", "3RD FLOOR STAIR AND BEAM LAYOUT PLAN"],
    ids=["tank-then-slab", "stair-then-beam"],
)
def test_an_architectural_plan_naming_a_slab_or_beam_after_another_subject_reads_at_floor_level(
    title: str,
) -> None:
    """The subject is the title's first ("tank", "stair"); a slab or beam it names later still puts
    the plan at its floor's level."""
    (plan,) = plans(Sheet("A-33", "GENERAL ARRANGEMENT", None, title))

    assert plan.storeys == ("floor_3",)
    assert plan.subject in {"tank", "stair"}
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_an_architectural_sheets_only_tank_slab_plan_takes_its_titles_storeys_at_floor_level() -> None:
    (plan,) = plans(
        Sheet("A-34", "WATER TANK, 7TH FLOOR", "7TH FLOOR", "WATER TANK BOTTOM SLAB OUTLINE PLAN")
    )

    assert plan.storeys_source is StoreysSource.SHEET_TITLE
    assert plan.subject == "tank"
    assert plan.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


def test_an_architectural_tank_plan_naming_no_slab_or_beam_runs_floor_to_floor() -> None:
    (plan,) = plans(Sheet("A-35", "GENERAL ARRANGEMENT", None, "3RD FLOOR WATER TANK LAYOUT PLAN"))

    assert plan.subject == "tank"
    assert plan.storeys_meaning is StoreysMeaning.FLOOR_TO_FLOOR
