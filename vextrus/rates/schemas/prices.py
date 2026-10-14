"""Market Prices and Rate Analyses in the API (docs/plans/M1.md C12, A18; frozen by M1-00, built by
M1-14). Money is `{amount, currency}`; an empty price is null, shown "rate not entered", never 0. An
entered price's source is its editor and date, never the starter's citation."""

from datetime import datetime
from decimal import Decimal

from ninja import Schema
from pydantic import Field

from vextrus.platform.schemas.money import MoneySchema


class PriceRowOut(Schema):
    """One Resource's Market Price in the Project's price set."""

    resource_code: str
    name: str
    unit: str
    price: MoneySchema | None
    changed_at: datetime | None
    changed_by: str | None
    source: str | None


class PriceMoneyIn(Schema):
    """An amount as typed and its ISO 4217 code: a request's own schema, as a decimal's input schema
    differs from its reply's (one component name each)."""

    amount: Decimal
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class PriceIn(Schema):
    """A Market Price entered or changed."""

    price: PriceMoneyIn


class RateLineOut(Schema):
    """One Resource of a Rate Analysis: its quantity per unit, its price and amount."""

    resource_code: str
    name: str
    quantity: Decimal
    unit: str
    price: MoneySchema | None
    amount: MoneySchema | None


class RateOut(Schema):
    """A BOQ Item's Rate Analysis: its own unit (`per_unit`, "cft"), its working rate, its lines."""

    item_code: str
    per_unit: str
    rate: MoneySchema | None
    lines: list[RateLineOut]
    sources: list[str]
