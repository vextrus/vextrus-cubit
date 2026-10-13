"""S25-E1 follow-up (#763): ranges that touch, and a run across a duplicated number's gap.

Ranges that share exactly one boundary mark (a member continued on the next sheet) run on; a run
crosses the number a duplicated sheet number left out, when no sheet at all carries it. Every title
and number is invented.
"""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest

from engine.recognise import conflicts
from engine.recognise.tests.candidates import sheet
from engine.recognise.types import Conflict, Continuation, SheetConventions

CONV = SheetConventions.from_json(
    json.loads(
        (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(
            encoding="utf-8"
        )
    )
)


def compare(titles: Sequence[tuple[str, str]]) -> list[Any]:
    sheets = [sheet(number, title) for number, title in titles]
    return list(
        conflicts.compare(
            sheets, [()] * len(sheets), conventions=CONV, recognisers=conflicts.recognisers(CONV)
        )
    )


def runs(found: list[Any]) -> list[list[str]]:
    return [[s.number.value for s in c.sheets if s.number] for c in found if isinstance(c, Continuation)]


def same_title(found: list[Any]) -> list[Any]:
    return [c for c in found if isinstance(c, Conflict) and c.kind == "same_title"]


def test_ranges_sharing_one_mark_run_on() -> None:
    found = compare(
        [
            ("S-41", "BEAM B1-B4 DETAILS"),
            ("S-42", "BEAM B4-B8 DETAILS"),
            ("S-43", "BEAM B8-B12 DETAILS"),
        ]
    )
    assert runs(found) == [["S-41", "S-42", "S-43"]]
    assert same_title(found) == []


@pytest.mark.parametrize(
    "second",
    ["BEAM B3-B8 DETAILS", "BEAM B1-B4 DETAILS", "BEAM B4-B4 DETAILS", "BEAM B2-B3 DETAILS"],
)
def test_ranges_that_overlap_or_repeat_do_not_run_on(second: str) -> None:
    found = compare([("S-41", "BEAM B1-B4 DETAILS"), ("S-42", second)])
    assert runs(found) == []


def test_a_single_mark_range_does_not_touch() -> None:
    found = compare([("S-41", "BEAM B4-B4 DETAILS"), ("S-42", "BEAM B4-B8 DETAILS")])
    assert runs(found) == []


def test_a_run_crosses_the_number_a_duplicate_left_out() -> None:
    found = compare(
        [
            ("S-41", "BEAM B1-B4 DETAILS"),
            ("S-42", "BEAM B5-B8 DETAILS"),
            ("S-42", "BEAM B9-B12 DETAILS"),  # drawn as S-43
            ("S-44", "BEAM B13-B16 DETAILS"),
        ]
    )
    assert runs(found) == [["S-41", "S-42", "S-42", "S-44"]]
    assert same_title(found) == []
    assert [c.kind for c in found if isinstance(c, Conflict)] == ["same_number"]


def test_the_gap_and_the_touching_mark_together() -> None:
    found = compare(
        [
            ("S-41", "BEAM B1-B4 DETAILS"),
            ("S-42", "BEAM B5-B8 DETAILS"),
            ("S-42", "BEAM B9-B12 DETAILS"),
            ("S-44", "BEAM B12-B16 DETAILS"),
        ]
    )
    assert runs(found) == [["S-41", "S-42", "S-42", "S-44"]]
    assert same_title(found) == []


def test_a_gap_is_not_crossed_when_another_sheet_carries_the_number() -> None:
    found = compare(
        [
            ("S-41", "BEAM B1-B4 DETAILS"),
            ("S-42", "BEAM B5-B8 DETAILS"),
            ("S-42", "BEAM B9-B12 DETAILS"),
            ("S-43", "SLAB DETAILS"),
            ("S-44", "BEAM B13-B16 DETAILS"),
        ]
    )
    assert ["S-44"] not in runs(found)
    assert all("S-44" not in r or "S-42" not in r for r in runs(found))


def test_a_missing_number_without_a_duplicate_is_no_gap() -> None:
    found = compare([("S-41", "BEAM B1-B4 DETAILS"), ("S-43", "BEAM B5-B8 DETAILS")])
    assert runs(found) == []
