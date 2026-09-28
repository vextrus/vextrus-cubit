"""Row-level security on the Live Model's tables, attacked as `vextrus_app` (docs/data-model.md §2).

Each test acts as the app would: the three settings set local to a transaction, then plain SQL or
the ORM. The attacks:
- T tables: a tenant reading, updating, deleting or inserting another tenant's rows, or moving its
  own row to another tenant;
- L tables: a tenant writing a Library row (insert, update, delete), including by pointing its own
  row's `tenant_id` at the Library;
- a setting never set, or read back as `''`: no row is seen, none is written;
- a reference naming another tenant's row, which a key check (run as the owner) would pass.
"""

import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.db import connections

from vextrus.live_model.models import Element
from vextrus.live_model.tests import rows
from vextrus.live_model.tests.attacks import (
    L_TABLES,
    OUT_OF_REACH,
    REACH_CHECKED,
    RLS_REFUSED,
    T_TABLES,
    UPDATES,
    act,
    execute,
    ids,
    immediate,
    refused,
)
from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile


def insert_into(tenant: uuid.UUID, table: str, of: dict[str, Any]) -> Callable[[], object]:
    """An insert of a row with `tenant_id` = `tenant`, its references naming the rows in `of`
    (the acting tenant's own, so only the row's tenant is wrong)."""
    family, element = of["live_model_elementfamily"], of["live_model_element"]
    writes: dict[str, Callable[[], object]] = {
        "live_model_element": lambda: rows.element(tenant, of=family),
        "live_model_record": lambda: rows.record(tenant, on=element),
        "live_model_elementrelation": lambda: rows.relation(
            tenant, between=(element, Element(pk=of["live_model_elementrelation"].to_element_id))
        ),
        "live_model_elementfamily": lambda: rows.family(tenant),
        "live_model_attributedefinition": lambda: rows.definition(tenant),
        "live_model_familyattribute": lambda: rows.family_attribute(
            tenant, of=of["live_model_attributedefinition"], on=family
        ),
        "live_model_classificationsystem": lambda: rows.system(tenant),
        "live_model_classificationreference": lambda: rows.reference(
            tenant, within=of["live_model_classificationsystem"]
        ),
    }
    return writes[table]


@pytest.fixture
def cursor() -> Iterator[Any]:
    with connections["default"].cursor() as cursor:
        yield cursor


@pytest.fixture
def two(make_developer: Callable[..., uuid.UUID]) -> tuple[uuid.UUID, uuid.UUID]:
    return make_developer("Developer A"), make_developer("Developer B")


@pytest.fixture
def a_and_b(
    two: tuple[uuid.UUID, uuid.UUID],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """A row of every table in Developer A and in Developer B, each written by its own tenant."""
    a, b = two
    with tenancy.acting_in(a):
        in_a = rows.every_table(a)
    with tenancy.acting_in(b):
        in_b = rows.every_table(b)
    return in_a, in_b


ALL_TABLES = T_TABLES + L_TABLES


# Another tenant's rows -------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("table", ALL_TABLES)
def test_a_tenant_reads_none_of_another_tenant_s_rows(
    a_and_b: tuple[dict[str, Any], dict[str, Any]],
    two: tuple[uuid.UUID, uuid.UUID],
    market: MarketProfile,
    cursor: Any,
    table: str,
) -> None:
    in_a, in_b = a_and_b
    a, b = two
    act(cursor, tenant=b, library=market.library_id)

    seen = ids(cursor, table)

    assert in_b[table].pk in seen
    assert in_a[table].pk not in seen
    act(cursor, tenant=a, library=market.library_id)
    assert in_a[table].pk in ids(cursor, table)


@pytest.mark.django_db
@pytest.mark.parametrize("table", ALL_TABLES)
def test_a_tenant_updates_and_deletes_none_of_another_tenant_s_rows(
    a_and_b: tuple[dict[str, Any], dict[str, Any]],
    two: tuple[uuid.UUID, uuid.UUID],
    market: MarketProfile,
    cursor: Any,
    table: str,
) -> None:
    in_a, _in_b = a_and_b
    a, b = two
    target = [in_a[table].pk]
    update = f"update {table} set {UPDATES[table]} where id = %s"
    act(cursor, tenant=b, library=market.library_id)

    assert execute(cursor, update, target)() == 0
    assert execute(cursor, f"delete from {table} where id = %s", target)() == 0

    act(cursor, tenant=a, library=market.library_id)
    assert in_a[table].pk in ids(cursor, table)
    assert execute(cursor, update, target)() == 1  # the same update passes for its own tenant


@pytest.mark.django_db
@pytest.mark.parametrize("table", ALL_TABLES)
def test_a_tenant_inserts_no_row_into_another_tenant(
    a_and_b: tuple[dict[str, Any], dict[str, Any]],
    two: tuple[uuid.UUID, uuid.UUID],
    table: str,
) -> None:
    _in_a, in_b = a_and_b
    a, b = two

    with tenancy.acting_in(b):
        error = refused(insert_into(a, table, in_b))

    assert RLS_REFUSED in error


@pytest.mark.django_db
@pytest.mark.parametrize("table", ALL_TABLES)
def test_a_tenant_moves_none_of_its_own_rows_to_another_tenant(
    a_and_b: tuple[dict[str, Any], dict[str, Any]],
    two: tuple[uuid.UUID, uuid.UUID],
    market: MarketProfile,
    cursor: Any,
    table: str,
) -> None:
    _in_a, in_b = a_and_b
    a, b = two
    act(cursor, tenant=b, library=market.library_id)

    error = refused(
        execute(cursor, f"update {table} set tenant_id = %s where id = %s", [a, in_b[table].pk])
    )

    assert RLS_REFUSED in error


# No tenant set ---------------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("table", ALL_TABLES)
def test_with_the_settings_read_back_empty_no_row_is_seen_or_written(
    a_and_b: tuple[dict[str, Any], dict[str, Any]],
    two: tuple[uuid.UUID, uuid.UUID],
    cursor: Any,
    table: str,
) -> None:
    in_a, _in_b = a_and_b
    a, _b = two
    act(cursor)  # '' for every setting, as a pooled connection reads them back
    cursor.execute("select current_setting('app.tenant_id', true)")
    assert cursor.fetchone() == ("",)

    assert ids(cursor, table) == set()
    # A row naming an Element Family or an Attribute Definition is refused sooner: with no tenant,
    # the row it names cannot be read.
    reason = OUT_OF_REACH if table in REACH_CHECKED else RLS_REFUSED
    assert reason in refused(insert_into(a, table, in_a))


# References ------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_no_reference_names_another_tenant_s_row(
    a_and_b: tuple[dict[str, Any], dict[str, Any]],
    two: tuple[uuid.UUID, uuid.UUID],
) -> None:
    in_a, in_b = a_and_b
    _a, b = two
    theirs: Any = in_a
    mine: Any = in_b

    with tenancy.acting_in(b):
        # T to T and a reference to its system: composite keys on (tenant_id, …).
        assert "live_model_record_element_own_tenant" in refused(
            immediate(lambda: rows.record(b, on=theirs["live_model_element"]))
        )
        assert "live_model_relation_to_own_tenant" in refused(
            immediate(
                lambda: rows.relation(
                    b, between=(mine["live_model_element"], theirs["live_model_element"])
                )
            )
        )
        assert "live_model_relation_from_own_tenant" in refused(
            immediate(
                lambda: rows.relation(
                    b, between=(theirs["live_model_element"], mine["live_model_element"])
                )
            )
        )
        assert "live_model_record_supersedes_own_tenant" in refused(
            immediate(
                lambda: rows.record(
                    b, on=mine["live_model_element"], supersedes=theirs["live_model_record"]
                )
            )
        )
        assert "live_model_reference_system_own_tenant" in refused(
            immediate(lambda: rows.reference(b, within=theirs["live_model_classificationsystem"]))
        )
        # References to an L table: the caller must be able to read the row named.
        assert OUT_OF_REACH in refused(lambda: rows.element(b, of=theirs["live_model_elementfamily"]))
        assert OUT_OF_REACH in refused(
            lambda: rows.family_attribute(
                b,
                of=theirs["live_model_attributedefinition"],
                on=mine["live_model_elementfamily"],
            )
        )
        assert OUT_OF_REACH in refused(
            lambda: rows.family_attribute(
                b,
                of=mine["live_model_attributedefinition"],
                on=theirs["live_model_elementfamily"],
            )
        )
        # Re-pointing an existing row is refused the same way.
        assert OUT_OF_REACH in refused(
            lambda: Element.objects.filter(pk=mine["live_model_element"].pk).update(
                family_id=theirs["live_model_elementfamily"].pk
            )
        )
