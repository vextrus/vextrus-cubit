"""`working_rate` and the price edit, beyond the acceptance tests (ticket S16-RT)."""

import uuid
from collections.abc import Callable
from decimal import Decimal

import pytest

from vextrus.platform.money import Currency
from vextrus.platform.services import auth, tenancy
from vextrus.platform.services.markets import MarketProfile
from vextrus.rates import services, starter
from vextrus.rates.models import MarketPrice, MarketPriceSet
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

TAKA = Currency("BDT", 2)


def row(code: str) -> starter.ResourceRow:
    [found] = [r for r in starter.RESOURCES if r.code == code]
    return found


def test_the_column_concrete_rate_is_its_lines_at_the_starter_prices_rounded_once(
    qs_project: QsProject,
) -> None:
    [analysis] = [a for a in starter.ANALYSES if a.item_code == "RCC-COL-1:1.5:3"]
    exact = sum(
        (
            line.qty * (1 + line.wastage_pct / 100) * row(line.resource).price  # type: ignore[operator]
            for line in analysis.lines
        ),
        Decimal(0),
    )
    with qs_project.member.acting():
        rate = services.working_rate("RCC-COL-1:1.5:3", qs_project.project_id)
    assert isinstance(rate, services.WorkingRate)
    assert rate.amount == exact.quantize(Decimal("0.01"), rounding="ROUND_HALF_UP")
    assert rate.per_unit == "cft"


def test_an_item_with_no_rate_analysis_is_rate_not_entered(qs_project: QsProject) -> None:
    with qs_project.member.acting():
        rate = services.working_rate("NO-SUCH-ITEM", qs_project.project_id)
    assert isinstance(rate, services.RateNotEntered)
    assert rate.item_code == "NO-SUCH-ITEM"


def test_a_new_developer_has_its_own_copy_of_the_starter_set_before_anything_reads_it(
    qs_project: QsProject,
) -> None:
    with qs_project.member.acting():
        sets = list(MarketPriceSet.objects.filter(tenant_id=qs_project.member.developer_id))
        priced = MarketPrice.objects.filter(price_set=sets[0]).count()
    assert [s.label for s in sets] == [starter.STARTER_LABEL]
    assert sets[0].parent_set_id is not None
    assert priced == len(starter.RESOURCES)


def test_taking_the_starter_again_changes_nothing(qs_project: QsProject) -> None:
    with qs_project.member.acting():
        first = services.copy_starter()
        second = services.copy_starter()
        assert first is not None
        assert second is not None
        assert first.id == second.id
        assert MarketPriceSet.objects.filter(tenant_id=qs_project.member.developer_id).count() == 1


def test_one_developer_s_edit_never_reaches_another(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    other = sign_in(role="qs")
    with other.acting():
        from vextrus.projects import services as projects

        other_project = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another")
    reply = api_as(qs_project.member).send(
        "put", f"/api/projects/{qs_project.project_id}/prices/rebar_500w", {"amount": "999.00"}
    )
    assert reply.status_code == 200, reply.content[:300]
    with other.acting():
        rows = {p.resource_code: p for p in services.prices(other_project.id).prices}
    assert rows["rebar_500w"].price is not None
    assert rows["rebar_500w"].price.amount == row("rebar_500w").price


@pytest.mark.parametrize("typed", ["520", "520.5", "0", "0.00", " 12.34 ", "9999999999.99"])
def test_a_plain_amount_is_taken(typed: str) -> None:
    assert services.parse_amount(typed, TAKA) == Decimal(typed.strip())


@pytest.mark.parametrize(
    "typed",
    [
        "",
        " ",
        "abc",
        "-1",
        "-0.01",
        "1e5",
        "1e400x",
        "NaN",
        "Infinity",
        "12.345",
        "1,000",
        "١٢",
        "12\n3",
        "\u00a05",
        "5\n",
        None,
        5,
        1.5,
    ],
)
def test_anything_else_is_refused_with_a_400(typed: object) -> None:
    with pytest.raises(auth.Refused) as refused:
        services.parse_amount(typed, TAKA)
    assert refused.value.status == 400
    assert refused.value.message["code"] == "rates.prices.amount_invalid"


def test_an_unknown_resource_is_a_404_naming_its_code(qs_project: QsProject) -> None:
    reply = api_as(qs_project.member).send(
        "put", f"/api/projects/{qs_project.project_id}/prices/no_such_resource", {"amount": "1.00"}
    )
    assert reply.status_code == 404
    assert reply.json() == {
        "code": "rates.prices.resource_unknown",
        "params": {"code": "no_such_resource"},
    }


def test_the_md_reads_the_prices_and_cannot_edit_one(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    md = sign_in(role="md", developer_id=qs_project.member.developer_id)
    base = f"/api/projects/{qs_project.project_id}"
    assert api_as(md).get(f"{base}/prices").status_code == 200
    assert api_as(md).send("put", f"{base}/prices/rebar_500w", {"amount": "1.00"}).status_code == 403


def test_the_acting_tenant_is_the_developers_not_the_librarys(
    qs_project: QsProject, market: MarketProfile
) -> None:
    with qs_project.member.acting():
        assert tenancy.current_tenant_id() == qs_project.member.developer_id
        assert tenancy.current().library_id == market.library_id
