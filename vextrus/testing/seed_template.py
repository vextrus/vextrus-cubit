"""The demo seed's upper layers, made once a session and copied after (S15-T2, #532).

One `seed_demo` sends about 11,000 SQL statements (98 % of them the `drawings` layer's read job), and
every test module that asked for the demo ran it anew, in each xdist worker. Now, in each worker's
database:

1. the first seed makes a *template*: in a thread of its own (its own connections, so its commits are
   its own) the real layers run and commit, the rows the layers above `platform` added are copied into
   the schema `seed_template`, and every row the build made is deleted again;
2. every seed (that one too) then runs `platform` for real, once, and the layers above it are not run:
   the template's rows are copied in with `INSERT ... SELECT`, a few hundred statements, as the app,
   acting as each tenant (and, for a job, its user) through the product's own `tenancy.acting_in`,
   in the seed's own transaction.

The copy is faithful where a replay is not. Every row gets an id of its own (the ledger of used ids
refuses one twice, even after a flush), and every uuid column, and every uuid written inside text or
JSON, is mapped from the template's to this seed's, the ids `platform` made (Developers, users,
Memberships) among them. A job gets the queue's next id and the one column that names it follows; its
events are written by the queue's triggers, as the seed's were. Every time moves by the age of the
template, so a state that depends on "now" (a retry still to come, a read with time left) is what a
fresh seed shows. The stored files are copied to the keys of the new tenant and Projects. `demo` gains
the upper layers' names, as the layers made them.

The template is used only when the layers above `platform` are the product's own (a test that replaces
one runs the real thing), and it sits below `vextrus.seed.platform.run`, which is called once per seed.
"""

import contextvars
import copy
import re
import shutil
import threading
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from importlib import import_module
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings
from django.db import IntegrityError, ProgrammingError, connections, transaction
from django.utils import timezone
from pytest_django.plugin import DjangoDbBlocker

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import tenancy
from vextrus.seed import demo as seed_demo_module
from vextrus.seed.demo import Demo

SCHEMA = "seed_template"
BELOW = "seed_template_before"
"""The ids of every table before the seed, and after `platform`'s layer: the build's yardsticks."""
MIDDLE = "seed_template_middle"
PLATFORM = "platform"
ABOVE = ("projects", "drawings", "takeoff")
PLATFORM_KEYS = ("developer:", "user:", "membership:", "invitation:")
"""The `demo` names whose ids `platform` makes anew each seed."""
JOBS = "procrastinate_jobs"
EVENTS = "procrastinate_events"
LEDGER = "drawings_usedid"
"""The ids ever used: the database's triggers write it as views and the rest are inserted, so the copy
adds what they did not (`on conflict do nothing`), last."""
JOB_COLUMNS = {("drawings_drawingfile", "read_job_id"), (EVENTS, "job_id")}
"""The columns that hold a job's id (not a uuid)."""
APP_ROLE = "vextrus_app"
TEXTUAL = {"text", "character varying", "character"}


type Key = tuple[uuid.UUID | None, uuid.UUID | None]


@dataclass
class Column:
    name: str
    type: str  # `format_type`
    generated: bool
    identity: bool


@dataclass
class Table:
    name: str
    columns: list[Column]
    keys: list[Key]
    """The (tenant, user) each group of this table's rows is written as: the tenant its rows name (None:
    rows with no tenant), and for jobs the user too (the database's wall wants both set)."""


@dataclass
class Template:
    demo: Demo
    made_at: datetime
    tables: list[Table] = field(default_factory=list)
    library: dict[tuple[str, uuid.UUID, str], uuid.UUID] = field(default_factory=dict)
    """The Library rows, by (table, tenant, key): a `flush` writes them again under new ids."""
    library_tables: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    """The keys of the stored files the layers wrote, copied to each seed's own keys."""


_template: Template | None = None
_genuine: dict[str, Any] = {}
_using: set[int] = set()
"""The seeds (by their `demo` dict) that copy the template for the layers above `platform`."""


# --- the build -------------------------------------------------------------------------------------


def _names(cursor: Any) -> list[str]:
    cursor.execute(
        "select c.relname from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attname = 'id'"
        " where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1"
    )
    return [row[0] for row in cursor.fetchall()]


def _library_tables(cursor: Any) -> list[str]:
    """The tables that hold Library rows: a tenant and a key (a row's identity, `platform.library`)."""
    cursor.execute(
        "select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace"
        " and c.relkind = 'r' and not exists (select 1 from (values ('tenant_id'), ('key')) k(name)"
        " where not exists (select 1 from pg_attribute a where a.attrelid = c.oid"
        " and a.attname = k.name and not a.attisdropped)) order by 1"
    )
    return [row[0] for row in cursor.fetchall()]


def _library(cursor: Any, tables: list[str]) -> dict[tuple[str, uuid.UUID, str], uuid.UUID]:
    """Every Library row (a Developer with `is_library` is the tenant), by table, tenant and key."""
    cursor.execute(
        " union all ".join(
            f"select '{table}', tenant_id, key, id from public.{table}"
            " where tenant_id in (select id from public.platform_developer where is_library)"
            for table in tables
        )
    )
    return {(table, tenant, key): row_id for table, tenant, key, row_id in cursor.fetchall()}


def _columns(cursor: Any, table: str) -> list[Column]:
    cursor.execute(
        "select a.attname, format_type(a.atttypid, a.atttypmod),"
        " a.attgenerated <> '', a.attidentity <> ''"
        " from pg_attribute a where a.attrelid = %s::regclass and a.attnum > 0 and not a.attisdropped"
        " order by a.attnum",
        [f"{SCHEMA}.{table}"],
    )
    return [Column(*row) for row in cursor.fetchall()]


def _build() -> Template:
    """Runs in its own thread: the real layers, committed; the template copied; the rows gone again."""
    owner = connections[OWNER_ALIAS]
    with owner.cursor() as cursor:
        names = _names(cursor)
        for schema in (SCHEMA, BELOW, MIDDLE):
            cursor.execute(f"drop schema if exists {schema} cascade")
            cursor.execute(f"create schema {schema}")
        for table in names:
            cursor.execute(f"create table {BELOW}.{table} as select id from public.{table}")
    template = Template(demo={}, made_at=timezone.now())
    with owner.cursor() as cursor:
        template.library_tables = _library_tables(cursor)
        template.library = _library(cursor, template.library_tables)
    try:
        _make(template, names)
    finally:  # a build that failed leaves no row behind either
        _delete_the_build(owner, names)
        with owner.cursor() as cursor:
            for schema in (BELOW, MIDDLE):
                cursor.execute(f"drop schema if exists {schema} cascade")
    return template


def _make(template: Template, names: list[str]) -> None:
    """The real layers, committed, and the rows they added copied into the template's schema."""
    owner = connections[OWNER_ALIAS]
    demo = template.demo
    with transaction.atomic():
        _genuine[PLATFORM](demo)
    with owner.cursor() as cursor:
        for table in names:
            cursor.execute(f"create table {MIDDLE}.{table} as select id from public.{table}")
    with transaction.atomic():
        for name in ABOVE:
            _genuine[name](demo)
    template.made_at = timezone.now()
    with owner.cursor() as cursor:
        for table in names:
            cursor.execute(
                f"create table {SCHEMA}.{table} as select * from public.{table}"
                f" where id not in (select id from {MIDDLE}.{table})"
            )
            cursor.execute(f"select count(*) from {SCHEMA}.{table}")
            if cursor.fetchone()[0] == 0:
                cursor.execute(f"drop table {SCHEMA}.{table}")
                continue
            columns = _columns(cursor, table)
            keys: list[Key] = [(None, None)]
            if any(column.name == "tenant_id" for column in columns):
                cursor.execute(f"select distinct tenant_id from {SCHEMA}.{table}")
                keys = [(row[0], None) for row in cursor.fetchall()]
            elif (
                table == JOBS
            ):  # a job's tenant and user are the ones its args name (the database's wall)
                cursor.execute(
                    "select distinct (args->>'tenant_id')::uuid, (args->>'user_id')::uuid"
                    f" from {SCHEMA}.{table}"
                )
                keys = [(row[0], row[1]) for row in cursor.fetchall()]
            template.tables.append(Table(table, columns, keys))
        cursor.execute(f"select key from {SCHEMA}.platform_storedfile")
        template.files = [row[0] for row in cursor.fetchall()]
        cursor.execute(
            "select conrelid::regclass::text, confrelid::regclass::text from pg_constraint"
            " where contype = 'f' and connamespace = 'public'::regnamespace"
        )
        template.tables = _parents_first(template.tables, cursor.fetchall())
        cursor.execute(f"grant usage on schema {SCHEMA} to {APP_ROLE}")
        cursor.execute(f"grant select on all tables in schema {SCHEMA} to {APP_ROLE}")


def _parents_first(tables: list[Table], references: list[tuple[str, str]]) -> list[Table]:
    """The tables, each after the tables its foreign keys name (the database's own triggers read the
    parents), the queue's jobs first; a cycle is broken by name."""
    by_name = {table.name: table for table in tables}
    parents = {
        name: {p for c, p in references if c == name and p in by_name and p != name} for name in by_name
    }
    ordered: list[Table] = []
    while parents:
        ready = sorted(name for name, needs in parents.items() if not needs) or [
            min(parents, key=lambda name: (len(parents[name]), name))
        ]
        name = next((n for n in ready if n == JOBS), ready[0])
        ordered.append(by_name[name])
        del parents[name]
        for needs in parents.values():
            needs.discard(name)
    return ordered


def _delete_the_build(owner: Any, names: list[str]) -> None:
    """Every row the build made, the rows `platform` and the layers above it added. A foreign key may
    restrict a delete, so each table is tried (in its own savepoint) until none is left."""
    pending = list(names)
    with transaction.atomic(using=OWNER_ALIAS), owner.cursor() as cursor:
        while pending:
            failed = []
            for table in pending:
                try:
                    with transaction.atomic(using=OWNER_ALIAS):
                        cursor.execute(
                            f"delete from public.{table}"
                            f" where id not in (select id from {BELOW}.{table})"
                        )
                except IntegrityError:
                    failed.append(table)
            if len(failed) == len(pending):
                raise RuntimeError(f"the seed template's build could not be deleted from {failed}")
            pending = failed


def _in_a_thread() -> Template:
    outcome: dict[str, Any] = {}

    def work() -> None:
        try:
            outcome["template"] = _build()
        except BaseException as error:
            outcome["error"] = error
        finally:
            connections.close_all()

    thread = threading.Thread(target=contextvars.copy_context().run, args=(work,))
    thread.start()
    thread.join()
    if "error" in outcome:
        raise outcome["error"]
    template: Template = outcome["template"]
    return template


# --- the copy --------------------------------------------------------------------------------------

UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
REMAP = f"""
create or replace function pg_temp.seed_remap(s text) returns text language plpgsql as $$
declare found text;
begin
  if s is null then return null; end if;
  for found in select distinct m[1] from regexp_matches(s, '({UUID})', 'g') as m loop
    s := replace(s, found, coalesce((select new::text from seed_map where old = found::uuid), found));
  end loop;
  return s;
end $$
"""


def _expression(table: str, column: Column) -> str:
    name, kind = f't."{column.name}"', column.type
    if (table, column.name) in JOB_COLUMNS:
        return f"coalesce((select new from seed_jobs j where j.old = {name}), {name})"
    if kind == "uuid":
        return f"coalesce((select new from seed_map m where m.old = {name}), {name})"
    if kind.startswith("timestamp"):
        return f"{name} + %(shift)s::interval"
    if kind in ("jsonb", "json") or kind.endswith("[]"):
        return f"pg_temp.seed_remap({name}::text)::{kind}"
    if kind in TEXTUAL or kind.startswith(("character varying", "character(")):
        return f"pg_temp.seed_remap({name})"
    return name


def _value(table: str, column: Column) -> str:
    if table == JOBS:
        # A job is deferred as waiting, no try made, nothing scheduled (the database's wall); `_retry`
        # then sets both, as the seed does, and the queue's own triggers write the job's events.
        special = {"id": "j.new", "attempts": "0", "scheduled_at": "null"}
        if column.name in special:
            return special[column.name]
    return _expression(table, column)


def _retry(where: str) -> str:
    """The jobs just copied, tried and scheduled as the template's were."""
    return (
        f"update public.{JOBS} q set attempts = t.attempts,"
        " scheduled_at = t.scheduled_at + %(shift)s::interval"
        f" from {SCHEMA}.{JOBS} t join seed_jobs j on j.old = t.id where q.id = j.new and {where}"
    )


def _insert(table: Table, where: str) -> str:
    columns = [c for c in table.columns if not c.generated and not (c.identity and table.name != JOBS)]
    names = ", ".join(f'"{c.name}"' for c in columns)
    values = ", ".join(_value(table.name, c) for c in columns)
    joined = f"{SCHEMA}.{table.name} t"
    if table.name == JOBS:
        joined += " join seed_jobs j on j.old = t.id"
    overriding = " overriding system value" if table.name == JOBS else ""
    conflict = " on conflict do nothing" if table.name == LEDGER else ""
    return (
        f"insert into public.{table.name} ({names}){overriding}"
        f" select {values} from {joined} where {where}{conflict}"
    )


def _own(table: Table) -> str:
    """The expression that names a row's tenant: a job's is in its args (the database's tenant wall)."""
    return "(t.args->>'tenant_id')::uuid" if table.name == JOBS else "t.tenant_id"


def _where(table: Table, key: Key) -> str:
    tenant, user = key
    if tenant is None:
        return "true" if table.keys == [(None, None)] else f"{_own(table)} is null"
    if table.name == JOBS:
        mine = "null::uuid" if user is None else f"'{user}'::uuid"
        return f"{_own(table)} = '{tenant}' and (t.args->>'user_id')::uuid is not distinct from {mine}"
    return f"{_own(table)} = '{tenant}'"


def _copy(cursor: Any, table: Table, key: Key, shift: timedelta) -> None:
    """One group of a table's rows, written while acting as its tenant (`_restore`)."""
    cursor.execute(_insert(table, _where(table, key)), {"shift": shift})
    if table.name == JOBS:
        cursor.execute(_retry(_where(table, key)), {"shift": shift})


def _uuid_ids(table: Table) -> bool:
    return any(column.name == "id" and column.type == "uuid" for column in table.columns)


def _remapped(value: Any, mapping: dict[uuid.UUID, uuid.UUID]) -> Any:
    """A `demo` value with every id it holds (itself, or inside a list, tuple, set or dict) mapped."""
    if isinstance(value, uuid.UUID):
        return mapping.get(value, value)
    if isinstance(value, list | tuple | set):
        return type(value)(_remapped(item, mapping) for item in value)
    if isinstance(value, dict):
        return {_remapped(k, mapping): _remapped(v, mapping) for k, v in value.items()}
    return copy.deepcopy(value)


def _copy_files(files: list[str], mapping: dict[uuid.UUID, uuid.UUID]) -> None:
    """Each stored file the layers wrote, under the key of this seed's own tenant and Project."""
    root = Path(settings.VEXTRUS_STORAGE_ROOT)
    found = re.compile(UUID)
    for old in files:
        new = found.sub(lambda m: str(mapping.get(uuid.UUID(m.group()), m.group())), old)
        source, target = root / old, root / new
        if new != old and source.is_file() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            shutil.copyfile(source, target)


def _write(
    pending: list[tuple[Table, Key]], mapping: dict[uuid.UUID, uuid.UUID], shift: timedelta
) -> None:
    """The groups of rows, each written as its tenant; a group a trigger refuses waits for the others
    (the tables it reads), and is tried again."""
    while pending:
        failed: list[tuple[Table, Key]] = []
        for tenant, user in dict.fromkeys(key for _, key in pending):
            as_tenant = None if tenant is None else mapping.get(tenant, tenant)
            as_user = None if user is None else mapping.get(user, user)
            with tenancy.acting_in(as_tenant, user_id=as_user):
                for table, key in pending:
                    if key != (tenant, user):
                        continue
                    try:
                        with transaction.atomic(), connections["default"].cursor() as cursor:
                            _copy(cursor, table, key, shift)
                    except (ProgrammingError, IntegrityError) as error:
                        failed.append((table, key))
                        last = error
        if len(failed) == len(pending):
            raise last
        pending = failed


def _restore(demo: Demo) -> None:
    template = _template
    assert template is not None
    platform_ids = {
        template.demo[key]: demo[key]
        for key in template.demo
        if key.startswith(PLATFORM_KEYS) and key in demo
    }
    with connections[OWNER_ALIAS].cursor() as cursor:  # the committed Library: put back, new ids (flush)
        now = _library(cursor, template.library_tables)
    platform_ids.update(
        {old: now[key] for key, old in template.library.items() if now.get(key, old) != old}
    )
    shift = timezone.now() - template.made_at
    with transaction.atomic(), connections["default"].cursor() as cursor:
        cursor.execute("drop table if exists pg_temp.seed_map")
        cursor.execute("create temp table seed_map (old uuid primary key, new uuid not null)")
        cursor.execute(
            "insert into seed_map select * from unnest(%s::uuid[], %s::uuid[])",
            [list(platform_ids), list(platform_ids.values())],
        )
        # Every copied row gets an id of its own: the ledger of used ids (`LEDGER`) refuses an id twice,
        # even after a flush, so a second seed of the same template could not reuse the first's.
        for table in template.tables:
            if _uuid_ids(table):
                cursor.execute(
                    f"insert into seed_map select id, uuidv7() from {SCHEMA}.{table.name}"
                    " on conflict do nothing"
                )
        cursor.execute("select old, new from seed_map")
        mapping = dict(cursor.fetchall())
        cursor.execute("drop table if exists pg_temp.seed_jobs")
        if any(t.name == JOBS for t in template.tables):
            cursor.execute(
                "create temp table seed_jobs as select id as old,"
                f" nextval(pg_get_serial_sequence(%s, 'id')) as new from {SCHEMA}.{JOBS}",
                [JOBS],
            )
        else:
            cursor.execute("create temp table seed_jobs (old bigint, new bigint)")
        cursor.execute(REMAP)
    # The queue's triggers write the copied jobs' events, and the ledger goes last, when every id it
    # holds is in a row (the ledger's own trigger would refuse a row whose id it already held).
    tables = [t for t in template.tables if t.name not in (EVENTS, LEDGER)]
    ledger = [t for t in template.tables if t.name == LEDGER]
    for group in (tables, ledger):
        _write([(table, key) for table in group for key in table.keys], mapping, shift)
    _copy_files(template.files, mapping)
    for key, value in template.demo.items():
        if key not in demo:
            demo[key] = _remapped(value, mapping)


# --- the hook --------------------------------------------------------------------------------------


def _usable() -> bool:
    if tuple(seed_demo_module.SEEDS) != (PLATFORM, *ABOVE):
        return False
    return all(import_module(f"vextrus.seed.{name}").run is _genuine[name] for name in ABOVE)


def _wrap(original: Any) -> Any:
    def run_layer(name: str, demo: Demo) -> None:
        global _template
        if name == PLATFORM and _usable():
            from vextrus.seed import platform as seed_platform

            if not seed_platform.seeded_developers():
                if _template is None:
                    _template = _in_a_thread()
                _using.add(id(demo))
        elif id(demo) in _using and name in ABOVE:
            if name == ABOVE[0]:
                _restore(demo)
            if name == ABOVE[-1]:
                _using.discard(id(demo))
            return
        original(name, demo)

    return run_layer


@pytest.fixture(scope="session", autouse=True)
def seed_template(django_db_blocker: DjangoDbBlocker) -> Iterator[None]:
    """Wrap `vextrus.seed.demo.run_layer` for the session, and drop the template at its end."""
    global _template
    for name in (PLATFORM, *ABOVE):
        _genuine[name] = import_module(f"vextrus.seed.{name}").run
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(seed_demo_module, "run_layer", _wrap(seed_demo_module.run_layer))
        yield
    if _template is not None:
        _template = None
        with django_db_blocker.unblock(), connections[OWNER_ALIAS].cursor() as cursor:
            cursor.execute(f"drop schema if exists {SCHEMA} cascade")
