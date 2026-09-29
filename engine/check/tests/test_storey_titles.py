"""The storeys a sheet's title names against its plans' storeys (ticket 19b), with 13's stand-in
storey reader: a table of titles, never the product's parser."""

from collections.abc import Sequence
from typing import Any

import pytest

from engine.check.storey_titles import check
from engine.recognise.tests.candidates import plan, sheet, view
from engine.recognise.tests.stand_ins import stand_ins
from engine.recognise.types import SetReading, SheetCandidate, ViewCandidate, ViewKind

TABLE = {
    "3RD, 5TH & 7TH FLOOR": ("floor_3", "floor_5", "floor_7"),
    "1ST TO TOP FLOOR": ("floor_1", "top"),
    "TYPICAL FLOOR": ("typical",),
    "GROUND FLOOR": ("ground",),
    "EL. +16'-6\"": (),
}
READERS = stand_ins(TABLE)


def reading(
    pairs: Sequence[tuple[SheetCandidate, Sequence[ViewCandidate]]],
    read: frozenset[str] = frozenset({"views"}),
) -> SetReading:
    return SetReading(
        sheets=tuple(s for s, _ in pairs), views=tuple(tuple(v) for _, v in pairs), read=read
    )


def outcome(stated: str | None, *storeys: Sequence[str], number: str | None = "S-06") -> Any:
    one = sheet(number, "Beam layout", storeys=stated)
    results = check(reading([(one, [plan(s) for s in storeys])]), recognisers=READERS)
    assert all(r.subject is one and r.code == "storey_titles" for r in results)
    return [(str(r.outcome), r.finding) for r in results]


def differ(
    not_drawn: int, not_named: int, stated: str, sheet: str = "S-06", named: str = "number"
) -> Any:
    params = {
        "sheet": sheet,
        "named": named,
        "stated": stated,
        "not_drawn": not_drawn,
        "not_named": not_named,
    }
    return [("fired", {"code": "engine.storey_titles.differ", "params": params})]


def test_a_title_its_plans_agree_with_passes() -> None:
    assert outcome("3RD, 5TH & 7TH FLOOR", ["floor_3"], ["floor_5", "floor_7"]) == [("passed", None)]


def test_a_title_and_plans_that_disagree_fire_with_each_side_counted() -> None:
    stated = "3RD, 5TH & 7TH FLOOR"
    assert outcome(stated, ["floor_3", "floor_4", "floor_5"]) == differ(1, 1, stated)
    assert outcome("GROUND FLOOR", ["floor_1"]) == differ(1, 1, "GROUND FLOOR")
    assert outcome(stated, ["floor_3", "floor_5", "floor_7", "roof"]) == differ(0, 1, stated)


@pytest.mark.parametrize(
    ("stated", "storeys"),
    [
        ("1ST TO TOP FLOOR", [[f"floor_{n}"] for n in range(1, 10)]),  # top: Step 3's
        ("1ST TO TOP FLOOR", [["ground", "floor_1"]]),
        ("TYPICAL FLOOR", [["floor_2", "floor_3", "floor_8"]]),
        ("GROUND FLOOR", [["typical"]]),
        ("GROUND FLOOR", [["ground", "top"]]),
    ],
)
def test_a_symbolic_storey_alone_never_fires(stated: str, storeys: list[list[str]]) -> None:
    assert outcome(stated, *storeys) == [("passed", None)]


def test_a_title_named_storey_a_symbolic_plan_cannot_hold_still_fires_the_other_way() -> None:
    assert outcome("1ST TO TOP FLOOR", ["floor_2"]) == differ(1, 0, "1ST TO TOP FLOOR")


def test_what_cannot_be_compared_sits_out() -> None:
    assert outcome(None, ["floor_1"]) == []  # no storey words in the title
    assert outcome("\u200b", ["floor_1"]) == []
    assert outcome("EL. +16'-6\"", ["floor_1"]) == []  # a level title: 13 reads no storey from it
    assert outcome("GROUND FLOOR") == []  # no plan view (m0-screens 6.8)
    assert outcome("GROUND FLOOR", []) == []  # a plan with no storey list
    one = sheet("S-01", storeys="GROUND FLOOR")
    section = ViewCandidate(**{**plan(["floor_1"]).__dict__, "kind": ViewKind.SECTION})
    assert check(reading([(one, [section, view()])]), recognisers=READERS) == []
    nameless = sheet(None, None, storeys="GROUND FLOOR")
    assert check(reading([(nameless, [plan(["floor_1"])])]), recognisers=READERS) == []


def test_a_sheet_with_no_number_is_named_by_its_title() -> None:
    one = sheet(None, "Ground floor beams", storeys="GROUND FLOOR")

    [result] = check(reading([(one, [plan(["floor_1"])])]), recognisers=READERS)

    assert result.finding == differ(1, 1, "GROUND FLOOR", "Ground floor beams", "title")[0][1]


def test_the_check_says_nothing_when_the_views_were_not_read() -> None:
    one = sheet("S-06", storeys="GROUND FLOOR")
    pairs = [(one, [plan(["floor_1"])])]
    assert check(reading(pairs, read=frozenset({"register", "plot"})), recognisers=READERS) == []


@pytest.mark.parametrize(
    "readers",
    [
        stand_ins({"GROUND FLOOR": "ground"}),
        stand_ins({"GROUND FLOOR": (1,)}),  # type: ignore[dict-item]
    ],
)
def test_a_reader_answering_outside_13s_contract_is_refused(readers: Any) -> None:
    one = sheet("S-06", storeys="GROUND FLOOR")
    with pytest.raises(TypeError, match="13's storeys"):
        check(reading([(one, [plan(["floor_1"])])]), recognisers=readers)


def test_a_symbolic_answer_that_is_not_a_boolean_is_refused() -> None:
    readers = stand_ins(TABLE)
    readers = type(readers)(readers.sequence, readers.storeys, lambda key: "no")  # type: ignore[arg-type,return-value]
    one = sheet("S-06", storeys="GROUND FLOOR")
    with pytest.raises(TypeError, match="13's symbolic"):
        check(reading([(one, [plan(["floor_1"])])]), recognisers=readers)


def test_two_sets_drawn_differently_read_alike() -> None:
    """ADR 0039: no storey key or word lives in the code."""

    def drawn(table: dict[str, tuple[str, ...]], symbolic: str, keys: list[str]) -> list[Any]:
        readers = stand_ins(table, symbolic=[symbolic])
        stated = next(iter(table))
        pairs = [
            (sheet("X-1", storeys=stated), [plan([keys[0]])]),
            (sheet("X-2", storeys=stated), [plan([keys[1]])]),
            (sheet("X-3", storeys=stated), [plan([symbolic])]),
        ]
        return [
            (str(r.outcome), r.finding and r.finding["params"]["not_drawn"])
            for r in check(reading(pairs), recognisers=readers)
        ]

    one = drawn({"GROUND FLOOR": ("ground",)}, "typical", ["ground", "floor_1"])
    two = drawn({"ERDGESCHOSS": ("eg",)}, "regel", ["eg", "og_1"])
    assert one == two == [("passed", None), ("fired", 1), ("passed", None)]
