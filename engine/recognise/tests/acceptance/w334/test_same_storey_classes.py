"""Ticket T-W334's acceptance on `same_storey` and the counts (#232's engine half; the owner's ruling of
5 Oct 2026: "same_storey never compares a layout Sheet's plan with a details Sheet's plan Views").

A Sheet's class is read from its title: a details Sheet's title reads as a detail, a section or a
schedule; every other title (a plan's, or one naming no kind) is a layout Sheet's. Plan Views compare
only within a class. A `same_title` or `same_storey` Conflict's evidence counts its distinct Sheets in
`sheets` (`same_storey` keeps `views`). Every title, number and storey is invented.
"""

from collections.abc import Sequence

from engine.recognise import conflicts
from engine.recognise.types import Conflict, SheetCandidate, ViewCandidate

from .test_series_and_ranges import Found, compare, conflicts_of, numbers, plan, sheet


def same_storeys(found: Found) -> list[Conflict]:
    return conflicts_of(found, conflicts.SAME_STOREY)


def sheets_named(
    conflict: Conflict, sheets: Sequence[SheetCandidate], views: Sequence[Sequence[ViewCandidate]]
) -> list[str]:
    """The numbers of the Sheets whose views a `same_storey` Conflict names."""
    held = {id(v) for v in conflict.candidates}
    return [
        s.number.value
        for s, vs in zip(sheets, views, strict=True)
        if s.number and any(id(v) in held for v in vs)
    ]


FOOTINGS = "FOOTING PLAN"


# 11. A layout Sheet's plan is never compared with a details Sheet's plan Views -------------------


def test_a_layout_plan_and_the_details_that_enlarge_it_are_not_two_plans_of_one_storey() -> None:
    sheets = [
        sheet("S-05", "FOOTING LAYOUT PLAN"),
        sheet("S-06", "FOOTING REINFORCEMENT DETAILS"),
        sheet("S-07", "FOOTING REINFORCEMENT DETAILS"),
    ]
    views = [(plan(FOOTINGS, "foundation", "foundation"),) for _ in sheets]

    found = compare(sheets, views)

    assert same_storeys(found) == []
    assert conflicts_of(found) == []


def test_a_layout_plan_and_a_schedule_or_section_sheets_plan_view_are_not_compared() -> None:
    for title in ("FOOTING SCHEDULE", "FOOTING SECTIONS"):
        sheets = [sheet("S-05", "FOOTING LAYOUT PLAN"), sheet("S-09", title)]
        views = [(plan(FOOTINGS, "foundation", "foundation"),) for _ in sheets]

        assert same_storeys(compare(sheets, views)) == [], title


# 12. The unchanged edges ------------------------------------------------------------------------


def test_two_layout_sheets_drawing_one_subject_and_storey_still_raise_same_storey() -> None:
    sheets = [sheet("S-05", "FOOTING LAYOUT PLAN"), sheet("S-09", "FOOTING SETTING OUT PLAN")]
    views = [(plan(FOOTINGS, "foundation", "foundation"),) for _ in sheets]

    [conflict] = same_storeys(compare(sheets, views))

    assert sheets_named(conflict, sheets, views) == ["S-05", "S-09"]


def test_two_details_sheets_on_numbers_that_do_not_run_on_still_raise_same_storey() -> None:
    sheets = [sheet("S-06", "FOOTING REINFORCEMENT DETAILS"), sheet("S-12", "FOOTING SECTION DETAILS")]
    views = [(plan(FOOTINGS, "foundation", "foundation"),) for _ in sheets]

    [conflict] = same_storeys(compare(sheets, views))

    assert sheets_named(conflict, sheets, views) == ["S-06", "S-12"]


def test_sheets_whose_titles_name_no_kind_compare_as_layout_sheets() -> None:
    for other in ("SLAB BOTTOM BARS", "2ND FLOOR SLAB LAYOUT PLAN"):
        sheets = [sheet("S-05", "SLAB REINFORCEMENT"), sheet("S-09", other)]
        views = [(plan("2ND FLOOR SLAB", "slab", "floor_2"),) for _ in sheets]

        [conflict] = same_storeys(compare(sheets, views))

        assert sheets_named(conflict, sheets, views) == ["S-05", "S-09"], other


# 13. The counts agree ---------------------------------------------------------------------------


def test_a_same_storey_conflict_counts_its_views_and_its_sheets() -> None:
    """Three plan views on two Sheets: S-05 holds two of them."""
    sheets = [
        sheet("S-05", "4TH FLOOR SLAB LAYOUT PLAN"),
        sheet("S-09", "4TH FLOOR SLAB REINFORCEMENT PLAN"),
    ]
    views = [
        (
            plan("4TH FLOOR SLAB (PART A)", "slab", "floor_4"),
            plan("4TH FLOOR SLAB (PART B)", "slab", "floor_4"),
        ),
        (plan("4TH FLOOR SLAB", "slab", "floor_4"),),
    ]

    [conflict] = same_storeys(compare(sheets, views))

    assert conflict.evidence["views"] == 3
    assert conflict.evidence["sheets"] == 2


def test_a_same_title_conflict_counts_its_sheets() -> None:
    sheets = [sheet(n, "STAIR DETAILS") for n in ("S-70", "S-71", "S-74")]

    [conflict] = conflicts_of(compare(sheets), conflicts.SAME_TITLE)

    assert numbers(conflict.candidates) == ["S-70", "S-71", "S-74"]
    assert conflict.evidence["sheets"] == 3
