"""The Library's rows in the Live Model's L tables, attacked as `vextrus_app` (docs/data-model.md §2).

A tenant reads its Market's Library through `app.library_id` and writes none of it: no insert, update
or delete, and no row of its own moved into the Library. Its own rows may name the Library's Element
Families and Attribute Definitions; a classification reference stays in its system's tenant.

The Library's rows are written by the owner and committed, so the app's connection sees them: these
tests run outside the test transaction, and the flush after each puts the Market back.
"""

import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.db import connections, transaction

from vextrus.live_model.tests import rows
from vextrus.live_model.tests.attacks import (
    L_TABLES,
    OUT_OF_REACH,
    RLS_REFUSED,
    T_TABLES,
    UPDATES,
    act,
    ids,
    immediate,
    refused,
)
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile

TRANSACTIONAL = pytest.mark.django_db(transaction=True, databases=["default", "owner"])


def insert_into_library(library: uuid.UUID, table: str, of: dict[str, Any]) -> Callable[[], object]:
    """The app writing a row with `tenant_id` = the Library, naming the Library's own rows."""
    writes: dict[str, Callable[[], object]] = {
        "live_model_elementfamily": lambda: rows.family(library),
        "live_model_attributedefinition": lambda: rows.definition(library),
        "live_model_familyattribute": lambda: rows.family_attribute(
            library,
            of=of["live_model_attributedefinition"],
            on=of["live_model_elementfamily"],
        ),
        "live_model_classificationsystem": lambda: rows.system(library),
        "live_model_classificationreference": lambda: rows.reference(
            library, within=of["live_model_classificationsystem"]
        ),
    }
    return writes[table]


def library_rows(table: str, library: uuid.UUID) -> list[Any]:
    """Every Library row of a table, whole, as the owner reads it."""
    with connections[OWNER_ALIAS].cursor() as owner:
        owner.execute(f"select to_jsonb(t) from {table} t where tenant_id = %s", [library])
        return [row for (row,) in owner.fetchall()]


def library_ids(table: str, library: uuid.UUID) -> set[uuid.UUID]:
    """Every Library row's id of a table, as the owner reads it."""
    with connections[OWNER_ALIAS].cursor() as owner:
        owner.execute(f"select id from {table} where tenant_id = %s", [library])
        return {row_id for (row_id,) in owner.fetchall()}


@pytest.fixture
def in_library(market: MarketProfile) -> dict[str, Any]:
    return rows.every_l_table(market.library_id, OWNER_ALIAS)


@pytest.fixture
def cursor() -> Iterator[Any]:
    with connections["default"].cursor() as cursor:
        yield cursor


@TRANSACTIONAL
@pytest.mark.parametrize("table", L_TABLES)
def test_a_tenant_reads_its_library_s_rows_and_writes_none(
    in_library: dict[str, Any],
    market: MarketProfile,
    make_developer: Callable[..., uuid.UUID],
    cursor: Any,
    table: str,
) -> None:
    library = market.library_id
    a = make_developer("Developer A")
    target = [in_library[table].pk]
    before = library_rows(table, library)

    with transaction.atomic():
        act(cursor, tenant=a, library=library)
        # Every Library row, the synced Library's (S16-L) and the one made here, and no other.
        assert in_library[table].pk in ids(cursor, table)
        assert ids(cursor, table) == library_ids(table, library)

        cursor.execute(f"update {table} set {UPDATES[table]} where id = %s", target)
        assert cursor.rowcount == 0
        cursor.execute(f"delete from {table} where id = %s", target)
        assert cursor.rowcount == 0
        assert RLS_REFUSED in refused(insert_into_library(library, table, in_library))

        act(cursor, tenant=a)  # the Library's rows come only through app.library_id
        assert ids(cursor, table) == set()

    assert library_rows(table, library) == before


@TRANSACTIONAL
@pytest.mark.parametrize("table", L_TABLES)
def test_a_tenant_cannot_point_its_own_row_at_the_library(
    in_library: dict[str, Any],
    market: MarketProfile,
    make_developer: Callable[..., uuid.UUID],
    cursor: Any,
    table: str,
) -> None:
    library = market.library_id
    a = make_developer("Developer A")
    with tenancy.acting_in(a):
        mine = rows.every_l_table(a)

    with transaction.atomic():
        act(cursor, tenant=a, library=library)
        error = refused(
            lambda: cursor.execute(
                f"update {table} set tenant_id = %s where id = %s", [library, mine[table].pk]
            )
        )

    assert RLS_REFUSED in error
    with connections[OWNER_ALIAS].cursor() as owner:
        owner.execute(f"select tenant_id from {table} where id = %s", [mine[table].pk])
        assert owner.fetchone() == (a,)


@TRANSACTIONAL
def test_a_tenant_s_rows_may_name_its_library_s_families_and_definitions(
    in_library: dict[str, Any],
    make_developer: Callable[..., uuid.UUID],
) -> None:
    a = make_developer("Developer A")
    family = in_library["live_model_elementfamily"]
    definition = in_library["live_model_attributedefinition"]

    with tenancy.acting_in(a):
        element = rows.element(a, of=family)
        own_definition = rows.definition(a)
        on_library_family = rows.family_attribute(a, of=own_definition, on=family)
        library_definition_on_own = rows.family_attribute(a, of=definition)
        # A classification reference sits in its system's tenant: never a code of ours in another's.
        in_another_s = refused(
            immediate(lambda: rows.reference(a, within=in_library["live_model_classificationsystem"]))
        )

    assert "live_model_reference_system_own_tenant" in in_another_s
    assert (element.family_id, on_library_family.family_id) == (family.pk, family.pk)
    assert library_definition_on_own.definition_id == definition.pk


@TRANSACTIONAL
def test_without_its_library_set_a_tenant_cannot_name_a_library_row(
    in_library: dict[str, Any],
    make_developer: Callable[..., uuid.UUID],
    cursor: Any,
) -> None:
    a = make_developer("Developer A")
    family = in_library["live_model_elementfamily"]

    with transaction.atomic():
        act(cursor, tenant=a)  # the trigger reads through the caller's own policies
        assert OUT_OF_REACH in refused(lambda: rows.element(a, of=family))
        assert OUT_OF_REACH in refused(
            lambda: rows.family_attribute(a, of=in_library["live_model_attributedefinition"])
        )


@TRANSACTIONAL
def test_on_a_connection_that_never_set_a_tenant_no_row_is_seen(
    in_library: dict[str, Any], make_developer: Callable[..., uuid.UUID]
) -> None:
    a = make_developer("Developer A")
    with tenancy.acting_in(a):
        element = rows.element(a, of=in_library["live_model_elementfamily"])
        rows.record(a, on=element)
        rows.relation(a, between=(element, rows.element(a)))
        rows.family_attribute(a)
        rows.reference(a)
    fresh = connections.create_connection("default")
    try:
        with fresh.cursor() as cursor:
            cursor.execute(
                "select current_setting('app.tenant_id', true), current_setting('app.library_id', true)"
            )
            assert cursor.fetchone() == (None, None)
            for table in T_TABLES + L_TABLES:
                assert ids(cursor, table) == set(), table
    finally:
        fresh.close()
