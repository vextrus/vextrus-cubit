"""Rate Analyses and the working rate (ticket S16-RT; docs/plans/M1.md C12).

`rates` prices by item code only and never reads `measurement`. A Rate Analysis is priced from the
Developer's own Market Price set: each line is its quantity per unit with its wastage, times the
price. The rate is the sum of the lines, exact, rounded once to the currency's minor unit. **One empty
price leaves the whole rate not entered** (`RateNotEntered`), never a rate that priced it as ৳0.
"""

import uuid
from dataclasses import dataclass
from decimal import Decimal

from vextrus.platform.money import Currency, Money
from vextrus.platform.services import auth
from vextrus.rates import acts
from vextrus.rates.models import MarketPrice, RateAnalysis, RateAnalysisLine
from vextrus.rates.services.prices import own_currency, own_set, require_project

_HUNDRED = Decimal(100)


@dataclass(frozen=True)
class WorkingRate:
    amount: Decimal
    """Per `per_unit`, rounded to the currency's minor unit."""
    per_unit: str
    """The Rate Analysis's own unit as a plain code ("cft", "kg", "sft")."""


@dataclass(frozen=True)
class RateNotEntered:
    """The item has no rate: its Rate Analysis is missing, or a line's price is empty. Shown "rate
    not entered", never ৳0."""

    item_code: str = ""


@dataclass(frozen=True)
class LineView:
    resource_code: str
    name: str
    qty: Decimal
    """Per one unit of the item, wastage included: what is bought."""
    unit: str
    price: Money | None
    amount: Money | None
    source_ref: str


@dataclass(frozen=True)
class RateView:
    item_code: str
    per_unit: str
    rate: Money | None
    lines: tuple[LineView, ...]


def _priced(
    item_code: str,
) -> tuple[RateAnalysis, Currency, list[tuple[RateAnalysisLine, Decimal | None]]] | None:
    """The Rate Analysis, the currency and each line with its price in the Developer's set."""
    analysis = RateAnalysis.objects.filter(item_code=item_code).first()
    if analysis is None:
        return None
    currency = own_currency()
    price_set = own_set()
    held = {row.resource_id: row.price for row in MarketPrice.objects.filter(price_set=price_set)}
    lines = list(
        RateAnalysisLine.objects.filter(analysis=analysis).select_related("resource").order_by("ordinal")
    )
    return analysis, currency, [(line, held.get(line.resource_id)) for line in lines]


def _gross(line: RateAnalysisLine) -> Decimal:
    return line.qty_per_unit * (1 + line.wastage_pct / _HUNDRED)


def working_rate(item_code: str, project_id: uuid.UUID) -> WorkingRate | RateNotEntered:
    """The item's rate per its Rate Analysis's unit at the Developer's prices, or `RateNotEntered`.

    `project_id` names the Project the rate is for (the Developer's prices are shared by its
    Projects, so it picks no other price); the acting Developer is the tenant."""
    found = _priced(item_code)
    if found is None:
        return RateNotEntered(item_code)
    analysis, currency, lines = found
    if not lines or any(price is None for _, price in lines):
        return RateNotEntered(item_code)
    total = sum((_gross(line) * price for line, price in lines if price is not None), Decimal(0))
    return WorkingRate(Money.of(total, currency).amount, analysis.per_unit)


def rate_analysis(project_id: uuid.UUID, item_code: str) -> RateView:
    """The Rate Analysis of `item_code`, line by line at the Developer's prices; `rate` is `None`
    when any line's price is empty. An item with no Rate Analysis is not found (404)."""
    require_project(acts.LOOK, project_id)
    found = _priced(item_code)
    if found is None:
        raise auth.NotFound
    analysis, currency, lines = found
    shown = tuple(
        LineView(
            resource_code=line.resource.code,
            name=line.resource.name,
            qty=_gross(line),
            unit=line.resource.quoted_unit,
            price=None if price is None else Money.of(price, currency),
            amount=None if price is None else Money.of(_gross(line) * price, currency),
            source_ref=line.source_ref,
        )
        for line, price in lines
    )
    rate = working_rate(item_code, project_id)
    return RateView(
        item_code=analysis.item_code,
        per_unit=analysis.per_unit,
        rate=Money.of(rate.amount, currency) if isinstance(rate, WorkingRate) else None,
        lines=shown,
    )
