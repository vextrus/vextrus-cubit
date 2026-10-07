"""Prices and rates in the API (C12; the session-16 contract). Money is `{amount, currency}` with the
amount a decimal string; a null price shows "rate not entered"."""

from datetime import datetime

from ninja import Schema


class Money(Schema):
    amount: str
    currency: str


class PriceSetOut(Schema):
    id: str
    name: str
    currency: str


class PriceOut(Schema):
    resource_code: str
    name: str
    unit: str
    price: Money | None
    source_ref: str
    changed_at: datetime | None


class PricesOut(Schema):
    price_set: PriceSetOut
    prices: list[PriceOut]


class PriceIn(Schema):
    """The new price's amount, a decimal string (validated by the service, 400 `{code, params}`)."""

    amount: str


class RateLineOut(Schema):
    resource_code: str
    name: str
    qty: str
    unit: str
    price: Money | None
    amount: Money | None
    source_ref: str


class RateOut(Schema):
    item_code: str
    per_unit: str
    rate: Money | None
    lines: list[RateLineOut]
