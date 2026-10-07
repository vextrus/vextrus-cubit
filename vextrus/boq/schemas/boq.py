"""The Priced BOQ in the API (session 16; docs/plans/M1.md C13, C15): the strip, the BOQ Items as
billed by section and group, the allowance lines, a BOQ Item's Measurement Lines, and the Gross Floor
Area. Money is `{amount, currency}`; quantities are decimal strings, never floats."""

import uuid
from decimal import Decimal
from typing import Any

from ninja import Schema

from vextrus.platform.schemas.money import MoneySchema


class GfaOut(Schema):
    value: Decimal
    basis: str  # "entered"


class StripOut(Schema):
    measured: MoneySchema
    awaiting_answer: MoneySchema
    allowance: MoneySchema
    total: MoneySchema
    unpriced_lines: int
    per_area: MoneySchema | None
    gfa: GfaOut | None


class DescriptionOut(Schema):
    code: str
    params: dict[str, Any]


class AwaitingOut(Schema):
    quantity: Decimal
    amount: MoneySchema | None


class StoreyQuantityOut(Schema):
    storey: str
    quantity: Decimal


class BoqItemOut(Schema):
    """C13's BOQ Item as billed. `quantity` is the measured quantity only; `awaiting_answer` apart."""

    number: str
    item_code: str
    section: str
    group: str
    description: DescriptionOut
    billing_unit: str
    quantity: Decimal
    rate: MoneySchema | None
    amount: MoneySchema | None
    cost_basis: str
    rebar_basis: str | None
    rebar_from_drawing_share: Decimal | None
    awaiting_answer: AwaitingOut | None
    by_storey: list[StoreyQuantityOut]
    trace: dict[str, int]
    """`{"lines": n}`."""


class BoqGroupOut(Schema):
    group: str
    items: list[BoqItemOut]


class BoqSectionOut(Schema):
    section: str
    groups: list[BoqGroupOut]


class ConsumptionOut(Schema):
    item_code: str
    per_area: Decimal


class AllowanceOut(Schema):
    """C13's allowance line, for a Step not yet confirmed (storeys .. roof)."""

    step: str
    part: str
    cost_basis: str
    consumptions: list[ConsumptionOut]
    amount: MoneySchema | None
    measured_so_far: MoneySchema | None
    source: str


class BoqOut(Schema):
    """`GET boq`."""

    strip: StripOut
    measured_share: Decimal
    sections: list[BoqSectionOut]
    allowances: list[AllowanceOut]


class LineTraceOut(Schema):
    sheet_id: uuid.UUID | None
    view_id: uuid.UUID | None
    anchor: dict[str, Any] | None


class MeasurementLineOut(Schema):
    """C11's Measurement Line, with the session-16 seams' fields and its trace."""

    item_code: str
    element_id: uuid.UUID | None
    mark: str
    storey: str | None
    step: str
    family: str
    state: str  # "measured" | "awaiting_answer"
    rule_codes: list[str]
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
    trace: list[LineTraceOut]


class BoqLinesOut(Schema):
    """`GET boq/items/{item_code}/lines`."""

    lines: list[MeasurementLineOut]


class GrossFloorAreaIn(Schema):
    """`PUT buildings/{building_id}/gross-floor-area` (C15): the value as text, `unit` "sft" or "m2";
    the service converts exactly and answers a bad one 400."""

    value: str
    unit: str


class GrossFloorAreaOut(Schema):
    building_id: uuid.UUID
    gross_floor_area_m2: Decimal
