"""`projects`' tables under row-level security, at the SQL level, as vextrus_app (docs/data-model.md §2).

Each test acts as the app would: the three settings set local to the test's transaction, then plain
SQL, so what is proven here holds for any code path, the admin's included.
"""

import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.db import DatabaseError, connections, transaction

from vextrus.platform.services.markets import MarketProfile
from vextrus.platform.tests.policy_coverage import coverage_problems

RLS_REFUSED = "new row violates row-level security policy"
TABLES = ("projects_project", "projects_site", "projects_building")


def act(cursor: Any, *, tenant: uuid.UUID | None = None) -> None:
    cursor.execute(
        "select set_config('app.tenant_id', %s, true), set_config('app.user_id', '', true), "
        "set_config('app.library_id', '', true)",
        [str(tenant or "")],
    )


def rows(cursor: Any, sql: str, params: list[Any] | None = None) -> list[tuple[Any, ...]]:
    cursor.execute(sql, params or [])
    return list(cursor.fetchall())


def refused(cursor: Any, sql: str, params: list[Any]) -> str:
    """The error a statement raises, inside its own savepoint so the test goes on."""
    with pytest.raises(DatabaseError) as raised, transaction.atomic():
        cursor.execute(sql, params)
    return str(raised.value)


@pytest.fixture
def two(make_developer: Callable[..., uuid.UUID]) -> tuple[uuid.UUID, uuid.UUID]:
    return make_developer("Developer A"), make_developer("Developer B")


@pytest.fixture
def cursor() -> Iterator[Any]:
    with connections["default"].cursor() as cursor:
        yield cursor


INSERT_PROJECT = """insert into projects_project
  (id, tenant_id, code, code_key, name, address, market_id, currency_code, unit_system, created_at)
  values (%s, %s, %s, lower(%s), 'A project', '', %s, %s, %s, now())"""
INSERT_BUILDING = """insert into projects_building (id, tenant_id, project_id, code, name, ordinal)
  values (%s, %s, %s, 'B2', 'A second', 2)"""


def project_row(
    project_id: uuid.UUID, tenant: uuid.UUID, market: MarketProfile, code: str, **changed: Any
) -> list[Any]:
    """INSERT_PROJECT's values: on the Market's own currency and default unit system unless changed."""
    values = {
        "market_id": market.id,
        "currency_code": market.currency.code,
        "unit_system": market.default_unit_system,
        **changed,
    }
    return [project_id, tenant, code, code, *values.values()]


def insert_project(cursor: Any, tenant: uuid.UUID, market: MarketProfile, code: str) -> uuid.UUID:
    project_id = uuid.uuid4()
    cursor.execute(INSERT_PROJECT, project_row(project_id, tenant, market, code))
    return project_id


@pytest.mark.django_db
def test_the_policy_coverage_check_covers_every_projects_table(cursor: Any) -> None:
    checked, problems = coverage_problems(cursor)

    assert set(TABLES) <= set(checked)
    assert [problem for problem in problems if problem.startswith("projects_")] == []


@pytest.mark.django_db
def test_a_developer_sees_only_its_own_projects(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, b = two
    act(cursor, tenant=a)
    mine = insert_project(cursor, a, market, "KR-01")
    act(cursor, tenant=b)
    insert_project(cursor, b, market, "MG-01")

    act(cursor, tenant=a)
    assert rows(cursor, "select id from projects_project") == [(mine,)]
    act(cursor)
    assert rows(cursor, "select id from projects_project") == []


@pytest.mark.django_db
def test_the_app_cannot_write_a_project_into_another_developer(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, b = two
    act(cursor, tenant=b)
    theirs = insert_project(cursor, b, market, "MG-01")
    act(cursor, tenant=a)

    assert RLS_REFUSED in refused(cursor, INSERT_PROJECT, project_row(uuid.uuid4(), b, market, "X-01"))
    cursor.execute("update projects_project set name = 'Taken' where id = %s", [theirs])
    assert cursor.rowcount == 0
    cursor.execute("delete from projects_project where id = %s", [theirs])
    assert cursor.rowcount == 0
    act(cursor, tenant=b)
    assert rows(cursor, "select name from projects_project where id = %s", [theirs]) == [("A project",)]


@pytest.mark.django_db
def test_the_app_cannot_move_its_project_into_another_developer(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, b = two
    act(cursor, tenant=a)
    mine = insert_project(cursor, a, market, "KR-01")

    error = refused(cursor, "update projects_project set tenant_id = %s where id = %s", [b, mine])

    assert "permission denied" in error


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("column", "value"),
    [("market_id", uuid.uuid4()), ("currency_code", "XTS"), ("created_at", "2020-01-01T00:00Z")],
)
def test_the_app_cannot_rewrite_a_projects_market_or_currency(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile, column: str, value: Any
) -> None:
    a, _b = two
    act(cursor, tenant=a)
    mine = insert_project(cursor, a, market, "KR-01")

    error = refused(cursor, f"update projects_project set {column} = %s where id = %s", [value, mine])

    assert "permission denied" in error


@pytest.mark.django_db
def test_the_app_may_change_what_a_person_may_change(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, _b = two
    act(cursor, tenant=a)
    mine = insert_project(cursor, a, market, "KR-01")

    cursor.execute(
        "update projects_project set code = 'KR-02', code_key = 'kr-02', name = 'Renamed',"
        " address = 'Elsewhere', unit_system = %s where id = %s",
        [market.unit_systems[-1], mine],
    )

    assert cursor.rowcount == 1


FOLLOWS_MARKET = "projects_project_follows_market"


@pytest.mark.django_db
def test_the_app_cannot_swap_a_projects_currency_by_deleting_and_inserting_it_again(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, _b = two
    act(cursor, tenant=a)
    mine = insert_project(cursor, a, market, "KR-01")
    cursor.execute("delete from projects_project where id = %s", [mine])

    for changed in (
        {"currency_code": "XTS"},
        {"market_id": uuid.uuid4()},
        {"unit_system": "cubits"},
        {"unit_system": ""},
    ):
        error = refused(cursor, INSERT_PROJECT, project_row(mine, a, market, "KR-01", **changed))
        assert FOLLOWS_MARKET in error, changed
    cursor.execute(INSERT_PROJECT, project_row(mine, a, market, "KR-01"))


@pytest.mark.django_db
def test_the_app_cannot_set_a_unit_system_the_market_does_not_offer(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, _b = two
    act(cursor, tenant=a)
    mine = insert_project(cursor, a, market, "KR-01")

    error = refused(cursor, "update projects_project set unit_system = 'cubits' where id = %s", [mine])

    assert FOLLOWS_MARKET in error


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_market_check_holds_the_owner_too(market: MarketProfile, make_developer: Any) -> None:
    # The trigger fires for every writer, the owner (migrations, the operators' path) included.
    row = project_row(uuid.uuid4(), make_developer(), market, "KR-01", currency_code="XTS")

    with (
        connections["owner"].cursor() as owner,
        pytest.raises(DatabaseError, match=FOLLOWS_MARKET),
        transaction.atomic(using="owner"),
    ):
        owner.execute(INSERT_PROJECT, row)


@pytest.mark.django_db
def test_the_market_check_is_the_owners_and_nobody_may_call_it(cursor: Any) -> None:
    owner, security_definer, pinned = rows(
        cursor,
        "select pg_get_userbyid(proowner), prosecdef, proconfig from pg_proc where proname = %s",
        [FOLLOWS_MARKET],
    )[0]

    assert (owner, security_definer, pinned) == ("vextrus", True, ["search_path=pg_catalog, pg_temp"])
    assert rows(
        cursor,
        "select has_function_privilege('vextrus_app', %s, 'execute')",
        [f"public.{FOLLOWS_MARKET}()"],
    ) == [(False,)]


@pytest.mark.django_db
@pytest.mark.parametrize("table", ["projects_site", "projects_building"])
def test_the_app_cannot_move_a_site_or_building_to_another_project(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile, table: str
) -> None:
    a, _b = two
    act(cursor, tenant=a)
    first = insert_project(cursor, a, market, "KR-01")
    second = insert_project(cursor, a, market, "BP-02")
    cursor.execute(
        "insert into projects_site (id, tenant_id, project_id, name) values (%s, %s, %s, '')",
        [uuid.uuid4(), a, first],
    )
    cursor.execute(
        "insert into projects_building (id, tenant_id, project_id, code, name, ordinal)"
        " values (%s, %s, %s, 'B1', 'x', 1)",
        [uuid.uuid4(), a, first],
    )

    for column, value in (("project_id", second), ("tenant_id", _b)):
        error = refused(cursor, f"update {table} set {column} = %s", [value])
        assert "permission denied" in error


@pytest.mark.django_db
def test_a_building_cannot_be_hung_on_another_developers_project(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, b = two
    act(cursor, tenant=b)
    theirs = insert_project(cursor, b, market, "MG-01")
    act(cursor, tenant=a)

    # Its own tenant, their Project: the composite key refuses it (deferred to commit; made immediate).
    cursor.execute("set constraints all immediate")
    error = refused(cursor, INSERT_BUILDING, [uuid.uuid4(), a, theirs])

    assert "projects_building_own_tenant" in error
    # Their tenant: row-level security refuses it.
    assert RLS_REFUSED in refused(cursor, INSERT_BUILDING, [uuid.uuid4(), b, theirs])


@pytest.mark.django_db
def test_a_site_cannot_be_hung_on_another_developers_project(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, b = two
    act(cursor, tenant=b)
    theirs = insert_project(cursor, b, market, "MG-01")
    act(cursor, tenant=a)

    cursor.execute("set constraints all immediate")
    error = refused(
        cursor,
        "insert into projects_site (id, tenant_id, project_id, name) values (%s, %s, %s, '')",
        [uuid.uuid4(), a, theirs],
    )

    assert "projects_site_own_tenant" in error


@pytest.mark.django_db
def test_a_code_key_is_unique_in_a_developer_but_not_across_developers(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, b = two
    act(cursor, tenant=a)
    insert_project(cursor, a, market, "KR-01")

    error = refused(cursor, INSERT_PROJECT, project_row(uuid.uuid4(), a, market, "KR-01"))

    assert "projects_project_code_unique" in error
    act(cursor, tenant=b)
    insert_project(cursor, b, market, "KR-01")


@pytest.mark.django_db
def test_the_app_is_never_granted_truncate_on_projects_tables(cursor: Any) -> None:
    for table in TABLES:
        assert rows(cursor, "select has_table_privilege(%s, 'truncate')", [table]) == [(False,)]
