"""The Priced BOQ in the API (S16-B; M1.md C13), built on S16-K0's frozen schemas
(`vextrus/boq/schemas/boq.py`), never changing them: each class here is a K0 class with the fields the
orchestrator added after the freeze (`building_id`; an allowance line's `description`) and the
allowance's priced consumptions. A BOQ Item's `description` may be null (an Item whose kind has no
code yet). Money is `{amount, currency}`; quantities and shares are decimal strings."""

import uuid
from typing import Any

from vextrus.boq.schemas.boq import (
    AllowanceOut,
    AwaitingOut,
    BoqGroupOut,
    BoqItemOut,
    BoqLinesOut,
    BoqOut,
    BoqSectionOut,
    ConsumptionOut,
    DescriptionOut,
    GfaOut,
    LineTraceOut,
    MeasurementLineOut,
    StoreyQuantityOut,
    StripOut,
)
from vextrus.boq.services import priced
from vextrus.platform.money import Money
from vextrus.platform.schemas import MoneySchema


def _money(value: Money | None) -> MoneySchema | None:
    return None if value is None else MoneySchema.from_money(value)


def _description(value: dict[str, Any] | None) -> DescriptionOut | None:
    return None if value is None else DescriptionOut(code=value["code"], params=value["params"])


class PricedItemOut(BoqItemOut):
    description: DescriptionOut | None  # type: ignore[assignment]

    @classmethod
    def from_view(cls, item: priced.BilledItem) -> PricedItemOut:
        held = item.awaiting_answer
        return cls(
            number=item.number,
            item_code=item.item_code,
            section=item.section,
            group=item.group,
            description=_description(item.description),
            billing_unit=item.billing_unit,
            quantity=item.quantity,
            rate=_money(item.rate),
            amount=_money(item.amount),
            cost_basis=item.cost_basis,
            rebar_basis=item.rebar_basis,
            rebar_from_drawing_share=item.rebar_from_drawing_share,
            awaiting_answer=None
            if held is None
            else AwaitingOut(quantity=held.quantity, amount=_money(held.amount)),
            by_storey=[StoreyQuantityOut(storey=s.storey, quantity=s.quantity) for s in item.by_storey],
            trace={"lines": item.lines},
        )


class PricedGroupOut(BoqGroupOut):
    items: list[PricedItemOut]  # type: ignore[assignment]


class PricedSectionOut(BoqSectionOut):
    groups: list[PricedGroupOut]  # type: ignore[assignment]


class PricedConsumptionOut(ConsumptionOut):
    billing_unit: str
    quantity: str
    rate: MoneySchema | None
    amount: MoneySchema | None


class PricedAllowanceOut(AllowanceOut):
    description: DescriptionOut
    consumptions: list[PricedConsumptionOut]  # type: ignore[assignment]
    confidence: str
    unpriced: int

    @classmethod
    def from_view(cls, line: priced.AllowanceLine) -> PricedAllowanceOut:
        assert line.description is not None
        return cls(
            step=line.step,
            part=line.part,
            description=DescriptionOut(**line.description),
            cost_basis=line.cost_basis,
            consumptions=[
                PricedConsumptionOut(
                    item_code=c.item_code,
                    per_area=c.per_area,
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


class PricedBoqOut(BoqOut):
    building_id: uuid.UUID | None
    """The Project's Building, the one `PUT .../buildings/{building_id}/gross-floor-area` names."""
    sections: list[PricedSectionOut]  # type: ignore[assignment]
    allowances: list[PricedAllowanceOut]  # type: ignore[assignment]

    @classmethod
    def from_view(cls, boq: priced.PricedBoq) -> PricedBoqOut:
        strip = boq.strip
        gfa = strip.gfa
        return cls(
            building_id=boq.building_id,
            strip=StripOut(
                measured=MoneySchema.from_money(strip.measured),
                awaiting_answer=MoneySchema.from_money(strip.awaiting_answer),
                allowance=MoneySchema.from_money(strip.allowance),
                total=MoneySchema.from_money(strip.total),
                unpriced_lines=strip.unpriced_lines,
                per_area=_money(strip.per_area),
                gfa=None if gfa is None else GfaOut(value=gfa.value, basis=gfa.basis),
            ),
            measured_share=boq.measured_share,
            sections=[
                PricedSectionOut(
                    section=s.section,
                    groups=[
                        PricedGroupOut(
                            group=g.group, items=[PricedItemOut.from_view(i) for i in g.items]
                        )
                        for g in s.groups
                    ],
                )
                for s in boq.sections
            ],
            allowances=[PricedAllowanceOut.from_view(line) for line in boq.allowances],
        )


def lines_out(lines: tuple[priced.TracedLine, ...]) -> BoqLinesOut:
    return BoqLinesOut(
        lines=[
            MeasurementLineOut(
                item_code=line.item_code,
                element_id=line.element_id,
                mark=line.mark,
                storey=line.storey,
                step=line.step,
                family=line.family,
                state=line.state,
                rule_codes=list(line.rule_codes),
                nos=line.nos,
                l_m=line.l_m,
                b_m=line.b_m,
                h_m=line.h_m,
                area_m2=line.area_m2,
                qty_si=line.qty_si,
                unit_si=line.unit_si,
                billing_unit=line.billing_unit,
                quantity=line.quantity,
                rebar_basis=line.rebar_basis,
                diameter_mm=line.diameter_mm,
                assumed_split=line.assumed_split,
                lap=line.lap,
                held=line.held,
                trace=[LineTraceOut(**t) for t in line.trace],
            )
            for line in lines
        ]
    )
