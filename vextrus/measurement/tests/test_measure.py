"""`measure`'s own cases beyond the acceptance example: held Elements, missing facts, the Billing
Unit conversion, a Rebar Ratio set in kg/cft and the trace."""

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import pytest

from vextrus.measurement import library
from vextrus.measurement.models import RuleSetVersion
from vextrus.measurement.services import measure
from vextrus.measurement.services.measure import ratio_per_m3
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

BUILDING = uuid.UUID("5e160000-0000-4000-8000-0000000000a1")
STOREY = uuid.UUID("5e160000-0000-4000-8000-0000000000a2")


@dataclass(frozen=True)
class Storey:
    id: uuid.UUID
    name: str
    order: int
    height_m: str | None


@dataclass(frozen=True)
class Element:
    element_id: uuid.UUID
    family: str
    mark: str
    storey_id: uuid.UUID
    attrs: dict[str, str]
    held_by_question_id: uuid.UUID | None = None
    trace: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class Snapshot:
    building_id: uuid.UUID
    seq: int
    storeys: tuple[Storey, ...]
    elements: tuple[Element, ...]


def column(
    mark: str, *, held: bool = False, d: str | None = "0.508", trace: tuple[dict[str, Any], ...] = ()
) -> Element:
    attrs = {"vx.column.section_b": "0.254"}
    if d is not None:
        attrs["vx.column.section_d"] = d
    return Element(
        uuid.uuid4(),
        "column",
        mark,
        STOREY,
        attrs,
        held_by_question_id=uuid.uuid4() if held else None,
        trace=trace,
    )


def run(
    monkeypatch: pytest.MonkeyPatch,
    market: MarketProfile,
    make_developer: Any,
    elements: tuple[Element, ...],
    *,
    height: str | None = "2.921",
    **kwargs: Any,
) -> tuple[Any, ...]:
    snapshot = Snapshot(BUILDING, 3, (Storey(STOREY, "floor_1", 1, height),), elements)
    monkeypatch.setattr(
        "vextrus.live_model.services.snapshot", lambda *_a, **_k: snapshot, raising=False
    )
    [version] = RuleSetVersion.objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    with tenancy.acting_in(make_developer()):
        return measure(BUILDING, 3, version.id, **kwargs).lines


def test_a_held_column_is_awaiting_answer_and_include_held_false_leaves_it_out(
    monkeypatch: pytest.MonkeyPatch, market: MarketProfile, make_developer: Any
) -> None:
    elements = (column("C1"), column("C2", held=True))

    both = run(monkeypatch, market, make_developer, elements)
    measured_only = run(monkeypatch, market, make_developer, elements, include_held=False)

    assert {(line.state, line.held) for line in both} == {("measured", False), ("awaiting_answer", True)}
    assert len(both) == 6
    assert {line.state for line in measured_only} == {"measured"}
    assert len(measured_only) == 3


def test_a_column_without_its_depth_or_its_storeys_height_gets_no_line(
    monkeypatch: pytest.MonkeyPatch, market: MarketProfile, make_developer: Any
) -> None:
    assert run(monkeypatch, market, make_developer, (column("C1", d=None),)) == ()
    assert run(monkeypatch, market, make_developer, (column("C1"),), height=None) == ()


def test_the_quantity_is_converted_to_the_billing_unit_once_from_the_unrounded_figure(
    monkeypatch: pytest.MonkeyPatch, market: MarketProfile, make_developer: Any
) -> None:
    lines = {line.item_code: line for line in run(monkeypatch, market, make_developer, (column("C1"),))}
    exact = Decimal("0.254") * Decimal("0.508") * Decimal("2.921")

    concrete = lines["RCC-COL-1:1.5:3"]
    assert concrete.billing_unit == "cft"
    assert concrete.quantity == (exact / library.CFT_M3).quantize(Decimal("0.000001"))
    assert lines["FW-COL"].billing_unit == "sft"
    assert lines["FW-COL"].quantity == (
        2 * Decimal("0.762") * Decimal("2.921") / library.SFT_M2
    ).quantize(Decimal("0.000001"))
    assert lines["REBAR-500W"].billing_unit == "kg"
    assert lines["REBAR-500W"].quantity == lines["REBAR-500W"].qty_si


def test_a_rebar_ratio_set_in_kg_per_cft_is_applied_per_m3_exactly() -> None:
    per_m3 = ratio_per_m3(Decimal("6.8"), "kg/cft")

    assert abs(per_m3 * library.CFT_M3 - Decimal("6.8")) < Decimal("1e-20")
    assert ratio_per_m3(Decimal("240.1397"), "kg/m3") == Decimal("240.1397")


def test_the_starter_column_ratio_is_6_8_kg_per_cft_to_four_places() -> None:
    [column_ratio] = library.RATIOS

    assert column_ratio.confidence == "Low"
    assert abs(column_ratio.value - ratio_per_m3(Decimal("6.8"), "kg/cft")) < Decimal("0.00005")


def test_the_trace_carries_each_facts_sheet_and_view(
    monkeypatch: pytest.MonkeyPatch, market: MarketProfile, make_developer: Any
) -> None:
    anchor = {"sheet_id": "s-1", "view_id": "v-1", "x": 1}
    trace = ({"fact": "section_b", "kind": "drawing", "anchor": anchor},)

    lines = run(monkeypatch, market, make_developer, (column("C1", trace=trace),))

    assert len(lines) == 3
    for line in lines:
        assert line.trace == ({"sheet_id": "s-1", "view_id": "v-1", "anchor": anchor},)


def test_the_lines_come_in_the_snapshots_storey_and_mark_order(
    monkeypatch: pytest.MonkeyPatch, market: MarketProfile, make_developer: Any
) -> None:
    lines = run(monkeypatch, market, make_developer, (column("C3"), column("C1")))

    assert [line.rule_codes for line in lines] == [("F1",), ("FW2",), ("R2",)] * 2
    assert lines[0].element_id != lines[3].element_id
