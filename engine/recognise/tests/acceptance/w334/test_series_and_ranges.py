"""Ticket T-W334's acceptance on 19b's `engine.recognise.conflicts.compare` (#334, #321; the owner's
rulings of 5 Oct 2026, session 13): "one title on several runs that draw different storeys, marks or
members is one series ('N sheets share this title'), no Question; the Question stays when two Sheets
of one title draw the same thing" and "Continuation groups by member-mark range: 'In M0'".

The seam the ticket fixes: `compare` returns `Continuation`s, then `Series`, then `Conflict`s;
`engine.recognise.types.Series(title, sheets)` holds two Sheets or more, in number order, on two runs
or more; `SheetConventions.member_range_pattern` is loaded from `sheet-default.json`; a `same_title` or
`same_storey` Conflict's evidence counts the distinct Sheets it names in `sheets`.

Hand-made candidates under the default sheet conventions (group `set`, Discipline `structural`), read
with 13's own readers. Every title, number and mark is invented.
"""

import itertools
import json
import time
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path
from typing import Any

from engine.recognise import conflicts
from engine.recognise.types import (
    Box,
    Conflict,
    Continuation,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    StoreysMeaning,
    ValueSource,
    ViewCandidate,
    ViewKind,
)

CONV = SheetConventions.from_json(
    json.loads(
        (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(
            encoding="utf-8"
        )
    )
)
_layouts = itertools.count()

type Found = list[Any]
"""What `compare` returns: Continuations, then Series, then Conflicts."""


def sheet(number: str, title: str) -> SheetCandidate:
    return SheetCandidate(
        location=SheetLocation(layout=f"Layout{next(_layouts)}"),
        number=Sourced(number, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        title=Sourced(title, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        discipline=Sourced("structural", ValueSource.FILE),
        group="set",
    )


def plan(title: str, subject: str, *storeys: str) -> ViewCandidate:
    """A plan view of one subject drawn at the storeys' floor levels."""
    return ViewCandidate(
        box=Box(40.0, 60.0, 660.0, 560.0),
        kind=ViewKind.PLAN,
        title=title,
        storeys=storeys,
        storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL if storeys else None,
        subject=subject,
    )


def detail(title: str | None = None, *storeys: str, kind: ViewKind = ViewKind.DETAIL) -> ViewCandidate:
    """A view that is not a plan: its title, and the storeys it states (none: none)."""
    return ViewCandidate(
        box=Box(40.0, 60.0, 660.0, 560.0),
        kind=kind,
        title=title,
        storeys=storeys,
        storeys_meaning=StoreysMeaning.AT_FLOOR_LEVEL if storeys else None,
    )


def compare(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]] | None = None,
    conventions: SheetConventions = CONV,
) -> Found:
    found: Found = conflicts.compare(
        sheets,
        [()] * len(sheets) if views is None else views,
        conventions=conventions,
        recognisers=conflicts.recognisers(conventions),
    )
    return found


def numbers(sheets: Sequence[object]) -> list[str]:
    return [s.number.value for s in sheets if isinstance(s, SheetCandidate) and s.number is not None]


def continuations(found: Found) -> list[list[str]]:
    return [numbers(c.sheets) for c in found if isinstance(c, Continuation)]


def continuation_titles(found: Found) -> list[str]:
    return [c.title for c in found if isinstance(c, Continuation)]


def series(found: Found) -> list[list[str]]:
    """Each Series' Sheets by number (the type is the seam this ticket adds)."""
    from engine.recognise.types import Series  # type: ignore[attr-defined, unused-ignore]

    return [numbers(s.sheets) for s in found if isinstance(s, Series)]


def no_series(found: Found) -> bool:
    """Nothing but Continuations and Conflicts (true on main too: the tripwire cases' check)."""
    return all(isinstance(f, Conflict | Continuation) for f in found)


def conflicts_of(found: Found, kind: str | None = None) -> list[Conflict]:
    return [c for c in found if isinstance(c, Conflict) and (kind is None or c.kind == kind)]


def same_titles(found: Found) -> list[list[str]]:
    return [numbers(c.candidates) for c in conflicts_of(found, conflicts.SAME_TITLE)]


# 1. Runs that follow different floors' layout plans are a series --------------------------------

DETAILS = "BEAM REBAR DETAILS"


def floors_and_their_details() -> tuple[list[SheetCandidate], list[tuple[ViewCandidate, ...]]]:
    """Three floors' framing plans, each followed by a run of one title's details (2, 3 and 1 Sheets),
    the details' own views stating no storey."""
    rows: list[tuple[str, str, tuple[ViewCandidate, ...]]] = [
        (
            "S-31",
            "5TH FLOOR BEAM FRAMING PLAN",
            (plan("5TH FLOOR BEAM FRAMING PLAN", "beam", "floor_5"),),
        ),
        ("S-32", DETAILS, ()),
        ("S-33", DETAILS, ()),
        (
            "S-36",
            "6TH FLOOR BEAM FRAMING PLAN",
            (plan("6TH FLOOR BEAM FRAMING PLAN", "beam", "floor_6"),),
        ),
        ("S-37", DETAILS, ()),
        ("S-38", DETAILS, ()),
        ("S-39", DETAILS, ()),
        (
            "S-42",
            "7TH FLOOR BEAM FRAMING PLAN",
            (plan("7TH FLOOR BEAM FRAMING PLAN", "beam", "floor_7"),),
        ),
        ("S-43", DETAILS, ()),
    ]
    return [sheet(n, t) for n, t, _ in rows], [v for _, _, v in rows]


def test_one_title_on_runs_that_follow_different_floors_layout_plans_is_a_series_and_no_question() -> (
    None
):
    sheets, views = floors_and_their_details()

    found = compare(sheets, views)

    assert continuations(found) == [["S-32", "S-33"], ["S-37", "S-38", "S-39"]]
    assert series(found) == [["S-32", "S-33", "S-37", "S-38", "S-39", "S-43"]]
    assert same_titles(found) == []
    assert conflicts_of(found) == []


def test_compare_returns_continuations_then_series_then_conflicts() -> None:
    sheets, views = floors_and_their_details()
    sheets += [sheet("S-50", "GENERAL NOTES"), sheet("S-50", "GENERAL NOTES")]  # one number twice
    views += [(), ()]

    found = compare(sheets, views)

    from engine.recognise.types import Series  # type: ignore[attr-defined, unused-ignore]

    order = [0 if isinstance(f, Continuation) else 1 if isinstance(f, Series) else 2 for f in found]
    assert order == [0, 0, 1, 2]
    assert [c.kind for c in conflicts_of(found)] == [conflicts.SAME_NUMBER]


# 2. Runs told apart by their own views ----------------------------------------------------------


def test_runs_whose_views_name_different_member_marks_are_a_series() -> None:
    sheets = [sheet(n, "COLUMN DETAILS") for n in ("S-50", "S-51", "S-55")]
    views = [(detail("COLUMN C3"),), (detail("COLUMN C5"),), (detail("COLUMN C12"),)]

    found = compare(sheets, views)

    assert series(found) == [["S-50", "S-51", "S-55"]]
    assert continuations(found) == [["S-50", "S-51"]]
    assert conflicts_of(found) == []


def test_runs_whose_views_state_different_storeys_are_a_series() -> None:
    sheets = [sheet(n, "SUNKEN SLAB DETAILS") for n in ("S-60", "S-61", "S-64")]
    views = [(detail(None, "floor_3"),), (), (detail(None, "floor_8"),)]

    found = compare(sheets, views)

    assert series(found) == [["S-60", "S-61", "S-64"]]
    assert conflicts_of(found) == []


# 3. The Question stays when two runs draw the same thing (green on main: the tripwire) -----------


def test_a_second_run_after_no_new_layout_plan_keeps_the_same_title_question() -> None:
    """Both runs follow the one 5th-floor framing plan: they may draw the same thing."""
    sheets = [
        sheet("S-31", "5TH FLOOR BEAM FRAMING PLAN"),
        sheet("S-32", DETAILS),
        sheet("S-33", DETAILS),
        sheet("S-35", DETAILS),
    ]
    views = [(plan("5TH FLOOR BEAM FRAMING PLAN", "beam", "floor_5"),), (), (), ()]

    found = compare(sheets, views)

    assert same_titles(found) == [["S-32", "S-33", "S-35"]]
    assert continuations(found) == [["S-32", "S-33"]]
    assert no_series(found)


def test_two_runs_whose_views_name_one_storey_keep_the_same_title_question() -> None:
    sheets = [sheet(n, "SUNKEN SLAB DETAILS") for n in ("S-60", "S-61", "S-64")]
    views = [(detail(None, "floor_3"),), (), (detail(None, "floor_3"),)]

    found = compare(sheets, views)

    assert same_titles(found) == [["S-60", "S-61", "S-64"]]
    assert no_series(found)


# 4. Nothing tells the runs apart: the Question stays --------------------------------------------


def test_runs_with_no_views_and_no_earlier_plan_keep_the_same_title_question() -> None:
    """Conservative: what was not read is not different."""
    found = compare([sheet("S-70", "STAIR DETAILS"), sheet("S-74", "STAIR DETAILS")])

    assert same_titles(found) == [["S-70", "S-74"]]
    assert no_series(found)


# 5. A contradicted Sheet far from its title's other Sheets (#102; S19-B4's E2) ------------------


def test_a_sheet_whose_view_contradicts_its_title_far_from_its_title_is_told_apart_by_its_plan() -> None:
    """The runs follow the ground and 1st floor's column plans, but S-16's drawing is stair details
    under a copied "COLUMN REBAR SCHEDULE" title block. S19-B4's E2 (engine/recognise/tests/acceptance/
    ts19b4): a contradicted sheet blocks a series only where it would run on with its title's sheets;
    S-16 runs on with none, so it is told apart like any run (#102's Question stays for a copied title
    block on the next sheet, ts19b4's test_copied_titles)."""
    sheets = [
        sheet("S-11", "GROUND FLOOR COLUMN LAYOUT PLAN"),
        sheet("S-12", "COLUMN REBAR SCHEDULE"),
        sheet("S-15", "1ST FLOOR COLUMN LAYOUT PLAN"),
        sheet("S-16", "COLUMN REBAR SCHEDULE"),
    ]
    views = [
        (plan("GROUND FLOOR COLUMN LAYOUT PLAN", "column", "ground"),),
        (),
        (plan("1ST FLOOR COLUMN LAYOUT PLAN", "column", "floor_1"),),
        (detail("STAIR DETAILS"),),
    ]

    found = compare(sheets, views)

    assert series(found) == [["S-12", "S-16"]]
    assert same_titles(found) == []


# 6-9. Member-mark ranges ------------------------------------------------------------------------


def test_titles_equal_but_for_ascending_member_mark_ranges_are_one_continuation() -> None:
    sheets = [
        sheet("S-17", "LINTEL L3-L8 DETAILS"),
        sheet("S-18", "LINTEL L9-L14 DETAILS"),
        sheet("S-19", "LINTEL L15-L21 DETAILS"),
    ]

    found = compare(sheets)

    assert continuations(found) == [["S-17", "S-18", "S-19"]]
    assert continuation_titles(found) == ["LINTEL L3-L21 DETAILS"]
    assert conflicts_of(found) == []
    assert no_series(found)


def test_a_mark_range_continuation_keeps_its_own_joiner() -> None:
    """An en dash, `TO` and `THRU` join a range as `-` does; the group's title keeps the drawn one."""
    cases = [
        (("WALL W1\u2013W3 DETAILS", "WALL W4\u2013W7 DETAILS"), "WALL W1\u2013W7 DETAILS"),
        (("COLUMN C2 TO C5 SCHEDULE", "COLUMN C6 TO C9 SCHEDULE"), "COLUMN C2 TO C9 SCHEDULE"),
        (("FOOTING F1 THRU F4 DETAILS", "FOOTING F5 THRU F9 DETAILS"), "FOOTING F1 THRU F9 DETAILS"),
    ]
    for (first, second), joined in cases:
        found = compare([sheet("S-24", first), sheet("S-25", second)])

        assert continuations(found) == [["S-24", "S-25"]], first
        assert continuation_titles(found) == [joined]
        assert conflicts_of(found) == []


def test_overlapping_member_mark_ranges_are_no_continuation_and_keep_the_question() -> None:
    sheets = [sheet("S-17", "LINTEL L3-L8 DETAILS"), sheet("S-18", "LINTEL L6-L11 DETAILS")]

    found = compare(sheets)

    assert continuations(found) == []
    assert same_titles(found) == [["S-17", "S-18"]]
    assert no_series(found)


def test_disjoint_ranges_on_numbers_that_do_not_run_on_are_a_series() -> None:
    found = compare([sheet("S-17", "LINTEL L3-L8 DETAILS"), sheet("S-23", "LINTEL L9-L14 DETAILS")])

    assert series(found) == [["S-17", "S-23"]]
    assert continuations(found) == []
    assert conflicts_of(found) == []


def test_one_range_twice_on_numbers_that_do_not_run_on_keeps_the_question() -> None:
    """The same members drawn twice."""
    found = compare([sheet("S-17", "LINTEL L3-L8 DETAILS"), sheet("S-23", "LINTEL L3-L8 DETAILS")])

    assert same_titles(found) == [["S-17", "S-23"]]
    assert no_series(found)


def test_with_no_member_range_pattern_ranged_titles_are_different_titles() -> None:
    plain = replace(CONV, member_range_pattern=None)  # type: ignore[call-arg, unused-ignore]
    sheets = [
        sheet("S-17", "LINTEL L3-L8 DETAILS"),
        sheet("S-18", "LINTEL L9-L14 DETAILS"),
        sheet("S-19", "LINTEL L15-L21 DETAILS"),
    ]

    found = compare(sheets, conventions=plain)

    assert found == []


def test_a_title_with_a_range_never_joins_the_same_words_without_one() -> None:
    assert CONV.member_range_pattern  # type: ignore[attr-defined, unused-ignore]

    found = compare([sheet("S-17", "LINTEL DETAILS"), sheet("S-18", "LINTEL L3-L8 DETAILS")])

    assert found == []


# 10. Hostile titles stay linear -----------------------------------------------------------------

MANY = 2_000
CPU_SECONDS = 1.0
"""What `compare` may spend on `MANY` hostile sheets, in CPU seconds (`time.process_time`): main
spends under a tenth of it on the ranged titles, a throwaway build under half; comparing their runs
pairwise (two million pairs) would spend more."""


def cpu(sheets: Sequence[SheetCandidate], conventions: SheetConventions = CONV) -> tuple[float, Found]:
    start = time.process_time()
    found = compare(sheets, conventions=conventions)
    return time.process_time() - start, found


def test_two_thousand_ascending_ranges_on_consecutive_numbers_are_one_continuation_in_linear_time() -> (
    None
):
    sheets = [sheet(f"S-{n}", f"LINTEL L{2 * n - 1}-L{2 * n} DETAILS") for n in range(1, MANY + 1)]

    spent, found = cpu(sheets)

    assert spent < CPU_SECONDS
    assert [len(run) for run in continuations(found)] == [MANY]
    assert continuation_titles(found) == [f"LINTEL L1-L{2 * MANY} DETAILS"]
    assert conflicts_of(found) == []


def test_two_thousand_overlapping_ranges_are_one_question_in_linear_time() -> None:
    """Each range overlaps the next, so no two join and no two runs draw apart: one Question holds
    them all, found without comparing the runs pairwise."""
    sheets = [sheet(f"S-{n}", f"LINTEL L{n}-L{n + 1} DETAILS") for n in range(1, MANY + 1)]

    spent, found = cpu(sheets)

    assert spent < CPU_SECONDS
    assert continuations(found) == []
    assert [len(c.candidates) for c in conflicts_of(found)] == [MANY]
    assert no_series(found)


def test_three_thousand_disjoint_ranges_apart_are_one_series_in_linear_time() -> None:
    """Every run apart from every other: comparing the runs pairwise (four and a half million pairs)
    would spend more than the bound, so this many."""
    sheets = [sheet(f"S-{2 * n}", f"LINTEL L{2 * n - 1}-L{2 * n} DETAILS") for n in range(1, 3_001)]

    spent, found = cpu(sheets)

    assert spent < CPU_SECONDS
    assert [len(run) for run in series(found)] == [3_000]
    assert continuations(found) == []
    assert conflicts_of(found) == []


def test_two_thousand_long_titles_of_digits_and_dashes_cost_little_beyond_their_normal_form() -> None:
    """Titles of 5,000 digits and dashes. Main's normal form alone spends most of a second on them
    (NFKC and a look-up per character), so the bound is a second beyond twice what normalising the
    titles costs: masking ranges, or reading each title's kind, must not scan a title more than
    linearly, nor read every title where no rule needs it."""
    tail = "-".join(["7351"] * 1_000)
    titles = [f"{n}-{tail}"[:5_000] for n in range(1, MANY + 1)]
    sheets = [sheet(f"S-{n}", title) for n, title in enumerate(titles, start=1)]
    start = time.process_time()
    for title in titles:
        conflicts.normal(title)
    normal_form = time.process_time() - start

    spent, found = cpu(sheets)

    assert spent < 2 * normal_form + CPU_SECONDS
    assert conflicts_of(found) == []
    assert no_series(found)
    assert CONV.member_range_pattern  # type: ignore[attr-defined, unused-ignore]


def test_a_range_with_a_huge_number_is_no_range_and_raises_nothing() -> None:
    sheets = [
        sheet("S-17", "LINTEL L1-L4 DETAILS"),
        sheet("S-18", "LINTEL L99999999999999999999-L1 DETAILS"),
        sheet("S-19", "LINTEL L5-L99999999999999999999 DETAILS"),
    ]

    found = compare(sheets)

    assert continuations(found) == []
    assert conflicts_of(found) == []
    assert CONV.member_range_pattern  # type: ignore[attr-defined, unused-ignore]
