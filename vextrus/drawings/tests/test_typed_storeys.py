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
        "3rd!",
        "3rd *",
        "(3rd)",
        "3\u0661rd",
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
        ("3rd, " * (corrections.STOREYS_LENGTH // 5 + 1), "drawings.sheets.storeys_too_long"),
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


# Review 1 of #811 ------------------------------------------------------------------------------------


def ordinal(n: int) -> str:
    suffix = "th" if n % 100 in (11, 12, 13) else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def test_the_list_the_form_prefills_from_a_long_run_of_floors_is_kept() -> None:
    # A plan read "2ND TO 45TH FLOOR PLAN" names 44 storeys; the form lists them one by one, and a QS
    # who only flips the meaning saves that very text.
    prefilled = ", ".join(ordinal(n) for n in range(2, 46))

    assert corrections.typed_storeys(prefilled) == tuple(f"floor_{n}" for n in range(2, 46))


def test_every_floor_the_engine_reads_may_be_listed_in_any_order() -> None:
    typed = ", ".join(["roof", "Basement 2", "ground", *(ordinal(n) for n in range(200, 0, -1))])

    assert corrections.typed_storeys(typed) == (
        "basement_2",
        "ground",
        *(f"floor_{n}" for n in range(1, 201)),
        "roof",
    )


def test_a_list_read_together_otherwise_than_item_by_item_has_its_own_words(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    real = corrections.storey_reader.read

    def read(text: str, conventions: Any, *, plan_title: bool) -> Any:
        found = real(text, conventions, plan_title=plan_title)
        if "," in text:  # the items read together: one storey more than each names alone
            return type(found)(as_stated=found.as_stated, keys=(*found.keys, "floor_99"))
        return found

    monkeypatch.setattr(corrections.storey_reader, "read", read)

    assert refused("3rd, 5th")["code"] == "drawings.sheets.storeys_read_together"
