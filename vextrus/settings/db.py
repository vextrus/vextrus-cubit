"""The database: two aliases onto one PostgreSQL 18 database, one database per worktree.

- `default` connects as `vextrus_app`, the only role the web and the worker use: not a superuser, no
  BYPASSRLS, owning nothing, so row-level security applies to it (docs/data-model.md §2).
- `owner` connects as `vextrus`, which owns the schema; it is used only by migrations, `sync_library`
  and the test flush (the M0 plan's reviews A1, A2). `migrate` and `flush` always run through it.

Both come from environment variables, `DATABASE_URL` and `DATABASE_OWNER_URL`
(`postgresql://user[:password]@host:port[/name]`). Locally, unset, they default to 127.0.0.1:5432
with no password: libpq reads the password from `~/.pgpass`. CI and the cloud set both.

The database's name is the URLs' path when they carry one, else `VEXTRUS_DB_NAME`, else the
worktree's own: `vextrus` in the main checkout and `vextrus_<worktree>` in a linked worktree, so
parallel sessions never share data. `manage.py ensure_database` creates it. Test databases are named
`<name>_test_<hash>`: the worktree's database and a hash of every migration and of the checkout's
resolved path, so a changed migration gets a fresh test database, an unchanged one is reused, and two
checkouts that share a name never share one. Under pytest-xdist each worker appends `_gw<N>`
(`vextrus.testing.database`); `_MAX_NAME` keeps `_gw127` within PostgreSQL's 63.
"""

import hashlib
import os
import re
from collections.abc import Mapping
from importlib.metadata import version
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured

from vextrus.settings.base import BASE_DIR
from vextrus.settings.tenancy import VEXTRUS_APP_ROLE, VEXTRUS_OWNER_ROLE

VEXTRUS_OWNER_ALIAS = "owner"
_LOCAL_HOST = "127.0.0.1"
_LOCAL_PORT = "5432"
_MAX_NAME = 40  # leaves room for "_test_", 10 hex and xdist's "_gw127" within PostgreSQL's 63
_HASHED_PACKAGES = ("django", "procrastinate")  # their own migrations make our test schema too


def worktree_database_name(checkout: Path) -> str:
    """`vextrus` in the main checkout; `vextrus_<worktree>` in a linked worktree (`.git` is a file)."""
    if not (checkout / ".git").is_file():
        return "vextrus"
    slug = re.sub(r"[^a-z0-9]+", "_", checkout.name.lower()).strip("_")
    return f"vextrus_{slug}"[:_MAX_NAME]


def migrations_hash(checkout: Path) -> str:
    """A hash of every module's migrations and of the packages whose migrations we also run."""
    digest = hashlib.sha256()
    for path in sorted(checkout.glob("vextrus/*/migrations/*.py")):
        digest.update(path.relative_to(checkout).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    for package in _HASHED_PACKAGES:
        digest.update(f"{package}=={version(package)}\0".encode())
    return digest.hexdigest()


def test_database_hash(checkout: Path) -> str:
    """10 hex of the migrations' hash and the checkout's resolved path: one test database per schema
    and per checkout (two checkouts named alike, under different parents, never share one)."""
    digest = hashlib.sha256(f"{migrations_hash(checkout)}\0{checkout.resolve()}".encode())
    return digest.hexdigest()[:10]


def _parse(variable: str, url: str) -> dict[str, str]:
    parts = urlsplit(url)
    if parts.scheme not in ("postgresql", "postgres") or not parts.username:
        raise ImproperlyConfigured(f"{variable} must be postgresql://user[:password]@host:port[/name]")
    return {
        "USER": unquote(parts.username),
        "PASSWORD": unquote(parts.password or ""),
        "HOST": parts.hostname or _LOCAL_HOST,
        "PORT": str(parts.port or _LOCAL_PORT),
        "NAME": unquote(parts.path.lstrip("/")),
    }


def databases(environ: Mapping[str, str], checkout: Path) -> dict[str, dict[str, Any]]:
    """Django's DATABASES for this environment and checkout."""
    local = f"{_LOCAL_HOST}:{_LOCAL_PORT}"
    default = _parse(
        "DATABASE_URL", environ.get("DATABASE_URL", f"postgresql://{VEXTRUS_APP_ROLE}@{local}")
    )
    owner = _parse(
        "DATABASE_OWNER_URL",
        environ.get("DATABASE_OWNER_URL", f"postgresql://{VEXTRUS_OWNER_ROLE}@{local}"),
    )
    fallback = environ.get("VEXTRUS_DB_NAME") or worktree_database_name(checkout)
    names = {default["NAME"] or fallback, owner["NAME"] or fallback}
    if len(names) != 1:
        raise ImproperlyConfigured(
            f"DATABASE_URL and DATABASE_OWNER_URL must name one database: {names}"
        )
    name = names.pop()
    test_name = f"{name}_test_{test_database_hash(checkout)}"
    return {
        alias: {
            "ENGINE": "django.db.backends.postgresql",
            **params,
            "NAME": name,
            "CONN_MAX_AGE": 0,
            # The tenant middleware opens the request's transaction itself (docs/data-model.md §2).
            "ATOMIC_REQUESTS": False,
            "TEST": {"NAME": test_name},
        }
        for alias, params in (("default", default), (VEXTRUS_OWNER_ALIAS, owner))
    }


DATABASES = databases(os.environ, BASE_DIR)
DATABASE_ROUTERS = ["vextrus.platform.database.OwnerMigrates"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"  # Django's own tables; ours use ids.new_id()
