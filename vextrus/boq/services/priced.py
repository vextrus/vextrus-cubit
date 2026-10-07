"""The Priced BOQ, read on demand (S16-B; M1.md C13): the strip, the BOQ Items as billed, the
allowance per open Takeoff Step and the measured share.

    body = priced.read(project_id)                # PricedBoq
    lines = priced.item_lines(project_id, "RCC-COL-1:1.5:3")

It reads three seams, each looked up on its module at call time (the tests set them):
`measurement.services.measure` (Measurement Lines, already in each Item's Billing Unit, so boq never
converts again), `rates.services.working_rate` (a `WorkingRate(amount, per_unit)`, or anything without
an `amount`, `RateNotEntered`) and `boq.services.steps.confirmed`.

**Each Element once.** A step's Measurement Lines are billed only while nothing else stands for it:
- a confirmed step bills its lines, and has no allowance;
- an open step, in a Building with a Gross Floor Area, is priced whole by its allowance; its lines
  show as `measured_so_far` on that allowance line and are not billed;
- with no Gross Floor Area there is no allowance, so every step bills its lines.
The strip's `total` = measured + awaiting answer + allowance. A line `awaiting_answer` (a held Element
at its best candidate) is never in `quantity`. An unpriced Item, or an allowance consumption with no
rate, adds zero and is counted in `unpriced_lines`. Money is rounded once per BOQ Item (and once per
allowance consumption), to the currency's minor units. The measured share is measured ÷ total (zero
while the total is), to four places.
"""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field, replace
from decimal import ROUND_HALF_UP, Decimal
from importlib import import_module
from typing import Any

from vextrus.boq.services import allowances as defaults
from vextrus.boq.services import descriptions, steps
from vextrus.platform.money import Currency, Money
from vextrus.platform.services import markets
from vextrus.projects import services as projects

QUANTITY = Decimal("0.01")
"""A billed quantity's places (the Billing Unit's line decimals, two for cft, sft and kg)."""
SHARE = Decimal("0.0001")

MEASURED = "measured"
AWAITING = "awaiting_answer"


@dataclass(frozen=True)
class Rate:
    amount: Decimal
    per_unit: str


@dataclass(frozen=True)
class Awaiting:
    quantity: Decimal
    amount: Money | None


@dataclass(frozen=True)
class StoreyQuantity:
    storey: str
    quantity: Decimal


@dataclass(frozen=True)
class BilledItem:
    number: str
    item_code: str
    section: str
    group: str
    billing_unit: str
    quantity: Decimal
    rate: Money | None
    amount: Money | None
    cost_basis: str
    rebar_basis: str | None
    rebar_from_drawing_share: Decimal | None
    awaiting_answer: Awaiting | None
    by_storey: tuple[StoreyQuantity, ...]
    lines: int
    description: descriptions.Description | None = None


@dataclass(frozen=True)
class Group:
    group: str
    items: tuple[BilledItem, ...]


@dataclass(frozen=True)
class Section:
    section: str
    groups: tuple[Group, ...]


@dataclass(frozen=True)
class AllowanceConsumption:
    item_code: str
    per_area: Decimal
    billing_unit: str
    quantity: Decimal
    rate: Money | None
    amount: Money | None


@dataclass(frozen=True)
class AllowanceLine:
    step: str
    part: str
    cost_basis: str
    consumptions: tuple[AllowanceConsumption, ...]
    amount: Money
    measured_so_far: Money
    source: str
    confidence: str
    unpriced: int
    description: descriptions.Description | None = None


@dataclass(frozen=True)
class Gfa:
    value: Decimal
    """In m2, to four places, as stored."""
    unit: str
    basis: str


@dataclass(frozen=True)
class Strip:
    measured: Money
    awaiting_answer: Money
    allowance: Money
    total: Money
    unpriced_lines: int
    per_area: Money | None
    """The total per sft of Gross Floor Area."""
    gfa: Gfa | None


@dataclass(frozen=True)
class PricedBoq:
    building_id: uuid.UUID | None
    """The Project's Building (one in M1): the one its Gross Floor Area is entered on."""
    strip: Strip
    measured_share: Decimal
    sections: tuple[Section, ...]
    allowances: tuple[AllowanceLine, ...]


@dataclass(frozen=True)
class TracedLine:
    """A Measurement Line as billed (C11's fields, those `measure` leaves out at their empty value),
    with where it was read."""

    element_id: uuid.UUID | None
    item_code: str
    storey: str | None
    step: str
    family: str
    state: str
    rule_codes: tuple[str, ...]
    nos: int
    l_m: Decimal | None
    b_m: Decimal | None
    h_m: Decimal | None
    area_m2: Decimal | None
    qty_si: Decimal
    unit_si: str
    billing_unit: str
    quantity: Decimal
    rebar_basis: str | None
    diameter_mm: int | None
    assumed_split: bool
    lap: bool
    held: bool
    trace: tuple[dict[str, Any], ...]
    """Each `{sheet_id, view_id, anchor}`; an anchor given as text is `{"ref": text}`."""
    mark: str = ""
    """The Element's mark as drawn (e.g. "C-2")."""


@dataclass
class _Reading:
    """One Building's lines, split by what stands for each step."""

    billed: list[Any] = field(default_factory=list)
    allowances: list[AllowanceLine] = field(default_factory=list)
    unpriced: int = 0


def read(project_id: uuid.UUID) -> PricedBoq:
    """The Priced BOQ of the Project's Buildings (`ProjectNotFound` outside the Membership's scope)."""
    project = projects.get(project_id)
    currency = markets.get(project.market_id).currency
    rates = _Rates(project_id)
    billed: list[Any] = []
    allowance_lines: list[AllowanceLine] = []
    unpriced = 0
    area_m2: Decimal | None = None
    buildings = projects.buildings(project_id)
    first_building = buildings[0].id if buildings else None
    for building in buildings:
        gfa = projects.gfa.gross_floor_area(building.id, project_id=project_id)
        reading = _read_building(project_id, building.id, gfa, rates, currency)
        billed += reading.billed
        allowance_lines += reading.allowances
        unpriced += reading.unpriced
        if gfa is not None:
            area_m2 = gfa.m2 if area_m2 is None else area_m2 + gfa.m2

    items = _bill(billed, rates, currency)
    zero = Money.zero(currency)
    measured = _sum((item.amount for item in items), zero)
    awaiting = _sum(
        (item.awaiting_answer.amount for item in items if item.awaiting_answer is not None), zero
    )
    allowance = _sum((line.amount for line in allowance_lines), zero)
    total = measured + awaiting + allowance
    unpriced += sum(1 for item in items if item.rate is None)
    per_area = None
    if area_m2 is not None:
        sft = area_m2 / projects.gfa.M2_PER_SFT
        per_area = Money.of(total.amount / sft, currency)
    share = Decimal(0) if total.amount == 0 else (measured.amount / total.amount)
    strip = Strip(
        measured=measured,
        awaiting_answer=awaiting,
        allowance=allowance,
        total=total,
        unpriced_lines=unpriced,
        per_area=per_area,
        gfa=None if area_m2 is None else Gfa(area_m2, "m2", "entered"),
    )
    return PricedBoq(
        building_id=first_building,
        strip=strip,
        measured_share=share.quantize(SHARE, rounding=ROUND_HALF_UP),
        sections=_sections(items),
        allowances=tuple(allowance_lines),
    )


def item_lines(project_id: uuid.UUID, item_code: str) -> tuple[TracedLine, ...]:
    """The Measurement Lines billed in one BOQ Item, each with its trace (none for an Item not
    billed)."""
    projects.get(project_id)
    found: list[TracedLine] = []
    for building in projects.buildings(project_id):
        gfa = projects.gfa.gross_floor_area(building.id, project_id=project_id)
        for line in _billed_lines(project_id, building.id, gfa is not None):
            if line.item_code == item_code:
                found.append(_traced(line))
    return tuple(found)


def _read_building(
    project_id: uuid.UUID,
    building_id: uuid.UUID,
    gfa: Any,
    rates: _Rates,
    currency: Currency,
) -> _Reading:
    lines = _measured(project_id, building_id)
    reading = _Reading()
    if gfa is None:
        reading.billed = list(lines)
        return reading
    closed = steps.confirmed(building_id)
    reading.billed = [line for line in lines if line.step in closed]
    open_lines = [line for line in lines if line.step not in closed]
    for default in defaults.DEFAULTS:
        if default.step in closed:
            continue
        so_far = [line for line in open_lines if line.step == default.step]
        line, unpriced = _allowance(default, gfa.sft, so_far, rates, currency)
        reading.allowances.append(line)
        reading.unpriced += unpriced
    return reading


def _billed_lines(project_id: uuid.UUID, building_id: uuid.UUID, has_gfa: bool) -> list[Any]:
    lines = _measured(project_id, building_id)
    if not has_gfa:
        return list(lines)
    closed = steps.confirmed(building_id)
    return [line for line in lines if line.step in closed]


def _measured(project_id: uuid.UUID, building_id: uuid.UUID) -> tuple[Any, ...]:
    """The Building's Measurement Lines at the Live Model's current version (seq None) under the
    Project's pinned Rule Set version (`measurement.services.pinned`, C11, where measurement
    answers it; until then None)."""
    measurement = import_module("vextrus.measurement.services")
    pinned = getattr(measurement, "pinned", None)
    version = None if pinned is None else getattr(pinned(project_id), "id", None)
    return tuple(measurement.measure(building_id, None, version).lines)


class _Rates:
    """`working_rate` asked once per item code per read."""

    def __init__(self, project_id: uuid.UUID) -> None:
        self.project_id = project_id
        self.known: dict[str, Rate | None] = {}

    def of(self, item_code: str, billing_unit: str) -> Rate | None:
        if item_code not in self.known:
            rates = import_module("vextrus.rates.services")
            answer = rates.working_rate(item_code, self.project_id)
            amount = getattr(answer, "amount", None)
            self.known[item_code] = (
                None if amount is None else Rate(Decimal(amount), str(answer.per_unit))
            )
        rate = self.known[item_code]
        if rate is None or rate.per_unit != billing_unit:
            # A rate per another unit than the Item's Billing Unit is not this Item's price.
            return None
        return rate


def _bill(lines: Sequence[Any], rates: _Rates, currency: Currency) -> tuple[BilledItem, ...]:
    # One BOQ Item per step and code: Rebar of the columns and of the beams bill in their own groups.
    by_code: dict[tuple[str, str], list[Any]] = {}
    for line in lines:
        by_code.setdefault((str(line.step), str(line.item_code)), []).append(line)
    items = [_item(code, of_code, rates, currency) for (_, code), of_code in by_code.items()]
    return tuple(items)


def _item(item_code: str, lines: list[Any], rates: _Rates, currency: Currency) -> BilledItem:
    first = lines[0]
    unit = str(first.billing_unit)
    measured = [line for line in lines if line.state == MEASURED]
    held = [line for line in lines if line.state != MEASURED]
    quantity = sum((Decimal(line.quantity) for line in measured), Decimal(0))
    held_quantity = sum((Decimal(line.quantity) for line in held), Decimal(0))
    rate = rates.of(item_code, unit)
    storeys: dict[str, Decimal] = {}
    for line in measured:
        storeys[str(line.storey)] = storeys.get(str(line.storey), Decimal(0)) + Decimal(line.quantity)
    rebar = next((line.rebar_basis for line in lines if line.rebar_basis), None)
    return BilledItem(
        number="",
        item_code=item_code,
        section=steps.section_of(first.step),
        group=str(first.step),
        billing_unit=unit,
        quantity=quantity,
        rate=None if rate is None else Money.of(rate.amount, currency),
        amount=_price(quantity, rate, currency),
        cost_basis=MEASURED,
        rebar_basis=rebar,
        rebar_from_drawing_share=None,
        awaiting_answer=None
        if not held
        else Awaiting(held_quantity, _price(held_quantity, rate, currency)),
        by_storey=tuple(StoreyQuantity(storey, qty) for storey, qty in storeys.items()),
        lines=len(lines),
        description=descriptions.of_item(item_code, str(first.step), lines),
    )


def _allowance(
    default: defaults.AllowanceDefault,
    gfa_sft: Decimal,
    so_far: list[Any],
    rates: _Rates,
    currency: Currency,
) -> tuple[AllowanceLine, int]:
    consumptions = []
    unpriced = 0
    for used in default.consumptions:
        quantity = (gfa_sft * used.per_area).quantize(QUANTITY, rounding=ROUND_HALF_UP)
        rate = rates.of(used.item_code, used.billing_unit)
        unpriced += rate is None
        consumptions.append(
            AllowanceConsumption(
                item_code=used.item_code,
                per_area=used.per_area,
                billing_unit=used.billing_unit,
                quantity=quantity,
                rate=None if rate is None else Money.of(rate.amount, currency),
                amount=_price(quantity, rate, currency),
            )
        )
    zero = Money.zero(currency)
    amount = _sum((c.amount for c in consumptions), zero)
    so_far_amount = _sum(
        (
            _price(Decimal(line.quantity), rates.of(line.item_code, str(line.billing_unit)), currency)
            for line in so_far
            # Foundations' lines are not split by part until M1-07 names the piles' Items: all on `rest`.
            if default.part in ("whole", "rest")
        ),
        zero,
    )
    line = AllowanceLine(
        step=default.step,
        part=default.part,
        cost_basis="allowance",
        consumptions=tuple(consumptions),
        amount=amount,
        measured_so_far=so_far_amount,
        source=defaults.SOURCE,
        confidence=defaults.CONFIDENCE,
        unpriced=unpriced,
        description=descriptions.of_allowance(default.step),
    )
    return line, unpriced


def _price(quantity: Decimal, rate: Rate | None, currency: Currency) -> Money | None:
    if rate is None:
        return None
    return Money.of(quantity * rate.amount, currency)


def _sum(amounts: Iterable[Money | None], zero: Money) -> Money:
    total = zero
    for amount in amounts:
        if amount is not None:
            total = total + amount
    return total


def _sections(items: Sequence[BilledItem]) -> tuple[Section, ...]:
    """Sections in print order, groups in Takeoff Step order, Items by code; each numbered
    `<section>.<group>.<item>` from one."""
    sections = []
    for s_no, (section, keys) in enumerate(
        ((s, k) for s, k in steps.SECTIONS if any(i.section == s for i in items)), start=1
    ):
        groups = []
        present = [key for key in keys if any(i.section == section and i.group == key for i in items)]
        for g_no, key in enumerate(present, start=1):
            of_group = sorted((i for i in items if i.group == key), key=lambda i: i.item_code)
            numbered = tuple(
                _numbered(item, f"{s_no}.{g_no}.{n}") for n, item in enumerate(of_group, start=1)
            )
            groups.append(Group(key, numbered))
        sections.append(Section(section, tuple(groups)))
    return tuple(sections)


def _numbered(item: BilledItem, number: str) -> BilledItem:
    return replace(item, number=number)


def _traced(line: Any) -> TracedLine:
    def got(name: str, default: Any = None) -> Any:
        return getattr(line, name, default)

    diameter = got("diameter_mm")
    return TracedLine(
        element_id=got("element_id"),
        item_code=str(line.item_code),
        storey=None if got("storey") is None else str(got("storey")),
        step=str(line.step),
        family=str(line.family),
        state=str(line.state),
        rule_codes=tuple(str(code) for code in got("rule_codes", ())),
        nos=int(got("nos", 1)),
        l_m=got("l_m"),
        b_m=got("b_m"),
        h_m=got("h_m"),
        area_m2=got("area_m2"),
        qty_si=Decimal(got("qty_si", line.quantity)),
        unit_si=str(got("unit_si", line.billing_unit)),
        billing_unit=str(line.billing_unit),
        quantity=Decimal(line.quantity),
        rebar_basis=got("rebar_basis"),
        diameter_mm=None if diameter is None else int(diameter),
        assumed_split=bool(got("assumed_split", False)),
        lap=bool(got("lap", False)),
        held=bool(got("held", line.state != MEASURED)),
        trace=tuple(_trace_entry(t) for t in line.trace),
        mark=str(got("mark") or ""),
    )


def _trace_entry(entry: Any) -> dict[str, Any]:
    anchor = entry.get("anchor")
    return {
        "sheet_id": entry.get("sheet_id"),
        "view_id": entry.get("view_id"),
        "anchor": anchor if anchor is None or isinstance(anchor, dict) else {"ref": str(anchor)},
    }
