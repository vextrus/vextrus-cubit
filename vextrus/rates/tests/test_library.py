"""The starter rows as Library rows (ticket S16-RT): `sync_library` writes them, again writes nothing,
and never touches a Developer's own copy of the prices."""

from decimal import Decimal

import pytest

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import library as platform_library
from vextrus.platform.services.markets import MarketProfile
from vextrus.rates import starter
from vextrus.rates.models import MarketPrice, RateAnalysis, RateAnalysisLine, Resource
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def rates_written() -> int:
    return platform_library.sync()["rates"]


def test_the_library_holds_every_starter_resource_analysis_and_price(market: MarketProfile) -> None:
    owned = {"tenant_id": market.library_id}
    assert Resource.objects.using(OWNER_ALIAS).filter(**owned).count() == len(starter.RESOURCES)
    assert RateAnalysis.objects.using(OWNER_ALIAS).filter(**owned).count() == len(starter.ANALYSES)
    assert RateAnalysisLine.objects.using(OWNER_ALIAS).filter(**owned).count() == sum(
        len(a.lines) for a in starter.ANALYSES
    )
    assert MarketPrice.objects.using(OWNER_ALIAS).filter(**owned).count() == len(starter.RESOURCES)


def test_syncing_again_writes_nothing() -> None:
    assert rates_written() == 0


def test_sync_puts_back_a_library_price_changed_by_hand(market: MarketProfile) -> None:
    prices = MarketPrice.objects.using(OWNER_ALIAS).filter(
        tenant_id=market.library_id, resource__code="cement_opc"
    )
    prices.update(price=Decimal("1.00"))
    assert rates_written() == 1
    assert prices.get().price == Decimal("520.00")


def test_sync_never_touches_a_developers_own_prices(
    qs_project: QsProject, market: MarketProfile
) -> None:
    reply = api_as(qs_project.member).send(
        "put", f"/api/projects/{qs_project.project_id}/prices/cement_opc", {"amount": "777.00"}
    )
    assert reply.status_code == 200, reply.content[:300]
    MarketPrice.objects.using(OWNER_ALIAS).filter(
        tenant_id=market.library_id, resource__code="cement_opc"
    ).update(price=Decimal("1.00"))

    rates_written()

    with qs_project.member.acting():
        kept = MarketPrice.objects.get(
            resource__code="cement_opc", tenant_id=qs_project.member.developer_id
        )
    assert kept.price == Decimal("777.00")


def test_a_line_dropped_from_the_data_is_dropped_from_the_library(
    market: MarketProfile, monkeypatch: pytest.MonkeyPatch
) -> None:
    [analysis] = [a for a in starter.ANALYSES if a.item_code == "RCC-COL-1:1.5:3"]
    shorter = type(analysis)(
        analysis.item_code,
        analysis.per_unit,
        analysis.lines[:2],
        mix=analysis.mix,
        dry_volume_factor=analysis.dry_volume_factor,
        benchmark_ref=analysis.benchmark_ref,
        notes=analysis.notes,
    )
    monkeypatch.setattr(
        starter, "ANALYSES", tuple(shorter if a is analysis else a for a in starter.ANALYSES)
    )
    rates_written()
    lines = RateAnalysisLine.objects.using(OWNER_ALIAS).filter(
        tenant_id=market.library_id, analysis__item_code="RCC-COL-1:1.5:3"
    )
    assert lines.count() == 2
