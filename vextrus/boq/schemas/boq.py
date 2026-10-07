"""The Priced BOQ in the API (C13 and C15; the session-16 contract). Money is `{amount, currency}`;
quantities are decimal strings in the BOQ Item's Billing Unit."""

from typing import Any, Literal

from ninja import Schema

from vextrus.rates.schemas.prices import Money


class GrossFloorAreaOut(Schema):
    """The strip's Gross Floor Area: its value and how it was had (`entered`)."""

    value: str
    basis: str


class StripOut(Schema):
    measured: Money
    awaiting_answer: Money
    allowance: Money
    total: Money
    unpriced_lines: int
    per_area: Money | None
    gfa: GrossFloorAreaOut | None


class DescriptionOut(Schema):
    code: str
    params: dict[str, str]


class AwaitingAnswerOut(Schema):
    quantity: str
    amount: Money | None


class ByStoreyOut(Schema):
    storey: str
    quantity: str


class TraceCountOut(Schema):
    lines: int


class BoqItemOut(Schema):
    """A BOQ Item as billed (C13)."""

    number: str
    item_code: str
    section: str
    group: str
    description: DescriptionOut
    billing_unit: str
    quantity: str
    rate: Money | None
    amount: Money | None
    cost_basis: str
    rebar_basis: str | None
    rebar_from_drawing_share: str | None
    awaiting_answer: AwaitingAnswerOut | None
    by_storey: list[ByStoreyOut]
    trace: TraceCountOut


class BoqGroupOut(Schema):
    group: str
    items: list[BoqItemOut]


class BoqSectionOut(Schema):
    section: str
    groups: list[BoqGroupOut]


class ConsumptionOut(Schema):
    item_code: str
    per_area: str


class AllowanceOut(Schema):
    """An allowance line (C13): a step not yet confirmed, priced per area."""

    step: str
    part: str
    cost_basis: Literal["allowance"]
    consumptions: list[ConsumptionOut]
    amount: Money | None
    measured_so_far: Money | None
    source: str


class BoqOut(Schema):
    strip: StripOut
    measured_share: str
    sections: list[BoqSectionOut]
    allowances: list[AllowanceOut]


class LineTraceOut(Schema):
    sheet_id: str
    view_id: str
    anchor: dict[str, Any]


class BoqLineOut(Schema):
    """A Measurement Line in the BOQ Item's Billing Unit, with where it was read."""

    item_code: str
    step: str
    family: str
    element_id: str
    storey: str | None
    state: Literal["measured", "awaiting_answer"]
    billing_unit: str
    quantity: str
    rule_codes: list[str]
    rebar_basis: str | None
    trace: list[LineTraceOut]


class BoqLinesOut(Schema):
    lines: list[BoqLineOut]
