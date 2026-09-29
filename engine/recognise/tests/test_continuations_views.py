"""17's edits to 19b's continuations (#100, #102), on the real sets' classes, with invented titles:
a view title that names no subject is no evidence against its title block."""

import itertools
import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from engine.recognise import conflicts
from engine.recognise.types import (
    Box,
    Conflict,
    Continuation,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)

CONVENTIONS = SheetConventions.from_json(
    json.loads(
        (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(
            encoding="utf-8"
        )
    )
)
_layouts = itertools.count()


def sheet(number: str, title: str) -> SheetCandidate:
    return SheetCandidate(
        location=SheetLocation(layout=f"L{next(_layouts)}"),
        number=Sourced(number, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        title=Sourced(title, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        discipline=Sourced("structural", ValueSource.FILE),
        group="set",
    )


def view(title: str | None, kind: ViewKind = ViewKind.SECTION) -> ViewCandidate:
    return ViewCandidate(box=Box(0.0, 0.0, 10.0, 10.0), kind=kind, title=title)


def runs(found: Sequence[object]) -> list[list[str]]:
    return [
        [s.number.value for s in c.sheets if s.number is not None]
        for c in found
        if isinstance(c, Continuation)
    ]


@pytest.mark.parametrize(
    ("title", "first", "second"),
    [
        ("BEAM BAR DETAILS", "BEAM K-4 LONG SECTION", "SECTION 7Q-7Q"),
        ("BEAM BAR DETAILS", "SECTION 2Q-2Q", "SECTION 3Q-3Q"),
        ("TANK T-9 DETAILS", "PLAN", "SECTION K-K"),
        ("PODIUM LEVEL", "RAMP LAYOUT PLAN", "GRID LAYOUT PLAN"),  # the title names no subject
    ],
)
def test_a_view_title_naming_no_subject_of_its_own_keeps_the_continuation(
    title: str, first: str, second: str
) -> None:
    sheets = [sheet("S-23", title), sheet("S-24", title)]
    found = conflicts.find(sheets, [(view(first),), (view(second),)], CONVENTIONS)
    assert runs(found) == [["S-23", "S-24"]]


def test_a_view_naming_another_subject_breaks_it_even_beside_a_generic_one() -> None:
    sheets = [sheet("S-05", "COLUMN SCHEDULE"), sheet("S-06", "COLUMN SCHEDULE")]
    later = (view("SECTION 1-1"), view("PILE CAP DETAILS", ViewKind.DETAIL))
    found = conflicts.find(sheets, [(view("COLUMN SCHEDULE", ViewKind.SCHEDULE),), later], CONVENTIONS)
    assert runs(found) == []


def test_one_view_sharing_the_titles_subject_keeps_it() -> None:
    sheets = [sheet("S-05", "COLUMN SCHEDULE"), sheet("S-06", "COLUMN SCHEDULE")]
    later = (view("PILE CAP DETAILS", ViewKind.DETAIL), view("COLUMN SCHEDULE (CONTD.)"))
    found = conflicts.find(sheets, [(), later], CONVENTIONS)
    assert runs(found) == [["S-05", "S-06"]]


@pytest.mark.parametrize(
    ("number", "expected"),
    [("S-01 R1", ("S-01", "R1")), ("S-01 REV A", ("S-01", "REV A")), ("R1", ("R1", None)),
     ("S-01", ("S-01", None)), ("E-R2", ("E-R2", None)), ("S-01  R12", ("S-01", "R12"))],
)  # fmt: skip
def test_a_revision_is_split_off_only_after_a_space_and_a_number(
    number: str, expected: tuple[str, str | None]
) -> None:
    assert conflicts.split_revision(number, CONVENTIONS.revision_mark_pattern) == expected
    assert conflicts.split_revision(number, None) == (number, None)


def storeys_drawn_twice(found: Sequence[object]) -> int:
    return sum(1 for c in found if isinstance(c, Conflict) and c.kind == conflicts.SAME_STOREY)


def column_plan(title: str, storeys: tuple[str, ...]) -> ViewCandidate:
    from engine.recognise.types import StoreysMeaning

    return ViewCandidate(
        box=Box(0.0, 0.0, 10.0, 10.0), kind=ViewKind.PLAN, title=title, storeys=storeys,
        storeys_meaning=StoreysMeaning.FLOOR_TO_FLOOR, subject="column",
    )  # fmt: skip


def test_consecutive_column_ranges_meeting_at_a_floor_are_no_storey_drawn_twice() -> None:
    """Column layouts in ranges that meet at a floor: the lower one's top is the upper's bottom."""
    sheets = [sheet("S-13", "COLUMN LAYOUT PLAN A"), sheet("S-14", "COLUMN LAYOUT PLAN B")]
    low = column_plan(
        "COLUMN PLAN, LEVELS F TO 3",
        ("foundation", "ground", "floor_1", "floor_2", "floor_3"),
    )
    high = column_plan("COLUMN PLAN, LEVELS 3 TO 6", ("floor_3", "floor_4", "floor_5", "floor_6"))
    found = conflicts.find(sheets, [(low,), (high,)], CONVENTIONS)
    assert storeys_drawn_twice(found) == 0
    overlapping = column_plan("COLUMN PLAN, LEVELS 2 TO 5", ("floor_2", "floor_3", "floor_4", "floor_5"))
    found = conflicts.find(sheets, [(low,), (overlapping,)], CONVENTIONS)
    assert storeys_drawn_twice(found) == 1


@pytest.mark.parametrize(
    ("title", "first", "second"),
    [
        ("WEST ELEVATION", "WEST ELEVATION", "SOUTH ELEVATION"),
        (
            "PODIUM SLAB BAR DETAILS (BOTTOM)",
            "PODIUM SLAB BAR DETAILS (BOTTOM)",
            "PODIUM SLAB BAR DETAILS (TOP)",
        ),
    ],
)
def test_a_view_of_the_titles_kind_that_disagrees_with_it_breaks_the_continuation(
    title: str, first: str, second: str
) -> None:
    """#102 on the real sets' two tellable classes (invented words): a second sheet whose heading, of
    the title's own kind, names another side or the other layer carries a copied title block."""
    sheets = [sheet("A-17", title), sheet("A-18", title)]
    found = conflicts.find(
        sheets, [(view(first, ViewKind.ELEVATION),), (view(second, ViewKind.ELEVATION),)], CONVENTIONS
    )
    assert runs(found) == []


def test_views_of_another_kind_or_sharing_a_word_keep_the_continuation() -> None:
    sheets = [sheet("A-81", "TERRACE DETAILS"), sheet("A-82", "TERRACE DETAILS")]
    first = (view("TERRACE BENCH DETAIL", ViewKind.DETAIL),)
    second = (view("PLAN OF PLANTER P-1", ViewKind.PLAN), view("SECTION M-M"))
    assert runs(conflicts.find(sheets, [first, second], CONVENTIONS)) == [["A-81", "A-82"]]
