"""The column's measure beyond C11's worked example (engine/families/column/measure.py)."""

from decimal import Decimal

from engine.families.column.geometry import geometry
from engine.families.column.measure import measure
from engine.families.types import ElementFacts, OwnedSolid, RuleSetData

ZERO = Decimal(0)


def _owned(b: str, d: str, z0: str, z1: str) -> OwnedSolid:
    bb, dd = Decimal(b), Decimal(d)
    return OwnedSolid(
        polygon=((ZERO, ZERO), (bb, ZERO), (bb, dd), (ZERO, dd)), z0=Decimal(z0), z1=Decimal(z1)
    )


def _facts(**values: object) -> ElementFacts:
    return ElementFacts(family="column", element_id="e1", mark="C1", storey="floor_1", values=values)


def test_without_a_ratio_there_is_no_rebar_line() -> None:
    lines = measure(
        _facts(section_b=Decimal("0.3"), section_d=Decimal("0.3")),
        _owned("0.3", "0.3", "0", "3"),
        RuleSetData(rebar_ratios={}),
    )

    assert [line.unit_si for line in lines] == ["m3", "m2"]
    assert lines[0].qty_si == Decimal("0.270000")


def test_the_section_is_the_confirmed_size_not_the_owned_outline() -> None:
    lines = measure(
        _facts(section_b=Decimal("0.254"), section_d=Decimal("0.508")),
        _owned("0.3", "0.6", "0", "1"),
        RuleSetData(),
    )

    assert lines[0].qty_si == Decimal("0.129032")


def test_a_section_not_confirmed_falls_back_to_the_owned_solid() -> None:
    lines = measure(_facts(), _owned("0.3", "0.6", "1", "4"), RuleSetData())

    assert lines[0].qty_si == Decimal("0.540000")
    assert lines[1].qty_si == Decimal("5.400000")


def test_a_value_carried_with_its_text_is_read_as_a_decimal() -> None:
    class Held:
        value = Decimal("0.25")
        unit = "m"
        text = "250x500"

    lines = measure(
        _facts(section_b=Held(), section_d=Decimal("0.5")),
        _owned("0.25", "0.5", "0", "2"),
        RuleSetData(),
    )

    assert lines[0].qty_si == Decimal("0.250000")


def test_the_measure_rounds_half_up_at_six_places() -> None:
    lines = measure(
        _facts(section_b=Decimal("0.1"), section_d=Decimal("0.1")),
        _owned("0.1", "0.1", "0", "0.0000005"),
        RuleSetData(),
    )

    assert lines[0].qty_si == Decimal("0.000000")
    lines = measure(
        _facts(section_b=Decimal("1"), section_d=Decimal("1")),
        _owned("1", "1", "0", "0.0000005"),
        RuleSetData(),
    )
    assert lines[0].qty_si == Decimal("0.000001")


def test_the_prism_spans_the_owned_solid() -> None:
    owned = _owned("0.254", "0.508", "0", "2.921")

    [prism] = geometry(_facts(), owned)

    assert prism.kind == "prism"
    assert (prism.z0, prism.z1) == (Decimal(0), Decimal("2.921"))
