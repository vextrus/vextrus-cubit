"""Every write NARROWER does not grant is refused, attacked by every write (lessons, session 04:
"Blocked by UPDATE" is not "blocked").

For each table in `test_tenancy_roles.NARROWER`, as vextrus_app: DELETE and MERGE's delete when the
table has no DELETE, UPDATE and MERGE's update of each column the app may not update, and TRUNCATE
(on every table in `public`). Each must fail with SQLSTATE 42501. The statements are made from the
map and the catalogue, so a table added to the map, or a column added to one, is attacked without
anyone writing its attack.
"""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from django.db import DatabaseError, connections, transaction

from vextrus.platform.tests.test_tenancy_roles import NARROWER, public_tables, updatable_columns

PERMISSION_DENIED = "42501"

UPDATABLE = {
    "django_admin_log": set(),
    "django_migrations": set(),
    "drawings_artefact": set(),
    "drawings_discipline": set(),
    "drawings_drawingfile": {
        "bangla_ansi",
        "bangla_lines",
        "cancelled_at",
        "cancelled_by",
        "cancelled_by_name",
        "cancelled_by_vextrus",
        "cross_check",
        "discipline_id",
        "discipline_source",
        "empty_layouts",
        "finding",
        "font_report",
        "held_answer",
        "progress_at",
        "read_job_id",
        "read_status",
        "read_step",
        "read_tries",
        "revision_id",
        "sheets_done",
        "sheets_refused",
        "sheets_started_at",
        "sheets_total",
        "unmatched_pages",
        "upload_report",
    },
    "drawings_drawingset": {"current_state_id", "name"},
    "drawings_drawingsetstate": {"reader", "reader_version", "status"},
    "drawings_readstep": set(),
    "drawings_revision": set(),
    "drawings_sheet": {"consultant_office", "discipline_id", "number", "storeys_as_stated", "title"},
    "drawings_sheetrevision": {
        "anchors",
        "confirmation_id",
        "confirmed_kind",
        "content_hash",
        "decided_at",
        "decided_by",
        "decision",
        "excluded_reason",
        "excluded_text",
        "issue_date",
        "kind",
        "location",
        "ordinal",
        "plot_file_id",
        "plot_none_reason",
        "plot_page",
        "plot_residual",
        "plot_transform",
        "proposed_exclusion",
        "proposed_exclusion_text",
        "reader_version",
        "render_f1",
        "render_file_id",
        "render_key",
        "revision_id",
        "revision_mark",
        "sheet_id",
        "sheet_key",
        "source_sha256",
        "sources",
        "storeys_as_stated",
        "title",
        "views_refused",
    },
    "drawings_statesheet": set(),
    "drawings_usedid": set(),
    "drawings_view": {
        "confirmation_id",
        "confirmed_kind",
        "decided_at",
        "decided_by",
        "decision",
        "excluded_reason",
        "excluded_text",
    },
    "live_model_elementrelation": {"valid_to_seq"},
    # M1's spine (live_model 0002): closing a validity is the only change.
    "live_model_modelversion": set(),
    "live_model_elementstate": {"valid_to_seq"},
    "live_model_elementtrace": {"valid_to_seq"},
    "live_model_viewplacement": {"valid_to_seq"},
    "live_model_viewplacementstorey": set(),
    "takeoff_confirmation": {"undone_at"},  # an act is undone by stamping it (19a)
    "measurement_ruleset": set(),
    "measurement_rulesetversion": set(),
    "measurement_measurementrule": set(),
    "measurement_boqitem": set(),
    "measurement_boqitembillingunit": set(),
    "measurement_rebarratio": set(),
    "takeoff_takeoffstep": set(),
    "takeoff_check": set(),
    "takeoff_drawingregister": set(),
    "takeoff_registerentry": set(),
    "takeoff_proposaltrace": set(),
    "takeoff_questionlink": set(),
    "takeoff_checkrun": set(),
    "takeoff_checkfinding": set(),
    "live_model_record": set(),
    "platform_developer": {"name"},
    "platform_domainevent": set(),
    "platform_jevanswer": set(),
    "platform_jevoverride": set(),
    "platform_market": set(),
    "platform_storedfile": set(),
    "platform_user": {"last_login", "name", "password", "phone"},
    "procrastinate_events": set(),
    "projects_building": {"code", "name", "ordinal"},
    "projects_project": {"address", "code", "code_key", "name", "unit_system"},
    "projects_site": {"name"},
}
"""The columns the app may UPDATE on each NARROWER table without UPDATE on the table (the reasons
are NARROWER's). A column added later is attacked unless it is named here."""


def columns(cursor: Any, table: str) -> list[str]:
    cursor.execute(
        "select attname from pg_attribute where attrelid = %s::regclass and attnum > 0"
        " and not attisdropped order by attnum",
        [f"public.{table}"],
    )
    return [name for (name,) in cursor.fetchall()]


def attacks(cursor: Any, table: str, granted: set[str], updatable: set[str]) -> dict[str, str]:
    """Every write `granted` (a NARROWER entry) and `updatable` leave out, by name."""
    made = {"truncate": f"truncate {table}"}
    if "DELETE" not in granted:
        made["delete"] = f"delete from {table} where false"
        made["merge, delete when matched"] = (
            f"merge into {table} t using (select 1 as one) s on false when matched then delete"
        )
    if "UPDATE" not in granted:
        for column in columns(cursor, table):
            if column not in updatable:
                made[f"update {column}"] = f'update {table} set "{column}" = default where false'
                made[f"merge, update {column} when matched"] = (
                    f"merge into {table} t using (select 1 as one) s on false"
                    f' when matched then update set "{column}" = default'
                )
    return made


def refusal(cursor: Any, sql: str) -> tuple[str | None, str]:
    """The SQLSTATE and first line a statement fails with, inside its own savepoint; (None, "")
    if it runs."""
    try:
        with transaction.atomic(using=cursor.db.alias):
            cursor.execute(sql)
    except DatabaseError as error:
        return getattr(error.__cause__, "sqlstate", None), str(error).splitlines()[0]
    return None, ""


def let_through(cursor: Any, table: str, granted: set[str], updatable: set[str]) -> list[str]:
    """Each attack on `table` not refused as permission denied, with what it did instead."""
    wrong = []
    for name, sql in attacks(cursor, table, granted, updatable).items():
        state, message = refusal(cursor, sql)
        if state != PERMISSION_DENIED or message != f"permission denied for table {table}":
            wrong.append(f"{table}: {name}: {state or 'ran'} {message}".rstrip())
    return wrong


@pytest.fixture
def cursor() -> Iterator[Any]:
    """The app's cursor, acting in a tenant of no one's, so no policy fails to read its settings."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            "select set_config('app.tenant_id', %s, true), set_config('app.user_id', '', true),"
            " set_config('app.library_id', '', true)",
            [str(uuid.uuid4())],
        )
        yield cursor


@pytest.mark.django_db
def test_the_columns_named_updatable_are_the_catalogue_s() -> None:
    with connections["default"].cursor() as cursor:
        found = {
            table: updatable_columns(cursor, table)
            for table, granted in NARROWER.items()
            if "UPDATE" not in granted
        }

    assert found == UPDATABLE


@pytest.mark.django_db
@pytest.mark.parametrize("table", sorted(NARROWER))
def test_every_write_narrower_leaves_out_is_refused(cursor: Any, table: str) -> None:
    assert let_through(cursor, table, NARROWER[table], UPDATABLE.get(table, set())) == []


@pytest.mark.django_db
def test_truncate_is_refused_on_every_table(cursor: Any) -> None:
    wrong = [
        problem
        for table in public_tables(cursor)
        for problem in let_through(cursor, table, {"SELECT", "INSERT", "UPDATE", "DELETE"}, set())
    ]

    assert wrong == []


@pytest.fixture
def probe() -> Iterator[str]:
    """A table the owner makes (committed, so the app's connection sees it; dropped after), with the
    default privileges a later ticket's table would get."""
    with connections["owner"].cursor() as owner:
        owner.execute("create table probe_wall (id uuid primary key, name text, kept text)")
    try:
        yield "probe_wall"
    finally:
        with connections["owner"].cursor() as owner:
            owner.execute("drop table probe_wall")


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_the_check_finds_a_write_the_map_says_is_refused(probe: str) -> None:
    """Judged as if NARROWER gave the probe SELECT and INSERT and the UPDATE of `name` alone: its
    DELETE and its other columns' UPDATE run where they must not, and TRUNCATE stays refused."""
    with transaction.atomic(), connections["default"].cursor() as cursor:
        wrong = let_through(cursor, probe, {"SELECT", "INSERT"}, {"name"})

    assert wrong == [
        f"{probe}: {attack}: ran"
        for attack in (
            "delete",
            "merge, delete when matched",
            "update id",
            "merge, update id when matched",
            "update kept",
            "merge, update kept when matched",
        )
    ]
