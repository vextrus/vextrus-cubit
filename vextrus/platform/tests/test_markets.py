"""The Market as data: Bangladesh seeded by the data migration, every value a market decides held
in its row (ADR 0038; the M0 plan, 02)."""

import uuid
from collections.abc import Callable

import pytest

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import Developer
from vextrus.platform.money import Currency
from vextrus.platform.services import markets, tenancy
from vextrus.platform.services.markets import MarketProfile


@pytest.mark.django_db
def test_bangladesh_is_the_one_market_seeded(market: MarketProfile) -> None:
    assert market.code == "BD"
    assert market.labels == {"en": "Bangladesh"}
    assert market.currency == Currency("BDT", 2)
    assert (market.currency_symbol, market.currency_symbol_position) == ("৳", {"en": "before"})
    assert (market.grouping, market.digits) == ("lakh", "latn")
    assert market.borrowed_locales == {"en": "en-IN"}
    assert (market.unit_systems, market.default_unit_system) == (("imperial", "metric"), "imperial")
    assert (market.languages, market.default_language) == (("en",), "en")
    assert market.time_zone == "Asia/Dhaka"
    assert market.days_off == (5, 6)  # Friday and Saturday
    assert market.default_home_region == "asia-south1"


@pytest.mark.django_db(databases=["default", "owner"])
def test_its_library_is_a_library_tenant_with_a_fixed_id(market: MarketProfile) -> None:
    # Read as the owner: no code acts in a Library (tenancy.LibraryNotATenant).
    library = Developer.objects.using(OWNER_ALIAS).get(id=market.library_id)

    assert library.id == market.library_id == uuid.UUID("01a0e713-563c-74c4-9eb3-48f87fc1678e")
    assert (library.is_library, library.library_id, library.market_id) == (
        True,
        library.id,
        market.id,
    )


@pytest.mark.django_db
def test_a_developer_reads_its_market_and_its_home_region_starts_as_the_market_s(
    make_developer: Callable[..., uuid.UUID], market: MarketProfile
) -> None:
    developer = make_developer()

    with tenancy.acting_in(developer):
        assert markets.of_developer(developer) == market
        home_region = Developer.objects.values_list("home_region", flat=True).get()

    assert home_region == market.default_home_region
    assert markets.by_code("BD") == markets.get(market.id) == market


@pytest.mark.django_db
def test_an_unknown_market_is_not_found(make_developer: Callable[..., uuid.UUID]) -> None:
    other = make_developer()
    with pytest.raises(markets.MarketNotFound):
        markets.by_code("ZZ")
    with pytest.raises(markets.MarketNotFound):
        markets.get(uuid.uuid4())
    with tenancy.acting_in(None), pytest.raises(markets.MarketNotFound):
        markets.of_developer(other)  # not the acting tenant's own row
