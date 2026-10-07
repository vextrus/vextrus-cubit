"""Ticket S16-M: `measurement.services.measure` on columns, C11's worked example exact.

The plan (docs/plans/M1.md C11; session 16's contract, "measurement (M)"):
`measurement.services.measure(building_id, model_version_seq, rule_set_version_id) ->
Measured(lines: tuple[MeasurementLine])`, "one rounding place; Decimal only"; a Measurement Line is
"SI, never a float". C11's worked example: "0.254 x 0.508 x 2.921 = 0.376902472, rounded to six
places", `{"item_code": "RCC-COL-1:1.5:3", ..., "qty_si": "0.376902", "unit_si": "m3",
"rebar_basis": "by_ratio"}`. The contract's column rules: "F1 concrete (b x d x h, m3), FW2 formwork
(2(b+d) x h, m2), R2 rebar by ratio (concrete m3 x kg/m3 ratio, `rebar_basis: "by_ratio"`)".

`measure` reads the Live Model through `live_model.services.snapshot(building_id, seq)` (C7), which is
S16-L's. To stay independent of it, these tests replace that attribute of `vextrus.live_model.services`
with a snapshot of one column, so `measure` must call it through the module
(`live_model.services.snapshot(...)`), not a name bound at import. The snapshot's shape follows C7's
ElementState example (`element_id`, `mark`, `storey_id`, `mix`, `grade`, `attrs` with
`vx.column.section_b` and `vx.column.section_d` in m as decimal strings, `held_by_question_id`) plus
`family`, and the contract's storey (`id`, `name`, `height_m`). This subset has no slab, so the
column's h is its storey's `height_m`: 2.921 m, C11's h after the slab soffit.
"""

import dataclasses
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from importlib import import_module
from typing import Any

import pytest

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile

B = Decimal("0.254")
D = Decimal("0.508")
H = Decimal("2.921")
SIX = Decimal("0.000001")


def model(name: str) -> Any:
    """A `measurement` model S16-M adds, found when the test runs (so the file collects before)."""
    return getattr(import_module("vextrus.measurement.models"), name)


pytestmark = pytest.mark.django_db(databases=["default", "owner"])


@dataclass(frozen=True)
class StoreyState:
    id: uuid.UUID
    name: str
    order: int
    height_m: str
    level_m: str | None = None


@dataclass(frozen=True)
class ElementState:
    element_id: uuid.UUID
    family: str
    mark: str
    storey_id: uuid.UUID
    attrs: dict[str, str]
    grid_ref: str | None = None
    mix: str | None = None
    grade: str | None = None
    held_by_question_id: uuid.UUID | None = None


@dataclass(frozen=True)
class Snapshot:
    building_id: uuid.UUID
    seq: int
    storeys: tuple[StoreyState, ...]
    elements: tuple[ElementState, ...]
    figures_hash: str = field(default="sha256:test")


BUILDING = uuid.UUID("5e160000-0000-4000-8000-000000000001")
FLOOR_1 = uuid.UUID("5e160000-0000-4000-8000-000000000002")
COLUMN = uuid.UUID("5e160000-0000-4000-8000-000000000003")
GRID_B = uuid.UUID("5e160000-0000-4000-8000-000000000004")
SEQ = 9


def one_column_snapshot(building_id: uuid.UUID, seq: int | None = None) -> Snapshot:
    floor_1 = StoreyState(id=FLOOR_1, name="floor_1", order=1, height_m="2.921", level_m="3.048")
    column = ElementState(
        element_id=COLUMN,
        family="column",
        mark="C2",
        storey_id=FLOOR_1,
        grid_ref="B/2",
        mix="1:1.5:3",
        grade="500W",
        attrs={"vx.column.section_b": "0.254", "vx.column.section_d": "0.508"},
    )
    grid_line = ElementState(
        element_id=GRID_B, family="grid_line", mark="B", storey_id=FLOOR_1, attrs={}
    )
    return Snapshot(
        building_id=building_id,
        seq=SEQ if seq is None else seq,
        storeys=(floor_1,),
        elements=(column, grid_line),
    )


@pytest.fixture
def measured_lines(
    monkeypatch: pytest.MonkeyPatch, market: MarketProfile, make_developer: Any
) -> tuple[Any, ...]:
    monkeypatch.setattr("vextrus.live_model.services.snapshot", one_column_snapshot, raising=False)
    [version] = model("RuleSetVersion").objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    developer = make_developer()
    with tenancy.acting_in(developer):
        measured = import_module("vextrus.measurement.services").measure(BUILDING, SEQ, version.id)
    return tuple(measured.lines)


def line_of(lines: tuple[Any, ...], item_code: str) -> Any:
    [line] = [line for line in lines if line.item_code == item_code]
    return line


def column_ratio(market: MarketProfile) -> Decimal:
    [version] = model("RuleSetVersion").objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    [ratio] = (
        model("RebarRatio")
        .objects.using(OWNER_ALIAS)
        .filter(tenant_id=market.library_id, version=version, family_key="column", band__isnull=True)
    )
    return Decimal(ratio.value)


def test_a_column_measures_c11s_worked_example_exactly(measured_lines: tuple[Any, ...]) -> None:
    line = line_of(measured_lines, "RCC-COL-1:1.5:3")

    assert line.qty_si == Decimal("0.376902")
    assert str(line.qty_si) == "0.376902"
    assert line.unit_si == "m3"
    assert str(line.element_id) == str(COLUMN)
    assert "F1" in line.rule_codes


def test_column_formwork_is_two_b_plus_d_times_h_in_m2(measured_lines: tuple[Any, ...]) -> None:
    line = line_of(measured_lines, "FW-COL")

    assert line.qty_si == (2 * (B + D) * H).quantize(SIX)
    assert str(line.qty_si) == "4.451604"
    assert line.unit_si == "m2"
    assert "FW2" in line.rule_codes


def test_column_rebar_is_the_concrete_times_the_ratio_in_kg_by_ratio(
    measured_lines: tuple[Any, ...], market: MarketProfile
) -> None:
    line = line_of(measured_lines, "REBAR-500W")
    exact = B * D * H * column_ratio(market)

    assert line.unit_si == "kg"
    assert line.rebar_basis == "by_ratio"
    assert "R2" in line.rule_codes
    assert isinstance(line.qty_si, Decimal)
    assert line.qty_si.as_tuple().exponent == -6
    assert abs(line.qty_si - exact) <= Decimal("0.0000005"), "rounded once, from the unrounded concrete"


def test_one_column_gives_exactly_its_three_lines_and_a_grid_line_none(
    measured_lines: tuple[Any, ...],
) -> None:
    assert sorted(line.item_code for line in measured_lines) == [
        "FW-COL",
        "RCC-COL-1:1.5:3",
        "REBAR-500W",
    ]
    assert {str(line.element_id) for line in measured_lines} == {str(COLUMN)}


def test_no_measurement_line_holds_a_float(measured_lines: tuple[Any, ...]) -> None:
    assert measured_lines
    for line in measured_lines:
        values = (
            {f.name: getattr(line, f.name) for f in dataclasses.fields(line)}
            if dataclasses.is_dataclass(line)
            else dict(vars(line))
        )
        floats = {name: value for name, value in values.items() if isinstance(value, float)}
        assert not floats, f"{line.item_code} holds floats: {floats}"
        assert isinstance(line.qty_si, Decimal)
