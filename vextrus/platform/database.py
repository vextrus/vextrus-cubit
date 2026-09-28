"""The database's plumbing: schema changes belong to the owner, and each worktree has its database.

`vextrus` owns every table and runs every migration; `vextrus_app`, which the web and the worker use,
owns nothing and is never granted TRUNCATE (docs/data-model.md §2). So:
- `OwnerMigrates` (DATABASE_ROUTERS) lets migrations run only through the `owner` alias;
- this module's `migrate` and `flush` commands always run through the `owner` alias, whatever
  `--database` says, so a test's flush and a plain `manage.py migrate` never run as the app;
- `ensure_database` creates the worktree's database, or a test database, as the owner.
"""

from typing import Any

import psycopg
from django.conf import settings
from psycopg import sql

OWNER_ALIAS: str = settings.VEXTRUS_OWNER_ALIAS


class OwnerMigrates:
    """Migrations run only through the owner alias; both aliases name one database."""

    def allow_migrate(
        self, db: str, app_label: str, model_name: str | None = None, **hints: Any
    ) -> bool:
        return db == OWNER_ALIAS


def ensure_database(name: str) -> bool:
    """Create the database `name` as the owner unless it exists; True when it was created.

    Connects to the cluster's `postgres` database with the owner alias's role, host and port (and its
    password when one is set; else libpq reads `~/.pgpass`).
    """
    owner = settings.DATABASES[OWNER_ALIAS]
    params = {"host": owner["HOST"], "port": owner["PORT"], "user": owner["USER"], "dbname": "postgres"}
    if owner["PASSWORD"]:
        params["password"] = owner["PASSWORD"]
    with psycopg.connect(**params, autocommit=True) as connection:
        found = connection.execute("select 1 from pg_database where datname = %s", [name]).fetchone()
        if found:
            return False
        try:
            connection.execute(sql.SQL("create database {}").format(sql.Identifier(name)))
        except psycopg.errors.DuplicateDatabase:  # made meanwhile by a parallel run
            return False
        return True
