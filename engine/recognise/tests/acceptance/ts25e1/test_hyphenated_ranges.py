"""Ticket S25-E1 (G1 walk A f-6, FL9, #763): member-mark ranges written with a hyphen in each mark.

A Structural set's titles may write a member mark as letters, a hyphen and digits ("C-1 TO C-12"); such a
range is read as one range like "C1-C12" and "C1 TO C12" are (T-W334, engine/recognise/conflicts.py
"Member-mark ranges"), so consecutive sheets carrying adjacent ranges group as one Continuation (the M0
plan's item 5). Read through the module's public readers (`member_ranges`, `range_key`, `compare`) and
the default conventions' `member_range_pattern`. Every title and number is invented.
"""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest

from engine.recognise import conflicts
from engine.recognise.conflicts import member_ranges, range_key
from engine.recognise.tests.candidates import sheet
from engine.recognise.types import Conflict, Continuation, SheetConventions

DEFAULT = json.loads(
    (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(encoding="utf-8")
)
CONV = SheetConventions.from_json(DEFAULT)
PATTERN = CONV.member_range_pattern
UNREAD = "a hyphenated member-mark range is not read"


def compare(titles: Sequence[tuple[str, str]]) -> list[Any]:
    sheets = [sheet(number, title) for number, title in titles]
    return list(
        conflicts.compare(
            sheets,
            [()] * len(sheets),
            conventions=CONV,
            recognisers=conflicts.recognisers(CONV),
        )
    )


def spans(title: str) -> list[tuple[int, int]]:
    return [(r.low, r.high) for r in member_ranges(title, PATTERN)]


# A range read -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("title", "low", "high"),
    [
        ("COLUMN C-1 TO C-12 DETAILS", 1, 12),
        ("BEAM B-01 - B-09 DETAILS", 1, 9),
        ("SHEAR WALL SW-1 THRU SW-4 DETAILS", 1, 4),
    ],
)
def test_a_range_of_hyphenated_marks_is_read_as_one_range_with_its_low_and_high(
    title: str, low: int, high: int
) -> None:
    assert spans(title) == [(low, high)], UNREAD


@pytest.mark.parametrize(
    ("title", "low", "high"),
    [
        ("COLUMN C1-C12 DETAILS", 1, 12),
        ("COLUMN C1 TO C12 DETAILS", 1, 12),
        ("SHEAR WALL SW1 THRU SW4 DETAILS", 1, 4),
    ],
)
def test_a_range_of_marks_without_a_hyphen_is_still_read(title: str, low: int, high: int) -> None:
    assert spans(title) == [(low, high)]


def test_a_hyphenated_range_and_the_next_one_are_one_title() -> None:
    first = range_key("COLUMN C-1 TO C-4 DETAILS", PATTERN)
    second = range_key("COLUMN C-5 TO C-8 DETAILS", PATTERN)

    assert first == second, UNREAD
    assert first != range_key("COLUMN DETAILS", PATTERN)


# Not a range ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "title",
    [
        "COLUMN C-1 & C-2 DETAILS",  # two marks listed, not a range
        "S-12",  # a sheet number
        "+10'-0\"",  # a level
        "SLAB AT +10'-0\" TO +20'-0\"",  # levels, no marks
        "SECTION 1-1",
        "COLUMN C-12 TO C-1 DETAILS",  # descending
        "COLUMN C-1 TO B-12 DETAILS",  # two letters
        "BEAM B-12345 TO B-12346 DETAILS",  # five digits: a mark holds four
    ],
)
def test_what_is_not_a_range_of_hyphenated_marks_leaves_the_title_as_it_is(title: str) -> None:
    assert member_ranges(title, PATTERN) == ()
    assert range_key(title, PATTERN) == conflicts.normal(title)


# A continuation ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("titles", "joined"),
    [
        (
            ["COLUMN C-1 TO C-4 DETAILS", "COLUMN C-5 TO C-8 DETAILS", "COLUMN C-9 TO C-12 DETAILS"],
            "COLUMN C-1 TO C-12 DETAILS",
        ),
        (
            ["BEAM B-01 - B-04 DETAILS", "BEAM B-05 - B-08 DETAILS", "BEAM B-09 - B-12 DETAILS"],
            "BEAM B-01 - B-12 DETAILS",
        ),
        (
            [
                "SHEAR WALL SW-1 THRU SW-2 DETAILS",
                "SHEAR WALL SW-3 THRU SW-4 DETAILS",
                "SHEAR WALL SW-5 THRU SW-6 DETAILS",
                "SHEAR WALL SW-7 THRU SW-9 DETAILS",
            ],
            "SHEAR WALL SW-1 THRU SW-9 DETAILS",
        ),
    ],
)
def test_consecutive_sheets_of_adjacent_hyphenated_ranges_group_as_one_continuation(
    titles: list[str], joined: str
) -> None:
    numbers = [f"S-{n}" for n in range(71, 71 + len(titles))]
    found = compare(list(zip(numbers, titles, strict=True)))

    runs = [c for c in found if isinstance(c, Continuation)]
    grouped = [[s.number.value for s in r.sheets if s.number is not None] for r in runs]
    assert grouped == [numbers], UNREAD
    assert runs[0].title == joined
    assert [c for c in found if isinstance(c, Conflict) and c.kind == "same_title"] == []


def test_hyphenated_ranges_that_overlap_do_not_run_on() -> None:
    found = compare(
        [
            ("S-71", "COLUMN C-1 TO C-6 DETAILS"),
            ("S-72", "COLUMN C-4 TO C-9 DETAILS"),
            ("S-73", "COLUMN C-10 TO C-12 DETAILS"),
        ]
    )

    assert not any(isinstance(c, Continuation) and len(c.sheets) == 3 for c in found)
