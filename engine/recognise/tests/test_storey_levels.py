"""S19-B5's builder tests: a bare storey line under a plan's title (R1) and the ceiling level, a storey
meaning of its own (R2), at `views.storeys`, the sheet conventions and 19b's `conflicts`. The
acceptance cases are in `engine/recognise/tests/acceptance/ts19b5/`. Every title and word is invented.

    uv run pytest engine/recognise/tests/test_storey_levels.py
"""

from collections.abc import Sequence
from dataclasses import replace
from typing import Any

import pytest

from engine.recognise import conflicts
from engine.recognise.sheets import default_conventions
from engine.recognise.tests.candidates import plan, sheet
from engine.recognise.types import (
    Continuation,
    SheetConventions,
    StoreysMeaning,
    StoreysSource,
    ViewCandidate,
    ViewKind,
)
from engine.recognise.views import storeys

DEFAULT = default_conventions()

# R1: a bare line --------------------------------------------------------------------------------------


def test_a_scale_note_is_passed_over_and_the_bare_line_under_it_read() -> None:
    found = storeys.read("SLAB OPENING PLAN", ViewKind.PLAN, "slab", ["SCALE 1:100", "9TH  FLOOR"])
    assert (found.keys, found.as_stated, found.source) == (
        ("floor_9",),
        "9TH FLOOR",
        StoreysSource.TITLE_LINE,
    )
    assert found.meaning is StoreysMeaning.AT_FLOOR_LEVEL


@pytest.mark.parametrize("line", ["NOT TO SCALE", "SEE 9TH FLOOR PLAN", "9TH FLOOR ONLY", ""])
def test_a_bare_line_not_read_whole_gives_no_storeys(line: str) -> None:
    found = storeys.read("SLAB OPENING PLAN", ViewKind.PLAN, "slab", [line])
    assert found.keys == ("not_stated",)
    assert found.source is None


def test_a_bare_line_under_a_column_plan_runs_floor_to_floor() -> None:
    found = storeys.read("COLUMN LAYOUT PLAN", ViewKind.PLAN, "column", ["1ST TO 4TH FLOOR"])
    assert found.meaning is StoreysMeaning.FLOOR_TO_FLOOR


# R2: the ceiling level --------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("title", "at_ceiling"),
    [
        ("DRAIN LAYOUT AT 9TH FLOOR CEILING LEVEL", True),
        ("drain layout, 9th floor ceiling-level", True),
        ("DRAIN LAYOUT 9TH FLOOR CEILING LVL", True),
        ("9TH FLOOR CEILING LAYOUT", False),  # a ceiling's own layout, drawn at floor level
        ("9TH FLOOR DRAIN LAYOUT, LEVEL 3", False),
        ("CEILINGLEVEL DRAIN PLAN", False),  # the words whole
        (None, False),
    ],
)
def test_the_ceiling_level_is_named_by_the_conventions_words_whole(
    title: str | None, at_ceiling: bool
) -> None:
    assert storeys.at_ceiling_level(title) is at_ceiling


def test_the_ceiling_level_words_are_the_conventions_given() -> None:
    market = replace(DEFAULT, ceiling_level_words=("soffit level",))
    title = "DRAIN LAYOUT AT 9TH FLOOR SOFFIT LEVEL"

    assert storeys.at_ceiling_level(title, market)
    assert not storeys.at_ceiling_level(title)
    found = storeys.read(title, ViewKind.PLAN, None, conventions=market)
    assert found.meaning is StoreysMeaning.AT_CEILING_LEVEL


def test_the_ceiling_level_wins_over_a_floor_to_floor_subject_and_a_bare_line() -> None:
    own = storeys.read("COLUMN LAYOUT AT 9TH FLOOR CEILING LEVEL", ViewKind.PLAN, "column")
    lined = storeys.read("DRAIN LAYOUT AT CEILING LEVEL", ViewKind.PLAN, None, ["9TH FLOOR"])

    assert own.meaning is StoreysMeaning.AT_CEILING_LEVEL
    assert (lined.keys, lined.meaning) == (("floor_9",), StoreysMeaning.AT_CEILING_LEVEL)


def test_a_plan_at_ceiling_level_taking_its_sheets_storeys_keeps_its_level() -> None:
    page = sheet("P-09", "9TH FLOOR DRAIN PLAN", storeys="9TH FLOOR")
    made = [plan([], None, title="DRAIN LAYOUT AT CEILING LEVEL")]

    [given] = storeys.inherit(made, page, [])

    assert given.storeys == ("floor_9",)
    assert given.storeys_source is StoreysSource.SHEET_TITLE
    assert given.storeys_meaning is StoreysMeaning.AT_CEILING_LEVEL


def test_the_ceiling_level_words_round_trip_and_an_older_file_has_none() -> None:
    data = {"disciplines": [], "ceiling_level_words": ["ceiling level"]}

    assert SheetConventions.from_json(data).ceiling_level_words == ("ceiling level",)
    assert SheetConventions.from_json(data).to_json()["ceiling_level_words"] == ["ceiling level"]
    assert SheetConventions.from_json({"disciplines": []}).ceiling_level_words == ()
    assert "ceiling level" in DEFAULT.ceiling_level_words


# R2 in 19b's conflicts --------------------------------------------------------------------------------


def _at(meaning: StoreysMeaning, storey: str = "floor_9", subject: str = "slab") -> ViewCandidate:
    return replace(plan([storey], subject), storeys_meaning=meaning)


def _found(views: Sequence[ViewCandidate]) -> list[Any]:
    a, b = sheet("S-41", "9TH FLOOR SLAB"), sheet("S-42", "SLAB OPENINGS")
    found: list[Any] = conflicts.find([a, b], [[views[0]], [views[1]]], DEFAULT)
    return found


def test_one_storey_at_floor_and_at_ceiling_level_is_not_drawn_twice() -> None:
    found = _found([_at(StoreysMeaning.AT_FLOOR_LEVEL), _at(StoreysMeaning.AT_CEILING_LEVEL)])
    assert [c for c in found if getattr(c, "kind", None) == conflicts.SAME_STOREY] == []


def test_one_storey_at_ceiling_level_on_two_sheets_is_drawn_twice() -> None:
    found = _found([_at(StoreysMeaning.AT_CEILING_LEVEL), _at(StoreysMeaning.AT_CEILING_LEVEL)])
    assert [getattr(c, "kind", None) for c in found] == [conflicts.SAME_STOREY]


def test_floor_to_floor_and_at_floor_level_of_one_storey_still_run_on() -> None:
    """Both draw the storey's own floor (`conflicts.level`): only the ceiling level parts a pair."""
    title = "9TH FLOOR FRAMING PLAN"
    pages = [sheet("S-51", title), sheet("S-52", title)]
    views = [
        [_at(StoreysMeaning.FLOOR_TO_FLOOR, subject="column")],
        [_at(StoreysMeaning.AT_FLOOR_LEVEL, subject="column")],
    ]

    found = conflicts.find(pages, views, DEFAULT)

    assert [type(c) for c in found] == [Continuation]
