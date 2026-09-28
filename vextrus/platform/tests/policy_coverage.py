"""Policy coverage: every tenant table is under row-level security as docs/data-model.md §2 rules.

For every table in the `public` schema that is not on the allowlist of global tables below:
- it has `tenant_id uuid NOT NULL`;
- row-level security is enabled and **not forced** (the owner's constraint checks must see every
  row; the M0 plan's reviews A1, A2);
- it has its own-tenant policy for every command, reading the tenant as
  `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid` for reads and writes alike
  (a widening is a separate `FOR SELECT` policy, which this check allows beside it);
- every index but the primary key is led by `tenant_id`, so the policy becomes an index condition,
  unless the index is on the allowlist of index exceptions with its reason.

Every allowlist entry gives its reason, and an entry naming no table or index is stale and fails.
"""

import re
from collections.abc import Mapping
from typing import Any

# Tables with no tenant, each with its reason (the M0 plan, 01a: Django's contrib tables,
# django_session, django_admin_log, Procrastinate's tables, platform_user).
GLOBAL_TABLES: Mapping[str, str] = {
    "django_migrations": "Django's record of applied migrations, written only by the owner.",
    "django_content_type": "Django's catalogue of models: the same for every tenant.",
    "auth_permission": "Django's catalogue of permissions: the same for every tenant.",
    "auth_group": "Django's permission groups: unused by Vextrus, holding no tenant data.",
    "auth_group_permissions": "Django's permission groups' links: unused, holding no tenant data.",
    "django_session": (
        "A session exists before a Developer is chosen; it names its user, and the tenant middleware "
        "reads the current Developer from it."
    ),
    "django_admin_log": "The admin's LogEntry writes are switched off; vextrus_app has no rights (02).",
    "procrastinate_jobs": (
        "The job queue: a job's arguments carry only the tenant's id and ids, and its step runner sets "
        "the tenant before touching data (09)."
    ),
    "procrastinate_events": "The job queue's events: ids and states only (09).",
    "procrastinate_periodic_defers": "The job queue's periodic schedule: no tenant data (09).",
    "procrastinate_workers": "The job queue's workers: no tenant data (09).",
    "platform_user": (
        "A person may hold Memberships in several Developers, so User is global (docs/data-model.md "
        "§3.0); vextrus_app can read every row, an accepted and recorded risk."
    ),
}

# Indexes on tenant tables not led by tenant_id, each with its reason (02 adds the Market's code).
INDEX_EXCEPTIONS: Mapping[str, str] = {}

_OWN_TENANT = "tenant_id=nullifcurrent_setting'app.tenant_id'::text,true,''::text::uuid"


def _normalise(expression: str | None) -> str:
    return re.sub(r"[\s()]", "", expression or "").lower()


def coverage_problems(
    cursor: Any,
    global_tables: Mapping[str, str] = GLOBAL_TABLES,
    index_exceptions: Mapping[str, str] = INDEX_EXCEPTIONS,
) -> tuple[list[str], list[str]]:
    """(the tenant tables checked, the problems found) for the database the cursor is connected to."""
    cursor.execute(
        """
        select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p')
         order by c.relname
        """
    )
    tables = cursor.fetchall()
    names = {name for _oid, name, _enabled, _forced in tables}
    problems = [
        f"{name}: on the global allowlist without its reason"
        for name, reason in sorted(global_tables.items())
        if not reason.strip()
    ]
    problems.extend(
        f"{index}: on the index exceptions without its reason"
        for index, reason in sorted(index_exceptions.items())
        if not reason.strip()
    )
    problems.extend(
        f"{name}: on the global allowlist but no such table (stale entry)"
        for name in sorted(set(global_tables) - names)
    )
    checked = []
    indexes_seen: set[str] = set()
    for oid, name, enabled, forced in tables:
        if name in global_tables:
            continue
        checked.append(name)
        problems.extend(_table_problems(cursor, oid, name, enabled, forced))
        index_problems, seen = _index_problems(cursor, oid, name, index_exceptions)
        problems.extend(index_problems)
        indexes_seen |= seen
    problems.extend(
        f"{index}: on the index exceptions but no such index on a tenant table (stale entry)"
        for index in sorted(set(index_exceptions) - indexes_seen)
    )
    return checked, problems


def _table_problems(cursor: Any, oid: int, name: str, enabled: bool, forced: bool) -> list[str]:
    problems = []
    cursor.execute(
        """
        select format_type(atttypid, atttypmod), attnotnull from pg_attribute
         where attrelid = %s and attname = 'tenant_id' and not attisdropped
        """,
        [oid],
    )
    column = cursor.fetchone()
    if column is None or column != ("uuid", True):
        problems.append(f"{name}: has no tenant_id uuid NOT NULL")
    if not enabled:
        problems.append(f"{name}: row-level security is not enabled")
    if forced:
        problems.append(f"{name}: row-level security is forced (enable it, never force it)")
    cursor.execute(
        """
        select cmd, permissive, roles::text[], qual, with_check from pg_policies
         where schemaname = 'public' and tablename = %s
        """,
        [name],
    )
    own_tenant = [
        policy
        for policy in cursor.fetchall()
        if policy[0] == "ALL"
        and policy[1] == "PERMISSIVE"
        and policy[2] == ["public"]
        and _normalise(policy[3]) == _OWN_TENANT
        and policy[4] in (None, policy[3])
    ]
    if not own_tenant:
        problems.append(f"{name}: has no own-tenant policy for all commands")
    return problems


def _index_problems(
    cursor: Any, oid: int, name: str, index_exceptions: Mapping[str, str]
) -> tuple[list[str], set[str]]:
    cursor.execute(
        """
        select i.indexrelid::regclass::text, i.indisprimary, a.attname
          from pg_index i
          left join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
         where i.indrelid = %s
        """,
        [oid],
    )
    problems = []
    seen = set()
    for index, primary, first in cursor.fetchall():
        seen.add(index)
        if primary or first == "tenant_id" or index in index_exceptions:
            continue
        problems.append(f"{name}: index {index} is not led by tenant_id")
    return problems, seen
