"""The Priced BOQ in the API (docs/plans/M1.md C13, A18; frozen by M1-00, built by M1-15a and M1-15b).
Money is `{amount, currency}` in the Project's currency; an unpriced BOQ Item's rate and amount are
null ("rate not entered"). `quantity` is the measured quantity only; `awaiting_answer` is apart."""

import uuid
from decimal import Decimal
from typing import Any

from ninja import Schema

from vextrus.live_model.schemas.trace import TraceEntryOut
from vextrus.platform.schemas.money import MoneySchema


class BoqWordsOut(Schema):
    """Words the web renders: a code and its params ("boq.item.rcc")."""

    code: str
    params: dict[str, Any]


class BoqGfaOut(Schema):
    value: Decimal
    basis: str


class BoqStripOut(Schema):
    """The strip: measured + awaiting answer + allowance = total, each Element once."""

    measured: MoneySchema
    awaiting_answer: MoneySchema
    allowance: MoneySchema
    total: MoneySchema
    unpriced_lines: int
    per_area: MoneySchema | None
    gfa: BoqGfaOut | None


class BoqAwaitingOut(Schema):
    """The held Elements at their best candidate: never inside `quantity`."""

    quantity: Decimal
    amount: MoneySchema | None


class BoqByStoreyOut(Schema):
    storey: str
    quantity: Decimal


class BoqItemTraceOut(Schema):
    lines: int


class BoqItemOut(Schema):
    """A BOQ Item as billed."""

    number: str
    item_code: str
    section: str
    group: str
    description: BoqWordsOut
    billing_unit: str
    quantity: Decimal
    rate: MoneySchema | None
    amount: MoneySchema | None
    cost_basis: str
    rebar_basis: str | None
    rebar_from_drawing_share: Decimal | None
    awaiting_answer: BoqAwaitingOut | None
    by_storey: list[BoqByStoreyOut]
    trace: BoqItemTraceOut


class BoqSectionOut(Schema):
    section: str
    items: list[BoqItemOut]


class BoqConsumptionOut(Schema):
    item_code: str
    per_area: Decimal


class BoqAllowanceOut(Schema):
    """An allowance line: a step's (or part's) cost by consumption per area until it is measured."""

    step: str
    part: str
    cost_basis: str
    consumptions: list[BoqConsumptionOut]
    amount: MoneySchema | None
    measured_so_far: MoneySchema | None
    source: str


class BoqOut(Schema):
    building_id: uuid.UUID
    strip: BoqStripOut
    measured_share: Decimal
    sections: list[BoqSectionOut]
    allowances: list[BoqAllowanceOut]


class BoqStoreyOut(Schema):
    """A storey by id and its confirmed name, never its key."""

    id: uuid.UUID
    name: str


class BoqLineOut(Schema):
    """One Measurement Line of a BOQ Item, in its Billing Unit, with its Element and Traces."""

    item_code: str
    element_id: uuid.UUID
    mark: str
    storey: BoqStoreyOut | None
    billing_unit: str
    quantity: Decimal
    trace: list[TraceEntryOut]


class BoqPreviewLineOut(Schema):
    """A Measurement Line a Proposal would make, in its Billing Unit; never stored."""

    proposal_id: uuid.UUID
    item_code: str
    mark: str
    storey: BoqStoreyOut | None
    billing_unit: str
    quantity: Decimal
    trace: list[TraceEntryOut]
