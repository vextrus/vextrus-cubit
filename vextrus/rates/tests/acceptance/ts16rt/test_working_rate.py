"""S16-RT: `rates.services.working_rate` (docs/plans/M1.md C12; session 16's contracts, rates).

- "`rates.services.working_rate(item_code, project_id) -> WorkingRate(amount, per_unit) |
  RateNotEntered`, where `per_unit` is the Rate Analysis's own unit as a plain code ("cft", "kg",
  "nos"), exact, rounded to the currency's minor unit."
- "An empty price is `RateNotEntered`, shown "rate not entered", never ৳0." The finish line: "an empty
  price never prices ৳0."

No ৳ figure is pinned: the starter prices are seed data the builder cites.
"""

from decimal import Decimal
from importlib import import_module
from types import ModuleType
from typing import Any

import pytest

from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

from .prices import ITEMS, got, money, price_path, rate_path

pytestmark = pytest.mark.django_db

services: ModuleType = import_module("vextrus.rates.services")
"""`rates`'s public services (C12), read as a module so the tests type-check before they are built."""


def working_rate(qs: QsProject, item_code: str) -> Any:
    with qs.member.acting():
        return services.working_rate(item_code, qs.project_id)


def empty_every_price(qs: QsProject) -> None:
    """Every Market Price emptied (C12: `MarketPrice(price | empty, ...)`), as a Resource whose price
    was never entered."""
    models: ModuleType = import_module("vextrus.rates.models")
    with qs.member.acting():
        models.MarketPrice.objects.update(price=None)


@pytest.mark.parametrize("item_code", ITEMS)
def test_working_rate_prices_each_column_item_from_the_starter_set(
    qs_project: QsProject, item_code: str
) -> None:
    rate = working_rate(qs_project, item_code)
    assert type(rate).__name__ == "WorkingRate", rate
    assert isinstance(rate.amount, Decimal)
    assert rate.amount > 0
    assert rate.amount == rate.amount.quantize(Decimal("0.01")), "rounded to the currency's minor unit"
    assert isinstance(rate.per_unit, str)
    assert rate.per_unit
    assert rate.per_unit.strip() == rate.per_unit


@pytest.mark.parametrize("item_code", ITEMS)
def test_working_rate_is_the_rate_the_rate_analysis_shows(qs_project: QsProject, item_code: str) -> None:
    rate = working_rate(qs_project, item_code)
    shown = got(api_as(qs_project.member).get(rate_path(qs_project.project_id, item_code)))
    assert shown["per_unit"] == rate.per_unit
    assert money(shown["rate"]) == rate.amount


@pytest.mark.parametrize("item_code", ITEMS)
def test_an_empty_price_is_rate_not_entered_never_zero(qs_project: QsProject, item_code: str) -> None:
    empty_every_price(qs_project)
    rate = working_rate(qs_project, item_code)
    assert type(rate).__name__ == "RateNotEntered", rate
    assert getattr(rate, "amount", None) != Decimal(0)


def test_one_empty_line_price_leaves_the_item_rate_not_entered(qs_project: QsProject) -> None:
    """The item's lines all emptied, then every line but one priced again through the API: the one
    empty price still leaves the item unpriced (never priced as if it cost ৳0)."""
    api = api_as(qs_project.member)
    item_code = "RCC-COL-1:1.5:3"
    lines = got(api.get(rate_path(qs_project.project_id, item_code)))["lines"]
    codes = list(dict.fromkeys(line["resource_code"] for line in lines))
    assert len(codes) >= 2, f"{item_code}'s Rate Analysis has a line per Resource: {codes}"
    empty_every_price(qs_project)
    for code in codes[1:]:
        assert (
            api.send("put", price_path(qs_project.project_id, code), {"amount": "100.00"}).status_code
            < 300
        )
    rate = working_rate(qs_project, item_code)
    assert type(rate).__name__ == "RateNotEntered", rate
    shown = got(api.get(rate_path(qs_project.project_id, item_code)))
    assert shown["rate"] is None
    empty = [line for line in shown["lines"] if line["resource_code"] == codes[0]]
    assert empty
    assert all(line["price"] is None for line in empty)
    assert all(line["amount"] is None for line in empty)
