"""T-W318's acceptance, part B: the storey wording the reader misses (D9, #233), and the wording it
reads right today kept so.

The seam: `engine.recognise.storeys.read(text, sheets.default_conventions(), plan_title=True)` with
the shipped conventions (`engine/recognise/conventions/sheet-default.json`; new words are data).
Each title was first read on main: those read wrong there are the ticket's to fix (the lift machine
room's abbreviation and "underground floor"); the rest are regression cases. "Underground" names a
storey only beside a floor word: the underground reservoir stays a structure, never a storey. Every
title is invented.

    uv run pytest engine/recognise/tests/acceptance/w318/test_storey_wording.py
"""

import pytest

from engine.recognise import sheets, storeys

CONVENTIONS = sheets.default_conventions()


def read(text: str) -> storeys.Storeys:
    return storeys.read(text, CONVENTIONS, plan_title=True)


# Missed on main ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "title", ["LIFT MOTOR RM TOP SLAB", "LIFT MOTOR ROOM SLAB REINFORCEMENT"], ids=["rm", "room"]
)
def test_the_lift_motor_rooms_words_name_the_lift_machine_room(title: str) -> None:
    found = read(title)

    assert found.keys == ("lift_machine_room",)
    assert found.as_stated is not None


@pytest.mark.parametrize(
    "title", ["UNDERGROUND FLOOR PLAN", "UNDERGROUND FLOOR BEAM LAYOUT"], ids=["plan", "beam"]
)
def test_an_underground_floor_is_read_as_below_ground(title: str) -> None:
    found = read(title)

    assert found.keys == ("foundation", "ground")
    assert found.below_ground
    assert found.as_stated is not None


# Read right on main, kept so ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "title",
    ["UNDERGROUND WATER RESERVOIR PLAN", "UNDERGROUND RESERVOIR SLAB LAYOUT"],
    ids=["water-reservoir", "reservoir"],
)
def test_the_underground_reservoir_is_a_structure_never_a_storey(title: str) -> None:
    found = read(title)

    assert set(found.keys) <= {"not_stated"}
    assert not found.below_ground
    assert found.runs_to is None


@pytest.mark.parametrize(
    ("title", "keys", "below_ground"),
    [
        ("BELOW GROUND FLOOR COLUMN LAYOUT", ("foundation", "ground"), True),
        ("BELOW G.F SLAB LAYOUT", ("foundation", "ground"), True),
        ("FOUNDATION LEVEL STRAP BEAM LAYOUT", ("foundation",), False),
        ("RAFT FOUNDATION LAYOUT", ("foundation",), False),
        ("LIFT MACHINE ROOM FLOOR SLAB LAYOUT", ("lift_machine_room",), False),
        ("LIFT MACHINE ROOM ROOF SLAB LAYOUT", ("lift_machine_room_roof",), False),
        ("PILE CAP LAYOUT PLAN", ("pile_cap",), False),
        ("TIE BEAM LAYOUT PLAN", ("plinth",), False),
    ],
)
def test_the_wording_main_reads_right_stays_read_so(
    title: str, keys: tuple[str, ...], below_ground: bool
) -> None:
    found = read(title)

    assert found.keys == keys
    assert found.below_ground is below_ground
