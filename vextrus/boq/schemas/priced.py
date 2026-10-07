"""The Priced BOQ in the API (S16-B; M1.md C13): money `{amount, currency}`, quantities and shares as
decimal strings, never floats."""

import uuid

from ninja import Schema

from vextrus.boq.services import priced
from vextrus.platform.money import Money
from vextrus.platform.schemas import MoneySchema


def _money(value: Money | None) -> MoneySchema | None:
    return None if value is None else MoneySchema.from_money(value)


class BoqGfaOut(Schema):
    value: str
    unit: str
    basis: str


class BoqStripOut(Schema):
    measured: MoneySchema
    awaiting_answer: MoneySchema
    allowance: MoneySchema
    total: MoneySchema
    unpriced_lines: int
    per_area: MoneySchema | None
    gfa: BoqGfaOut | None


class BoqAwaitingOut(Schema):
    quantity: str
    amount: MoneySchema | None


class BoqStoreyQuantityOut(Schema):
    storey: str
    quantity: str


class BoqTraceCountOut(Schema):
    lines: int


class BoqItemOut(Schema):
    number: str
    item_code: str
    section: str
    group: str
    billing_unit: str
    quantity: str
    rate: MoneySchema | None
    amount: MoneySchema | None
    cost_basis: str
    rebar_basis: str | None
    rebar_from_drawing_share: str | None
    awaiting_answer: BoqAwaitingOut | None
    by_storey: list[BoqStoreyQuantityOut]
    trace: BoqTraceCountOut

    @classmethod
    def from_view(cls, item: priced.BilledItem) -> BoqItemOut:
        held = item.awaiting_answer
        share = item.rebar_from_drawing_share
        return cls(
            number=item.number,
            item_code=item.item_code,
            section=item.section,
            group=item.group,
            billing_unit=item.billing_unit,
            quantity=str(item.quantity),
            rate=_money(item.rate),
            amount=_money(item.amount),
            cost_basis=item.cost_basis,
            rebar_basis=item.rebar_basis,
            rebar_from_drawing_share=None if share is None else str(share),
            awaiting_answer=None
            if held is None
            else BoqAwaitingOut(quantity=str(held.quantity), amount=_money(held.amount)),
            by_storey=[
                BoqStoreyQuantityOut(storey=s.storey, quantity=str(s.quantity)) for s in item.by_storey
            ],
            trace=BoqTraceCountOut(lines=item.lines),
        )


class BoqGroupOut(Schema):
    group: str
    items: list[BoqItemOut]


class BoqSectionOut(Schema):
    section: str
    groups: list[BoqGroupOut]


class BoqConsumptionOut(Schema):
    item_code: str
    per_area: str
    billing_unit: str
    quantity: str
    rate: MoneySchema | None
    amount: MoneySchema | None


class BoqAllowanceOut(Schema):
    step: str
    part: str
    cost_basis: str
    consumptions: list[BoqConsumptionOut]
    amount: MoneySchema
    measured_so_far: MoneySchema
    source: str
    confidence: str
    unpriced: int

    @classmethod
    def from_view(cls, line: priced.AllowanceLine) -> BoqAllowanceOut:
        return cls(
            step=line.step,
            part=line.part,
            cost_basis=line.cost_basis,
            consumptions=[
                BoqConsumptionOut(
                    item_code=c.item_code,
                    per_area=str(c.per_area),
                    billing_unit=c.billing_unit,
                    quantity=str(c.quantity),
                    rate=_money(c.rate),
                    amount=_money(c.amount),
                )
                for c in line.consumptions
            ],
            amount=MoneySchema.from_money(line.amount),
            measured_so_far=MoneySchema.from_money(line.measured_so_far),
            source=line.source,
            confidence=line.confidence,
            unpriced=line.unpriced,
        )


class PricedBoqOut(Schema):
    strip: BoqStripOut
    measured_share: str
    sections: list[BoqSectionOut]
    allowances: list[BoqAllowanceOut]

    @classmethod
    def from_view(cls, boq: priced.PricedBoq) -> PricedBoqOut:
        strip = boq.strip
        gfa = strip.gfa
        return cls(
            strip=BoqStripOut(
                measured=MoneySchema.from_money(strip.measured),
                awaiting_answer=MoneySchema.from_money(strip.awaiting_answer),
                allowance=MoneySchema.from_money(strip.allowance),
                total=MoneySchema.from_money(strip.total),
                unpriced_lines=strip.unpriced_lines,
                per_area=_money(strip.per_area),
                gfa=None
                if gfa is None
                else BoqGfaOut(value=str(gfa.value), unit=gfa.unit, basis=gfa.basis),
            ),
            measured_share=str(boq.measured_share),
            sections=[
                BoqSectionOut(
                    section=s.section,
                    groups=[
                        BoqGroupOut(group=g.group, items=[BoqItemOut.from_view(i) for i in g.items])
                        for g in s.groups
                    ],
                )
                for s in boq.sections
            ],
            allowances=[BoqAllowanceOut.from_view(line) for line in boq.allowances],
        )


class BoqTraceOut(Schema):
    sheet_id: str
    view_id: str
    anchor: str


class BoqLineOut(Schema):
    element_id: uuid.UUID
    item_code: str
    step: str
    family: str
    storey: str
    billing_unit: str
    quantity: str
    state: str
    rebar_basis: str | None
    trace: list[BoqTraceOut]

    @classmethod
    def from_view(cls, line: priced.TracedLine) -> BoqLineOut:
        return cls(
            element_id=line.element_id,
            item_code=line.item_code,
            step=line.step,
            family=line.family,
            storey=line.storey,
            billing_unit=line.billing_unit,
            quantity=str(line.quantity),
            state=line.state,
            rebar_basis=line.rebar_basis,
            trace=[BoqTraceOut(**t) for t in line.trace],
        )


class BoqLinesOut(Schema):
    lines: list[BoqLineOut]
