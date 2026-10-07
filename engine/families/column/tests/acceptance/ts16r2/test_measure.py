"""S16-R2: the column's measure (docs/plans/M1.md C11; session 16's contract, column).

C11's worked example: a column of a 3.048 m storey under a 127 mm slab stops at the slab soffit, so
h = 2.921 m; 0.254 x 0.508 x 2.921 = 0.376902472, rounded to six places: "0.376902" m3.
"""

from decimal import Decimal

from engine.families.column.measure import measure  # type: ignore[import-not-found, unused-ignore]
from engine.families.types import LineDraft  # type: ignore[import-not-found, unused-ignore]

from . import _k0

B, D, SOFFIT = "0.254", "0.508", "2.921"
RATIO = "150"


def _lines() -> tuple[LineDraft, ...]:
    lines: tuple[LineDraft, ...] = measure(
        _k0.column(B, D), _k0.owned(B, D, "0", SOFFIT), _k0.rules(RATIO)
    )
    return lines


def _line(unit: str) -> LineDraft:
    found = [line for line in _lines() if line.unit_si == unit]
    assert len(found) == 1, f"{len(found)} lines in {unit}: {_lines()!r}"
    return found[0]


def test_c11s_worked_column_measures_0_376902_m3_of_concrete() -> None:
    concrete = _line("m3")
    assert _k0.quantity_of(concrete) == Decimal("0.376902")
    assert "F1" in concrete.rule_codes


def test_the_concrete_quantity_is_rounded_to_six_places_never_a_float() -> None:
    qty = _line("m3").qty_si
    assert not isinstance(qty, float)
    assert str(qty) == "0.376902"


def test_formwork_is_twice_b_plus_d_times_h_in_m2() -> None:
    formwork = _line("m2")
    # 2 x (0.254 + 0.508) x 2.921 = 4.451604
    assert _k0.quantity_of(formwork) == Decimal("4.451604")
    assert "FW2" in formwork.rule_codes


def test_rebar_is_measured_by_the_rule_sets_ratio_on_the_concrete() -> None:
    rebar = _line("kg")
    assert rebar.rebar_basis == "by_ratio"
    assert "R2" in rebar.rule_codes
    # 0.376902 m3 x 150 kg/m3 = 56.535 kg (to the gram, whether the concrete is rounded first or not)
    assert _k0.quantity_of(rebar).quantize(Decimal("0.001")) == Decimal("56.535")


def test_a_different_ratio_changes_the_rebar_and_nothing_else() -> None:
    lines = measure(_k0.column(B, D), _k0.owned(B, D, "0", SOFFIT), _k0.rules("100"))
    by_unit = {line.unit_si: _k0.quantity_of(line) for line in lines}
    assert by_unit["m3"] == Decimal("0.376902")
    assert by_unit["m2"] == Decimal("4.451604")
    assert by_unit["kg"].quantize(Decimal("0.001")) == Decimal("37.690")


def test_no_line_holds_a_float() -> None:
    for line in _lines():
        for name in ("qty_si", "l_m", "b_m", "h_m", "area_m2"):
            assert not isinstance(getattr(line, name, None), float), f"{name} of {line!r}"
