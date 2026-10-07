"""Market Prices and Rate Analyses in the API (session 16; docs/plans/M1.md C12). A price not
entered is null ("rate not entered"), never 0. Money is `{amount, currency}`, the amount a decimal
string."""

import uuid
from datetime import datetime
from decimal import Decimal

from ninja import Schema

from vextrus.platform.schemas.money import MoneySchema


class PriceSetOut(Schema):
    id: uuid.UUID
    name: str
    currency: str


class PriceOut(Schema):
    resource_code: str
    name: str
    unit: str
    price: MoneySchema | None
    source_ref: str
    changed_at: datetime | None


class PricesOut(Schema):
    """`GET prices`."""

    price_set: PriceSetOut
    prices: list[PriceOut]


class PriceIn(Schema):
    """`PUT prices/{resource_code}`: the amount as text; the service answers a bad one 400."""

    amount: str


class RateLineOut(Schema):
    resource_code: str
    name: str
    qty: Decimal
    unit: str
    price: MoneySchema | None
    amount: MoneySchema | None
    source_ref: str


class RateOut(Schema):
    """`GET rates/{item_code}`: the working rate per its unit, and the Rate Analysis's lines."""

    item_code: str
    per_unit: str
    rate: MoneySchema | None
    lines: list[RateLineOut]
