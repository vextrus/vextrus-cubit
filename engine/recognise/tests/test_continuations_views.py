"""17's edits to 19b's continuations (#100, #102), on the real sets' classes, with invented titles:
a view title that names no subject is no evidence against its title block."""

import itertools
import json
from pathlib import Path

import pytest

from engine.recognise import conflicts
from engine.recognise.types import (
    Box,
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


def runs(found: list[object]) -> list[list[str]]:
    return [
        [s.number.value for s in c.sheets if s.number is not None]
        for c in found
        if isinstance(c, Continuation)
    ]


@pytest.mark.parametrize(
    ("title", "first", "second"),
    [
        ("BEAM REINFORCEMENT DETAILS", "LONG SECTION OF BEAM B-3", "SECTION 5Y-5Y"),
        ("BEAM REINFORCEMENT DETAILS", "SECTION 6Y-6Y", "SECTION 8Y-8Y"),
        ("RESERVOIR DETAILS", "PLAN", "SECTION Y-Y"),
        ("BASEMENT FLOOR", "WATER TANK LAYOUT PLAN", "COLUMN LAYOUT PLAN"),  # the title names none
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
    [("S-01 R1", ("S-01", "R1")), ("S-01 REV A", ("S-01 REV A", None)), ("R1", ("R1", None)),
     ("S-01", ("S-01", None)), ("E-R2", ("E-R2", None)), ("S-01  R12", ("S-01", "R12"))],
)  # fmt: skip
def test_a_revision_is_split_off_only_after_a_space_and_a_number(
    number: str, expected: tuple[str, str | None]
) -> None:
    assert conflicts.split_revision(number, CONVENTIONS.revision_mark_pattern) == expected
    assert conflicts.split_revision(number, None) == (number, None)
