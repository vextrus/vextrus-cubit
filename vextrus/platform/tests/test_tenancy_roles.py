"""The app's role and its grants, and the startup check that refuses any other role
(docs/data-model.md §2, Tenancy; the M0 plan, 02)."""

import importlib
import sys
from typing import Any

import pytest
from django.db import connections

from vextrus.platform import startup
from vextrus.platform.startup import RoleFacts, StartupRefused

GOOD = RoleFacts("vextrus_app", "vextrus_app", False, False, (), ())


@pytest.mark.django_db
def test_vextrus_app_is_no_superuser_lacks_bypassrls_and_owns_no_table() -> None:
    role = startup.facts("default")

    assert role == GOOD


@pytest.mark.django_db
def test_a_session_s_temporary_table_is_not_a_table_the_app_owns() -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute("create temporary table scratch (n int)")

    assert startup.facts("default").tables_owned == ()


@pytest.mark.django_db
def test_the_startup_check_lets_vextrus_app_start() -> None:
    startup.check("default")


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_startup_check_refuses_the_owner() -> None:
    with pytest.raises(StartupRefused, match="connected as vextrus, not vextrus_app") as refused:
        startup.check("owner")

    assert "vextrus owns" in str(refused.value)


@pytest.mark.parametrize(
    ("role", "problem"),
    [
        (
            RoleFacts("postgres", "postgres", True, True, (), ()),
            "connected as postgres, not vextrus_app",
        ),
        (
            RoleFacts("vextrus_app", "vextrus", False, False, (), ()),
            "signed in as vextrus, then switched to vextrus_app",
        ),
        (RoleFacts("vextrus_app", "vextrus_app", True, False, (), ()), "vextrus_app is a superuser"),
        (
            RoleFacts("vextrus_app", "vextrus_app", False, True, (), ()),
            "vextrus_app has BYPASSRLS",
        ),
        (
            RoleFacts("vextrus_app", "vextrus_app", False, False, ("public.platform_user",), ()),
            "vextrus_app owns 1 table(s): public.platform_user…",
        ),
        (
            RoleFacts("vextrus_app", "vextrus_app", False, False, (), ("vextrus",)),
            "vextrus_app is a member of vextrus",
        ),
    ],
)
def test_the_startup_check_refuses_any_role_row_level_security_would_not_bind(
    role: RoleFacts, problem: str
) -> None:
    assert problem in startup.problems(role, "vextrus_app")
    assert startup.problems(GOOD, "vextrus_app") == []


def test_the_web_process_runs_the_startup_check(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(using: str = "default") -> None:
        raise StartupRefused("refused")

    monkeypatch.setattr(startup, "check", refuse)
    monkeypatch.delitem(sys.modules, "vextrus.wsgi", raising=False)

    with pytest.raises(StartupRefused):
        importlib.import_module("vextrus.wsgi")
    monkeypatch.delitem(sys.modules, "vextrus.wsgi", raising=False)


def privileges(cursor: Any, table: str) -> set[str]:
    held = set()
    for kind in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"):
        cursor.execute("select has_table_privilege('vextrus_app', %s, %s)", [f"public.{table}", kind])
        if cursor.fetchone()[0]:
            held.add(kind)
    return held


def public_tables(cursor: Any) -> list[str]:
    cursor.execute(
        "select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace "
        "and c.relkind in ('r', 'p') order by 1"
    )
    return [name for (name,) in cursor.fetchall()]


@pytest.mark.django_db
def test_truncate_is_granted_to_vextrus_app_on_no_table() -> None:
    with connections["default"].cursor() as cursor:
        truncatable = [t for t in public_tables(cursor) if "TRUNCATE" in privileges(cursor, t)]

    assert truncatable == []


# Tables whose rights are narrower than SELECT, INSERT, UPDATE and DELETE, and why.
NARROWER = {
    "django_admin_log": set(),  # the admin's LogEntry writes are switched off
    "django_migrations": {"SELECT"},  # only the owner migrates
    "platform_market": {"SELECT"},  # Markets are the owner's data
    "platform_domainevent": {"SELECT", "INSERT"},  # append-only
    "platform_storedfile": {"SELECT", "INSERT"},  # a key names one content for good (09)
    "procrastinate_events": {"SELECT", "INSERT"},  # a job's history, added to by triggers (09)
    "procrastinate_jobs": {"SELECT", "INSERT", "UPDATE"},  # the worker keeps every job (09)
    "live_model_record": {"SELECT", "INSERT"},  # append-only: a correction is a new Record
    # Append-only but for closing its validity: UPDATE of valid_to_seq alone (live_model 0001).
    "live_model_elementrelation": {"SELECT", "INSERT"},
    # UPDATE only on the columns the app may change (below): never the staff flag.
    "platform_user": {"SELECT", "INSERT", "DELETE"},
    # UPDATE only on what a person may change: never a Project's Market or currency, nor which
    # Project a Site or Building belongs to (projects 0001; ticket 08).
    "projects_project": {"SELECT", "INSERT", "DELETE"},
    "projects_site": {"SELECT", "INSERT", "DELETE"},
    "projects_building": {"SELECT", "INSERT", "DELETE"},
}


@pytest.mark.django_db
def test_vextrus_app_may_read_and_write_every_other_table_and_nothing_more() -> None:
    with connections["default"].cursor() as cursor:
        found = {table: privileges(cursor, table) for table in public_tables(cursor)}

    expected = {table: NARROWER.get(table, {"SELECT", "INSERT", "UPDATE", "DELETE"}) for table in found}
    assert found == expected


@pytest.mark.django_db(databases=["owner"])
def test_a_table_the_owner_makes_later_gets_the_app_s_rights_but_never_truncate() -> None:
    with connections["owner"].cursor() as cursor:
        cursor.execute("create table later_sample (id uuid primary key, tenant_id uuid not null)")

        assert privileges(cursor, "later_sample") == {"SELECT", "INSERT", "UPDATE", "DELETE"}


USER_COLUMNS = (
    "id",
    "password",
    "last_login",
    "email",
    "name",
    "phone",
    "is_vextrus_staff",
    "is_active",
)


@pytest.mark.django_db
def test_vextrus_app_may_update_only_a_user_s_name_phone_password_and_last_sign_in() -> None:
    with connections["default"].cursor() as cursor:
        updatable = set()
        for column in USER_COLUMNS:
            cursor.execute(
                "select has_column_privilege('vextrus_app', 'public.platform_user', %s, 'UPDATE')",
                [column],
            )
            if cursor.fetchone()[0]:
                updatable.add(column)

    assert updatable == {"name", "phone", "password", "last_login"}
