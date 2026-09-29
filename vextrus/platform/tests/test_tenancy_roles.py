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
    "platform_jevanswer": {"SELECT", "INSERT"},  # an answer never changes: its key has the model (15)
    "platform_jevoverride": {"SELECT", "INSERT"},  # the override log: append-only (15)
    "procrastinate_events": {"SELECT", "INSERT"},  # a job's history, added to by triggers (09)
    "procrastinate_jobs": {"SELECT", "INSERT", "UPDATE"},  # the worker keeps every job (09)
    "live_model_record": {"SELECT", "INSERT"},  # append-only: a correction is a new Record
    # Append-only but for closing its validity: UPDATE of valid_to_seq alone (live_model 0001).
    "live_model_elementrelation": {"SELECT", "INSERT"},
    # UPDATE only on the columns the app may change (below): never the staff flag.
    "platform_user": {"SELECT", "INSERT", "DELETE"},
    # A Developer's Market is fixed (platform 0007; #75): UPDATE of its name alone (below), and no
    # DELETE, so no delete and re-insert moves it either.
    "platform_developer": {"SELECT", "INSERT"},
    # UPDATE only on what a person may change: never a Project's Market or currency, nor which
    # Project a Site or Building belongs to (projects 0001; ticket 08). And no DELETE (projects 0003;
    # #93): a delete and a re-insert under the same id, of the row or of its Project, whose key
    # cascades to it, would move a Site or a Building to another Project.
    "projects_project": {"SELECT", "INSERT"},
    "projects_site": {"SELECT", "INSERT"},
    "projects_building": {"SELECT", "INSERT"},
    "drawings_discipline": {"SELECT"},  # Library rows: only sync_library writes them, as the owner (14)
    "drawings_readstep": {"SELECT", "INSERT"},  # a read job's steps: insert-only (14)
    "drawings_artefact": {"SELECT", "INSERT"},  # a kept ReadArtefact: an anchor may name it (14)
    # Never deleted; UPDATE only on its reading's columns, never its contents or its set (14).
    "drawings_drawingfile": {"SELECT", "INSERT"},
    "drawings_drawingset": {"SELECT", "INSERT"},  # UPDATE only its name and state (14)
    "drawings_drawingsetstate": {"SELECT", "INSERT"},  # UPDATE only its status and reader (14)
    "drawings_revision": {"SELECT", "INSERT"},  # never updated or deleted (14)
    "drawings_sheet": {"SELECT", "INSERT", "DELETE"},  # UPDATE only what a reading may change (14)
    "drawings_sheetrevision": {"SELECT", "INSERT", "DELETE"},  # never moves set, file or place (14)
    "drawings_view": {"SELECT", "INSERT", "DELETE"},  # UPDATE only a decision (14)
    "drawings_statesheet": {"SELECT", "INSERT", "DELETE"},  # never updated (14)
    "drawings_usedid": {"SELECT", "INSERT"},  # an id once used is never used again (14)
    "takeoff_takeoffstep": {"SELECT"},  # Library rows: only sync_library writes them (19a)
    "takeoff_check": {"SELECT"},  # Library rows: only sync_library writes them (19a)
    # Nothing of Step 1's is deleted: an act is undone by stamping, never by deleting (19a).
    "takeoff_stepprogress": {"SELECT", "INSERT", "UPDATE"},
    "takeoff_recogniserun": {"SELECT", "INSERT", "UPDATE"},
    "takeoff_proposal": {"SELECT", "INSERT", "UPDATE"},
    "takeoff_question": {"SELECT", "INSERT", "UPDATE"},
    "takeoff_coverage": {"SELECT", "INSERT", "UPDATE"},
    "takeoff_coveragestep": {"SELECT", "INSERT", "UPDATE"},
    "takeoff_confirmation": {"SELECT", "INSERT"},  # UPDATE of undone_at alone (19a)
    # Append-only: a drawing list and its entries, a Trace, a Question's link, a Check's run (19a).
    "takeoff_drawingregister": {"SELECT", "INSERT"},
    "takeoff_registerentry": {"SELECT", "INSERT"},
    "takeoff_proposaltrace": {"SELECT", "INSERT"},
    "takeoff_questionlink": {"SELECT", "INSERT"},
    "takeoff_checkrun": {"SELECT", "INSERT"},
    "takeoff_checkfinding": {"SELECT", "INSERT"},
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


FIXED_MARKET_MIGRATIONS = (
    "vextrus.projects.migrations.0002_ended_access_and_invitation_projects",
    "vextrus.platform.migrations.0007_ended_access_and_fixed_market",
)
"""Unapplied in this order (`migrate platform 0006` unapplies projects' 0002 first)."""


def app_acl(cursor: Any, table: str) -> tuple[list[str], list[str]]:
    """vextrus_app's entries in the table's ACL, and the columns carrying an ACL of their own."""
    cursor.execute(
        "select array(select a::text from unnest(relacl) a where a::text like 'vextrus_app=%%') "
        "from pg_class where oid = %s::regclass",
        [f"public.{table}"],
    )
    table_acl = list(cursor.fetchone()[0])
    cursor.execute(
        "select attname from pg_attribute where attrelid = %s::regclass and attacl is not null "
        "order by attname",
        [f"public.{table}"],
    )
    return table_acl, [name for (name,) in cursor.fetchall()]


@pytest.mark.django_db(databases=["owner"])
def test_the_fixed_market_s_reverse_gives_back_0003_s_rights_and_drops_the_functions() -> None:
    """The reverse of platform 0007 (and projects 0002, unapplied before it) run as the owner, as
    `migrate platform 0006` runs it, inside the test's transaction, which rolls it back."""
    with connections["owner"].cursor() as owner:
        assert app_acl(owner, "platform_developer") == (["vextrus_app=ar/vextrus"], ["name"])
        assert invitation_by_token(owner) == (INVITATION_RESULT_0003 + ", market_code text", APP_ONLY)
        for module in FIXED_MARKET_MIGRATIONS:
            for operation in reversed(importlib.import_module(module).Migration.operations):
                for statement in operation.reverse_sql:
                    owner.execute(statement)

        # 0003's grants exactly: every right at table level, no column of its own.
        assert app_acl(owner, "platform_developer") == (["vextrus_app=arwd/vextrus"], [])
        assert privileges(owner, "platform_developer") == {"SELECT", "INSERT", "UPDATE", "DELETE"}
        for signature in ("ended_access()", "ended_access_projects()", "invitation_projects(uuid,text)"):
            owner.execute("select to_regprocedure(%s)", [f"public.{signature}"])
            assert owner.fetchone() == (None,), signature
        assert invitation_by_token(owner) == (INVITATION_RESULT_0003, APP_ONLY)


INVITATION_RESULT_0003 = (
    "TABLE(id uuid, tenant_id uuid, developer_name text, role text, invited_email text, "
    "invited_by_id uuid, outside_org text, starts_at timestamp with time zone, expires_at timestamp "
    "with time zone, invite_expires_at timestamp with time zone, project_ids uuid[]"
)
APP_ONLY = ["vextrus", "vextrus_app"]


def invitation_by_token(cursor: Any) -> tuple[str, list[str]]:
    """invitation_by_token's result (without its closing parenthesis) and who may run it."""
    cursor.execute(
        "select pg_get_function_result(p.oid), array(select coalesce(pg_get_userbyid(a.grantee), "
        "'PUBLIC') from aclexplode(p.proacl) a where a.privilege_type = 'EXECUTE' order by 1) "
        "from pg_proc p where p.oid = 'public.invitation_by_token(uuid, text)'::regprocedure"
    )
    result, executors = cursor.fetchone()
    return result.removesuffix(")"), list(executors)


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


def updatable_columns(cursor: Any, table: str) -> set[str]:
    """The columns vextrus_app may UPDATE, read from the table's own columns (so a column added
    later is judged too)."""
    cursor.execute(
        "select attname from pg_attribute where attrelid = %s::regclass and attnum > 0 "
        "and not attisdropped",
        [f"public.{table}"],
    )
    columns = [name for (name,) in cursor.fetchall()]
    updatable = set()
    for column in columns:
        cursor.execute(
            "select has_column_privilege('vextrus_app', %s, %s, 'UPDATE')", [f"public.{table}", column]
        )
        if cursor.fetchone()[0]:
            updatable.add(column)
    return updatable


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
    with connections["default"].cursor() as cursor:
        assert updatable_columns(cursor, "platform_user") == updatable


DEVELOPER_COLUMNS = (
    "id",
    "tenant_id",
    "name",
    "library_id",
    "home_region",
    "is_library",
    "created_at",
    "market_id",
)
"""platform_developer's columns, in the table's order: one added later must be judged here."""


@pytest.mark.django_db
def test_vextrus_app_may_update_only_a_developer_s_name() -> None:
    """Its Market, Library, home region, whether it is a Library, its tenant and id are the
    owner's (platform 0007); its name stays, since `select … for update` needs one column."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            "select attname from pg_attribute where attrelid = 'public.platform_developer'::regclass "
            "and attnum > 0 and not attisdropped order by attnum"
        )
        assert tuple(name for (name,) in cursor.fetchall()) == DEVELOPER_COLUMNS

        assert updatable_columns(cursor, "platform_developer") == {"name"}
