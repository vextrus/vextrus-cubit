"""The startup check: the web and the worker refuse to start unless row-level security binds them
(docs/data-model.md §2; the M0 plan's reviews A1, A2).

They must be connected as `vextrus_app` (settings.VEXTRUS_APP_ROLE), which is not a superuser, lacks
BYPASSRLS, owns no table and is a member of no role that is, has or does any of those. The owner
bypasses row-level security (it is enabled, not forced), so running as it would show every tenant.

`vextrus/wsgi.py` calls `check()` when the web starts (so does `runserver`, which loads it); the
worker (09) calls it before taking a job.
"""

from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import connections


class StartupRefused(ImproperlyConfigured):
    pass


@dataclass(frozen=True)
class RoleFacts:
    """What the database says about the role a connection runs as."""

    name: str
    superuser: bool
    bypasses_rls: bool
    tables_owned: tuple[str, ...]
    powerful_roles: tuple[str, ...]
    """Roles it is a member of that are superusers, bypass row-level security or own a table."""


def facts(using: str = "default") -> RoleFacts:
    with connections[using].cursor() as cursor:
        cursor.execute(
            """
            select r.rolname, r.rolsuper, r.rolbypassrls,
                   array(select n.nspname || '.' || c.relname
                           from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where c.relowner = r.oid and c.relkind in ('r', 'p', 'v', 'm', 'f')
                            and n.nspname not in ('pg_catalog', 'information_schema')
                          order by 1),
                   array(select m.rolname from pg_roles m
                          where m.oid <> r.oid and pg_has_role(r.oid, m.oid, 'MEMBER')
                            and (m.rolsuper or m.rolbypassrls
                                 or exists (select 1 from pg_class c where c.relowner = m.oid
                                              and c.relkind in ('r', 'p', 'v', 'm', 'f')
                                              and c.relnamespace not in (
                                                'pg_catalog'::regnamespace,
                                                'information_schema'::regnamespace)))
                          order by 1)
              from pg_roles r where r.rolname = current_user
            """
        )
        row = cursor.fetchone()
    if row is None:
        raise StartupRefused("the database knows no role named current_user")
    name, superuser, bypasses, owned, powerful = row
    return RoleFacts(name, superuser, bypasses, tuple(owned), tuple(powerful))


def problems(role: RoleFacts, expected: str) -> list[str]:
    found = []
    if role.name != expected:
        found.append(f"connected as {role.name}, not {expected}")
    if role.superuser:
        found.append(f"{role.name} is a superuser")
    if role.bypasses_rls:
        found.append(f"{role.name} has BYPASSRLS")
    if role.tables_owned:
        found.append(f"{role.name} owns {len(role.tables_owned)} table(s): {role.tables_owned[0]}…")
    if role.powerful_roles:
        found.append(f"{role.name} is a member of {', '.join(role.powerful_roles)}")
    return found


def check(using: str = "default") -> None:
    """Refuse to start (raise StartupRefused) unless row-level security binds this connection."""
    found = problems(facts(using), settings.VEXTRUS_APP_ROLE)
    if found:
        raise StartupRefused(
            "refusing to start, since row-level security would not bind this process: "
            + "; ".join(found)
        )
