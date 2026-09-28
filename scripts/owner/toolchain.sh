#!/usr/bin/env bash
# Installs the build's toolchain outside every home, under /opt/vextrus (the M0 plan, "Before wave 0",
# item 2; s02 reviews A3, R5; docs/architecture.md). The real-drawing check's sandbox binds
# /opt/vextrus read-only, so nothing it runs may live under a home.
#
#   /opt/vextrus/python    Python 3.14 (uv's managed build)
#   /opt/vextrus/libredwg  LibreDWG at its pin, built static from GNU's signed source
#   /opt/vextrus/dotnet    the .NET 10 SDK (ACadSharp, the second decoder; ADR 0029)
#   /opt/vextrus/acadsharp-dump  the ACadSharp dumper (ticket 10): built here from tools/acadsharp-dump/
#                          with that SDK, and installed only when its sha256 is the pin, beside
#                          the licences and notices of what is built into it
#
# Run by the owner, as root:   ! sudo bash scripts/owner/toolchain.sh
# Idempotent: a piece already at its pin is kept. Owned by root, readable by all, writable by none.
# The pins live in toolchain/ (ticket 01c), which engine.yml and the cloud's session start read too:
#   python.version    3.14.7
#   libredwg.version  0.14, and libredwg.sha256, GNU's tarball, checked on 28 Sep 2026 against
#                     libredwg-0.14.tar.xz.sig ("Good signature from <reini.urban@gmail.com>", RSA key
#                     38A4167B0DB69E49C5F7216CB8C28866AB27A7A2, gnu-keyring.gpg)
#   dotnet.version    10.0.401, the latest .NET 10 SDK on 8 Sep 2026 (release-metadata/10.0/releases.json)
#   acadsharp-dump.sha256  the dumper's own sha256: its build is reproducible (the same source, SDK and
#                     hash-locked packages give the same bytes), so a build here that differs from
#                     the pin is refused, never installed
set -euo pipefail

PREFIX=${VEXTRUS_TOOLCHAIN_PREFIX:-/opt/vextrus}   # overridable only to test this script
PINS=$(cd "$(dirname "$0")/../../toolchain" && pwd)
pin() { tr -d '[:space:]' < "$PINS/$1"; }
PY_VERSION=$(pin python.version)
LIBREDWG_VERSION=$(pin libredwg.version)
DOTNET_SDK_VERSION=$(pin dotnet.version)

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
  (cd "$WORK" && sha256sum -c --quiet "$PINS/libredwg.sha256") || fail "libredwg tarball hash differs from the pin"
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

install_acadsharp_dump() {
  local dest="$PREFIX/acadsharp-dump" pinned
  pinned=$(cut -d' ' -f1 "$PINS/acadsharp-dump.sha256")
  if [ -f "$dest/acadsharp-dump" ] && [ "$(sha256sum "$dest/acadsharp-dump" | cut -d' ' -f1)" = "$pinned" ]; then
    say "acadsharp-dump: already installed at its pin"; return
  fi
  say "acadsharp-dump: building from tools/acadsharp-dump/ (packages restored by the hashes its lock pins)"
  # Built in a folder of its own under $PREFIX, whose parents only root can write, never under /tmp:
  # MSBuild reads Directory.Build.* files from every folder above the project, so a file planted in a
  # folder anyone can write would run code in this root build. Those imports and MSBuild's response
  # files are turned off as well. The folder is deleted once the dumper is installed or refused.
  local build source out built runtime
  build=$(mktemp -d "$PREFIX/.acadsharp-dump-build.XXXXXX")
  source="$build/src"
  out="$build/out"
  mkdir -p "$source"
  cp "$PINS/../tools/acadsharp-dump/acadsharp-dump.csproj" "$PINS/../tools/acadsharp-dump/Program.cs" \
     "$PINS/../tools/acadsharp-dump/packages.lock.json" "$PINS/../tools/acadsharp-dump/global.json" \
     "$source/"
  if ! ( cd "$source" && DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_CLI_HOME="$build/home" \
         NUGET_PACKAGES="$build/nuget" "$PREFIX/dotnet/dotnet" publish "$source" -c Release -o "$out" \
         -noAutoResponse -p:ImportDirectoryBuildProps=false -p:ImportDirectoryBuildTargets=false \
         -p:ImportDirectoryPackagesProps=false ) > "$WORK/acadsharp-dump-build.log" 2>&1; then
    tail -30 "$WORK/acadsharp-dump-build.log" >&2
    rm -rf -- "$build"
    fail "acadsharp-dump build (log: $WORK/acadsharp-dump-build.log)"
  fi
  built=$(sha256sum "$out/acadsharp-dump" | cut -d' ' -f1)
  if [ "$built" != "$pinned" ]; then
    rm -rf -- "$build"
    fail "acadsharp-dump built as $built, not the pin $pinned: not installed (the build is not reproducible here; tell the session that pinned it)"
  fi
  # Every copy carries its notices: ACadSharp's MIT licence, and the .NET runtime's licence and its
  # third-party notices (MIT, BSD, zlib, Apache-2.0, Unicode), from the runtime pack built into it.
  runtime=$(echo "$build"/nuget/microsoft.netcore.app.runtime.linux-x64/*)
  install -d -m 0755 "$dest"
  install -m 0644 "$PINS/../tools/acadsharp-dump/ACADSHARP-LICENSE.txt" "$dest/ACADSHARP-LICENSE.txt"
  install -m 0644 "$runtime/LICENSE.TXT" "$dest/DOTNET-LICENSE.TXT"
  install -m 0644 "$runtime/THIRD-PARTY-NOTICES.TXT" "$dest/DOTNET-THIRD-PARTY-NOTICES.TXT"
  install -m 0755 "$out/acadsharp-dump" "$dest/acadsharp-dump"
  rm -rf -- "$build"
}

install_python
install_libredwg
install_dotnet
install_acadsharp_dump

chown -R root:root "$PREFIX"
chmod -R a+rX,go-w "$PREFIX"

say "installed:"
py=$(UV_PYTHON_INSTALL_DIR="$PREFIX/python" "$(command -v uv || echo "$OWNER_HOME/.local/bin/uv")" \
     python find --managed-python "$PY_VERSION")
printf '  %-10s %s (%s)\n' python "$("$py" --version 2>&1)" "$py"
printf '  %-10s %s\n' libredwg "$("$PREFIX/libredwg/bin/dwgread" --version 2>&1 | head -1)"
printf '  %-10s %s\n' dotnet "$(DOTNET_CLI_TELEMETRY_OPTOUT=1 "$PREFIX/dotnet/dotnet" --list-sdks | tr '\n' ' ')"
printf '  %-10s %s\n' acadsharp "$(sha256sum "$PREFIX/acadsharp-dump/acadsharp-dump" | cut -d' ' -f1) (the pin)"
cat <<EOF

Add these lines to $OWNER_HOME/.bashrc (this script does not edit it), then open a new shell:
  export UV_PYTHON_INSTALL_DIR=$PREFIX/python
  export DOTNET_ROOT=$PREFIX/dotnet
  export PATH=$PREFIX/libredwg/bin:$PREFIX/dotnet:\$PATH
The last line puts LibreDWG $LIBREDWG_VERSION ahead of the 0.13.3 in ~/.local/bin, which the research rejects
(docs/research/2d-to-bim-prototype-lessons.md).
EOF
