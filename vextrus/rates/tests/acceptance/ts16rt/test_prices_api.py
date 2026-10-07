"""S16-RT: the project's Market Prices and Rate Analyses on the API (session 16's contracts, rates;
docs/plans/M1.md C12).

- "starter MarketPriceSet "PWD SoR 2022 2nd Rev (Dhaka)" with `source_ref` page refs on every price";
  the finish line: "every starter price cites its page".
- "`GET /api/projects/{project_id}/prices` → `{price_set: {id, name, currency}, prices: [{resource_code,
  name, unit, price: Money|null, source_ref, changed_at}]}`; null price shows "rate not entered"."
- "`PUT /api/projects/{project_id}/prices/{resource_code} {amount}` → DomainEvent, editor named";
  "Every edit writes a DomainEvent under the editor's name."
- "`GET /api/projects/{project_id}/rates/{item_code}` → `{item_code, per_unit, rate: Money|null, lines:
  [{resource_code, name, qty, unit, price: Money|null, amount: Money|null, source_ref}]}`."

No ৳ figure is pinned: the starter prices are seed data the builder cites.
"""

import uuid
from collections.abc import Callable
from decimal import Decimal
from importlib import import_module
from types import ModuleType
from typing import Any

import pytest

from vextrus.platform.services import activity
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

from .prices import ITEMS, STARTER_SET, cites_a_page, got, money, price_path, prices_path, rate_path

pytestmark = pytest.mark.django_db

services: ModuleType = import_module("vextrus.rates.services")
"""`rates`'s public services (C12), read as a module so the tests type-check before they are built."""


def prices(qs: QsProject) -> Any:
    return got(api_as(qs.member).get(prices_path(qs.project_id)))


def price_of(qs: QsProject, resource_code: str) -> Any:
    [row] = [row for row in prices(qs)["prices"] if row["resource_code"] == resource_code]
    return row


def a_rebar_resource(qs: QsProject) -> tuple[str, Decimal]:
    """A Resource REBAR-500W's Rate Analysis prices, with its starter price."""
    lines = got(api_as(qs.member).get(rate_path(qs.project_id, "REBAR-500W")))["lines"]
    priced = [line for line in lines if line["price"] is not None]
    assert priced, "REBAR-500W's lines carry starter prices"
    return priced[0]["resource_code"], money(priced[0]["price"])


def acts_on(qs: QsProject) -> list[Any]:
    with qs.member.acting():
        return activity.acts(project_id=qs.project_id, limit=200)


# The starter set ----------------------------------------------------------------------------------


def test_a_new_project_prices_from_the_starter_set(qs_project: QsProject) -> None:
    body = prices(qs_project)
    price_set = body["price_set"]
    assert price_set["name"] == STARTER_SET
    assert set(price_set) >= {"id", "name", "currency"}
    uuid.UUID(str(price_set["id"]))
    assert isinstance(price_set["currency"], str)
    assert price_set["currency"]
    assert body["prices"], "the starter set has prices"


def test_every_starter_price_cites_its_page(qs_project: QsProject) -> None:
    rows = prices(qs_project)["prices"]
    uncited = [row["resource_code"] for row in rows if not cites_a_page(row["source_ref"])]
    assert uncited == [], f"prices without a page reference: {uncited}"


def test_each_price_row_has_the_contract_shape(qs_project: QsProject) -> None:
    body = prices(qs_project)
    currency = body["price_set"]["currency"]
    for row in body["prices"]:
        assert set(row) >= {"resource_code", "name", "unit", "price", "source_ref", "changed_at"}, row
        assert isinstance(row["resource_code"], str)
        assert row["resource_code"]
        assert isinstance(row["name"], str)
        assert row["name"]
        assert isinstance(row["unit"], str)
        assert row["unit"]
        if row["price"] is not None:
            assert money(row["price"]) >= 0
            assert row["price"]["currency"] == currency


@pytest.mark.parametrize("item_code", ITEMS)
def test_a_rate_analysis_shows_its_lines_each_citing_its_source(
    qs_project: QsProject, item_code: str
) -> None:
    body = got(api_as(qs_project.member).get(rate_path(qs_project.project_id, item_code)))
    assert body["item_code"] == item_code
    assert isinstance(body["per_unit"], str)
    assert body["per_unit"]
    assert money(body["rate"]) > 0
    assert body["lines"], f"{item_code} has Rate Analysis lines"
    for line in body["lines"]:
        assert set(line) >= {"resource_code", "name", "qty", "unit", "price", "amount", "source_ref"}, (
            line
        )
        assert Decimal(str(line["qty"])) > 0
        assert cites_a_page(line["source_ref"]), line
        assert money(line["price"]) >= 0
        assert money(line["amount"]) >= 0


# Editing a price ----------------------------------------------------------------------------------


def test_editing_a_price_writes_one_event_naming_the_editor(qs_project: QsProject) -> None:
    code, _ = a_rebar_resource(qs_project)
    before = {act.id for act in acts_on(qs_project)}
    reply = api_as(qs_project.member).send(
        "put", price_path(qs_project.project_id, code), {"amount": "123.45"}
    )
    assert reply.status_code < 300, (reply.status_code, reply.content[:400])
    new = [act for act in acts_on(qs_project) if act.id not in before]
    assert len(new) == 1, new
    assert new[0].actor is not None
    assert new[0].actor.id == qs_project.member.user.pk


def test_an_edited_price_is_shown_with_its_change_time(qs_project: QsProject) -> None:
    code, _ = a_rebar_resource(qs_project)
    reply = api_as(qs_project.member).send(
        "put", price_path(qs_project.project_id, code), {"amount": "123.45"}
    )
    assert reply.status_code < 300, (reply.status_code, reply.content[:400])
    row = price_of(qs_project, code)
    assert money(row["price"]) == Decimal("123.45")
    assert row["changed_at"]


def test_editing_a_price_changes_the_working_rate(qs_project: QsProject) -> None:
    code, starter = a_rebar_resource(qs_project)
    with qs_project.member.acting():
        was = services.working_rate("REBAR-500W", qs_project.project_id)
    reply = api_as(qs_project.member).send(
        "put", price_path(qs_project.project_id, code), {"amount": str(starter * 2 + 1)}
    )
    assert reply.status_code < 300, (reply.status_code, reply.content[:400])
    with qs_project.member.acting():
        now = services.working_rate("REBAR-500W", qs_project.project_id)
    assert type(now).__name__ == "WorkingRate", now
    assert now.amount > was.amount


@pytest.mark.parametrize("amount", ["abc", "-5", "-0.01", "", "1e400x"])
def test_a_non_numeric_or_negative_amount_is_refused(qs_project: QsProject, amount: Any) -> None:
    code, starter = a_rebar_resource(qs_project)
    before = {act.id for act in acts_on(qs_project)}
    reply = api_as(qs_project.member).send(
        "put", price_path(qs_project.project_id, code), {"amount": amount}
    )
    assert reply.status_code == 400, (reply.status_code, reply.content[:400])
    assert money(price_of(qs_project, code)["price"]) == starter
    assert {act.id for act in acts_on(qs_project)} == before


# A second Developer -------------------------------------------------------------------------------


@pytest.fixture
def stranger(sign_in: Callable[..., Member]) -> Member:
    """A QS of another Developer."""
    return sign_in(role="qs")


def test_another_developer_cannot_read_the_prices(qs_project: QsProject, stranger: Member) -> None:
    assert prices(qs_project)["prices"], "the project's own QS reads them"
    assert api_as(stranger).get(prices_path(qs_project.project_id)).status_code == 404


def test_another_developer_cannot_read_a_rate_analysis(qs_project: QsProject, stranger: Member) -> None:
    path = rate_path(qs_project.project_id, "RCC-COL-1:1.5:3")
    got(api_as(qs_project.member).get(path))
    assert api_as(stranger).get(path).status_code == 404


def test_another_developer_cannot_edit_a_price(qs_project: QsProject, stranger: Member) -> None:
    code, starter = a_rebar_resource(qs_project)
    reply = api_as(stranger).send("put", price_path(qs_project.project_id, code), {"amount": "1.00"})
    assert reply.status_code == 404
    assert money(price_of(qs_project, code)["price"]) == starter
