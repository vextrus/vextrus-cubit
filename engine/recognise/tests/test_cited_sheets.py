"""S25-E1 review rounds 1 (#811) and 5 (#775): a range of sheets a title cites is no member range.

E1 reads a range of hyphenated marks ("C-1 TO C-12"); a title citing sheets the same way ("FOR DETAILS
SEE S-12 TO S-14") must not be read as one, or two sheets that differ only by the sheets they cite run
on as one Continuation. A range is a citation when a citation word comes right before it, or when both
its marks are numbers of sheets of the set, of any Discipline; a mark that only shares a prefix with
sheets ("TR-1" where no sheet TR-1 is) is a member mark. Every title and number is invented.
"""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest

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


def cited(*numbers: str, conventions: SheetConventions = CONV) -> conflicts.Citations:
    return conflicts.Citations(conventions, [sheet(n, "ANY") for n in numbers])


def read(title: str, citations: conflicts.Citations | None) -> list[tuple[str, int, int]]:
    return [(r.letters, r.low, r.high) for r in member_ranges(title, PATTERN, citations)]


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


def test_another_disciplines_sheets_cited_without_a_cue_do_not_run_on() -> None:
    cited_sheets = [
        sheet(n, "WINDOW SCHEDULE", discipline="electrical") for n in ("Q-12", "Q-14", "Q-20", "Q-22")
    ]
    sheets = [
        sheet("A-41", "WINDOW SILL NOTES Q-12 TO Q-14", discipline="architectural"),
        sheet("A-42", "WINDOW SILL NOTES Q-20 TO Q-22", discipline="architectural"),
        *cited_sheets,
    ]
    found = conflicts.compare(
        sheets, [()] * len(sheets), conventions=CONV, recognisers=conflicts.recognisers(CONV)
    )
    assert runs(list(found)) == []


def test_another_disciplines_sheets_cited_after_a_cue_do_not_run_on() -> None:
    found = compare(
        [
            ("A-41", "WINDOW SILL NOTES SEE Q-12 TO Q-14"),
            ("A-42", "WINDOW SILL NOTES SEE Q-20 TO Q-22"),
        ],
        discipline="architectural",
    )
    assert runs(found) == []


def test_marks_that_share_only_a_disciplines_prefix_are_member_marks() -> None:
    data = json.loads(json.dumps(CONV.to_json()))
    for discipline in data["disciplines"]:
        if discipline["key"] == "structural":
            discipline["prefixes"].append("TR")
    conventions = SheetConventions.from_json(data)
    sheets = [
        sheet("TR-41", "STAIR TR-1 TO TR-2 DETAILS"),
        sheet("TR-42", "STAIR TR-3 TO TR-4 DETAILS"),
    ]
    found = conflicts.compare(
        sheets,
        [()] * len(sheets),
        conventions=conventions,
        recognisers=conflicts.recognisers(conventions),
    )
    assert runs(list(found)) == [["TR-41", "TR-42"]]


def test_a_slab_range_in_the_disciplines_own_letters_is_a_member_range() -> None:
    found = compare([("S-41", "SLAB S-1 TO S-4 DETAILS"), ("S-42", "SLAB S-5 TO S-8 DETAILS")])
    assert runs(found) == [["S-41", "S-42"]]


def test_a_range_whose_ends_are_both_sheets_of_the_set_cites_them() -> None:
    assert read("STAIR TR-1 TO TR-2 DETAILS", cited("TR-1", "TR-2")) == []
    assert read("STAIR TR-1 TO TR-2 DETAILS", cited("TR-1", "TR-3")) == [("tr", 1, 2)]
    assert read("STAIR TR-1 TO TR-2 DETAILS", cited("TR-01", "TR-02")) == [("tr", 1, 2)]
    assert read("STAIR TR-1 TO TR-2 DETAILS", cited("TR-1 R1", "TR-2 R2")) == []


@pytest.mark.parametrize(
    "title",
    [
        "FOR DETAILS SEE S-12 TO S-14",
        "NOTES (SEE: S-12 TO S-14)",
        "REFER TO S-12 TO S-14",
        "REF. S-12 TO S-14",
        "DETAILS ON S-12 TO S-14",
        "DETAILS IN S-12 - S-14",
        "AS PER S-12 THRU S-14",
        "FOR DETAILS SEE S12-S14",
    ],
)
def test_a_range_right_after_a_citation_word_cites_sheets(title: str) -> None:
    assert read(title, None) == [("s", 12, 14)]
    assert read(title, cited()) == []


@pytest.mark.parametrize(
    "title",
    [
        "BEAM B-1 TO B-4 DETAILS",
        "SEE NOTES. BEAM B-1 TO B-4 DETAILS",
        "OVERSEE B-1 TO B-4",
    ],
)
def test_a_range_with_no_citation_word_right_before_it_is_a_member_range(title: str) -> None:
    assert read(title, cited("S-12", "S-14")) == [("b", 1, 4)]


def test_conventions_with_no_citation_words_cite_by_the_sets_numbers_alone() -> None:
    bare = SheetConventions.from_json({**CONV.to_json(), "citation_words": []})
    assert read("SEE S-12 TO S-14", cited(conventions=bare)) == [("s", 12, 14)]
    assert read("SEE S-12 TO S-14", cited("S-12", "S-14", conventions=bare)) == []
