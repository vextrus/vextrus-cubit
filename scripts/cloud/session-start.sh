#!/bin/bash
# Per-session start in cloud VMs only (docs/research/sdlc-waves-and-cloud.md §6.4; the M0 plan, 01c);
# local sessions exit at once. Puts the toolchain setup.sh left under /opt/vextrus on PATH, starts
# PostgreSQL 18, fetches LibreDWG if the setup could not, installs the dependencies and ezdxf's wheel
# by its pinned hash, says where the installed toolchain differs from toolchain/'s pins, and prints the
# setup's status, so a failed install is never hidden. It never blocks a session. First run in a VM
# on 28 Sep 2026; since then it uses setup.sh's own uv under /opt/vextrus/uv, never the image's.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
V=/opt/vextrus
cd "$CLAUDE_PROJECT_DIR" || exit 0
pin() { tr -d '[:space:]' < "toolchain/$1" 2>/dev/null; }
warn() { echo "WARN: $*"; }

{ echo "export PATH=$V/uv/bin:$V/node/bin:$V/libredwg/bin:$V/dotnet:\$PATH"
  echo "export DOTNET_ROOT=$V/dotnet DOTNET_CLI_TELEMETRY_OPTOUT=1"
  echo "export UV_PYTHON_INSTALL_DIR=$V/python UV_PYTHON_PREFERENCE=only-managed"
  echo "export PLAYWRIGHT_BROWSERS_PATH=$V/ms-playwright"; } >> "$CLAUDE_ENV_FILE"
export UV_PYTHON_INSTALL_DIR=$V/python UV_PYTHON_PREFERENCE=only-managed
export PATH=$V/uv/bin:$PATH                      # setup.sh's uv, never the image's older one

pg_ctlcluster 18 main start >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 ||
  warn "PostgreSQL 18 did not start"

LIBREDWG=$(pin libredwg.version)
if [ ! -x "$V/libredwg/bin/dwgread" ]; then     # the GitHub proxy is live by now
  asset="libredwg-$LIBREDWG-ubuntu24.04-x86_64.tar.gz"
  tmp=$(mktemp -d)
  if ! { command -v gh >/dev/null &&         # the image has no gh: setup.sh's source build is the path
         gh release download "toolchain-libredwg-$LIBREDWG" -R vextrus/vextrus-cubit -p "$asset" -p "$asset.sha256" -D "$tmp" &&
         (cd "$tmp" && sha256sum -c --quiet "$asset.sha256") &&
         tar -xzf "$tmp/$asset" -C / --no-same-owner opt/vextrus/libredwg; }; then
    warn "LibreDWG missing"
  fi
fi

uv sync --locked -q || warn "uv sync failed"
read -r wheel sha release < <(python3 -c "import tomllib; l = tomllib.load(open('toolchain/ezdxf.lock', 'rb'));
print(l['wheel'], l['wheel_sha256'], l['release'])")
have_wheel() { echo "$sha  $V/wheels/$wheel" | sha256sum -c --quiet - 2>/dev/null; }
if [ "$wheel" = "${wheel%-py3-none-any.whl}" ]; then    # the lock pins the compiled wheel
  if ! have_wheel; then
    # The setup could not reach the private release (no token). By now the session's GitHub proxy is
    # live and may authorise this attached repository: try once through the API; the hash decides.
    api=https://api.github.com/repos/vextrus/vextrus-cubit/releases
    id=$(curl -fsSL "$api/tags/$release" 2>/dev/null | python3 -c "import json,sys;
print(next(a['id'] for a in json.load(sys.stdin)['assets'] if a['name'] == sys.argv[1]))" "$wheel" 2>/dev/null) &&
      curl -fsSL -H 'Accept: application/octet-stream' -o "$V/wheels/$wheel" "$api/assets/$id" 2>/dev/null
  fi
  if have_wheel; then
    # A later `uv run` that syncs may put the pure wheel back: the same code, slower.
    uv pip install -q --no-deps --reinstall "$V/wheels/$wheel" || warn "ezdxf's wheel did not install"
  else
    warn "ezdxf's compiled wheel $wheel is unreachable: the pure wheel runs (slower); see setup.sh's VEXTRUS_RELEASE_TOKEN"
  fi
fi

# Drift: a pin changed in toolchain/ but the cached setup predates it. Re-saving the setup script
# (with the new pins) rebuilds the cache.
[ "$("$V/libredwg/bin/dwgread" --version 2>/dev/null)" = "dwgread $LIBREDWG" ] ||
  warn "dwgread is not LibreDWG $LIBREDWG"
"$V/dotnet/dotnet" --list-sdks 2>/dev/null | grep -q "^$(pin dotnet.version) " ||
  warn ".NET SDK $(pin dotnet.version) is not installed"
uv python find "$(pin python.version)" >/dev/null 2>&1 ||   # only-managed is exported above; uv refuses
                                                             # --managed-python beside it
  warn "Python $(pin python.version) is not installed"

cat /opt/vextrus-setup.status 2>/dev/null || warn "no setup status: the setup script did not run"
exit 0
