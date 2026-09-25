#!/bin/bash
# Vextrus cloud environment setup (ADR 0025; docs/research/sdlc-waves-and-cloud.md §6).
# Paste this file's contents into the cloud environment's "Setup script" box on BOTH Claude accounts.
# It runs as root on Ubuntu 24.04 x86_64 before Claude Code starts; its result is cached for about
# 7 days; it must exit 0 and finish in under ~5 minutes. No secrets here: the TypeSafe cloud key is
# an API credential in the environment settings, never a variable or a file (ADR 0013).
# Network: Custom = the default package-manager list + releases.astral.sh, ftp.gnu.org,
# builds.dotnet.microsoft.com, dot.net.
# NOT YET RUN IN A CLOUD VM: the first session on each account runs the checklist in §6.5.
set -uo pipefail
STATUS=/opt/vextrus-setup.status
mkdir -p /opt && : > "$STATUS"
note() { echo "[vextrus-setup] $*"; echo "$*" >> "$STATUS"; }

PY_VERSION=3.13
NODE_MAJOR=24
DOTNET_CHANNEL=10.0
LIBREDWG_VERSION=0.14          # keep equal to toolchain/libredwg.version
LIBREDWG_PREFIX=/opt/libredwg
REPO=vextrus/vextrus-cubit
LIBREDWG_TAG="toolchain-libredwg-${LIBREDWG_VERSION}"
LIBREDWG_ASSET="libredwg-${LIBREDWG_VERSION}-ubuntu24.04-x86_64.tar.gz"
export UV_PYTHON_INSTALL_DIR=/opt/uv-python

install_python() {
  uv python find "$PY_VERSION" >/dev/null 2>&1 && return 0
  uv python install "$PY_VERSION" && return 0
  python3 -m pip install -q --break-system-packages --upgrade uv && uv python install "$PY_VERSION"
}

install_node() {
  local v
  v=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c \
      "import sys,json; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v${NODE_MAJOR}.')))") || return 1
  curl -fsSL "https://nodejs.org/dist/${v}/node-${v}-linux-x64.tar.xz" -o /tmp/node.tar.xz || return 1
  rm -rf "/opt/node${NODE_MAJOR}" && mkdir -p "/opt/node${NODE_MAJOR}" &&
    tar -xJf /tmp/node.tar.xz -C "/opt/node${NODE_MAJOR}" --strip-components=1
}

install_dotnet() {                       # ACadSharp, the second DWG decoder (ADR 0029)
  [ -x /opt/dotnet/dotnet ] && return 0
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh || return 1
  bash /tmp/dotnet-install.sh --channel "$DOTNET_CHANNEL" --install-dir /opt/dotnet --no-path
}

prepare_postgres() {                     # PostgreSQL 16 is preinstalled, not running
  service postgresql start || return 1
  su postgres -c "psql -v ON_ERROR_STOP=1 -q" <<'SQL' || return 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus') THEN
    CREATE ROLE vextrus LOGIN CREATEDB PASSWORD 'vextrus';   -- throwaway, VM-local only
  END IF;
END $$;
SQL
  su postgres -c "createdb -O vextrus vextrus" 2>/dev/null || true
  su postgres -c "psql -q -d vextrus -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm'" || true
  service postgresql stop
}

install_libredwg() {                     # 1st: our release asset; 2nd: build from source
  [ -x "$LIBREDWG_PREFIX/bin/dwg2dxf" ] && return 0
  if gh release download "$LIBREDWG_TAG" -R "$REPO" -p "$LIBREDWG_ASSET" -D /tmp --clobber 2>/dev/null; then
    tar -xzf "/tmp/$LIBREDWG_ASSET" -C / && return 0
  fi
  note "libredwg: release asset unavailable, building from source (may exceed the time budget)"
  cd /tmp && curl -fsSLO "https://ftp.gnu.org/gnu/libredwg/libredwg-${LIBREDWG_VERSION}.tar.xz" &&
    tar -xJf "libredwg-${LIBREDWG_VERSION}.tar.xz" && cd "libredwg-${LIBREDWG_VERSION}" &&
    ./configure -q --prefix="$LIBREDWG_PREFIX" --disable-shared --disable-bindings --disable-docs &&
    make -s -j"$(nproc)" && make -s install
}

install_python   & p1=$!
install_node     & p2=$!
install_dotnet   & p3=$!
prepare_postgres & p4=$!
install_libredwg & p5=$!
if wait $p1; then note "python ${PY_VERSION}: ok"; else note "python ${PY_VERSION}: FAILED"; fi
if wait $p2; then note "node ${NODE_MAJOR}: ok"; else note "node ${NODE_MAJOR}: FAILED"; fi
if wait $p3; then note "dotnet ${DOTNET_CHANNEL}: ok"; else note "dotnet ${DOTNET_CHANNEL}: FAILED"; fi
if wait $p4; then note "postgres: ok"; else note "postgres: FAILED"; fi
if wait $p5; then note "libredwg ${LIBREDWG_VERSION}: ok"; else note "libredwg ${LIBREDWG_VERSION}: FAILED"; fi
exit 0   # never block the session; the SessionStart hook prints the status so failures are visible
