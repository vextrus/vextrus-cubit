"""Row-level security at the SQL level, as vextrus_app (docs/data-model.md §2 and §3.0).

Each test acts as the app would: the three settings set local to the test's transaction, then plain
SQL. The review's measured attack (the app inserting a Membership for itself into another Developer)
must fail; so must every other write outside the acting tenant, and every write to a Library row.
"""

import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.core.management import call_command
from django.db import DatabaseError, connections, transaction

from vextrus.platform.models import User
from vextrus.platform.services.markets import MarketProfile
from vextrus.platform.tests.policy_coverage import coverage_problems
from vextrus.testing.tenancy import add_member

RLS_REFUSED = "new row violates row-level security policy"


def act(
    cursor: Any,
    *,
    tenant: uuid.UUID | None = None,
    user: uuid.UUID | None = None,
    library: uuid.UUID | None = None,
) -> None:
    cursor.execute(
        "select set_config('app.tenant_id', %s, true), set_config('app.user_id', %s, true), "
        "set_config('app.library_id', %s, true)",
        [str(tenant or ""), str(user or ""), str(library or "")],
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


INSERT_MD = """insert into platform_membership
  (id, tenant_id, user_id, role, outside_org, created_at, starts_at, accepted_at, invited_email,
   invite_token_hash)
  values (%s, %s, %s, 'md', '', now(), now(), now(), '', '')"""


@pytest.mark.django_db
def test_the_measured_attack_fails_the_app_cannot_insert_itself_into_another_developer(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any
) -> None:
    a, b = two
    user, _membership = add_member(a, role="qs")
    act(cursor, tenant=a, user=user.pk)

    error = refused(cursor, INSERT_MD, [uuid.uuid4(), b, user.pk])

    assert RLS_REFUSED in error
    act(cursor, tenant=b)
    assert rows(cursor, "select 1 from platform_membership where user_id = %s", [user.pk]) == []


@pytest.mark.django_db
def test_with_no_tenant_set_the_app_can_write_no_membership_at_all(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any
) -> None:
    a, _b = two
    user, _membership = add_member(a, role="qs")
    act(cursor, user=user.pk)

    assert RLS_REFUSED in refused(cursor, INSERT_MD, [uuid.uuid4(), a, user.pk])


@pytest.mark.django_db
def test_the_user_s_own_memberships_elsewhere_are_readable_but_not_writable(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any
) -> None:
    a, b = two
    user, in_a = add_member(a, role="qs")
    _same, in_b = add_member(b, role="qs", user=user)
    _other, others_in_b = add_member(b, role="md")
    act(cursor, tenant=a, user=user.pk)

    seen = {row[0] for row in rows(cursor, "select id from platform_membership")}
    promoted = rows(
        cursor,
        "update platform_membership set role = 'md' where user_id = %s returning id",
        [user.pk],
    )
    cursor.execute("delete from platform_membership where id = %s", [in_b])
    deleted = cursor.rowcount

    assert seen == {in_a, in_b}
    assert others_in_b not in seen
    assert promoted == [(in_a,)]  # its own tenant's row only
    assert deleted == 0
    act(cursor, tenant=b)
    assert rows(cursor, "select role from platform_membership where id = %s", [in_b]) == [("qs",)]


@pytest.mark.django_db
def test_a_developer_s_policy_admits_its_own_row_only(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any
) -> None:
    a, b = two
    act(cursor, tenant=a)
    assert rows(cursor, "select id from platform_developer") == [(a,)]
    cursor.execute("update platform_developer set name = 'Taken' where id = %s", [b])
    assert cursor.rowcount == 0
    act(cursor)
    assert rows(cursor, "select id from platform_developer") == []


@pytest.mark.django_db
def test_membership_projects_and_events_stay_in_their_tenant(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any
) -> None:
    a, b = two
    user, membership = add_member(a, role="guest", projects=[uuid.uuid4()])
    act(cursor, tenant=b, user=user.pk)

    assert rows(cursor, "select 1 from platform_membershipproject") == []
    assert rows(cursor, "select 1 from platform_domainevent where tenant_id = %s", [a]) == []
    error = refused(
        cursor,
        "insert into platform_membershipproject (id, tenant_id, membership_id, project_id) "
        "values (%s, %s, %s, %s)",
        [uuid.uuid4(), a, membership, uuid.uuid4()],
    )
    assert RLS_REFUSED in error


@pytest.mark.django_db
def test_a_membership_project_names_a_membership_of_its_own_tenant(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any
) -> None:
    a, b = two
    _user, in_a = add_member(a, role="qs")
    act(cursor, tenant=b)
    cursor.execute("set constraints all immediate")

    error = refused(
        cursor,
        "insert into platform_membershipproject (id, tenant_id, membership_id, project_id) "
        "values (%s, %s, %s, %s)",
        [uuid.uuid4(), b, in_a, uuid.uuid4()],
    )

    assert "platform_membershipproject_own_tenant" in error


@pytest.mark.django_db
def test_a_developer_cannot_point_at_another_library_or_become_one(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any
) -> None:
    a, b = two
    act(cursor, tenant=a)
    cursor.execute("set constraints all immediate")

    assert "platform_developer_market_library" in refused(
        cursor, "update platform_developer set library_id = %s where id = %s", [b, a]
    )
    assert "platform_developer_library_is_itself" in refused(
        cursor, "update platform_developer set is_library = true where id = %s", [a]
    )


@pytest.mark.django_db
def test_every_market_is_readable_and_no_tenant_can_write_one(
    two: tuple[uuid.UUID, uuid.UUID], cursor: Any, market: MarketProfile
) -> None:
    a, _b = two
    act(cursor)
    assert rows(cursor, "select id from platform_market") == [(market.id,)]
    act(cursor, tenant=market.library_id, library=market.library_id)

    for sql in (
        "update platform_market set time_zone = 'UTC'",
        "delete from platform_market",
        "insert into platform_market (id, tenant_id) values (gen_random_uuid(), %s)",
    ):
        error = refused(cursor, sql, [a] if "%s" in sql else [])
        assert "permission denied for table platform_market" in error


LIBRARY_POLICY = "tenant_id = nullif(current_setting('app.library_id', true), '')::uuid"
OWN_TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid"


@pytest.fixture
def library_table() -> Iterator[str]:
    """An L table as a later ticket makes one (own-tenant policy, and the Library's rows read
    through a FOR SELECT policy), committed so the app's connection sees it; dropped after."""
    with connections["owner"].cursor() as owner:
        owner.execute("create table sample_library (id uuid primary key, tenant_id uuid not null)")
        owner.execute("alter table sample_library enable row level security")
        owner.execute(f"create policy own_tenant on sample_library using ({OWN_TENANT})")
        owner.execute(
            f"create policy library_reads on sample_library for select using ({LIBRARY_POLICY})"
        )
    try:
        yield "sample_library"
    finally:
        with connections["owner"].cursor() as owner:
            owner.execute("drop table sample_library")


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_a_tenant_reads_its_library_but_cannot_write_a_library_row(
    library_table: str, market: MarketProfile, make_developer: Callable[..., uuid.UUID]
) -> None:
    library = market.library_id
    with connections["owner"].cursor() as owner:
        owner.execute(f"insert into {library_table} values (%s, %s)", [uuid.uuid4(), library])
        _checked, problems = coverage_problems(owner)
    assert [p for p in problems if library_table in p] == []
    a = make_developer("Developer A")

    with transaction.atomic(), connections["default"].cursor() as cursor:
        act(cursor, tenant=a, library=library)
        assert len(rows(cursor, f"select id from {library_table}")) == 1
        cursor.execute(f"update {library_table} set tenant_id = tenant_id")
        assert cursor.rowcount == 0
        cursor.execute(f"delete from {library_table}")
        assert cursor.rowcount == 0
        error = refused(cursor, f"insert into {library_table} values (%s, %s)", [uuid.uuid4(), library])
        assert RLS_REFUSED in error
        cursor.execute(f"insert into {library_table} values (%s, %s)", [uuid.uuid4(), a])
        assert len(rows(cursor, f"select id from {library_table}")) == 2


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_after_a_flush_the_market_and_its_library_come_back(market: MarketProfile) -> None:
    call_command("flush", interactive=False, verbosity=0)

    with connections["default"].cursor() as cursor:
        assert rows(cursor, "select code from platform_market") == [(market.code,)]


@pytest.mark.django_db
@pytest.mark.parametrize("column", ["is_vextrus_staff", "is_active"])
def test_the_app_cannot_make_anyone_staff_nor_revive_a_user(cursor: Any, column: str) -> None:
    user = User.objects.create_user("nusrat@shapla-homes.example", "Nusrat Jahan")
    act(cursor, user=user.pk)

    error = refused(cursor, f"update platform_user set {column} = true where id = %s", [user.pk])

    assert "permission denied for table platform_user" in error


@pytest.mark.django_db
def test_the_app_may_still_sign_a_user_in_and_rename_them(cursor: Any) -> None:
    user = User.objects.create_user("nusrat@shapla-homes.example", "Nusrat Jahan")

    user.set_password("a new long password 1")
    user.save(update_fields=["password"])
    User.objects.filter(id=user.pk).update(name="Nusrat J.", phone="01700000000")
    cursor.execute("update platform_user set last_login = now() where id = %s", [user.pk])

    assert User.objects.get(id=user.pk).name == "Nusrat J."
