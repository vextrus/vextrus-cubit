#!/bin/bash
# PostgreSQL 18 for the cloud scripts: sourced by setup.sh and session-start.sh, never run alone.
# Starts the cluster, makes the roles and the database through scripts/owner/db-roles.sql only when they
# are missing, and gives the two roles the passwords the environment's own variables name:
# DATABASE_URL (vextrus_app) and DATABASE_OWNER_URL (vextrus). No password is written in the repository,
# printed, or put on a command line: the SQL that sets one is piped from a Python one-liner to psql.
# Every function is idempotent. Under VEXTRUS_CLOUD_DRY_RUN=1 the PostgreSQL tools found on PATH run as
# the user running the script (no su, no sudo) and the caller installs and downloads nothing.
# shellcheck shell=bash

PG_PORT=5432
PG_HOST=127.0.0.1

pg_su() {                                   # pg_su psql ARGS...: the tool, as the cluster's superuser
  if [ -n "${VEXTRUS_CLOUD_DRY_RUN:-}" ]; then
    "$@"
  elif [ "$(id -u)" = 0 ]; then
    runuser -u postgres -- "$@"
  else
    sudo -n -u postgres "$@"
  fi
}

pg_up() {                                   # starts PostgreSQL 18 if it is not answering; 0 when it answers
  pg_isready -q -h "$PG_HOST" -p "$PG_PORT" && return 0
  pg_ctlcluster 18 main start >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 || true
  local _
  for _ in $(seq 20); do
    pg_isready -q -h "$PG_HOST" -p "$PG_PORT" && return 0
    sleep 1
  done
  return 1
}

pg_passwords_sql() {                        # SQL setting each role's password from its URL; prints no password
  python3 -I - <<'PY'
import os
import sys
from urllib.parse import unquote, urlsplit

for variable, role in (("DATABASE_OWNER_URL", "vextrus"), ("DATABASE_URL", "vextrus_app")):
    url = os.environ.get(variable, "")
    if not url:
        print(f"cloud: {variable} is not set: role {role} keeps the password it has", file=sys.stderr)
        continue
    parts = urlsplit(url)
    password = unquote(parts.password or "")
    if parts.username != role or not password or "\0" in password:
        print(f"cloud: {variable} does not name role {role} with a password: skipped", file=sys.stderr)
        continue
    print("ALTER ROLE " + role + " PASSWORD '" + password.replace("'", "''") + "';")
PY
}

pg_prepare() {                              # pg_prepare CHECKOUT: the roles, the database, the passwords
  local checkout=$1 sql
  pg_su psql -q -d postgres < "$checkout/scripts/owner/db-roles.sql" || return 1
  sql=$(pg_passwords_sql) || return 1
  [ -z "$sql" ] && return 0
  # A failed statement's error would echo the statement, password included: say only that it failed.
  printf '%s\n' "$sql" | pg_su psql -v ON_ERROR_STOP=1 -q -d postgres >/dev/null 2>&1 || {
    echo "cloud: setting the role passwords failed"
    return 1
  }
}
