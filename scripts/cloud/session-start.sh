#!/bin/bash
# Per-session start in cloud VMs only (docs/research/sdlc-waves-and-cloud.md §6.4); local sessions
# exit at once. Puts the toolchain on PATH, starts Postgres, fetches LibreDWG if the setup script
# could not, and prints the setup status so a failed install is never hidden.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
{ echo 'export PATH=/opt/node24/bin:/opt/libredwg/bin:/opt/dotnet:$PATH'
  echo 'export DOTNET_ROOT=/opt/dotnet'
  echo 'export UV_PYTHON_INSTALL_DIR=/opt/uv-python'; } >> "$CLAUDE_ENV_FILE"
service postgresql start >/dev/null 2>&1 || echo "WARN: postgres did not start"
V=$(tr -d '[:space:]' < "$CLAUDE_PROJECT_DIR/toolchain/libredwg.version" 2>/dev/null || echo 0.14)
if [ ! -x /opt/libredwg/bin/dwg2dxf ]; then
  gh release download "toolchain-libredwg-$V" -R vextrus/vextrus-cubit \
     -p "libredwg-$V-ubuntu24.04-x86_64.tar.gz" -D /tmp --clobber &&
  tar -xzf "/tmp/libredwg-$V-ubuntu24.04-x86_64.tar.gz" -C / || echo "WARN: LibreDWG missing"
fi
cd "$CLAUDE_PROJECT_DIR" && [ -f uv.lock ] && uv sync --frozen -q || true
cat /opt/vextrus-setup.status 2>/dev/null
exit 0
