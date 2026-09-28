"""Markets: what each Market decides, as data (ADR 0038). No code here names a market.

A Market is written only by the owner (its data migration); every tenant and the admin may read
every Market. `/api/me` (07) sends the current Developer's profile, and 03's formatters use it.
"""

import uuid
from collections.abc import Mapping
from dataclasses import dataclass

from vextrus.platform.models import Developer, Market
from vextrus.platform.money import Currency


@dataclass(frozen=True)
class MarketProfile:
    id: uuid.UUID
    code: str
    library_id: uuid.UUID
    labels: Mapping[str, str]
    currency: Currency
    currency_symbol: str
    currency_symbol_position: Mapping[str, str]
    grouping: str
    digits: str
    borrowed_locales: Mapping[str, str]
    unit_systems: tuple[str, ...]
    default_unit_system: str
    languages: tuple[str, ...]
    default_language: str
    time_zone: str
    days_off: tuple[int, ...]
    default_home_region: str


class MarketNotFound(LookupError):
    pass


def offered() -> list[MarketProfile]:
    """Every Market, by code (the admin's choice when staff create a Developer)."""
    return [_profile(market) for market in Market.objects.order_by("code")]


def get(market_id: uuid.UUID) -> MarketProfile:
    try:
        return _profile(Market.objects.get(id=market_id))
    except Market.DoesNotExist:
        raise MarketNotFound(market_id) from None


def by_code(code: str) -> MarketProfile:
    try:
        return _profile(Market.objects.get(code=code))
    except Market.DoesNotExist:
        raise MarketNotFound(code) from None


def of_developer(developer_id: uuid.UUID) -> MarketProfile:
    """The Market of a Developer the transaction may see (its own tenant)."""
    market_id = Developer.objects.filter(id=developer_id).values_list("market_id", flat=True).first()
    if market_id is None:
        raise MarketNotFound(developer_id)
    return get(market_id)


def _profile(market: Market) -> MarketProfile:
    return MarketProfile(
        id=market.id,
        code=market.code,
        library_id=market.tenant_id,
        labels=dict(market.labels),
        currency=Currency(market.currency_code, market.currency_minor_units),
        currency_symbol=market.currency_symbol,
        currency_symbol_position=dict(market.currency_symbol_position),
        grouping=market.grouping,
        digits=market.digits,
        borrowed_locales=dict(market.borrowed_locales),
        unit_systems=tuple(market.unit_systems),
        default_unit_system=market.default_unit_system,
        languages=tuple(market.languages),
        default_language=market.default_language,
        time_zone=market.time_zone,
        days_off=tuple(market.days_off),
        default_home_region=market.default_home_region,
    )
