"""The Live Model's tables are the owner's Q14 ruling, each under its policy kind (docs/data-model.md
§2 and §3.3): T, the own-tenant policy alone; L, the own-tenant policy and one `FOR SELECT` policy
admitting the Market's Library. Both read their setting through `nullif`.
"""

import re
from collections.abc import Iterator
from typing import Any

import pytest
from django.apps import apps
from django.db import connections

from vextrus.live_model import services
from vextrus.platform import ids
from vextrus.platform.tests.policy_coverage import coverage_problems

T = {"live_model_element", "live_model_record", "live_model_elementrelation"}
L = {
    "live_model_elementfamily",
    "live_model_attributedefinition",
    "live_model_familyattribute",
    "live_model_classificationsystem",
    "live_model_classificationreference",
}

OWN_TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid"
LIBRARY = "tenant_id = nullif(current_setting('app.library_id', true), '')::uuid"


def _normalise(expression: str | None) -> str:
    """A policy's expression as pg_policies prints it, without spaces, brackets or casts."""
    return re.sub(r"[\s()]|::text", "", expression or "").lower()


def _policy(name: str, command: str, using: str) -> tuple[str, str, str, str, str, str]:
    return (name, command, "PERMISSIVE", "public", _normalise(using), "")


EXPECTED = {
    "T": {_policy("own_tenant", "ALL", OWN_TENANT)},
    "L": {_policy("own_tenant", "ALL", OWN_TENANT), _policy("library_reads", "SELECT", LIBRARY)},
}


def kind_problems(cursor: Any, table: str, kind: str) -> list[str]:
    """What differs between a table's policies and its kind's, exactly: none added, none missing,
    whatever its role (a policy granted to `vextrus_app` alone widens as much as one to public)."""
    cursor.execute(
        """
        select policyname, cmd, permissive, qual, with_check, roles::text[] from pg_policies
         where schemaname = 'public' and tablename = %s
        """,
        [table],
    )
    found = {
        (name, command, permissive, ",".join(roles), _normalise(qual), _normalise(check))
        for name, command, permissive, qual, check, roles in cursor.fetchall()
    }
    return [f"{table}: missing {policy}" for policy in sorted(EXPECTED[kind] - found)] + [
        f"{table}: unexpected {policy}" for policy in sorted(found - EXPECTED[kind])
    ]


@pytest.fixture
def cursor() -> Iterator[Any]:
    with connections["default"].cursor() as cursor:
        yield cursor


@pytest.fixture
def owner_cursor() -> Iterator[Any]:
    """The owner, inside the test's transaction: every table made here is rolled back."""
    with connections["owner"].cursor() as cursor:
        yield cursor


def test_the_tables_are_the_owner_s_ruling_and_no_more() -> None:
    tables = {model._meta.db_table for model in apps.get_app_config("live_model").get_models()}

    assert tables == T | L


def test_live_model_s_services_expose_nothing_yet() -> None:
    assert [name for name in vars(services) if not name.startswith("_")] == []


@pytest.mark.django_db
def test_every_id_comes_from_new_id_with_no_database_default(cursor: Any) -> None:
    for model in apps.get_app_config("live_model").get_models():
        assert model._meta.pk is not None
        assert model._meta.pk.default is ids.new_id, model

    cursor.execute(
        """
        select table_name, column_name from information_schema.columns
         where table_name like 'live\\_model\\_%%' and column_default is not null
        """
    )
    assert cursor.fetchall() == []


@pytest.mark.django_db
def test_every_table_is_under_row_level_security_as_the_coverage_test_rules(cursor: Any) -> None:
    checked, problems = coverage_problems(cursor)

    assert set(checked) >= T | L
    assert [problem for problem in problems if problem.startswith("live_model_")] == []


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("table", "kind"), [*((table, "T") for table in sorted(T)), *((table, "L") for table in sorted(L))]
)
def test_each_table_has_exactly_its_kind_s_policies(cursor: Any, table: str, kind: str) -> None:
    assert kind_problems(cursor, table, kind) == []


@pytest.mark.django_db(databases=["owner"])
def test_a_live_model_table_left_without_row_level_security_fails_the_coverage_test(
    owner_cursor: Any,
) -> None:
    owner_cursor.execute(
        "create table live_model_scratch (id uuid primary key, tenant_id uuid not null)"
    )

    checked, problems = coverage_problems(owner_cursor)

    assert "live_model_scratch" in checked
    assert [problem for problem in problems if problem.startswith("live_model_scratch")] == [
        "live_model_scratch: row-level security is not enabled",
        "live_model_scratch: has no own-tenant policy for all commands",
    ]


@pytest.mark.django_db(databases=["owner"])
@pytest.mark.parametrize(
    "using",
    [
        "tenant_id = current_setting('app.tenant_id', true)::uuid",
        "tenant_id::text = coalesce(current_setting('app.tenant_id', true), tenant_id::text)",
    ],
)
def test_a_policy_reading_its_setting_without_nullif_fails_the_coverage_test(
    owner_cursor: Any, using: str
) -> None:
    owner_cursor.execute(
        "create table live_model_scratch (id uuid primary key, tenant_id uuid not null)"
    )
    owner_cursor.execute("alter table live_model_scratch enable row level security")
    owner_cursor.execute(f"create policy own_tenant on live_model_scratch using ({using})")

    _checked, problems = coverage_problems(owner_cursor)

    assert "live_model_scratch: has no own-tenant policy for all commands" in problems


@pytest.mark.django_db(databases=["owner"])
@pytest.mark.parametrize(
    ("library_reads", "problem"),
    [
        # A widening for every command would let a tenant write the Library.
        (f"create policy library_reads on live_model_scratch using ({LIBRARY})", "ALL"),
        # A widening without nullif.
        (
            (
                "create policy library_reads on live_model_scratch for select using "
                "(tenant_id = current_setting('app.library_id', true)::uuid)"
            ),
            "SELECT",
        ),
    ],
)
def test_an_l_table_widening_writes_or_reading_without_nullif_fails_its_kind(
    owner_cursor: Any, library_reads: str, problem: str
) -> None:
    owner_cursor.execute(
        "create table live_model_scratch (id uuid primary key, tenant_id uuid not null)"
    )
    owner_cursor.execute("alter table live_model_scratch enable row level security")
    owner_cursor.execute(f"create policy own_tenant on live_model_scratch using ({OWN_TENANT})")
    owner_cursor.execute(library_reads)

    problems = kind_problems(owner_cursor, "live_model_scratch", "L")

    assert len(problems) == 2
    assert problems[0].startswith("live_model_scratch: missing ('library_reads', 'SELECT'")
    assert problems[1].startswith(f"live_model_scratch: unexpected ('library_reads', '{problem}'")


@pytest.mark.django_db(databases=["owner"])
def test_a_t_table_given_a_library_widening_fails_its_kind(owner_cursor: Any) -> None:
    table = "live_model_element"
    owner_cursor.execute(f"create policy library_reads on {table} for select using ({LIBRARY})")

    assert kind_problems(owner_cursor, table, "T") == [
        f"{table}: unexpected {_policy('library_reads', 'SELECT', LIBRARY)}"
    ]


@pytest.mark.django_db(databases=["owner"])
@pytest.mark.parametrize(
    "widening",
    [
        "create policy app_all on {table} to vextrus_app using (true) with check (true)",
        "create policy app_inserts on {table} for insert to vextrus_app with check (true)",
        "create policy everyone on {table} using (true) with check (true)",
    ],
)
def test_a_widening_granted_to_any_role_fails_its_kind(owner_cursor: Any, widening: str) -> None:
    table = "live_model_element"
    owner_cursor.execute(widening.format(table=table))

    problems = kind_problems(owner_cursor, table, "T")

    assert len(problems) == 1
    assert problems[0].startswith(f"{table}: unexpected (")
