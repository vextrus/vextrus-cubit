"""T-W334's edges beyond its acceptance: member ranges masked and joined, the runs of a series told
apart by one sweep, the plan a run follows, and the member range pattern bounded as data. Every
title, number and mark is invented."""

import itertools
import json
import random
from pathlib import Path
from typing import Any

import pytest

from engine.recognise import conflicts
from engine.recognise.conflicts import member_ranges, range_key
from engine.recognise.tests.candidates import plan, sheet
from engine.recognise.types import (
    MAX_PATTERN_TEXT,
    Continuation,
    Series,
    SheetCandidate,
    SheetConventions,
    ViewCandidate,
)

DEFAULT = json.loads(
    (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(encoding="utf-8")
)
CONV = SheetConventions.from_json(DEFAULT)
PATTERN = CONV.member_range_pattern


def compare(
    sheets: list[SheetCandidate], views: list[tuple[ViewCandidate, ...]] | None = None
) -> list[Any]:
    return list(
        conflicts.compare(
            sheets,
            [()] * len(sheets) if views is None else views,
            conventions=CONV,
            recognisers=conflicts.recognisers(CONV),
        )
    )


def numbers(group: Continuation | Series) -> list[str]:
    return [s.number.value for s in group.sheets if s.number is not None]


# Masking ----------------------------------------------------------------------------------------


def test_ranges_are_masked_wherever_they_lie_and_a_title_with_two_joins_each() -> None:
    first = "W3-W5 WALL AND C1 TO C2 COLUMN DETAILS"
    second = "W6-W9 WALL AND C3 TO C8 COLUMN DETAILS"

    assert range_key(first, PATTERN) == range_key(second, PATTERN)
    assert range_key(first, PATTERN) != range_key("WALL AND COLUMN DETAILS", PATTERN)
    [run] = [
        c for c in compare([sheet("S-03", first), sheet("S-04", second)]) if isinstance(c, Continuation)
    ]
    assert run.title == "W3-W9 WALL AND C1 TO C8 COLUMN DETAILS"


@pytest.mark.parametrize(
    "title",
    [
        "BEAM B6-B1 DETAILS",  # descending
        "BEAM B1-C6 DETAILS",  # two letters
        "BEAM B12345-B12346 DETAILS",  # five digits: the pattern's marks hold four
        "BEAM 2B1-2B6 DETAILS",  # a mark is letters then digits
        "SECTION 1-1",
    ],
)
def test_what_is_no_range_leaves_the_title_as_it_is(title: str) -> None:
    assert member_ranges(title, PATTERN) == ()
    assert range_key(title, PATTERN) == conflicts.normal(title)


def test_a_title_longer_than_a_pattern_runs_on_has_no_range() -> None:
    title = "BEAM B1-B6 " + "X" * MAX_PATTERN_TEXT

    assert member_ranges(title, PATTERN) == ()


def test_a_wider_pattern_still_reads_no_mark_of_running_limit_or_more() -> None:
    wide = r"(?P<a>[A-Z])(?P<low>\d{1,24})-(?P<b>[A-Z])(?P<high>\d{1,24})"
    huge = str(conflicts.RUNNING_LIMIT)

    assert member_ranges(f"B1-B{huge}", wide) == ()
    assert [r.high for r in member_ranges(f"B1-B{huge[:-1]}", wide)] == [int(huge[:-1])]


def test_ranges_of_other_letters_on_consecutive_numbers_are_two_runs_and_a_series() -> None:
    found = compare([sheet("S-40", "BEAM B1-B6 DETAILS"), sheet("S-41", "BEAM C1-C6 DETAILS")])

    assert [numbers(s) for s in found if isinstance(s, Series)] == [["S-40", "S-41"]]
    assert [c for c in found if isinstance(c, Continuation)] == []


# The runs told apart ----------------------------------------------------------------------------


def brute(marks: list[tuple[str, int, int, int]]) -> bool:
    return any(
        a[0] == b[0] and a[3] != b[3] and a[1] <= b[2] and b[1] <= a[2]
        for a, b in itertools.combinations(marks, 2)
    )


def test_the_sweep_finds_an_overlap_exactly_when_two_runs_share_a_mark() -> None:
    chance = random.Random(334)
    for _ in range(2_000):
        marks = []
        for _ in range(chance.randint(0, 7)):
            low = chance.randint(0, 12)
            marks.append((chance.choice("BC"), low, low + chance.randint(0, 4), chance.randint(0, 3)))

        assert conflicts._overlap(list(marks)) == brute(marks), marks


def test_marks_in_a_runs_view_titles_tell_it_apart_but_one_mark_twice_does_not() -> None:
    titles = [("S-50", "STAIR DETAILS"), ("S-54", "STAIR DETAILS")]
    sheets = [sheet(n, t) for n, t in titles]

    apart = compare(sheets, [(plan([], None, title="STAIR ST1"),), (plan([], None, title="STAIR ST2"),)])
    again = compare(
        [sheet(n, t) for n, t in titles],
        [(plan([], None, title="STAIR ST1"),), (plan([], None, title="STAIR ST1 (CONTD)"),)],
    )

    assert [type(f) for f in apart] == [Series]
    assert [f.kind for f in again] == [conflicts.SAME_TITLE]


def test_the_plan_a_run_follows_is_the_nearest_before_it_of_its_prefix() -> None:
    """S1-30 is another prefix's plan: S-35's run follows S-31, as S-33's does."""
    sheets = [
        sheet("S-31", "5TH FLOOR BEAM LAYOUT PLAN"),
        sheet("S-33", "BEAM DETAILS"),
        sheet("S1-34", "6TH FLOOR BEAM LAYOUT PLAN"),
        sheet("S-35", "BEAM DETAILS"),
    ]
    views = [(plan(["floor_5"], "beam"),), (), (plan(["floor_6"], "beam"),), ()]

    found = compare(sheets, views)

    assert [f.kind for f in found] == [conflicts.SAME_TITLE]


def test_a_symbolic_storey_tells_no_run_apart() -> None:
    sheets = [sheet("S-60", "SUNKEN SLAB DETAILS"), sheet("S-64", "SUNKEN SLAB DETAILS")]
    views = [(plan(["typical"], None),), (plan(["floor_8"], None),)]

    assert [f.kind for f in compare(sheets, views)] == [conflicts.SAME_TITLE]


# The pattern, as data ---------------------------------------------------------------------------


def test_a_member_range_pattern_must_name_its_marks_groups() -> None:
    with pytest.raises(ValueError, match="groups"):
        SheetConventions.from_json({**DEFAULT, "member_range_pattern": r"[A-Z]\d-[A-Z]\d"})


def test_a_member_range_pattern_is_bounded_like_every_other() -> None:
    with pytest.raises(ValueError, match="pattern"):
        SheetConventions.from_json(
            {**DEFAULT, "member_range_pattern": r"(?P<a>(B+)+)(?P<low>\d)-(?P<b>B)(?P<high>\d)"}
        )
