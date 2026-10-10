"""Ticket S19-B4 (Train B, false conflict Questions), E2, on 19b's `engine.recognise.conflicts.compare`:
"a contradicted sheet (copied title block, other subject) blocks a series only if, ignoring the
contradiction, it would have run on from or into another sheet of that title; consecutive copied
titles still raise same_title."

This narrows T-W334's #102 rule for a contradicted sheet on a number that runs on with none of its
title's sheets: it is told apart like any other run, by what it draws (the plan before it). Every
title, number and storey is invented.
"""

from dataclasses import replace

from engine.recognise.types import SheetCandidate, ViewCandidate

from ..w334.test_series_and_ranges import (
    compare,
    conflicts_of,
    continuations,
    no_series,
    same_titles,
    series,
    sheet,
)
from .views import plan, schedule, section

SCHEDULE = "SCHEDULE OF CORE WALLS"
COLUMNS = "COLUMN PLAN, LEVEL 1"
PILES = "PLAN OF PILES"

type Rows = list[tuple[str, str, tuple[ViewCandidate, ...]]]


def built(rows: Rows) -> tuple[list[SheetCandidate], list[tuple[ViewCandidate, ...]]]:
    views = [tuple(replace(v) for v in vs) for _, _, vs in rows]
    return [sheet(n, t) for n, t, _ in rows], views


def test_a_copied_title_on_a_sheet_that_runs_on_with_none_of_its_title_is_told_apart_by_its_plan() -> (
    None
):
    """S-04 carries S-02's title but draws a pile: contradicted. S-04 does not run on from S-02, and
    the plans before them (level 1's columns, the piles) differ: a series, no Question."""
    sheets, views = built(
        [
            ("S-01", COLUMNS, (plan(COLUMNS, "column", "floor_1"),)),
            ("S-02", SCHEDULE, (schedule(), schedule())),
            ("S-03", PILES, (plan(PILES, "pile", "foundation"),)),
            ("S-04", SCHEDULE, (section("PILE, SECTION ALONG"), schedule())),
        ]
    )

    found = compare(sheets, views)

    assert series(found) == [["S-02", "S-04"]]
    assert same_titles(found) == []
    assert conflicts_of(found) == []


def test_a_copied_pile_title_over_a_slab_section_far_from_its_title_is_told_apart_by_its_plan() -> None:
    """S-19 carries S-14's title but draws a slab section; the plans before them are the pile caps'
    and the plinth's tie beams."""
    caps, ties = "PLAN OF PILE CAPS", "PLAN OF TIE BEAMS"
    sheets, views = built(
        [
            ("S-13", caps, (plan(caps, "pile_cap", "pile_cap"),)),
            (
                "S-14",
                "DETAILS OF PILES",
                (section("SPLICE OF PILES"), section("CAP TO PILE CONNECTION")),
            ),
            ("S-18", ties, (plan(ties, "beam", "plinth"),)),
            ("S-19", "DETAILS OF PILES", (section("SECTION THRU SLAB"),)),
        ]
    )

    found = compare(sheets, views)

    assert series(found) == [["S-14", "S-19"]]
    assert conflicts_of(found) == []


def test_a_copied_title_on_the_next_sheet_still_raises_same_title() -> None:
    """Green on main (the tripwire, #102): S-03 would run on from S-02, so its contradiction blocks the
    series and the run."""
    sheets, views = built(
        [
            ("S-01", COLUMNS, (plan(COLUMNS, "column", "floor_1"),)),
            ("S-02", SCHEDULE, (schedule(), schedule())),
            ("S-03", SCHEDULE, (section("PILE, SECTION ALONG"), schedule())),
        ]
    )

    found = compare(sheets, views)

    assert same_titles(found) == [["S-02", "S-03"]]
    assert continuations(found) == []
    assert no_series(found)


def test_a_copied_title_running_into_its_title_s_next_sheet_still_raises_same_title() -> None:
    """Green on main (the tripwire): S-02 is contradicted and would run on into S-03; S-07, far after
    another plan, does not save the series."""
    sheets, views = built(
        [
            ("S-01", COLUMNS, (plan(COLUMNS, "column", "floor_1"),)),
            ("S-02", SCHEDULE, (section("PILE, SECTION ALONG"),)),
            ("S-03", SCHEDULE, (schedule(),)),
            ("S-06", PILES, (plan(PILES, "pile", "foundation"),)),
            ("S-07", SCHEDULE, (schedule(),)),
        ]
    )

    found = compare(sheets, views)

    assert same_titles(found) == [["S-02", "S-03", "S-07"]]
    assert no_series(found)
