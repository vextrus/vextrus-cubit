"""Storeys as stated and as an explicit list, by code (13; the M0 plan's review Q1; ADR 0011).

Titles here are invented in the forms Dhaka titles use (docs/design/m0-screens.md §5, "Storeys"; the
QS review's Q1); every rule under test is a ruling: never a first-to-last expansion of a list; "top"
and "typical" symbolic; "below ground floor" foundation to ground and marked; tie, grade and plinth
beams the plinth level; "typical" a storey word only in a plan's title beside a floor or plan word;
tanks and the underground reservoir never storeys.
"""

import json
from pathlib import Path

import pytest

from engine.recognise import storeys
from engine.recognise.storeys import MAX_FLOOR, MAX_TEXT, Storeys
from engine.recognise.types import SheetConventions, StoreyWords

DEFAULT = SheetConventions.from_json(
    json.loads(
        (Path(__file__).parents[1] / "conventions" / "sheet-default.json").read_text(encoding="utf-8")
    )
)


def floors(first: int, last: int) -> tuple[str, ...]:
    return tuple(f"floor_{n}" for n in range(first, last + 1))


def read(text: str, *, plan_title: bool = True) -> Storeys:
    return storeys.read(text, DEFAULT, plan_title=plan_title)


@pytest.mark.parametrize(
    ("title", "keys", "as_stated"),
    [
        ("4TH FLOOR SLAB LAYOUT", ("floor_4",), "4TH FLOOR"),
        ("Second Floor Plan", ("floor_2",), "Second Floor"),
        ("2ND & 5TH FLOOR BEAM LAYOUT PLAN", ("floor_2", "floor_5"), "2ND & 5TH FLOOR"),
        ("3RD, 5TH & 7TH FLOOR BEAM LAYOUT", ("floor_3", "floor_5", "floor_7"), "3RD, 5TH & 7TH FLOOR"),
        ("1ST, 4TH, & 9TH FLOOR SLAB", ("floor_1", "floor_4", "floor_9"), "1ST, 4TH, & 9TH FLOOR"),
        ("LAYOUT FOR 2ND,3RD,6th & 7th FLOOR", ("floor_2", "floor_3", "floor_6", "floor_7"),
         "2ND,3RD,6th & 7th FLOOR"),
        ("PLAN FOR2ND, 4TH FL.", ("floor_2", "floor_4"), "2ND, 4TH FL"),
        ("2ND - 6TH FLOOR BEAM LAYOUT", floors(2, 6), "2ND - 6TH FLOOR"),
        ("COLUMN PLAN (4TH TO 7TH FLOOR)", floors(4, 7), "4TH TO 7TH FLOOR"),
        ("COLUMN PLAN (4TH FLOOR TO 7TH)", floors(4, 7), "4TH FLOOR TO 7TH"),
        ("GROUND FLOOR PLAN", ("ground",), "GROUND FLOOR"),
        ("G.F. PLAN", ("ground",), "G.F"),
        ("GROUND & MEZZANINE FLOOR COLUMNS", ("ground", "mezzanine"), "GROUND & MEZZANINE FLOOR"),
        ("MEZZANINE PLAN", ("mezzanine",), "MEZZANINE"),
        ("7TH FLOOR & MEZZANINE FLOOR DB DETAIL", ("mezzanine", "floor_7"),
         "7TH FLOOR & MEZZANINE FLOOR"),
        ("COLUMNS (FOUNDATION TO 2ND FLOOR)", ("foundation", "ground", "floor_1", "floor_2"),
         "FOUNDATION TO 2ND FLOOR"),
        ("ROOF BEAM LAYOUT", ("roof",), "ROOF"),
        ("ROOF FL. LIGHTING", ("roof",), "ROOF FL"),
        ("SOLAR PANELS ON ROOF TOP PLAN", ("roof",), "ROOF TOP"),
        ("STAIR ROOM ROOF SLAB", ("stair_room_roof",), "STAIR ROOM ROOF"),
        ("STAIR ROOM ROOF, LIFT MACHINE ROOM & O.H.W.T PLAN", ("stair_room_roof", "lift_machine_room"),
         "STAIR ROOM ROOF, LIFT MACHINE ROOM"),
        ("LIFT MACHINE ROOM TOP SLAB", ("lift_machine_room_roof",), "LIFT MACHINE ROOM TOP"),
        ("PILE LAYOUT PLAN", ("pile",), "PILE"),
        ("PILE CAP DETAILS (PC-1, PC-2)", ("pile_cap",), "PILE CAP"),
        ("TIE BEAM LAYOUT PLAN", ("plinth",), "TIE BEAM"),
        ("GRADE BEAM LONG SECTIONS (GB-1 - GB-4)", ("plinth",), "GRADE BEAM"),
        ("PLINTH BEAM DETAILS", ("plinth",), "PLINTH BEAM"),
        ("BASEMENT-2 FLOOR PLAN", ("basement_2",), "BASEMENT-2 FLOOR"),
        ("2ND BASEMENT FLOOR PLAN", ("basement_2",), "2ND BASEMENT FLOOR"),
        ("BASEMENT 2 TO GROUND FLOOR", ("basement_2", "basement_1", "ground"),
         "BASEMENT 2 TO GROUND FLOOR"),
        ("SEMI-BASEMENT PLAN", ("lower_ground",), "SEMI-BASEMENT"),
    ],
)  # fmt: skip
def test_a_title_reads_its_storeys_as_an_explicit_list(
    title: str, keys: tuple[str, ...], as_stated: str
) -> None:
    found = read(title)

    assert set(found.keys) == set(keys)
    assert found.as_stated == as_stated
    assert found.runs_to is None
    assert found.below_ground is False


@pytest.mark.parametrize(
    ("title", "keys"),
    [
        ("MAT FOUNDATION LAYOUT PLAN", ("foundation",)),
        ("RAFT REINFORCEMENT DETAILS", ("foundation",)),
        ("GROUND BEAM LAYOUT", ("plinth",)),
        ("LGF PARKING PLAN", ("lower_ground",)),
        ("MUMTY SLAB DETAILS", ("stair_room_roof",)),
        ("PUMP MACHINE ROOM DETAILS", ()),
    ],
)
def test_the_words_a_dhaka_qs_reviewed_name_their_storeys(title: str, keys: tuple[str, ...]) -> None:
    """The QS critic's review of the default words (13's PR): mat and raft name the foundation, a
    pump's machine room is no lift machine room."""
    assert read(title, plan_title=False).keys == keys


def test_the_keys_run_low_to_high() -> None:
    found = read("7TH FLOOR, GROUND, BASEMENT & ROOF")

    assert found.keys == ("basement_1", "ground", "floor_7", "roof")


def test_a_list_is_never_expanded_first_to_last() -> None:
    """ "3RD, 5TH & 7TH" is three storeys, not five (m0-screens §5)."""
    assert read("3RD, 5TH & 7TH FLOOR BEAM LAYOUT").keys == ("floor_3", "floor_5", "floor_7")


@pytest.mark.parametrize(
    ("title", "keys"),
    [
        ("COLUMN LAYOUT (1ST TO TOP FLOOR)", ("floor_1",)),
        ("COLUMN LAYOUT (5TH FLOOR TO ROOF)", ("floor_5", "roof")),
        ("GROUND TO ROOF FLOOR", ("ground", "roof")),
    ],
)
def test_a_range_to_the_top_runs_to_a_symbolic_end(title: str, keys: tuple[str, ...]) -> None:
    """ "Top" is a symbolic end Step 3 resolves, never a fixed floor (the QS review, Q1)."""
    found = read(title)

    assert found.keys == keys
    assert found.runs_to == "top"


def test_the_top_floor_alone_is_the_symbolic_top() -> None:
    assert read("TOP FLOOR BEAM LAYOUT").keys == ("top",)


@pytest.mark.parametrize(
    "title",
    [
        "COLUMN LAYOUT PLAN (BELOW GROUND FLOOR)",
        "COLUMNS BELOW GROUND",
        "STUB COLUMNS BELOW G.F",
    ],
)
def test_below_ground_floor_reads_foundation_to_ground_and_is_marked(title: str) -> None:
    found = read(title)

    assert found.keys == ("foundation", "ground")
    assert found.below_ground is True
    assert found.as_stated is not None
    assert found.as_stated.lower().startswith("below")


@pytest.mark.parametrize(
    ("title", "plan_title", "keys"),
    [
        ("TYPICAL FLOOR PLAN", True, ("typical",)),
        ("TYPICAL PLAN", True, ("typical",)),
        ("LINTEL LAYOUT PLAN (TYPICAL FLOOR)", True, ("typical",)),
        ("TYPICAL FLOOR TOILET DETAILS", False, ()),
        ("LINTEL, SUNSHADE & TYPICAL DETAILS", False, ()),
        ("TYPICAL DETAILS OF BEAM LAYOUT", True, ("not_stated",)),
        ("TYPICAL COLUMN SECTION", True, ("not_stated",)),
    ],
)
def test_typical_is_a_storey_only_in_a_plan_title_beside_a_floor_or_plan_word(
    title: str, plan_title: bool, keys: tuple[str, ...]
) -> None:
    assert read(title, plan_title=plan_title).keys == keys


@pytest.mark.parametrize(
    "title",
    [
        "UNDERGROUND WATER RESERVOIR DETAILS",
        "U.G.W.R REINFORCEMENT DETAILS",
        "OVER HEAD TANK DETAIL",
        "PUMP CONNECTION UGWT TO OVER HEAD TANK (OHT)",
        "SEPTIC TANK SECTION",
        "LIFT PIT DETAILS",
    ],
)
def test_tanks_and_the_reservoir_are_structures_never_storeys(title: str) -> None:
    found = read(title, plan_title=False)

    assert found.keys == ()
    assert found.as_stated is None


def test_a_structure_beside_a_storey_leaves_the_storey() -> None:
    found = read("GROUND FLOOR SLAB, LIFT PIT & U.G.W.R DETAILS")

    assert found.keys == ("ground",)
    assert found.as_stated == "GROUND FLOOR"


def test_a_canopy_roof_is_not_the_roof() -> None:
    assert read("CANOPY ROOF SLAB OUTLINE PLAN").keys == ("not_stated",)


@pytest.mark.parametrize(
    "title",
    [
        "1ST FLIGHT DETAILS",
        "REINFORCEMENT DETAILS OF FLOOR BEAM",
        "SLAB DETAILS (TOP LAYER)",
        "NATURAL GROUND LEVEL SECTION",
        "SINGLE LINE DIAGRAM OF 150 KVA SUB-STATION",
        "SECTION A-A (THROUGH STAIR)",
        "FLOOR BEAM LONG SECTIONS (FB-1 - FB-5)",
    ],
)
def test_words_that_only_look_like_storeys_name_none(title: str) -> None:
    found = read(title, plan_title=False)

    assert found.keys == ()
    assert found.as_stated is None


def test_a_plan_title_that_states_no_storey_says_so() -> None:
    assert read("SET BACK LAYOUT PLAN") == Storeys(as_stated=None, keys=("not_stated",))
    assert read("SET BACK DETAILS", plan_title=False) == Storeys(as_stated=None, keys=())


@pytest.mark.parametrize(
    ("title", "as_stated"),
    [
        ("BEAM LAYOUT PLAN AT EL. +16'-6\"", "EL. +16'-6\""),
        ("SLAB AT LEVEL 3", "LEVEL 3"),
    ],
)
def test_a_level_title_is_kept_as_stated_with_no_storey(title: str, as_stated: str) -> None:
    found = read(title)

    assert found.keys == ()
    assert found.as_stated == as_stated


def test_the_words_are_data_a_drafting_profile_extends() -> None:
    """A word the default lacks names a storey once the conventions carry it (M1's profiles)."""
    extended = SheetConventions.from_json(
        {**DEFAULT.to_json(), "storey_words": [
            *DEFAULT.to_json()["storey_words"][:-1],
            {"storey": "top", "words": ["top", "uppermost"]},
        ]}
    )  # fmt: skip

    assert storeys.read("UPPERMOST FLOOR PLAN", DEFAULT, plan_title=True).keys == ("not_stated",)
    assert storeys.read("UPPERMOST FLOOR PLAN", extended, plan_title=True).keys == ("top",)


def test_a_storey_key_the_vocabulary_lacks_is_ignored() -> None:
    odd = SheetConventions(storey_words=(StoreyWords("attic", ("attic",)),), floor_words=("floor",))

    assert storeys.read("ATTIC FLOOR PLAN", odd, plan_title=False).keys == ()


def test_every_storey_the_default_names_is_in_the_vocabulary() -> None:
    assert {s.storey for s in DEFAULT.storey_words} <= storeys.NAMED


# The trust boundary: a range is bounded, and nothing a title holds crashes the reader.


@pytest.mark.parametrize(
    "title",
    [
        "1ST TO 9999TH FLOOR PLAN",
        "9999TH TO 1ST FLOOR PLAN",
        "0TH TO 5TH FLOOR PLAN",
        "1ST TO 1000000000TH FLOOR PLAN",
        "1ST TO " + "9" * 40 + "TH FLOOR PLAN",
    ],
)
def test_a_range_past_the_safety_bound_is_kept_as_stated_with_no_list(title: str) -> None:
    found = read(title)

    assert found.keys == ()
    assert found.as_stated is not None
    assert "FLOOR" in found.as_stated


def test_a_range_up_to_the_bound_is_listed_and_a_reversed_one_too() -> None:
    assert read(f"1ST TO {MAX_FLOOR}TH FLOOR").keys == floors(1, MAX_FLOOR)
    assert read("9TH TO 3RD FLOOR").keys == floors(3, 9)


@pytest.mark.parametrize(
    "title",
    [
        "",
        "   ",
        "​‮﻿",
        "১ম তলা",
        "²ND FLOOR PLAN",
        "\uff11ST FLOOR PLAN",
        "x" * (MAX_TEXT + 1),
        "FLOOR " * 10_000,
        "& , - TO & TO , -" * 1000,
    ],
)
def test_nothing_a_title_holds_crashes_the_reader(title: str) -> None:
    found = read(title)

    assert isinstance(found, Storeys)
    for key in found.keys:
        assert key in storeys.NAMED | {"not_stated"} or key.startswith(("floor_", "basement_"))


def test_a_title_past_the_text_bound_is_not_read() -> None:
    assert read("1ST FLOOR PLAN " + "x" * MAX_TEXT) == Storeys(as_stated=None, keys=())


def test_a_unicode_digit_ordinal_reads_by_one_rule() -> None:
    """Decimal digits of any script are digits (a fullwidth one); a superscript is not one."""
    assert read("\uff11ST FLOOR PLAN").keys == ("floor_1",)
    assert read("²ND FLOOR PLAN").keys == ("not_stated",)
