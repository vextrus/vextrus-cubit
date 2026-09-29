"""`drawings`' own fixtures: a second Market, made as the owner and committed (so the app role's
transactions see it exist, and its policies keep it out of reach), removed after the test."""

import uuid
from collections.abc import Iterator
from dataclasses import dataclass

import psycopg
import pytest
from django.conf import settings
from pytest_django.plugin import DjangoDbBlocker

from vextrus.platform.database import OWNER_ALIAS


@dataclass(frozen=True)
class OtherMarket:
    market_id: uuid.UUID
    library_id: uuid.UUID
    discipline_ids: dict[str, uuid.UUID]


def _owner() -> psycopg.Connection:
    db = settings.DATABASES[OWNER_ALIAS]
    params = {"host": db["HOST"], "port": db["PORT"], "user": db["USER"], "dbname": db["NAME"]}
    if db["PASSWORD"]:
        params["password"] = db["PASSWORD"]
    return psycopg.connect(**params, autocommit=True)


@pytest.fixture
def other_market(django_db_setup: None, django_db_blocker: DjangoDbBlocker) -> Iterator[OtherMarket]:
    """A test-only second Market ("ZZ") with its own Library and Disciplines, committed by the owner:
    the same keys as Bangladesh's (a key is unique only within its Library)."""
    market_id, library_id = uuid.uuid4(), uuid.uuid4()
    disciplines = {"structural": uuid.uuid4(), "zz_only": uuid.uuid4()}
    with django_db_blocker.unblock(), _owner() as owner, owner.transaction():
        owner.execute(
            "insert into platform_developer (id, tenant_id, name, market_id, library_id,"
            " home_region, is_library, created_at) values (%s, %s, 'ZZ Library', %s, %s,"
            " 'nowhere-1', true, now())",
            [library_id, library_id, market_id, library_id],
        )
        owner.execute(
            "insert into platform_market (id, tenant_id, code, labels, currency_code,"
            " currency_minor_units, currency_symbol, currency_symbol_position, grouping, digits,"
            " borrowed_locales, unit_systems, default_unit_system, languages, default_language,"
            " time_zone, days_off, default_home_region) values (%s, %s, 'ZZ', '{\"en\": \"ZZ\"}',"
            " 'XTS', 2, 'z', '{\"en\": \"before\"}', 'thousands', 'latn', '{}', '[\"si\"]', 'si',"
            " '[\"en\"]', 'en', 'Etc/UTC', '[6, 7]', 'nowhere-1')",
            [market_id, library_id],
        )
        for order, (key, discipline_id) in enumerate(disciplines.items(), start=1):
            owner.execute(
                "insert into drawings_discipline (id, tenant_id, key, labels, kind, sort_order,"
                " prefixes) values (%s, %s, %s, '{\"en\": \"Other\"}', 'mep', %s, '[\"Z\"]')",
                [discipline_id, library_id, key, order],
            )
    yield OtherMarket(market_id, library_id, disciplines)
    with django_db_blocker.unblock(), _owner() as owner, owner.transaction():
        owner.execute("delete from drawings_discipline where tenant_id = %s", [library_id])
        owner.execute("delete from platform_developer where id = %s", [library_id])
        owner.execute("delete from platform_market where id = %s", [market_id])
