"""S25-E1 review round 1 of #811: a range of sheet numbers a title cites is never a member range.

E1 reads a range of hyphenated marks ("C-1 TO C-12"); a title citing sheets the same way ("FOR DETAILS
SEE S-12 TO S-14") must not be read as one, or two sheets that differ only by the sheets they cite run
on as one Continuation. A mark that reads as a sheet number of the title's own Discipline (its prefix)
is a citation. Every title and number is invented.
"""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from engine.recognise import conflicts
from engine.recognise.conflicts import member_ranges
from engine.recognise.tests.candidates import sheet
from engine.recognise.types import Conflict, Continuation, SheetConventions

CONV = SheetConventions.from_json(
    json.loads(
        (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(
            encoding="utf-8"
        )
    )
)
PATTERN = CONV.member_range_pattern


def compare(titles: Sequence[tuple[str, str]], discipline: str = "structural") -> list[Any]:
    sheets = [sheet(number, title, discipline=discipline) for number, title in titles]
    return list(
        conflicts.compare(
            sheets, [()] * len(sheets), conventions=CONV, recognisers=conflicts.recognisers(CONV)
        )
    )


def runs(found: list[Any]) -> list[list[str]]:
    return [[s.number.value for s in c.sheets if s.number] for c in found if isinstance(c, Continuation)]


def cited_in(discipline: str) -> Any:
    reader = conflicts._Reader(
        conflicts.recognisers(CONV), conflicts.Numbers(CONV, conflicts.recognisers(CONV))
    )
    return reader.cites(sheet("S-01", "ANY", discipline=discipline))


def test_two_sheets_citing_different_sheet_ranges_do_not_run_on() -> None:
    found = compare(
        [
            ("S-41", "SLAB REINFORCEMENT DETAILS FOR DETAILS SEE S-12 TO S-14"),
            ("S-42", "SLAB REINFORCEMENT DETAILS FOR DETAILS SEE S-20 TO S-22"),
        ]
    )
    assert runs(found) == []
    assert not any("S-12 TO S-22" in (getattr(c, "title", "") or "") for c in found)


def test_a_member_range_beside_a_citation_still_runs_on() -> None:
    found = compare(
        [
            ("S-41", "BEAM B-1 TO B-4 DETAILS (SEE S-12 TO S-14)"),
            ("S-42", "BEAM B-5 TO B-8 DETAILS (SEE S-12 TO S-14)"),
        ]
    )
    assert runs(found) == [["S-41", "S-42"]]
    continuation = next(c for c in found if isinstance(c, Continuation))
    assert continuation.title == "BEAM B-1 TO B-8 DETAILS (SEE S-12 TO S-14)"


def test_touching_hyphenated_member_ranges_beside_a_citation_still_run_on() -> None:
    found = compare(
        [
            ("S-41", "BEAM B-1 TO B-4 DETAILS SEE S-12 TO S-14"),
            ("S-42", "BEAM B-4 TO B-8 DETAILS SEE S-12 TO S-14"),
        ]
    )
    assert runs(found) == [["S-41", "S-42"]]
    assert [c for c in found if isinstance(c, Conflict) and c.kind == "same_title"] == []


def test_a_member_family_sharing_another_disciplines_prefix_still_runs_on() -> None:
    found = compare([("S-41", "FOOTING F-1 TO F-4 DETAILS"), ("S-42", "FOOTING F-5 TO F-8 DETAILS")])
    assert runs(found) == [["S-41", "S-42"]]


def test_a_fire_sheet_citing_fire_sheets_does_not_run_on() -> None:
    found = compare(
        [
            ("F-41", "SPRINKLER DETAILS SEE F-12 TO F-14"),
            ("F-42", "SPRINKLER DETAILS SEE F-20 TO F-22"),
        ],
        discipline="fire",
    )
    assert runs(found) == []


def test_a_citation_is_no_member_range_only_where_its_marks_read_as_the_disciplines_sheets() -> None:
    title = "DETAILS SEE S-12 TO S-14"
    structural = cited_in("structural")

    assert [(r.letters, r.low, r.high) for r in member_ranges(title, PATTERN)] == [("s", 12, 14)]
    assert member_ranges(title, PATTERN, structural) == ()
    assert [(r.low, r.high) for r in member_ranges(title, PATTERN, cited_in("fire"))] == [(12, 14)]
    assert [(r.low, r.high) for r in member_ranges("BEAM B-1 TO B-4", PATTERN, structural)] == [(1, 4)]


def test_an_unhyphenated_range_of_the_disciplines_letters_is_still_a_member_range() -> None:
    assert [
        (r.low, r.high) for r in member_ranges("SLAB S12-S14 DETAILS", PATTERN, cited_in("structural"))
    ] == [(12, 14)]
