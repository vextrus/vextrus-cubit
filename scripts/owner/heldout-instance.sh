#!/usr/bin/env bash
# The Held-out instance (ticket M1-06; docs/plans/M1.md, wave 0): a product instance run as the key
# user, with its own database and roles, its file store, logs and Jev key copy under the key user's home,
# so that no build session (each runs as your user) can reach the Held-out Set, its reads or its Takeoff.
#
# Run by the owner, as root, in a WSL terminal, from the checkout of main pulled from GitHub, after
# reading this file in full:
#   cd ~/vextrus-cubit && sudo bash scripts/owner/heldout-instance.sh
# See every step first, running nothing (no root needed):
#   bash scripts/owner/heldout-instance.sh --dry-run
# Run it again whenever main changes and you want the instance on the new main: it is idempotent, rotates
# both database passwords, and keeps the instance's database, files and Jev key.
#
# Every step is inside `main`, which bash reads whole before running any of it: this file is your user's
# to write, and a change made to it while it runs (at a prompt, say) is never read. Nothing that runs as
# root or as the key user comes from your checkout: the code, and the SQL the superuser runs, come from
# the key user's own clone of the main GitHub holds.
#
# What it does, in order (each step says what it did; any failure stops it):
#   1. checks this machine: root, the key user and its 700 home, PostgreSQL 18 on 5432 (never 5544), root's
#      uv and the toolchain's Python, and that your user reaches no Docker daemon;
#   2. takes GitHub's main into the key user's own clone (your user bundles main; root checks the commit
#      against GitHub);
#   3. the database: scripts/owner/heldout-roles.sql (main's) as the superuser, then a fresh password for
#      each of the two roles, set as a SCRAM verifier (the password itself never reaches the server or its
#      log) and written into the key user's own ~/.pgpass only, never yours, never shown;
#   4. closes the superuser to passwords: with a password (yours, in your ~/.pgpass) every build session
#      could sign in as the superuser, who reads any database's files; it then signs in only as the
#      postgres Unix user (`sudo -u postgres psql`). Asked first; refused, the script stops;
#   5. pg_hba.conf: a marked block before every other rule, letting only the two roles reach
#      vextrus_heldout, over 127.0.0.1 with a password, and rejecting every other role, address and the
#      socket there; checked for errors before the reload (a reload, never a restart);
#   6. the instance under the key user's home: its folders, settings, Jev key copy (you paste it, hidden),
#      Node (pinned, root's), the Python and web packages, the migrations, the Library, and its launcher;
#   7. proves each wall.
set -euo pipefail

OWNER=riz
KEY_USER=vxkeys
KEY_HOME=/home/$KEY_USER
KEY_PGPASS=$KEY_HOME/.pgpass
INSTANCE=$KEY_HOME/heldout
APP=$INSTANCE/app            # the key user's own clone of main, and its .venv
STORE=$INSTANCE/store        # VEXTRUS_STORAGE_ROOT: the Held-out Set's uploaded drawings
LOGS=$INSTANCE/logs          # each process's log
SETTINGS=$INSTANCE/instance.env
JEV_KEY=$INSTANCE/jev.key    # the key user's own copy of the owner's local key (ADR 0013)
SERVE=$INSTANCE/serve        # the launcher, root's
HOST=127.0.0.1
PORT=5432
CLUSTER_MAJOR=18
DB=vextrus_heldout
OWNER_ROLE=vextrus_heldout
APP_ROLE=vextrus_heldout_app
API_PORT=8300
WEB_PORT=5300
REPOSITORY_URL=https://github.com/vextrus/vextrus-cubit.git
LIB=/usr/local/lib/vextrus
UV=$LIB/bin/uv               # root's, installed by scripts/owner/keys-custody.sh from its pinned release
SYSTEM_PYTHON=/usr/bin/python3
TOOLCHAIN_PYTHON_DIR=/opt/vextrus/python
# Node, from its release (your user's Node lives under your home, which you can change): the tarball's
# sha256 as the release publishes it (https://nodejs.org/dist/v24.19.0/SHASUMS256.txt).
NODE_VERSION=24.19.0
NODE_SHA256=14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647
NODE_DIR=$LIB/node-v$NODE_VERSION
NODE_URL=https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz
HBA_BEGIN='# >>> vextrus-heldout (scripts/owner/heldout-instance.sh, ticket M1-06): do not edit by hand'
HBA_END='# <<< vextrus-heldout'
CLEAN_PATH=/usr/local/bin:/usr/bin:/bin
DRY_RUN=0

step() { printf '\n== %s\n' "$1"; }
plan() { local line; for line in "$@"; do printf '  - %s\n' "$line"; done; }
ok() { printf '  ok: %s\n' "$1"; }
die() { printf '  FAILED: %s\n' "$1"; exit 1; }
dry() { [ "$DRY_RUN" = 1 ]; }
confirm() { local reply; read -r -p "  $1 [y/N] " reply; [[ "$reply" =~ ^[Yy] ]]; }
# Each user runs with a clean environment: nothing of root's or yours leaks into it.
as_owner() { runuser -u "$OWNER" -- env -i HOME="/home/$OWNER" PATH="$CLEAN_PATH" LANG=C.UTF-8 "$@"; }
as_key() { runuser -u "$KEY_USER" -- env -i HOME="$KEY_HOME" PATH="$NODE_DIR/bin:$CLEAN_PATH" LANG=C.UTF-8 "$@"; }
as_postgres() { runuser -u postgres -- env -i PATH="$CLEAN_PATH" LANG=C.UTF-8 "$@"; }
# The superuser, over the cluster's Unix socket (peer), on the cluster on $PORT, in the postgres database.
super_psql() { as_postgres psql -X -q -v ON_ERROR_STOP=1 -p "$PORT" -d postgres "$@"; }

# The marked pg_hba.conf block. The first rule that matches a connection decides it, so the block goes
# before every other rule: the two roles over 127.0.0.1 with a password; then every other role, from any
# address (::1 among them), and every connection over the socket, rejected for this database.
hba_block() {
  printf '%s\n' "$HBA_BEGIN"
  printf '%-7s %-16s %-36s %-13s %s\n' \
    host "$DB" "$OWNER_ROLE,$APP_ROLE" "$HOST/32" scram-sha-256 \
    host "$DB" all all reject \
    local "$DB" all "" reject
  printf '%s\n' "$HBA_END"
}

# pg_hba.conf ($1) with any earlier block taken out and the block put before its first rule.
hba_with_block() {
  local block
  block=$(hba_block)
  awk -v begin="$HBA_BEGIN" -v end="$HBA_END" -v block="$block" '
    $0 == begin { skipping = 1; next }
    skipping { if ($0 == end) skipping = 0; next }
    !placed && $0 !~ /^[ \t]*(#|$)/ { print block; placed = 1 }
    { print }
    END { if (skipping) exit 3; if (!placed) print block }
  ' "$1"
}

# Puts the block into the cluster's pg_hba.conf ($1), a copy kept at $2 first: the new file is checked for
# errors before the reload (an error puts the copy back), and the loaded first rules must be the block's.
install_hba() {
  local hba=$1 backup=$2 errors first expected
  install -o root -g root -m 0600 "$hba" "$backup"
  hba_with_block "$backup" > "$tmp/pg_hba.conf" || die "$hba holds a block with no end marker: fix it by hand"
  install -o postgres -g postgres -m 0640 "$tmp/pg_hba.conf" "$hba.heldout-new"
  rm -f -- "$tmp/pg_hba.conf"
  mv -f -- "$hba.heldout-new" "$hba"
  errors=$(super_psql -At -c "select count(*) from pg_hba_file_rules where error is not null")
  if [ "$errors" != 0 ]; then
    install -o postgres -g postgres -m 0640 "$backup" "$hba"
    die "the new pg_hba.conf has $errors error(s): the copy was put back and nothing reloaded"
  fi
  [ "$(super_psql -At -c 'select pg_reload_conf()')" = t ] || die "the cluster did not reload"
  first=$(super_psql -At -F ' ' -c "select type, array_to_string(database, ','),
    array_to_string(user_name, ','), coalesce(address, '-'), auth_method
    from pg_hba_file_rules order by rule_number limit 3")
  expected="host $DB $OWNER_ROLE,$APP_ROLE $HOST scram-sha-256
host $DB all all reject
local $DB all - reject"
  [ "$first" = "$expected" ] || die "the cluster's first rules are not the block's: $first"
}

# A SCRAM-SHA-256 verifier for the password on stdin (RFC 5802, RFC 7677; what libpq's `\password` sends),
# with a fresh salt, or the base64 salt given (for the tests). The password stays on stdin: never an
# argument, so no other user lists it, and never sent, so the server never logs it.
# shellcheck disable=SC2120 # the salt is the tests'
scram_verifier() {
  # shellcheck disable=SC2016 # Python, not shell
  "$SYSTEM_PYTHON" -I -c '
import base64, hashlib, hmac, os, sys
password = sys.stdin.buffer.read()
salt = base64.b64decode(sys.argv[1]) if len(sys.argv) > 1 else os.urandom(16)
rounds = 4096
salted = hashlib.pbkdf2_hmac("sha256", password, salt, rounds)
client = hmac.new(salted, b"Client Key", "sha256").digest()
server = hmac.new(salted, b"Server Key", "sha256").digest()
b64 = lambda raw: base64.b64encode(raw).decode()
print(f"SCRAM-SHA-256${rounds}:{b64(salt)}${b64(hashlib.sha256(client).digest())}:{b64(server)}")
' "$@"
}

# The key user's ~/.pgpass ($1, possibly absent) with $2's line for vextrus_heldout set to the password on
# stdin; printed. Only that role's line for this host, port and database is replaced.
pgpass_with() {
  local password
  password=$(cat)
  if [ -f "$1" ]; then awk -v line="$HOST:$PORT:$DB:$2:" 'index($0, line) != 1 && $0 != ""' "$1"; fi
  printf '%s:%s:%s:%s:%s\n' "$HOST" "$PORT" "$DB" "$2" "$password"
}

# Sets a fresh password for role $1 and writes it into the key user's ~/.pgpass, the key user's alone.
# The password lives in this shell and in root's own temporary folder only; printf is bash's own, so it
# is never an argument another user could list.
new_password() {
  local role=$1 password verifier
  password=$(openssl rand -hex 24)
  # shellcheck disable=SC2119 # a fresh salt
  verifier=$(printf '%s' "$password" | scram_verifier)
  printf "ALTER ROLE %s PASSWORD '%s';\n" "$role" "$verifier" | super_psql
  install -m 0600 /dev/null "$tmp/pgpass"
  printf '%s' "$password" | pgpass_with "$KEY_PGPASS" "$role" > "$tmp/pgpass"
  install -o "$KEY_USER" -g "$KEY_USER" -m 0600 "$tmp/pgpass" "$KEY_PGPASS"
  rm -f -- "$tmp/pgpass"
  unset password
}

# The instance's settings (no secret but the Django key, generated here; the Jev key is its own file).
instance_settings() {
  printf '%s\n' \
    "# The Held-out instance's settings (scripts/owner/heldout-instance.sh, ticket M1-06); the key user's." \
    "VEXTRUS_DB_NAME=$DB" \
    "VEXTRUS_APP_ROLE=$APP_ROLE" \
    "VEXTRUS_OWNER_ROLE=$OWNER_ROLE" \
    "VEXTRUS_STORAGE_ROOT=$STORE" \
    "VEXTRUS_WEB_PORT=$WEB_PORT" \
    "VEXTRUS_API_URL=http://$HOST:$API_PORT" \
    "VEXTRUS_ALLOWED_HOSTS=$HOST" \
    "VEXTRUS_SECRET_KEY=$1"
}

# The launcher, run by the owner as the key user with the owner's password (sudo -u <key user> <it>):
# the API, both workers and the web, each logging under $LOGS. Root's, so the key user runs it unchanged.
serve_script() {
  cat <<SERVE
#!/bin/bash
# The Held-out instance, served as the key user (scripts/owner/heldout-instance.sh, ticket M1-06).
set -euo pipefail
[ "\$(id -un)" = $KEY_USER ] || { echo "run it as the key user: sudo -u $KEY_USER $SERVE"; exit 1; }
umask 077
set -a
# shellcheck disable=SC1091
. $SETTINGS
set +a
TYPESAFE_API_KEY=\$(cat $JEV_KEY)
export TYPESAFE_API_KEY HOME=$KEY_HOME PATH=$NODE_DIR/bin:$CLEAN_PATH
cd $APP
pids=()
start() { local name=\$1; shift; "\$@" >> "$LOGS/\$name.log" 2>&1 & pids+=(\$!); }
stop() { kill "\${pids[@]}" 2>/dev/null || true; wait || true; }
trap stop EXIT INT TERM
start api env VEXTRUS_DEBUG=1 .venv/bin/python manage.py runserver $HOST:$API_PORT --noreload
start worker .venv/bin/python manage.py worker
start worker-cad .venv/bin/python manage.py worker --queue cad
start web npm --prefix web run dev
echo "The Held-out instance: http://$HOST:$WEB_PORT (logs in $LOGS). Ctrl-C stops it."
wait -n
SERVE
}

main() {
  if [ "${1:-}" = --dry-run ]; then DRY_RUN=1; elif [ -n "${1:-}" ]; then die "unknown argument: $1 (only --dry-run)"; fi
  if dry; then
    echo "Dry run: each step is printed, nothing runs, nothing changes."
  else
    [ "$(id -u)" = 0 ] || die "run this as root: sudo bash scripts/owner/heldout-instance.sh"
    tmp=$(mktemp -d)
    trap 'rm -f -- "$tmp"/*; rmdir -- "$tmp"' EXIT
  fi

  step "1/7 Check this machine"
  plan "root; the owner $OWNER and the key user $KEY_USER exist; $KEY_HOME is $KEY_USER's, mode 700" \
    "the cluster on port $PORT is PostgreSQL $CLUSTER_MAJOR (the 16 cluster on 5544 is never touched); its pg_hba.conf" \
    "root's $UV and the toolchain's Python under $TOOLCHAIN_PYTHON_DIR, each root's alone" \
    "$OWNER reaches no Docker daemon (one would be root)"
  if ! dry; then
    id "$OWNER" >/dev/null 2>&1 || die "no user $OWNER"
    id "$KEY_USER" >/dev/null 2>&1 || die "no key user $KEY_USER: run scripts/owner/custody-setup.sh first"
    [ "$(stat -c '%U %a' "$KEY_HOME")" = "$KEY_USER 700" ] || die "$KEY_HOME is not $KEY_USER's with mode 700 (ADR 0026)"
    read -r version port hba < <(super_psql -At -F ' ' -c \
      "select current_setting('server_version_num'), current_setting('port'), current_setting('hba_file')") \
      || die "the superuser could not reach the cluster on port $PORT"
    [ "${version:0:2}" = "$CLUSTER_MAJOR" ] && [ "$port" = "$PORT" ] \
      || die "port $PORT runs PostgreSQL ${version:0:2} on port $port, not $CLUSTER_MAJOR on $PORT"
    if [ -L "$hba" ] || [ ! -f "$hba" ]; then die "$hba is not a plain file"; fi
    if [ ! -x "$UV" ] || [ "$(stat -c %U "$UV")" != root ]; then die "no root's $UV: run scripts/owner/keys-custody.sh first"; fi
    bad=$(find "$TOOLCHAIN_PYTHON_DIR" "$UV" \( ! -user root -o -perm /022 \) ! -type l -print -quit)
    [ -z "$bad" ] || die "$bad is not root's alone: fix that before anything runs as the key user from it"
    if as_owner test -w /var/run/docker.sock; then
      die "$OWNER can reach Docker (/var/run/docker.sock), which is root: turn Docker's WSL integration off, or take $OWNER out of the docker group"
    fi
    ok "root; $KEY_HOME is 700; PostgreSQL $version on $PORT ($hba); root's uv; no Docker for $OWNER"
  fi

  step "2/7 Take GitHub's main into the key user's own clone"
  plan "$OWNER bundles main; $KEY_USER fetches it (objects checked) into $APP" \
    "root asks GitHub ($REPOSITORY_URL) which commit main is: the clone must be that commit" \
    "$APP is checked out at it, $KEY_USER's alone"
  if ! dry; then
    chmod 0711 "$tmp"
    install -m 0644 /dev/null "$tmp/main.bundle"
    as_owner git -C "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)" bundle create --quiet - refs/heads/main \
      > "$tmp/main.bundle" || die "your checkout could not bundle main"
    github_main=$(git ls-remote "$REPOSITORY_URL" refs/heads/main | cut -f1)
    [[ "$github_main" =~ ^[0-9a-f]{40}$ ]] || die "GitHub could not be asked which commit main is"
    install -d -o "$KEY_USER" -g "$KEY_USER" -m 0700 "$INSTANCE" "$APP"
    [ -d "$APP/.git" ] || as_key git -C "$APP" init --quiet
    as_key git -C "$APP" -c transfer.fsckObjects=true fetch --quiet --no-tags "$tmp/main.bundle" \
      "+refs/heads/main:refs/heads/main" || die "main's bundle could not be fetched"
    rm -f -- "$tmp/main.bundle"
    [ "$(as_key git -C "$APP" rev-parse refs/heads/main)" = "$github_main" ] \
      || die "your main is not the main GitHub holds ($github_main): pull main, then run this again"
    as_key git -C "$APP" checkout --quiet --force --detach "$github_main"
    ok "$APP is GitHub's main, ${github_main:0:12}"
  fi

  step "3/7 The database and its two roles"
  plan "as the superuser, over the socket, in the postgres database: main's scripts/owner/heldout-roles.sql" \
    "  (roles $OWNER_ROLE and $APP_ROLE; database $DB, its owner $OWNER_ROLE; CONNECT revoked from PUBLIC;" \
    "  its statements kept out of the server's log; each wall checked)" \
    "a fresh password for each role, set as a SCRAM verifier, written into $KEY_PGPASS (600) only"
  if ! dry; then
    as_key git -C "$APP" show "$github_main:scripts/owner/heldout-roles.sql" > "$tmp/heldout-roles.sql"
    chmod 0644 "$tmp/heldout-roles.sql"
    super_psql -f - < "$tmp/heldout-roles.sql" || die "heldout-roles.sql stopped (above); no password was set"
    new_password "$OWNER_ROLE"
    new_password "$APP_ROLE"
    ok "$DB, $OWNER_ROLE and $APP_ROLE; both passwords in $KEY_PGPASS only (not shown)"
  fi

  step "4/7 Close the superuser to passwords"
  plan "each superuser role with a password loses it (ALTER ROLE ... PASSWORD NULL), after you confirm:" \
    "  it then signs in only as the postgres Unix user, over the socket: sudo -u postgres psql -p $PORT" \
    "  (your ~/.pgpass's superuser line stops working; scripts/owner/db-local.sh then needs that route)"
  if ! dry; then
    supers=$(super_psql -At -c "select string_agg(rolname, ' ') from pg_authid where rolsuper and rolpassword is not null")
    if [ -z "$supers" ]; then
      ok "no superuser signs in with a password"
    else
      echo "  These superusers sign in with a password: $supers. Your user holds the postgres one in ~/.pgpass,"
      echo "  and every build session runs as your user: a superuser reads any database's files."
      confirm "Remove their passwords (they sign in as the postgres Unix user only)?" \
        || die "the superuser keeps its password, so the Held-out database has no wall; nothing else was changed"
      for role in $supers; do
        [[ "$role" =~ ^[a-z_][a-z0-9_]*$ ]] || die "a superuser's name is not plain: $role"
        printf 'ALTER ROLE %s PASSWORD NULL;\n' "$role" | super_psql
      done
      ok "no superuser signs in with a password now"
    fi
  fi

  step "5/7 pg_hba.conf"
  plan "a copy of the cluster's pg_hba.conf goes to /root first; then this block, before every other rule:"
  hba_block | sed 's/^/      /'
  plan "the file is checked for errors (pg_hba_file_rules) before the reload; an error puts the copy back" \
    "the cluster reloads (pg_reload_conf(); never a restart); its first three rules must be the block's"
  if ! dry; then
    backup=/root/pg_hba.conf.$(date -u +%Y%m%dT%H%M%SZ)
    install_hba "$hba" "$backup"
    ok "the block is $hba's first rules, loaded (the old file is $backup)"
  fi

  step "6/7 The instance, under $INSTANCE"
  plan "folders $STORE and $LOGS, $KEY_USER's, 700" \
    "settings $SETTINGS (600): database $DB as $APP_ROLE (the owner alias $OWNER_ROLE), the file store, ports $API_PORT and $WEB_PORT" \
    "the Jev key: you paste your TypeSafe key, hidden; it goes into $JEV_KEY (600), never shown (Enter keeps the copy there)" \
    "Node $NODE_VERSION from its release, sha256-checked, root's, at $NODE_DIR" \
    "as $KEY_USER: uv sync --locked, npm ci, manage.py migrate and sync_library" \
    "the launcher $SERVE, root's"
  if ! dry; then
    install -d -o "$KEY_USER" -g "$KEY_USER" -m 0700 "$INSTANCE" "$STORE" "$LOGS"
    if [ -f "$SETTINGS" ]; then
      secret=$(sed -n 's/^VEXTRUS_SECRET_KEY=//p' "$SETTINGS")
    fi
    [ -n "${secret:-}" ] || secret=$(openssl rand -hex 32)
    install -m 0600 /dev/null "$tmp/settings"
    instance_settings "$secret" > "$tmp/settings"
    unset secret
    install -o "$KEY_USER" -g "$KEY_USER" -m 0600 "$tmp/settings" "$SETTINGS"
    rm -f -- "$tmp/settings"
    read -r -s -p "  Paste your TypeSafe key (hidden; Enter keeps the copy already there): " jev; echo
    if [ -n "$jev" ]; then
      install -m 0600 /dev/null "$tmp/jev"
      printf '%s' "$jev" > "$tmp/jev"
      install -o "$KEY_USER" -g "$KEY_USER" -m 0600 "$tmp/jev" "$JEV_KEY"
      rm -f -- "$tmp/jev"
    fi
    unset jev
    [ -s "$JEV_KEY" ] || die "no Jev key in $JEV_KEY: run this again and paste it"
    if [ ! -x "$NODE_DIR/bin/node" ]; then
      curl -sSfL -o "$tmp/node.tar.xz" "$NODE_URL" || die "Node $NODE_VERSION could not be downloaded"
      echo "$NODE_SHA256  $tmp/node.tar.xz" | sha256sum -c --quiet - || die "Node's download is not the pinned release"
      install -d -o root -g root -m 0755 "$NODE_DIR"
      tar -xJf "$tmp/node.tar.xz" -C "$NODE_DIR" --strip-components=1 --no-same-owner
      rm -f -- "$tmp/node.tar.xz"
      chown -R -h root:root "$NODE_DIR"
      chmod -R go-w "$NODE_DIR"
    fi
    ok "Node $("$NODE_DIR/bin/node" --version), root's"
    cd -- "$INSTANCE"
    as_key env -C "$APP" UV_PYTHON_INSTALL_DIR="$TOOLCHAIN_PYTHON_DIR" UV_PYTHON_DOWNLOADS=never \
      UV_CACHE_DIR="$INSTANCE/.cache/uv" "$UV" sync --locked --quiet || die "uv sync failed (above)"
    as_key env -C "$APP" npm_config_cache="$INSTANCE/.cache/npm" npm --prefix web ci --no-audit --no-fund --silent \
      || die "npm ci failed (above)"
    for command in "migrate --no-input" sync_library; do
      # shellcheck disable=SC2086 # the command's words
      # shellcheck disable=SC2016 # expanded by the key user's shell
      as_key bash -c 'set -a; . "$1"; set +a; shift; cd "$1"; shift; exec .venv/bin/python manage.py "$@"' \
        _ "$SETTINGS" "$APP" $command >> "$tmp/manage.log" 2>&1 \
        || { install -o "$KEY_USER" -g "$KEY_USER" -m 0600 "$tmp/manage.log" "$LOGS/setup.log"; \
             die "manage.py $command failed: its output is in $LOGS/setup.log (the key user's)"; }
    done
    install -o "$KEY_USER" -g "$KEY_USER" -m 0600 "$tmp/manage.log" "$LOGS/setup.log"
    rm -f -- "$tmp/manage.log"
    serve_script > "$tmp/serve"
    install -o root -g root -m 0755 "$tmp/serve" "$SERVE"
    ok "migrated as $OWNER_ROLE, the Library synced; the launcher is $SERVE (setup output in $LOGS/setup.log)"
  fi

  step "7/7 Prove the walls"
  plan "$OWNER (with every password of ~/.pgpass) cannot reach $DB as vextrus, vextrus_app, $OWNER or postgres," \
    "  over 127.0.0.1, ::1 or the socket; nor sign in as any superuser over 127.0.0.1 or ::1" \
    "the superuser cannot reach $DB either; only $KEY_USER, as $OWNER_ROLE and $APP_ROLE, can" \
    "vextrus and vextrus_app have no CONNECT on $DB" \
    "$OWNER, postgres (the server's user, so no database role through it) and vxrun cannot list or read" \
    "  $INSTANCE, $STORE, $LOGS, $SETTINGS, $JEV_KEY or $KEY_PGPASS" \
    "$OWNER cannot run anything as $KEY_USER without the password"
  if dry; then
    echo
    echo "Dry run done: nothing ran."
    return 0
  fi
  pass=0; fail=0
  check() {
    if eval "$2" >/dev/null 2>&1; then printf '  ok: %s\n' "$1"; pass=$((pass + 1))
    else printf '  FAILED: %s\n' "$1"; fail=$((fail + 1)); fi
  }
  # shellcheck disable=SC2329 # called through check's eval
  owner_psql() { as_owner env PGCONNECT_TIMEOUT=5 psql -X -w "$@" -Atc 'select 1'; }
  for role in vextrus vextrus_app "$OWNER" postgres; do
    for where in "-h $HOST" "-h ::1" "-h /var/run/postgresql"; do
      # shellcheck disable=SC2086 # the host option's two words
      check "$OWNER cannot reach $DB as $role ($where)" "! owner_psql $where -p $PORT -U $role -d $DB"
    done
  done
  for role in $(super_psql -At -c "select rolname from pg_roles where rolsuper"); do
    for where in "-h $HOST" "-h ::1"; do
      # shellcheck disable=SC2086
      check "$OWNER cannot sign in as the superuser $role ($where)" "! owner_psql $where -p $PORT -U $role -d postgres"
    done
  done
  check "the superuser cannot reach $DB" "! as_postgres psql -X -w -p $PORT -d $DB -Atc 'select 1'"
  for role in "$OWNER_ROLE" "$APP_ROLE"; do
    check "$KEY_USER reaches $DB as $role, with its own ~/.pgpass" \
      "[ \"\$(as_key psql -X -w -h $HOST -p $PORT -U $role -d $DB -Atc 'select current_user')\" = $role ]"
  done
  check "vextrus and vextrus_app have no CONNECT on $DB" \
    "[ \"\$(super_psql -At -c \"select has_database_privilege('vextrus', '$DB', 'CONNECT') or has_database_privilege('vextrus_app', '$DB', 'CONNECT')\")\" = f ]"
  readers=("$OWNER" postgres)
  if id vxrun >/dev/null 2>&1; then readers+=(vxrun); fi
  for user in "${readers[@]}"; do
    for path in "$INSTANCE" "$STORE" "$LOGS" "$SETTINGS" "$JEV_KEY" "$KEY_PGPASS"; do
      check "$user cannot list or read $path" \
        "! runuser -u $user -- test -r $path && ! runuser -u $user -- ls $path"
    done
  done
  check "$OWNER cannot run anything as $KEY_USER without the password" "! as_owner sudo -n -u $KEY_USER true"
  printf '\n  %s passed, %s failed.\n' "$pass" "$fail"
  [ "$fail" = 0 ] || { echo "Something above failed; tell Claude which line."; exit 1; }
  echo
  echo "Done. Serve the instance with your password, as the key user:  sudo -u $KEY_USER $SERVE"
  echo "Then open http://$HOST:$WEB_PORT in your browser. Its logs are the key user's, in $LOGS."
}

# Only when run, never when sourced (the tests source this file to call its functions as your user).
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
  exit
fi
