"""`measure`: a Building's Measurement Lines at one Model Version, by one Rule Set Version (C11, M1.md;
session 16's contract, "measurement (M)").

It reads the Live Model through `live_model.services.snapshot(building_id, seq)` (looked up on the
module when it is called, so a test may replace it) and stores nothing. This subset measures a
column by F1 (concrete, b x d x h in m3), FW2 (formwork, 2(b+d) x h in m2) and R2 (Rebar, F1's
unrounded concrete times the family's Rebar Ratio, in kg, `rebar_basis: "by_ratio"`). A column's h is
its storey's height. Every figure is a `Decimal`; the one rounding place is `_round_si`, applied once
to each Measurement Line's SI quantity and once to its quantity in the item's Billing Unit, each
taken from the unrounded product, never from another rounded figure.
"""

import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from vextrus.live_model import services as live_model
from vextrus.measurement.library import BILLED_SYSTEM, CFT_M3
from vextrus.measurement.models import (
    BoqItem,
    BoqItemBillingUnit,
    MeasurementRule,
    RebarRatio,
    RuleSetVersion,
)

UNIT_SYSTEM = BILLED_SYSTEM
"""The slice bills in the Market's imperial Billing Units (the contract's seam 4)."""
SIX_PLACES = Decimal("0.000001")
SECTION_B = "vx.column.section_b"
SECTION_D = "vx.column.section_d"
MEASURED = "measured"
AWAITING = "awaiting_answer"


@dataclass(frozen=True)
class MeasurementLine:
    """One BOQ Item's quantity for one Element (C11's example), SI, never a float, with the fields
    the BOQ reads: its Takeoff Step, family, state, Billing Unit, quantity in it and its trace."""

    item_code: str
    element_id: uuid.UUID
    storey: str
    rule_codes: tuple[str, ...]
    nos: int
    l_m: Decimal | None
    b_m: Decimal | None
    h_m: Decimal | None
    area_m2: Decimal | None
    qty_si: Decimal
    unit_si: str
    rebar_basis: str | None
    diameter_mm: Decimal | None
    assumed_split: bool
    lap: bool
    held: bool
    step: str
    family: str
    state: str
    billing_unit: str
    quantity: Decimal
    trace: tuple[Mapping[str, Any], ...]
    mark: str = ""
    """The Element's mark as drawn (e.g. "C-2")."""


@dataclass(frozen=True)
class Measured:
    lines: tuple[MeasurementLine, ...]


@dataclass(frozen=True)
class _Column:
    b: Decimal
    d: Decimal
    h: Decimal


@dataclass(frozen=True)
class _Rule:
    code: str
    item_code: str
    family_key: str
    params: Mapping[str, Any]


def _round_si(value: Decimal) -> Decimal:
    """The one rounding place: six places, half up."""
    return value.quantize(SIX_PLACES, rounding=ROUND_HALF_UP)


def _concrete(column: _Column) -> Decimal:
    return column.b * column.d * column.h


def _formwork(column: _Column) -> Decimal:
    return 2 * (column.b + column.d) * column.h


def measure(
    building_id: uuid.UUID,
    model_version_seq: int,
    rule_set_version_id: uuid.UUID,
    *,
    include_held: bool = True,
) -> Measured:
    """The Measurement Lines of `building_id` at `model_version_seq` under the Rule Set Version.

    A held Element (one a Question holds) is measured at its best candidate with state
    `awaiting_answer`; `include_held=False` leaves it out. An Element without the facts a rule
    needs (a section, its storey's height) gets no line: its Question holds it.
    """
    if rule_set_version_id is None:
        # No Project pins a Rule Set Version yet (C11's `pinned` is a later ticket): the newest one.
        rule_set_version_id = _newest_version()
    rules = _rules(rule_set_version_id)
    units = _billing_units(rule_set_version_id)
    ratios = _ratios(rule_set_version_id)
    snapshot = getattr(live_model, "snapshot")(building_id, model_version_seq)  # noqa: B009
    storeys = {_get(s, "id"): s for s in snapshot.storeys}
    order = {_get(s, "id"): _get(s, "order") or 0 for s in snapshot.storeys}
    elements = sorted(
        (e for e in snapshot.elements if _get(e, "family") == "column"),
        key=lambda e: (
            order.get(_get(e, "storey_id"), 0),
            str(_get(e, "mark") or ""),
            str(_get(e, "element_id")),
        ),
    )
    lines: list[MeasurementLine] = []
    for element in elements:
        held = _get(element, "held_by_question_id") is not None
        if held and not include_held:
            continue
        column = _column(element, storeys.get(_get(element, "storey_id")))
        if column is None:
            continue
        lines.extend(
            _column_lines(
                element, storeys[_get(element, "storey_id")], column, held, rules, units, ratios
            )
        )
    return Measured(lines=tuple(lines))


def _column_lines(
    element: Any,
    storey: Any,
    column: _Column,
    held: bool,
    rules: Mapping[str, _Rule],
    units: Mapping[str, BoqItemBillingUnit],
    ratios: Mapping[str, Decimal],
) -> Iterable[MeasurementLine]:
    concrete = _concrete(column)
    quantities: list[tuple[_Rule, Decimal, bool]] = []
    if (rule := rules.get("F1")) is not None:
        quantities.append((rule, concrete, False))
    if (rule := rules.get("FW2")) is not None:
        quantities.append((rule, _formwork(column), False))
    ratio = ratios.get("column")
    if (rule := rules.get("R2")) is not None and ratio is not None:
        quantities.append((rule, concrete * ratio, True))
    trace = _trace(element)
    for rule, exact, by_ratio in quantities:
        unit = units.get(rule.item_code)
        if unit is None:
            continue
        yield MeasurementLine(
            item_code=rule.item_code,
            element_id=_get(element, "element_id"),
            storey=_get(storey, "name"),
            rule_codes=(rule.code,),
            nos=1,
            l_m=column.b,
            b_m=column.d,
            h_m=column.h,
            area_m2=None,
            qty_si=_round_si(exact),
            unit_si=unit.unit_si,
            rebar_basis="by_ratio" if by_ratio else None,
            diameter_mm=None,
            assumed_split=False,
            lap=False,
            held=held,
            step="columns",
            family="column",
            state=AWAITING if held else MEASURED,
            billing_unit=unit.billing_unit,
            quantity=_round_si(exact / unit.si_per_unit),
            trace=trace,
            mark=str(_get(element, "mark") or ""),
        )


def _column(element: Any, storey: Any) -> _Column | None:
    attrs = _get(element, "attrs") or {}
    height = _get(storey, "height_m") if storey is not None else None
    values = (attrs.get(SECTION_B), attrs.get(SECTION_D), height)
    if any(value is None for value in values):
        return None
    b, d, h = (Decimal(str(value)) for value in values)
    return _Column(b, d, h)


def _trace(element: Any) -> tuple[Mapping[str, Any], ...]:
    out: list[Mapping[str, Any]] = []
    for entry in _get(element, "trace") or ():
        anchor = _get(entry, "anchor") or {}
        out.append(
            {
                "sheet_id": _get(anchor, "sheet_id"),
                "view_id": _get(anchor, "view_id"),
                "anchor": anchor,
            }
        )
    return tuple(out)


def _get(obj: Any, name: str) -> Any:
    """A field of a snapshot row, whether the Live Model hands a mapping or an object."""
    if isinstance(obj, Mapping):
        return obj.get(name)
    return getattr(obj, name, None)


def _newest_version() -> uuid.UUID | None:
    return RuleSetVersion.objects.order_by("-number").values_list("id", flat=True).first()


def _rules(version_id: uuid.UUID) -> dict[str, _Rule]:
    rows = MeasurementRule.objects.filter(version_id=version_id, kind="quantity", family_key="column")
    return {
        row.code: _Rule(row.code, row.params.get("item_code", ""), row.family_key, row.params)
        for row in rows
    }


def _billing_units(version_id: uuid.UUID) -> dict[str, BoqItemBillingUnit]:
    items = BoqItem.objects.filter(version_id=version_id).values_list("id", "item_code")
    code_of = dict(items)
    rows = BoqItemBillingUnit.objects.filter(item_id__in=code_of, unit_system=UNIT_SYSTEM)
    return {code_of[row.item_id]: row for row in rows}


def _ratios(version_id: uuid.UUID) -> dict[str, Decimal]:
    """Each family's default Rebar Ratio in kg per m3 (a ratio set in kg/cft is converted exactly)."""
    ratios: dict[str, Decimal] = {}
    for row in RebarRatio.objects.filter(version_id=version_id, band__isnull=True):
        ratios[row.family_key] = ratio_per_m3(row.value, row.unit)
    return ratios


def ratio_per_m3(value: Decimal, unit: str) -> Decimal:
    """A Rebar Ratio in kg per m3: one set in kg/cft is converted exactly, not rounded."""
    return value / CFT_M3 if unit == "kg/cft" else value
