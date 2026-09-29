"""No key lets the app write a row it has no right to write (#93's guard, over every table).

A foreign key's action that writes the referencing row (on delete cascade, set null or set default;
on update the same) runs as the tables' owner, past the app's rights and past row-level security. So
the app, holding DELETE on a parent, deletes (or blanks) the child's rows too, whatever its rights on
the child: #93 found the app could free a Building's id by deleting its Project. This reads every key
in `public` from `pg_constraint` and follows chains upward (a parent the app may not delete, but whose
own parent's delete cascades to it, is deleted all the same). A key is safe when the write it makes is
one the app may make itself on the child, and within the tenant: the child has no row-level security,
or the key carries `tenant_id`. Anything else is a finding, unless ALLOWED names it with a reason.
A table made later gets SELECT, INSERT, UPDATE and DELETE by default (platform 0003), so its keys are
judged here without anyone listing it.
"""

from dataclasses import dataclass
from typing import Any

import pytest
from django.db import connections

ALLOWED: dict[str, str] = {}
"""Keys whose finding is safe by design, each with its reason. None on `main` today."""

WRITES = {"c": "cascade", "n": "set null", "d": "set default"}
"""A key's actions that write the referencing row; "a" (no action) and "r" (restrict) write none."""

KEYS = """
    select c.conname::text, c.conrelid::regclass::text, c.confrelid::regclass::text,
           c.confdeltype::text, c.confupdtype::text,
           array(select a.attname::text from unnest(c.conkey) k
                   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k order by 1),
           array(select a.attname::text from unnest(c.confkey) k
                   join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k order by 1),
           r.relrowsecurity
      from pg_constraint c join pg_class r on r.oid = c.conrelid
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace
     order by 1"""


@dataclass(frozen=True)
class Key:
    name: str
    table: str
    parent: str
    on_delete: str
    on_update: str
    columns: tuple[str, ...]
    """The referencing columns, in `table`."""
    referenced: tuple[str, ...]
    """The referenced columns, in `parent`."""
    row_security: bool
    """Whether `table` has row-level security, which the key's action runs past."""

    def within_tenant(self) -> bool:
        return not self.row_security or "tenant_id" in self.columns


def read_keys(cursor: Any) -> list[Key]:
    cursor.execute(KEYS)
    return [
        Key(name, table, parent, on_delete, on_update, tuple(columns), tuple(referenced), security)
        for name, table, parent, on_delete, on_update, columns, referenced, security in cursor.fetchall()
    ]


class Rights:
    """vextrus_app's own rights, asked of the catalogue once each."""

    def __init__(self, cursor: Any) -> None:
        self.cursor = cursor
        self.answers: dict[tuple[str, str, str], bool] = {}

    def ask(self, table: str, column: str, right: str) -> bool:
        if (table, column, right) not in self.answers:
            if column:
                self.cursor.execute(
                    "select has_column_privilege('vextrus_app', %s, %s, %s)", [table, column, right]
                )
            else:
                self.cursor.execute("select has_table_privilege('vextrus_app', %s, %s)", [table, right])
            self.answers[table, column, right] = bool(self.cursor.fetchone()[0])
        return self.answers[table, column, right]

    def delete(self, table: str) -> bool:
        return self.ask(table, "", "DELETE")

    def update(self, table: str, column: str) -> bool:
        return self.ask(table, column, "UPDATE")


def findings(cursor: Any, allowed: dict[str, str] = ALLOWED) -> list[str]:
    """Each key whose action the app can set off, directly or down a chain, and whose write the app
    could not make itself; but those `allowed` names."""
    keys = read_keys(cursor)
    rights = Rights(cursor)
    # What the app can reach: deleting a table's rows, and updating its columns (by its own right,
    # or through a key's action set off by what it can reach).
    deletes = {table for key in keys for table in (key.table, key.parent) if rights.delete(table)}
    updates = {
        (table, column)
        for key in keys
        for table, columns in ((key.table, key.columns), (key.parent, key.referenced))
        for column in columns
        if rights.update(table, column)
    }
    problems: dict[str, str] = {}
    changed = True
    while changed:
        changed = False
        for key in keys:
            columns = {(key.table, column) for column in key.columns}
            may_update = all(rights.update(key.table, column) for column in key.columns)
            blanked = f"update {key.table}.{', '.join(key.columns)}"
            if key.on_delete in WRITES and key.parent in deletes:
                action = f"on delete {WRITES[key.on_delete]}"
                cause = f"vextrus_app can delete from {key.parent}"
                if key.on_delete == "c":
                    own, write = rights.delete(key.table), f"delete from {key.table}"
                    changed |= key.table not in deletes
                    deletes.add(key.table)
                else:
                    own, write = may_update, blanked
                    changed |= not columns <= updates
                    updates |= columns
                changed |= note(problems, key, own, action, cause, write)
            updated = [column for column in key.referenced if (key.parent, column) in updates]
            if key.on_update in WRITES and updated:
                action = f"on update {WRITES[key.on_update]}"
                cause = f"vextrus_app can update {key.parent}.{', '.join(updated)}"
                changed |= not columns <= updates
                updates |= columns
                changed |= note(problems, key, may_update, action, cause, blanked)
    return sorted(problem for name, problem in problems.items() if name not in allowed)


def note(problems: dict[str, str], key: Key, own: bool, action: str, cause: str, write: str) -> bool:
    """Records the key as a finding unless the app may make its write itself, within the tenant."""
    if own and key.within_tenant():
        return False
    reason = f"may not {write}" if not own else f"may {write}, but the key crosses tenants"
    problem = f"{key.name} ({key.table} -> {key.parent}): {action}, {cause}, and {reason}"
    if problems.get(key.name) == problem:
        return False
    problems[key.name] = problem
    return True


@pytest.mark.django_db
def test_no_key_lets_the_app_write_a_row_it_has_no_right_to_write() -> None:
    with connections["default"].cursor() as cursor:
        assert findings(cursor) == []
        # The keys this judges, so a catalogue read that finds nothing fails too.
        names = {key.name for key in read_keys(cursor) if "c" in (key.on_delete, key.on_update)}
    assert names >= {"projects_building_own_tenant", "platform_membershipproject_own_tenant"}


@pytest.mark.django_db
def test_every_allowed_key_exists_and_still_needs_its_place() -> None:
    with connections["default"].cursor() as cursor:
        existing = {key.name for key in read_keys(cursor)}
        needed = set(findings(cursor, allowed={}))
    for name, reason in ALLOWED.items():
        assert name in existing, name
        assert reason.strip(), name
        assert any(problem.startswith(f"{name} ") for problem in needed), name


# The check finds each shape of the class. ----------------------------------------------------------

PROBE = "create table probe (id uuid primary key, tenant_id uuid not null, unique (tenant_id, id))"


def child(table: str, action: str, parent: str = "probe", *, tenant: bool = False) -> str:
    key = (
        f"(tenant_id, {parent}_id) references {parent} (tenant_id, id)"
        if tenant
        else (f"({parent}_id) references {parent} (id)")
    )
    return (
        f"create table {table} (id uuid primary key, tenant_id uuid not null, {parent}_id uuid,"
        f" unique (tenant_id, id), constraint {table}_key foreign key {key} {action})"
    )


def finding(table: str, parent: str, action: str, cause: str, reason: str) -> str:
    return f"{table}_key ({table} -> {parent}): {action}, {cause}, and {reason}"


PROBES = {
    "a cascade into a table the app may not delete from": (
        [
            PROBE,
            child("probe_kept", "on delete cascade"),
            "revoke delete on probe_kept from vextrus_app",
        ],
        [
            finding(
                "probe_kept",
                "probe",
                "on delete cascade",
                "vextrus_app can delete from probe",
                "may not delete from probe_kept",
            )
        ],
    ),
    "a cascade into a table the app may delete from": (
        [PROBE, child("probe_free", "on delete cascade")],
        [],
    ),
    "a cascade into a table under row-level security, by a key without the tenant": (
        [
            PROBE,
            child("probe_free", "on delete cascade"),
            "alter table probe_free enable row level security",
        ],
        [
            finding(
                "probe_free",
                "probe",
                "on delete cascade",
                "vextrus_app can delete from probe",
                "may delete from probe_free, but the key crosses tenants",
            )
        ],
    ),
    "the same, by a key with the tenant": (
        [
            PROBE,
            child("probe_free", "on delete cascade", tenant=True),
            "alter table probe_free enable row level security",
        ],
        [],
    ),
    "a chain through a table the app may not delete from": (
        [
            PROBE,
            child("probe_mid", "on delete cascade"),
            "revoke delete on probe_mid from vextrus_app",
            child("probe_leaf", "on delete cascade", "probe_mid"),
            "revoke delete on probe_leaf from vextrus_app",
        ],
        [
            finding(
                "probe_leaf",
                "probe_mid",
                "on delete cascade",
                "vextrus_app can delete from probe_mid",
                "may not delete from probe_leaf",
            ),
            finding(
                "probe_mid",
                "probe",
                "on delete cascade",
                "vextrus_app can delete from probe",
                "may not delete from probe_mid",
            ),
        ],
    ),
    "a chain from a table the app may not delete from": (
        [
            PROBE,
            "revoke delete on probe from vextrus_app",
            child("probe_mid", "on delete cascade"),
            "revoke delete on probe_mid from vextrus_app",
        ],
        [],
    ),
    "#93's own: DELETE on projects_project given back": (
        ["grant delete on projects_project to vextrus_app"],
        [
            f"projects_{kind}_own_tenant (projects_{kind} -> projects_project): on delete cascade,"
            f" vextrus_app can delete from projects_project, and may not delete from projects_{kind}"
            for kind in ("building", "site")
        ],
    ),
    "a key setting null in a column the app may not update": (
        [
            PROBE,
            child("probe_kept", "on delete set null"),
            "revoke update on probe_kept from vextrus_app",
        ],
        [
            finding(
                "probe_kept",
                "probe",
                "on delete set null",
                "vextrus_app can delete from probe",
                "may not update probe_kept.probe_id",
            )
        ],
    ),
    "a key cascading an update into a column the app may not update": (
        [
            PROBE,
            "revoke delete on probe from vextrus_app",
            child("probe_kept", "on update cascade"),
            "revoke update on probe_kept from vextrus_app",
        ],
        [
            finding(
                "probe_kept",
                "probe",
                "on update cascade",
                "vextrus_app can update probe.id",
                "may not update probe_kept.probe_id",
            )
        ],
    ),
}


@pytest.mark.django_db(databases=["owner"])
@pytest.mark.parametrize("probe", PROBES)
def test_the_check_finds_a_key_that_writes_past_the_app_s_rights(probe: str) -> None:
    """Made by the owner inside the test's transaction, which rolls it back; the new tables take
    the app's rights from the default privileges, as a later ticket's would."""
    statements, expected = PROBES[probe]
    with connections["owner"].cursor() as owner:
        for statement in statements:
            owner.execute(statement)

        assert findings(owner) == expected


@pytest.mark.django_db(databases=["owner"])
def test_an_allowed_key_is_not_a_finding() -> None:
    statements, expected = PROBES["a cascade into a table the app may not delete from"]
    with connections["owner"].cursor() as owner:
        for statement in statements:
            owner.execute(statement)

        assert findings(owner, allowed={"probe_kept_key": "a reason"}) == []
        assert findings(owner) == expected
