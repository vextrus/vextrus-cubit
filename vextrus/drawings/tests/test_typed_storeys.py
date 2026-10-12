"""S24-B2: a plan view's storeys as the QS types them (`typed_storeys`): each storey listed, read by the
engine's words one item at a time, low to high; a range, an open end or a word naming no storey is
refused (400) with a code, before anything is written. Pure: no database."""

from typing import Any

import pytest

from vextrus.drawings.services import corrections
from vextrus.platform.services import auth


def refused(typed: object) -> dict[str, Any]:
    """The refusal's message (`{code, params}`), after checking it is a 400."""
    with pytest.raises(auth.Refused) as raised:
        corrections.typed_storeys(typed)
    assert raised.value.status == 400
    return dict(raised.value.message)


@pytest.mark.parametrize(
    ("typed", "keys"),
    [
        ("3rd, 5th, 7th", ("floor_3", "floor_5", "floor_7")),
        ("7th, 3rd, 5th", ("floor_3", "floor_5", "floor_7")),
        ("3RD, 5TH & 7TH", ("floor_3", "floor_5", "floor_7")),
        ("3rd floor, 5th floor", ("floor_3", "floor_5")),
        ("3rd and 5th", ("floor_3", "floor_5")),
        ("3rd; 5th", ("floor_3", "floor_5")),
        ("  3rd ,, 5th , ", ("floor_3", "floor_5")),
        ("3rd, 3rd", ("floor_3",)),
        ("ground, 1st, roof", ("ground", "floor_1", "roof")),
        ("roof, ground", ("ground", "roof")),
        ("8th", ("floor_8",)),
        ("second floor", ("floor_2",)),
        ("pile cap, ground", ("pile_cap", "ground")),
        ("Stair-room roof", ("stair_room_roof",)),
        ("Lift machine room, Lift machine room roof", ("lift_machine_room", "lift_machine_room_roof")),
        ("Basement 2, Basement, Foundations", ("foundation", "basement_2", "basement_1")),
    ],
)
def test_each_storey_listed_is_read_low_to_high(typed: str, keys: tuple[str, ...]) -> None:
    assert corrections.typed_storeys(typed) == keys


@pytest.mark.parametrize(
    "typed",
    [
        "2nd to 6th",
        "6th to 2nd",
        "1st to top",
        "3rd, 5th to 7th",
        "2nd-6th",
        "basement to 3rd",
    ],
)
def test_a_range_is_refused_and_named(typed: str) -> None:
    refusal = refused(typed)
    assert refusal["code"] == "drawings.sheets.storeys_range"


@pytest.mark.parametrize(
    "typed",
    [
        "kitchen",
        "3rd, kitchen, 7th",
        "big 3rd",
        "3rd beam",
        "typical",
        "top",
        "0th",
        "9999th",
        "level 3",
    ],
)
def test_a_word_naming_no_single_storey_is_refused_and_named(typed: str) -> None:
    refusal = refused(typed)
    assert refusal["code"] == "drawings.sheets.storeys_not_a_storey"
    assert "word" in refusal["params"]


@pytest.mark.parametrize(
    ("typed", "code"),
    [
        ("", "drawings.sheets.storeys_empty"),
        ("   ", "drawings.sheets.storeys_empty"),
        (", ,", "drawings.sheets.storeys_empty"),
        (None, "drawings.sheets.storeys_empty"),
        (3, "drawings.sheets.storeys_empty"),
        ("3rd, " * 400, "drawings.sheets.storeys_too_long"),
        ("3rd,\n5th", "drawings.sheets.storeys_many_lines"),
        ("3rd,\t5th", "drawings.sheets.storeys_unreadable"),
        ("3rd, 5th\x00", "drawings.sheets.storeys_unreadable"),
        ("3rd, ‮5th", "drawings.sheets.storeys_unreadable"),
        ("3rd, \ud800", "drawings.sheets.storeys_unreadable"),
    ],
)
def test_text_that_cannot_be_kept_is_refused_with_its_own_code(typed: object, code: str) -> None:
    assert refused(typed)["code"] == code


def test_a_list_of_too_many_storeys_is_refused() -> None:
    many = ", ".join(f"{n}th" for n in range(1, corrections.MAX_STOREYS + 2))
    refusal = refused(many)
    assert refusal["code"] in {"drawings.sheets.storeys_too_many", "drawings.sheets.storeys_too_long"}
