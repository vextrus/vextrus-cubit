#!/bin/bash
# Vextrus cloud environment setup (ADR 0025; the M0 plan, 01c; docs/research/sdlc-waves-and-cloud.md §6).
# Paste this file's contents into the cloud environment's "Setup script" box on BOTH Claude accounts.
# It runs as root on Ubuntu 24.04 x86_64 after the clone and before Claude Code starts; the filesystem
# it leaves is cached for about 7 days and rebuilt when this script or the network list changes; it
# must exit 0 and should finish within five minutes. Every piece is timed into /opt/vextrus-setup.status,
# which scripts/cloud/session-start.sh prints at each session's start. First run in a VM on 28 Sep 2026
# (account B): the clone is /home/user/vextrus-cubit and $CLAUDE_PROJECT_DIR is empty here; the image's
# Launchpad PPAs answer 403, its uv is too old for Python 3.14.7, and it has no `gh` (fixed below).
#
# The layout is the local one (scripts/owner/toolchain.sh), /opt/vextrus/...: python, libredwg, dotnet,
# plus node, ms-playwright (Chromium) and wheels (ezdxf's compiled wheel). The pins below must equal
# toolchain/ (engine/read/tests/test_toolchain.py checks); a pasted script carries its own, so a pin
# change is a re-paste, which also rebuilds the cache. ezdxf's lock, Playwright's version and the
# database roles (scripts/owner/db-roles.sql) are read from the clone.
#
# Network: Custom, "Also include default list of common package managers" ticked, plus:
#   releases.astral.sh  ftp.gnu.org  apt.postgresql.org  builds.dotnet.microsoft.com  dot.net
#   ci.dot.net  cdn.playwright.dev  playwright.download.prss.microsoft.com
# Environment variables (no secrets; the database passwords are throwaways that exist only in the VM):
#   UV_PYTHON_INSTALL_DIR=/opt/vextrus/python
#   UV_PYTHON_PREFERENCE=only-managed
#   DATABASE_URL=postgresql://vextrus_app:vextrus_app@127.0.0.1:5432/vextrus
#   DATABASE_OWNER_URL=postgresql://vextrus:vextrus@127.0.0.1:5432/vextrus
#   TYPESAFE_API_KEY=proxy-injected       (the real key is an API credential, §6.2; ADR 0013)
#   VEXTRUS_RELEASE_TOKEN=...             optional, and not needed: in the VM (28 Sep 2026) the setup
#                                         got 403 from GitHub's API even with it set, while a session
#                                         reaches the release with no token, so session-start fetches
#                                         ezdxf's compiled wheel. Without the release, LibreDWG builds
#                                         from source here (about 235 s of the 300 s budget).
# shellcheck disable=SC2329  # the install_* functions are called by name, through timed()
set -uo pipefail

PY_VERSION=3.14.7
UV_VERSION=0.12.5                           # the image's uv predates 3.14.7; this one, from PyPI, knows it
NODE_MAJOR=24
DOTNET_SDK_VERSION=10.0.401
LIBREDWG_VERSION=0.14
LIBREDWG_SHA256=62ebb73b984f865960f20ed26619ea5f8789d5e3fd088fa40a2598384da81275
REPO=vextrus/vextrus-cubit
V=/opt/vextrus
STATUS=/opt/vextrus-setup.status
export UV_PYTHON_INSTALL_DIR=$V/python PLAYWRIGHT_BROWSERS_PATH=$V/ms-playwright
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DEBIAN_FRONTEND=noninteractive

mkdir -p "$V/wheels" && : > "$STATUS" && : > "$STATUS.parts"
T0=$(date +%s)
# Parallel installs share apt's lock: each apt call waits for it rather than failing.
echo 'DPkg::Lock::Timeout "240";' > /etc/apt/apt.conf.d/90vextrus-lock-wait
# That lock covers dpkg only, not apt's downloads and temporary files: in the second VM run a concurrent
# apt (Playwright's --with-deps) removed the .debs PostgreSQL's install was unpacking. So every apt use
# also holds this one lock, taken with flock.
APT_LOCK=/run/vextrus-apt.lock
# The image lists Launchpad PPAs (deadsnakes, ondrej/php) that the network policy answers with 403, which
# makes every `apt-get update` fail; nothing here needs them, so they are set aside before any install.
mkdir -p /etc/apt/sources.list.d.vextrus-disabled
for f in /etc/apt/sources.list.d/*; do
  if [ -f "$f" ] && grep -qE 'ppa\.launchpad(content)?\.net' "$f"; then
    mv "$f" /etc/apt/sources.list.d.vextrus-disabled/ && echo "apt: set aside $(basename "$f") (403)" >> "$STATUS"
  fi
done

timed() {                                   # timed NAME: runs install_NAME, records ok/FAILED and seconds
  local t r
  t=$(date +%s)
  if "install_$1" > "$V/setup-$1.log" 2>&1; then r=ok; else r=FAILED; fi
  echo "$1: $r ($(( $(date +%s) - t ))s; log $V/setup-$1.log)" >> "$STATUS.parts"
}

# The clone, for db-roles.sql, ezdxf's lock and web/'s Playwright pin. Where the VM clones it is not
# documented (research §8), so look where it could be.
CHECKOUT=
for dir in "${CLAUDE_PROJECT_DIR:-}" "$PWD" /home/*/* /root/* /workspace/* /code/* /repo/*; do
  [ -n "$dir" ] && [ -f "$dir/scripts/owner/db-roles.sql" ] && [ -d "$dir/toolchain" ] && { CHECKOUT=$dir; break; }
done

release_asset() {                           # release_asset TAG FILE DEST: our private release, read-only
  # Through GitHub's API with curl (the image has no `gh`), with the read-only token when one is set;
  # without one the request may still pass the session's GitHub proxy, or fail and the caller falls back.
  local auth=() id
  [ -n "${VEXTRUS_RELEASE_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $VEXTRUS_RELEASE_TOKEN")
  id=$(curl -fsSL "${auth[@]}" "https://api.github.com/repos/$REPO/releases/tags/$1" |
       python3 -c "import json,sys; print(next(a['id'] for a in json.load(sys.stdin)['assets'] if a['name'] == sys.argv[1]))" "$2" 2>/dev/null) ||
    return 1
  curl -fsSL "${auth[@]}" -H 'Accept: application/octet-stream' -o "$3/$2" \
    "https://api.github.com/repos/$REPO/releases/assets/$id"
}

install_python() {                          # a pinned uv of our own under $V/uv, first on PATH (session-start)
  python3 -m pip install -q --break-system-packages --target "$V/uv" "uv==$UV_VERSION" || return 1  # --target: $V/uv/bin/uv (Debian bends --prefix into local/)
  "$V/uv/bin/uv" python install --no-bin "$PY_VERSION"
}

install_node() {                            # Node 24, then Chromium through Playwright's own installer
  local v pw                                #   (Ubuntu 24.04's apt Chromium is a snap wrapper)
  v=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c \
      "import sys,json; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v${NODE_MAJOR}.')))") || return 1
  curl -fsSL "https://nodejs.org/dist/${v}/node-${v}-linux-x64.tar.xz" -o /tmp/node.tar.xz || return 1
  mkdir -p "$V/node" && tar -xJf /tmp/node.tar.xz -C "$V/node" --strip-components=1 --no-same-owner || return 1
  [ -n "$CHECKOUT" ] && [ -f "$CHECKOUT/web/package.json" ] || { echo "no web/package.json: no Playwright pin"; return 1; }
  pw=$("$V/node/bin/node" -p "const p = require('$CHECKOUT/web/package.json');
    const d = {...p.dependencies, ...p.devDependencies}; d['@playwright/test'] || d.playwright || ''")
  [[ $pw =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Playwright is not pinned exactly in web/package.json: '$pw'"; return 1; }
  flock "$APT_LOCK" env PATH="$V/node/bin:$PATH" npx -y "playwright@$pw" install --with-deps chromium
}

install_dotnet() {                          # ACadSharp, the second DWG decoder (ADR 0029)
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh || return 1
  bash /tmp/dotnet-install.sh --version "$DOTNET_SDK_VERSION" --install-dir "$V/dotnet" --no-path
}

install_libredwg() {                        # 1st: our release asset, by its sha256; 2nd: GNU's source
  local asset="libredwg-$LIBREDWG_VERSION-ubuntu24.04-x86_64.tar.gz" tag="toolchain-libredwg-$LIBREDWG_VERSION"
  if release_asset "$tag" "$asset" /tmp && release_asset "$tag" "$asset.sha256" /tmp &&
     (cd /tmp && sha256sum -c "$asset.sha256") && tar -xzf "/tmp/$asset" -C / --no-same-owner opt/vextrus/libredwg; then
    return 0
  fi
  echo "release asset unavailable: building from GNU's source"
  cd /tmp && curl -fsSLO "https://ftp.gnu.org/gnu/libredwg/libredwg-$LIBREDWG_VERSION.tar.xz" || return 1
  echo "$LIBREDWG_SHA256  libredwg-$LIBREDWG_VERSION.tar.xz" | sha256sum -c - || return 1
  tar -xJf "libredwg-$LIBREDWG_VERSION.tar.xz" --no-same-owner && cd "libredwg-$LIBREDWG_VERSION" &&
    ./configure -q --prefix="$V/libredwg" --disable-shared --disable-bindings --disable-docs &&
    make -s -j"$(nproc)" && make -s install
}

install_ezdxf() {                           # the compiled wheel by the hash toolchain/ezdxf.lock pins
  local lock wheel sha release
  [ -n "$CHECKOUT" ] || { echo "no clone found for toolchain/ezdxf.lock"; return 1; }
  lock=$(python3 -c "import tomllib,sys; l = tomllib.load(open(sys.argv[1], 'rb'));
print(l['wheel'], l['wheel_sha256'], l['release'])" "$CHECKOUT/toolchain/ezdxf.lock") || return 1
  read -r wheel sha release <<< "$lock"
  [ "$wheel" != "${wheel%-py3-none-any.whl}" ] && { echo "the lock names the pure wheel, which uv.lock installs"; return 0; }
  if release_asset "$release" "$wheel" "$V/wheels"; then
    echo "$sha  $V/wheels/$wheel" | sha256sum -c -        # a download that fails its hash is a failure
  else                                      # no access to the release: the pure wheel runs, slower
    rm -f "$V/wheels/$wheel"
    echo "ezdxf: NOTE not reachable from the setup; session-start fetches the compiled wheel" >> "$STATUS.parts"
  fi
}

install_postgres() {                        # 18 from apt.postgresql.org; 16's cluster dropped so 18 takes 5432
  curl -fsSL https://apt.postgresql.org/pub/repos/apt/ACCC4CF8.asc |
    gpg --dearmor --yes -o /usr/share/keyrings/pgdg.gpg || return 1
  printf 'Types: deb\nURIs: https://apt.postgresql.org/pub/repos/apt\nSuites: noble-pgdg\nComponents: main\nArchitectures: amd64\nSigned-By: /usr/share/keyrings/pgdg.gpg\n' \
    > /etc/apt/sources.list.d/pgdg.sources
  service postgresql stop || true
  pg_lsclusters -h | awk '$1 == "16" {print $2}' | while read -r c; do pg_dropcluster 16 "$c"; done
  flock "$APT_LOCK" sh -c 'apt-get update -qq && apt-get install -y -qq postgresql-18 bubblewrap' || return 1
  pg_ctlcluster 18 main start 2>/dev/null   # the package may have started it already
  for _ in $(seq 20); do pg_isready -q -h 127.0.0.1 -p 5432 && break; sleep 1; done
  pg_isready -q -h 127.0.0.1 -p 5432 || return 1
  prepare_postgres; local r=$?
  pg_ctlcluster 18 main stop                # the cache keeps files, not processes
  return "$r"
}

prepare_postgres() {                        # the roles exactly as db-roles.sql makes them (review A2)
  [ -n "$CHECKOUT" ] || { echo "no clone found for scripts/owner/db-roles.sql"; return 1; }
  su postgres -c "psql -q -d postgres" < "$CHECKOUT/scripts/owner/db-roles.sql" || return 1
  # Throwaway passwords, known to the environment's variables and valid only inside this VM.
  su postgres -c "psql -v ON_ERROR_STOP=1 -q -d postgres" <<'SQL'
ALTER ROLE vextrus PASSWORD 'vextrus';
ALTER ROLE vextrus_app PASSWORD 'vextrus_app';
SQL
}

echo "clone: ${CHECKOUT:-NOT FOUND}" >> "$STATUS"
for piece in python node dotnet libredwg ezdxf postgres; do timed "$piece" & done
wait
chown -R root:root "$V" && chmod -R a+rX,go-w "$V"
cat "$STATUS.parts" >> "$STATUS"
echo "total: $(( $(date +%s) - T0 ))s (budget 300s)" >> "$STATUS"
cat "$STATUS"
exit 0   # never block the session; session-start.sh prints the status, so a failure is seen
