#!/usr/bin/env bash
# Installs the build's toolchain outside every home, under /opt/vextrus (the M0 plan, "Before wave 0",
# item 2; s02 reviews A3, R5; docs/architecture.md). The real-drawing check's sandbox binds
# /opt/vextrus read-only, so nothing it runs may live under a home.
#
#   /opt/vextrus/python    Python 3.14 (uv's managed build)
#   /opt/vextrus/libredwg  LibreDWG at its pin, built static from GNU's signed source
#   /opt/vextrus/dotnet    the .NET 10 SDK (ACadSharp, the second decoder; ADR 0029)
#
# Run by the owner, as root:   ! sudo bash scripts/owner/toolchain.sh
# Idempotent: a piece already at its pin is kept. Owned by root, readable by all, writable by none.
# Ticket 01c takes this script over and moves the LibreDWG pin into toolchain/libredwg.version.
set -euo pipefail

PREFIX=${VEXTRUS_TOOLCHAIN_PREFIX:-/opt/vextrus}   # overridable only to test this script
PY_VERSION=3.14.7
LIBREDWG_VERSION=0.14
# GNU's tarball, checked on 28 Sep 2026 against libredwg-0.14.tar.xz.sig ("Good signature from
# <reini.urban@gmail.com>", RSA key 38A4167B0DB69E49C5F7216CB8C28866AB27A7A2, gnu-keyring.gpg).
LIBREDWG_SHA256=62ebb73b984f865960f20ed26619ea5f8789d5e3fd088fa40a2598384da81275
DOTNET_SDK_VERSION=10.0.401   # latest .NET 10 SDK on 8 Sep 2026 (release-metadata/10.0/releases.json)

say()  { printf '[toolchain] %s\n' "$*"; }
fail() { printf '[toolchain] FAILED: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run as root: sudo bash scripts/owner/toolchain.sh"
OWNER_USER=${SUDO_USER:-}
[ -n "$OWNER_USER" ] && [ "$OWNER_USER" != root ] || fail "run through sudo from the owner's account"
OWNER_HOME=$(getent passwd "$OWNER_USER" | cut -d: -f6)

WORK=$(mktemp -d /tmp/vextrus-toolchain.XXXXXX)   # left in place; /tmp clears at reboot
mkdir -p "$PREFIX"

install_python() {
  local uv
  uv=$(command -v uv || true)
  [ -n "$uv" ] || uv="$OWNER_HOME/.local/bin/uv"
  [ -x "$uv" ] || fail "uv not found (looked on PATH and in $OWNER_HOME/.local/bin)"
  if UV_PYTHON_INSTALL_DIR="$PREFIX/python" "$uv" python find --managed-python "$PY_VERSION" >/dev/null 2>&1; then
    say "python $PY_VERSION: already installed"; return
  fi
  say "python $PY_VERSION: installing"
  UV_PYTHON_INSTALL_DIR="$PREFIX/python" UV_CACHE_DIR="$WORK/uv-cache" \
    "$uv" python install --no-bin "$PY_VERSION"
}

install_libredwg() {
  local dest="$PREFIX/libredwg"
  if [ -x "$dest/bin/dwgread" ] && "$dest/bin/dwgread" --version 2>&1 | grep -q " $LIBREDWG_VERSION\$"; then
    say "libredwg $LIBREDWG_VERSION: already installed"; return
  fi
  command -v gcc >/dev/null && command -v make >/dev/null ||
    { say "installing build-essential"; apt-get update -qq && apt-get install -y -qq build-essential; }
  say "libredwg $LIBREDWG_VERSION: downloading and checking the source"
  local tarball="$WORK/libredwg-$LIBREDWG_VERSION.tar.xz"
  curl -fsSL "https://ftp.gnu.org/gnu/libredwg/libredwg-$LIBREDWG_VERSION.tar.xz" -o "$tarball"
  echo "$LIBREDWG_SHA256  $tarball" | sha256sum -c --quiet - || fail "libredwg tarball hash differs from the pin"
  tar -xJf "$tarball" -C "$WORK" --no-same-owner
  say "libredwg $LIBREDWG_VERSION: building (about two minutes)"
  ( cd "$WORK/libredwg-$LIBREDWG_VERSION" &&
    ./configure -q --prefix="$dest" --disable-shared --disable-bindings --disable-docs &&
    make -s -j"$(nproc)" && make -s install ) > "$WORK/libredwg-build.log" 2>&1 ||
    { tail -30 "$WORK/libredwg-build.log" >&2; fail "libredwg build (log: $WORK/libredwg-build.log)"; }
}

install_dotnet() {
  local dest="$PREFIX/dotnet"
  if [ -x "$dest/dotnet" ] && "$dest/dotnet" --list-sdks 2>/dev/null | grep -q "^$DOTNET_SDK_VERSION "; then
    say ".NET SDK $DOTNET_SDK_VERSION: already installed"; return
  fi
  say ".NET SDK $DOTNET_SDK_VERSION: installing"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o "$WORK/dotnet-install.sh"
  DOTNET_CLI_TELEMETRY_OPTOUT=1 bash "$WORK/dotnet-install.sh" \
    --version "$DOTNET_SDK_VERSION" --install-dir "$dest" --no-path > /dev/null
}

install_python
install_libredwg
install_dotnet

chown -R root:root "$PREFIX"
chmod -R a+rX,go-w "$PREFIX"

say "installed:"
py=$(UV_PYTHON_INSTALL_DIR="$PREFIX/python" "$(command -v uv || echo "$OWNER_HOME/.local/bin/uv")" \
     python find --managed-python "$PY_VERSION")
printf '  %-10s %s (%s)\n' python "$("$py" --version 2>&1)" "$py"
printf '  %-10s %s\n' libredwg "$("$PREFIX/libredwg/bin/dwgread" --version 2>&1 | head -1)"
printf '  %-10s %s\n' dotnet "$(DOTNET_CLI_TELEMETRY_OPTOUT=1 "$PREFIX/dotnet/dotnet" --list-sdks | tr '\n' ' ')"
cat <<EOF

Add these lines to $OWNER_HOME/.bashrc (this script does not edit it), then open a new shell:
  export UV_PYTHON_INSTALL_DIR=$PREFIX/python
  export DOTNET_ROOT=$PREFIX/dotnet
  export PATH=$PREFIX/libredwg/bin:$PREFIX/dotnet:\$PATH
The last line puts LibreDWG $LIBREDWG_VERSION ahead of the 0.13.3 in ~/.local/bin, which the research rejects
(docs/research/2d-to-bim-prototype-lessons.md).
EOF
