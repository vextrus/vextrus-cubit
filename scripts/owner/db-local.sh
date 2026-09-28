#!/usr/bin/env bash
# Creates this machine's two database roles on PostgreSQL 18 and gives each a fresh random password,
# written straight into ~/.pgpass and never shown (the M0 plan, "Before wave 0"; 01a's db-roles.sql).
# Run by the owner, not root:   ! bash scripts/owner/db-local.sh [port]      (default 5432)
# Needs the superuser's line for 127.0.0.1:<port> in ~/.pgpass. Re-running rotates both passwords.
set -euo pipefail
PORT=${1:-5432}
HOST=127.0.0.1
PGPASS=$HOME/.pgpass
cd "$(dirname "$0")/../.."

v=$(psql -h "$HOST" -p "$PORT" -U postgres -d postgres -Atc 'show server_version_num')
[ "${v:0:2}" = 18 ] || { echo "port $PORT runs PostgreSQL ${v:0:2}, not 18" >&2; exit 1; }
psql -h "$HOST" -p "$PORT" -U postgres -d postgres -q -f scripts/owner/db-roles.sql

touch "$PGPASS" && chmod 600 "$PGPASS"
for role in vextrus vextrus_app; do
  pw=$(openssl rand -hex 24)
  printf '%s\n' '\getenv pw VEXTRUS_PW' "ALTER ROLE $role PASSWORD :'pw';" |
    VEXTRUS_PW=$pw psql -h "$HOST" -p "$PORT" -U postgres -d postgres -q -v ON_ERROR_STOP=1
  tmp=$(mktemp "$HOME/.pgpass.XXXXXX")
  grep -v "^$HOST:$PORT:\*:$role:" "$PGPASS" > "$tmp" || true
  printf '%s:%s:*:%s:%s\n' "$HOST" "$PORT" "$role" "$pw" >> "$tmp"
  chmod 600 "$tmp" && mv "$tmp" "$PGPASS"
done
unset pw
for role in vextrus vextrus_app; do
  psql -h "$HOST" -p "$PORT" -U "$role" -d vextrus -Atc \
    "select current_user || ': createdb=' || rolcreatedb || ', bypassrls=' || rolbypassrls from pg_roles where rolname = current_user"
done
echo "passwords are in $PGPASS only (not shown)"
