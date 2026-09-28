"""Every tenant table has row-level security enabled, its own-tenant policy and tenant-led indexes."""

from collections.abc import Iterator
from typing import Any

import pytest
from django.db import connections

from vextrus.platform.tests.policy_coverage import GLOBAL_TABLES, coverage_problems

OWN_TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid"


@pytest.mark.django_db
def test_every_tenant_table_is_under_its_own_tenant_policy() -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute("select current_user")
        assert cursor.fetchone() == ("vextrus_app",)

        _checked, problems = coverage_problems(cursor)

    assert problems == []


@pytest.mark.django_db
def test_every_global_table_gives_its_reason() -> None:
    assert all(reason.strip() for reason in GLOBAL_TABLES.values())


@pytest.fixture
def owner_cursor() -> Iterator[Any]:
    """The owner, inside the test's transaction: every table made here is rolled back."""
    with connections["owner"].cursor() as cursor:
        yield cursor


def check(cursor: Any) -> list[str]:
    checked, problems = coverage_problems(cursor)
    assert "sample" in checked
    return problems


@pytest.mark.django_db(databases=["owner"])
def test_a_tenant_table_without_row_level_security_is_found(owner_cursor: Any) -> None:
    owner_cursor.execute("create table sample (id uuid primary key, tenant_id uuid not null)")

    assert check(owner_cursor) == [
        "sample: row-level security is not enabled",
        "sample: has no own-tenant policy for all commands",
    ]


@pytest.mark.django_db(databases=["owner"])
def test_a_covered_tenant_table_passes(owner_cursor: Any) -> None:
    owner_cursor.execute("create table sample (id uuid primary key, tenant_id uuid not null)")
    owner_cursor.execute("alter table sample enable row level security")
    owner_cursor.execute(f"create policy own_tenant on sample using ({OWN_TENANT})")
    owner_cursor.execute("create index sample_tenant_made on sample (tenant_id, id)")

    assert check(owner_cursor) == []


@pytest.mark.django_db(databases=["owner"])
def test_a_forced_table_a_narrower_policy_and_a_stray_index_are_found(owner_cursor: Any) -> None:
    owner_cursor.execute("create table sample (id uuid primary key, tenant_id uuid not null, n int)")
    owner_cursor.execute("alter table sample enable row level security")
    owner_cursor.execute("alter table sample force row level security")
    owner_cursor.execute(f"create policy reads on sample for select using ({OWN_TENANT})")
    owner_cursor.execute("create index sample_n on sample (n)")

    assert check(owner_cursor) == [
        "sample: row-level security is forced (enable it, never force it)",
        "sample: has no own-tenant policy for all commands",
        "sample: index sample_n is not led by tenant_id",
    ]


@pytest.mark.django_db(databases=["owner"])
def test_a_policy_widening_writes_is_not_the_own_tenant_policy(owner_cursor: Any) -> None:
    owner_cursor.execute("create table sample (id uuid primary key, tenant_id uuid not null)")
    owner_cursor.execute("alter table sample enable row level security")
    owner_cursor.execute(
        f"create policy wide on sample using ({OWN_TENANT} or tenant_id = "
        "nullif(current_setting('app.library_id', true), '')::uuid)"
    )

    assert check(owner_cursor) == ["sample: has no own-tenant policy for all commands"]


@pytest.mark.django_db(databases=["owner"])
def test_a_table_without_a_tenant_column_is_found(owner_cursor: Any) -> None:
    owner_cursor.execute("create table sample (id uuid primary key)")
    owner_cursor.execute("alter table sample enable row level security")

    assert check(owner_cursor)[0] == "sample: has no tenant_id uuid NOT NULL"


@pytest.mark.django_db(databases=["owner"])
def test_a_stale_allowlist_entry_is_found(owner_cursor: Any) -> None:
    _checked, problems = coverage_problems(
        owner_cursor, global_tables={**GLOBAL_TABLES, "gone_table": "was here once"}
    )

    assert problems == ["gone_table: on the global allowlist but no such table (stale entry)"]
