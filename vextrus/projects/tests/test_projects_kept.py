"""A Building keeps its Project, and a Site too (#93; docs/data-model.md §2 and §3.1).

Everything that names a Building by id (a DrawingFile's `building_id`, a Live Model Element's) belongs
to whichever Project holds that id. So the id must never come free for another Project: the app may
insert a Project, its Site and its Buildings, and change what a person may change, but never delete
one (projects 0003), since a delete and a re-insert under the same id would move it, whichever row
the delete names (the Building's, or its Project's, whose key cascades to it). Every write is
attacked here as vextrus_app, in the Developer's own tenant, and each refusal is asserted by its
SQLSTATE and its message; only the owner deletes, and its delete still cascades.
"""

import importlib
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, fields
from typing import Any

import psycopg
import pytest
from django.db import DatabaseError, connections, transaction

from vextrus.platform.services import tenancy
from vextrus.projects import services
from vextrus.projects.models import Building, Project, Site

PERMISSION_DENIED = "42501"
TABLES = ("projects_project", "projects_site", "projects_building")


def act(cursor: Any, tenant: uuid.UUID) -> None:
    cursor.execute(
        "select set_config('app.tenant_id', %s, true), set_config('app.user_id', '', true), "
        "set_config('app.library_id', '', true)",
        [str(tenant)],
    )


def rows(cursor: Any, sql: str, params: Any = None) -> list[tuple[Any, ...]]:
    cursor.execute(sql, params)
    return list(cursor.fetchall())


def failure(cursor: Any, sql: str, params: Any = None) -> tuple[str | None, str]:
    """The SQLSTATE and message a statement fails with, inside its own savepoint so the test goes
    on."""
    with pytest.raises(DatabaseError) as raised, transaction.atomic(using=cursor.db.alias):
        cursor.execute(sql, params)
    return getattr(raised.value.__cause__, "sqlstate", None), str(raised.value)


@dataclass(frozen=True)
class Made:
    """One Developer's two Projects, as `projects.services.create` makes them."""

    tenant: uuid.UUID
    project: uuid.UUID
    """KR-01, whose Site and Building the attacks try to move."""
    other: uuid.UUID
    """BP-02, where they try to move them."""
    site: uuid.UUID
    building: uuid.UUID
    other_site: uuid.UUID
    other_building: uuid.UUID

    def params(self) -> dict[str, uuid.UUID]:
        return {field.name: getattr(self, field.name) for field in fields(self)}


def make_two_projects(tenant: uuid.UUID) -> Made:
    with tenancy.acting_in(tenant):
        project = services.create(code="KR-01", name="Kadam Residence").id
        other = services.create(code="BP-02", name="Bashundhara Point").id
        sites = {site.project_id: site.id for site in Site.objects.all()}
        buildings = {building.project_id: building.id for building in Building.objects.all()}
    return Made(
        tenant, project, other, sites[project], buildings[project], sites[other], buildings[other]
    )


@pytest.fixture
def made(make_developer: Callable[..., uuid.UUID]) -> Made:
    return make_two_projects(make_developer("Shapla Homes Ltd"))


@pytest.fixture
def cursor(made: Made) -> Iterator[Any]:
    """The app's cursor, acting in the Developer."""
    with connections["default"].cursor() as cursor:
        act(cursor, made.tenant)
        yield cursor


PLACED = """
    select 'project', id, id, code, name, 0 from projects_project where tenant_id = %(tenant)s
    union all select 'site', id, project_id, '', name, 0 from projects_site
     where tenant_id = %(tenant)s
    union all select 'building', id, project_id, code, name, ordinal from projects_building
     where tenant_id = %(tenant)s
    order by 1, 2"""
"""Every Project, Site and Building of the Developer, each with its Project."""


def attempt(cursor: Any, made: Made, sql: str) -> tuple[str | None, str]:
    """A write's SQLSTATE and message, and proof it changed nothing."""
    before = rows(cursor, PLACED, made.params())
    assert len(before) == 6

    state, message = failure(cursor, sql, made.params() if "%(" in sql else None)

    assert rows(cursor, PLACED, made.params()) == before
    return state, message.splitlines()[0]  # without a function's CONTEXT line


BUILDING_ROW = "id, tenant_id, project_id, code, name, ordinal"
SITE_ROW = "id, tenant_id, project_id, name"

# Every write that could put KR-01's Building under BP-02, and the table whose right refuses it. ------
BUILDING_MOVES = {
    "delete": ("delete from projects_building where id = %(building)s", "projects_building"),
    "delete, then insert again under another Project": (
        f"""delete from projects_building where id = %(building)s;
            insert into projects_building ({BUILDING_ROW})
            values (%(building)s, %(tenant)s, %(other)s, 'B2', 'Building 1', 2)""",
        "projects_building",
    ),
    "a writable CTE deleting and inserting again": (
        f"""with gone as (delete from projects_building where id = %(building)s returning *)
            insert into projects_building ({BUILDING_ROW})
            select id, tenant_id, %(other)s, 'B2', name, 2 from gone""",
        "projects_building",
    ),
    "update project_id": (
        "update projects_building set project_id = %(other)s where id = %(building)s",
        "projects_building",
    ),
    "update a person's columns and project_id at once": (
        (
            "update projects_building set code = 'B2', ordinal = 2, project_id = %(other)s"
            " where id = %(building)s"
        ),
        "projects_building",
    ),
    "update tenant_id": (
        "update projects_building set tenant_id = %(other)s where id = %(building)s",
        "projects_building",
    ),
    "update id": (
        "update projects_building set id = %(other)s where id = %(building)s",
        "projects_building",
    ),
    "insert on conflict update": (
        f"""insert into projects_building ({BUILDING_ROW})
            values (%(building)s, %(tenant)s, %(other)s, 'B2', 'Building 1', 2)
            on conflict (id) do update set project_id = excluded.project_id""",
        "projects_building",
    ),
    "merge, update when matched": (
        """merge into projects_building b using (select %(building)s::uuid as id) s on b.id = s.id
           when matched then update set project_id = %(other)s""",
        "projects_building",
    ),
    "merge, delete when matched": (
        """merge into projects_building b using (select %(building)s::uuid as id) s on b.id = s.id
           when matched then delete""",
        "projects_building",
    ),
    "merge, delete when not matched by source and insert when not matched": (
        f"""merge into projects_building b
            using (select %(building)s::uuid as id, %(other)s::uuid as project_id) s
               on b.id = s.id and b.project_id = s.project_id
            when not matched by source and b.id = %(building)s then delete
            when not matched then insert ({BUILDING_ROW})
                 values (s.id, %(tenant)s, s.project_id, 'B2', 'Building 1', 2)""",
        "projects_building",
    ),
    "truncate": ("truncate projects_building", "projects_building"),
    "a temporary view's delete": (
        """create temporary view buildings as select * from projects_building;
           delete from buildings where id = %(building)s""",
        "projects_building",
    ),
    "a security definer function of the app's": (
        """create function pg_temp.retire(uuid) returns void language sql security definer
           as 'delete from public.projects_building where id = $1';
           select pg_temp.retire(%(building)s)""",
        "projects_building",
    ),
    # Its Project's delete cascades to it as the tables' owner, which would free its id.
    "delete its Project, then insert it under another": (
        f"""delete from projects_project where id = %(project)s;
            insert into projects_building ({BUILDING_ROW})
            values (%(building)s, %(tenant)s, %(other)s, 'B2', 'Building 1', 2)""",
        "projects_project",
    ),
    "a writable CTE deleting its Project": (
        f"""with gone as (delete from projects_project where id = %(project)s returning id)
            insert into projects_building ({BUILDING_ROW})
            select %(building)s, %(tenant)s, %(other)s, 'B2', 'Building 1', 2 from gone""",
        "projects_project",
    ),
    "merge, delete its Project when matched": (
        """merge into projects_project p using (select %(project)s::uuid as id) s on p.id = s.id
           when matched then delete""",
        "projects_project",
    ),
    "truncate its Project, cascading": ("truncate projects_project cascade", "projects_project"),
}


@pytest.mark.django_db
@pytest.mark.parametrize("move", BUILDING_MOVES)
def test_the_app_cannot_move_a_building_to_another_project_by_any_write(
    made: Made, cursor: Any, move: str
) -> None:
    sql, table = BUILDING_MOVES[move]

    state, message = attempt(cursor, made, sql)

    assert state == PERMISSION_DENIED, message
    assert message == f"permission denied for table {table}"


# Every write that could put KR-01's Site under BP-02 (which holds one Site: its own goes too). -------
SITE_MOVES = {
    "delete": ("delete from projects_site where id = %(site)s", "projects_site"),
    "delete both Sites, then insert this one under the other Project": (
        f"""delete from projects_site where id in (%(site)s, %(other_site)s);
            insert into projects_site ({SITE_ROW}) values (%(site)s, %(tenant)s, %(other)s, '')""",
        "projects_site",
    ),
    "a writable CTE deleting both and inserting again": (
        f"""with gone as (delete from projects_site where id in (%(site)s, %(other_site)s)
                          returning *)
            insert into projects_site ({SITE_ROW})
            select id, tenant_id, %(other)s, name from gone where id = %(site)s""",
        "projects_site",
    ),
    "update project_id": (
        "update projects_site set project_id = %(other)s where id = %(site)s",
        "projects_site",
    ),
    "update tenant_id": (
        "update projects_site set tenant_id = %(other)s where id = %(site)s",
        "projects_site",
    ),
    "insert on conflict update": (
        f"""insert into projects_site ({SITE_ROW}) values (%(site)s, %(tenant)s, %(other)s, '')
            on conflict (id) do update set project_id = excluded.project_id""",
        "projects_site",
    ),
    "merge, update when matched": (
        """merge into projects_site t using (select %(site)s::uuid as id) s on t.id = s.id
           when matched then update set project_id = %(other)s""",
        "projects_site",
    ),
    "merge, delete when matched": (
        """merge into projects_site t using (select %(site)s::uuid as id) s on t.id = s.id
           when matched then delete""",
        "projects_site",
    ),
    "merge, delete when not matched by source": (
        """merge into projects_site t using (select %(other_site)s::uuid as id) s on t.id = s.id
           when not matched by source then delete""",
        "projects_site",
    ),
    "truncate": ("truncate projects_site", "projects_site"),
    "delete its Project, then insert it under another": (
        f"""delete from projects_project where id = %(project)s;
            delete from projects_site where id = %(other_site)s;
            insert into projects_site ({SITE_ROW}) values (%(site)s, %(tenant)s, %(other)s, '')""",
        "projects_project",
    ),
}


@pytest.mark.django_db
@pytest.mark.parametrize("move", SITE_MOVES)
def test_the_app_cannot_move_a_site_to_another_project_by_any_write(
    made: Made, cursor: Any, move: str
) -> None:
    sql, table = SITE_MOVES[move]

    state, message = attempt(cursor, made, sql)

    assert state == PERMISSION_DENIED, message
    assert message == f"permission denied for table {table}"


@pytest.mark.django_db
def test_copy_cannot_write_a_building_at_all(made: Made, cursor: Any) -> None:
    # COPY FROM needs only INSERT, and is refused outright under row-level security.
    before = rows(cursor, PLACED, made.params())

    with (
        pytest.raises(psycopg.Error) as raised,
        transaction.atomic(),
        cursor.copy(f"copy projects_building ({BUILDING_ROW}) from stdin") as copy,
    ):
        copy.write_row((made.building, made.tenant, made.other, "B2", "Building 1", 2))

    assert raised.value.sqlstate == "0A000"
    assert "COPY FROM not supported with row-level security" in str(raised.value)
    assert rows(cursor, PLACED, made.params()) == before


# What only the tables' owner may do: change a table, its triggers, rules and policies. ---------------
OWNERS_ONLY = {
    "disable its triggers": "alter table {table} disable trigger all",
    "drop its key": "alter table {table} drop constraint {table}_pkey",
    "disable row-level security": "alter table {table} disable row level security",
    "add a rule": "create rule rewrite as on insert to {table} do instead nothing",
    "add a policy": "create policy anything on {table} using (true)",
    "widen its policy": "alter policy own_tenant on {table} using (true)",
    "drop its policy": "drop policy own_tenant on {table}",
    "drop it": "drop table {table} cascade",
}
"""Each refused as "must be owner of table …", but a policy's drop, "… of relation …"."""


@pytest.mark.django_db
@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("change", OWNERS_ONLY)
def test_the_app_cannot_change_the_tables_themselves(
    made: Made, cursor: Any, change: str, table: str
) -> None:
    state, message = attempt(cursor, made, OWNERS_ONLY[change].format(table=table))

    assert state == PERMISSION_DENIED, message
    noun = "relation" if change == "drop its policy" else "table"
    assert message == f"must be owner of {noun} {table}"


@pytest.mark.django_db
@pytest.mark.parametrize("table", TABLES)
def test_the_app_cannot_add_a_trigger(made: Made, cursor: Any, table: str) -> None:
    state, message = attempt(
        cursor,
        made,
        f"create trigger rewrite before insert on {table} for each row"
        " execute function suppress_redundant_updates_trigger()",
    )

    assert state == PERMISSION_DENIED, message
    assert message == f"permission denied for table {table}"


SESSION_WALLS = {
    # Replica mode would skip every trigger, the keys' own among them.
    "set session_replication_role = replica": (
        'permission denied to set parameter "session_replication_role"'
    ),
    "set role vextrus": 'permission denied to set role "vextrus"',
    "create function public.rewrite() returns int language sql as 'select 1'": (
        "permission denied for schema public"
    ),
}


@pytest.mark.django_db
@pytest.mark.parametrize("sql", SESSION_WALLS)
def test_the_app_cannot_step_around_its_rights(made: Made, cursor: Any, sql: str) -> None:
    state, message = attempt(cursor, made, sql)

    assert state == PERMISSION_DENIED, message
    assert message == SESSION_WALLS[sql]


@pytest.mark.django_db
@pytest.mark.parametrize("table", TABLES)
def test_the_app_cannot_grant_itself_delete(cursor: Any, table: str) -> None:
    # Not the owner, and holding no grant option: PostgreSQL warns and grants nothing.
    cursor.execute(f"grant delete on {table} to vextrus_app")

    assert rows(cursor, "select has_table_privilege(%s, 'delete')", [table]) == [(False,)]


# What the app still does. ------------------------------------------------------------------------------


@pytest.mark.django_db
def test_the_app_still_makes_a_project_with_its_site_and_building_and_renames_them(
    made: Made, cursor: Any
) -> None:
    assert rows(
        cursor,
        "select project_id, code, name, ordinal from projects_building order by code, project_id",
    ) == sorted(
        [(made.project, "B1", "Building 1", 1), (made.other, "B1", "Building 1", 1)],
        key=lambda row: (row[1], row[0]),
    )
    assert len(rows(cursor, "select id from projects_site")) == 2

    cursor.execute(
        "update projects_building set code = 'T1', name = 'Tower', ordinal = 3 where id = %s",
        [made.building],
    )
    cursor.execute("update projects_site set name = 'Plot 7' where id = %s", [made.site])
    cursor.execute(
        "update projects_project set code = 'KR-02', code_key = 'kr-02', name = 'Renamed' where id = %s",
        [made.project],
    )

    assert rows(
        cursor,
        "select project_id, code, name, ordinal from projects_building where id = %s",
        [made.building],
    ) == [(made.project, "T1", "Tower", 3)]
    assert rows(cursor, "select project_id, name from projects_site where id = %s", [made.site]) == [
        (made.project, "Plot 7")
    ]


@pytest.mark.django_db
def test_an_insert_that_changes_nothing_on_conflict_leaves_the_building_where_it_is(
    made: Made, cursor: Any
) -> None:
    cursor.execute(
        f"insert into projects_building ({BUILDING_ROW})"
        " values (%(building)s, %(tenant)s, %(other)s, 'B2', 'Building 1', 2)"
        " on conflict (id) do nothing",
        made.params(),
    )

    assert cursor.rowcount == 0
    assert rows(cursor, "select project_id from projects_building where id = %s", [made.building]) == [
        (made.project,)
    ]


# Only the owner deletes, and its delete still cascades. ------------------------------------------------


@pytest.fixture
def committed(make_developer: Callable[..., uuid.UUID]) -> Made:
    """Two Projects committed, so the owner's connection sees them (the test flushes after)."""
    return make_two_projects(make_developer("Shapla Homes Ltd"))


def remaining(made: Made) -> list[tuple[str, uuid.UUID, uuid.UUID]]:
    with connections["owner"].cursor() as owner:
        return [(kind, row, project) for kind, row, project, *_ in rows(owner, PLACED, made.params())]


def only_bp_02(made: Made) -> list[tuple[str, uuid.UUID, uuid.UUID]]:
    return sorted(
        [
            ("building", made.other_building, made.other),
            ("project", made.other, made.other),
            ("site", made.other_site, made.other),
        ]
    )


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_the_owner_s_delete_of_a_project_takes_its_site_and_building(committed: Made) -> None:
    with connections["owner"].cursor() as owner:
        owner.execute("delete from projects_project where id = %s", [committed.project])

    assert remaining(committed) == only_bp_02(committed)


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_the_owner_s_delete_through_the_orm_takes_its_site_and_building(committed: Made) -> None:
    deleted = Project.objects.using("owner").filter(id=committed.project).delete()

    assert deleted == (3, {"projects.Site": 1, "projects.Building": 1, "projects.Project": 1})
    assert remaining(committed) == only_bp_02(committed)


@pytest.fixture
def project_delete_granted() -> Iterator[None]:
    """DELETE on projects_project given back for a moment (committed), and on it alone."""
    with connections["owner"].cursor() as owner:
        owner.execute("grant delete on projects_project to vextrus_app")
    try:
        yield
    finally:
        with connections["owner"].cursor() as owner:
            owner.execute("revoke delete on projects_project from vextrus_app")


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
@pytest.mark.usefixtures("project_delete_granted")
def test_with_delete_on_a_project_alone_its_cascade_would_free_its_building_s_id(
    committed: Made,
) -> None:
    """Why 0003 takes DELETE on projects_project too: the keys' cascade runs as the tables' owner,
    so the app, holding no DELETE on projects_building, still removed the Building and could put its
    id under another Project."""
    with transaction.atomic(), connections["default"].cursor() as cursor:
        act(cursor, committed.tenant)
        assert rows(cursor, "select has_table_privilege('projects_building', 'delete')") == [(False,)]

        cursor.execute(
            BUILDING_MOVES["delete its Project, then insert it under another"][0], committed.params()
        )

        assert rows(
            cursor, "select project_id from projects_building where id = %s", [committed.building]
        ) == [(committed.other,)]
        transaction.set_rollback(True)


@pytest.mark.django_db
def test_the_app_s_delete_through_the_orm_is_refused(made: Made) -> None:
    with pytest.raises(DatabaseError) as raised, tenancy.acting_in(made.tenant):
        Project.objects.filter(id=made.project).delete()

    assert getattr(raised.value.__cause__, "sqlstate", None) == PERMISSION_DENIED
    assert "permission denied for table projects_" in str(raised.value)
    with tenancy.acting_in(made.tenant):
        assert Building.objects.filter(id=made.building, project_id=made.project).exists()


# The migration's reverse gives back 0001's rights exactly. ---------------------------------------------

KEPT_MIGRATION = "vextrus.projects.migrations.0003_a_building_keeps_its_project"

UPDATABLE = {
    "projects_project": ["address", "code", "code_key", "name", "unit_system"],
    "projects_site": ["name"],
    "projects_building": ["code", "name", "ordinal"],
}
"""0001's column grants: what a person may change."""


def acl(cursor: Any, table: str) -> tuple[list[str], dict[str, list[str]]]:
    """The table's ACL, and each column's that carries one of its own."""
    cursor.execute("select relacl::text[] from pg_class where oid = %s::regclass", [table])
    (table_acl,) = cursor.fetchone()
    cursor.execute(
        "select attname, attacl::text[] from pg_attribute where attrelid = %s::regclass"
        " and attacl is not null order by attname",
        [table],
    )
    return sorted(table_acl), {name: sorted(column_acl) for name, column_acl in cursor.fetchall()}


def rights(app: str) -> dict[str, tuple[list[str], dict[str, list[str]]]]:
    return {
        table: (
            ["vextrus=arwdDxtm/vextrus", f"vextrus_app={app}/vextrus"],
            {column: ["vextrus_app=w/vextrus"] for column in UPDATABLE[table]},
        )
        for table in TABLES
    }


@pytest.mark.django_db(databases=["owner"])
def test_the_reverse_gives_back_0001_s_rights_exactly_and_the_forward_takes_delete_again() -> None:
    """Run as the owner, as `migrate projects 0002` runs it, inside the test's transaction, which
    rolls it back."""
    operations = importlib.import_module(KEPT_MIGRATION).Migration.operations
    with connections["owner"].cursor() as owner:
        assert {table: acl(owner, table) for table in TABLES} == rights("ar")

        for operation in reversed(operations):
            for statement in operation.reverse_sql:
                owner.execute(statement)
        # 0001's: select, insert and delete on the table, and UPDATE of a person's columns only.
        assert {table: acl(owner, table) for table in TABLES} == rights("ard")

        for operation in operations:
            for statement in operation.sql:
                owner.execute(statement)
        assert {table: acl(owner, table) for table in TABLES} == rights("ar")
