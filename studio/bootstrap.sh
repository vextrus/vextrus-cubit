#!/bin/bash
# Make the Vextrus Studio workspace (studio/README.md): a private, local-only git repo holding the
# prototype from the Managed Agents session, its data, and the studio harness. Run once, on the owner's
# machine, from any checkout or worktree of the product repository.
#
#   studio/bootstrap.sh [<cma tree dir>]      default: the newest .private/work/cma/outputs/sesn_*/tree
#   STUDIO_DIR=~/elsewhere studio/bootstrap.sh
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
main=$(dirname -- "$(git -C "$here" rev-parse --path-format=absolute --git-common-dir)")   # where .private/ lives
studio="${STUDIO_DIR:-$HOME/vextrus-studio}"
die() { echo "bootstrap: $*" >&2; exit 1; }

cma="${1:-$(ls -d "$main"/.private/work/cma/outputs/sesn_*/tree 2>/dev/null | tail -1)}"
[ -n "$cma" ] && [ -d "$cma/private/02-prototype" ] || die "no Managed Agents output at '${cma}' (pass its tree/ folder)"
[ ! -e "$studio" ] || die "$studio exists already; move it aside or set STUDIO_DIR"
[ -d "$main/.private/reference/edison" ] || die "no Edison set at $main/.private/reference/edison"

echo "studio:   $studio"; echo "baseline: $cma"
mkdir -p "$studio/checks" "$studio/outcomes" "$studio/shots/owner"
touch "$studio/checks/.keep" "$studio/shots/owner/.keep"

# The harness
cp "$here/harness/CLAUDE.md" "$here/harness/CHECKPOINT.md" "$here/harness/OWNER-REVIEW.md" "$studio/"
cp -R "$here/harness/claude" "$studio/.claude"
cp "$here/harness/mcp.json" "$studio/.mcp.json"
cp "$here/harness/outcomes/RUBRIC-TEMPLATE.md" "$studio/outcomes/"
mkdir -p "$studio/.claude/mcp"
cp "$main/.claude/mcp/browser.mjs" "$studio/.claude/mcp/"           # the repo's headless Chromium wrapper
cp "$main/.claude/agents/qs-critic.md" "$studio/.claude/agents/"     # the QS critic, unchanged

# The baseline, read-only, and the working copies
mkdir -p "$studio/cma"
cp -R "$cma/." "$studio/cma/"
chmod -R a-w "$studio/cma"
cp -R "$cma/private/02-prototype" "$studio/proto"
cp -R "$cma/private/01-dissect" "$studio/data"
tracked=(CLAUDE.md CHECKPOINT.md OWNER-REVIEW.md .claude .mcp.json .gitignore outcomes checks shots cma proto data)
if [ -d "$cma/public/02-prototype" ]; then cp -R "$cma/public/02-prototype" "$studio/generator"; tracked+=(generator); fi
chmod -R u+w "$studio/proto" "$studio/data"
if [ -d "$studio/generator" ]; then chmod -R u+w "$studio/generator"; fi
ln -s "$main/.private/reference/edison" "$studio/drawings"            # the originals, never edited

cat > "$studio/.gitignore" <<'IGN'
.venv/
node_modules/
__pycache__/
*.pyc
drawings
.claude/settings.local.json
.claude/worktrees/
IGN

# Python for the checks: the toolchain's Python 3.14 (ADR 0034), plus the analysis libraries
if command -v uv >/dev/null; then
  (cd "$studio" && UV_PYTHON_INSTALL_DIR=/opt/vextrus/python uv venv -q .venv --python 3.14 &&
   uv pip install -q --python .venv/bin/python ezdxf==1.4.4 shapely trimesh networkx matplotlib pillow numpy &&
   { uv pip install -q --python .venv/bin/python ifcopenshell || echo "bootstrap: ifcopenshell has no wheel for this Python; IFC checks wait"; }) ||
   echo "bootstrap: venv not made; the first session makes it"
fi

# A private git repo, local only: never add a remote that points at the public repository
git -C "$studio" init -q -b main
git -C "$studio" add -- "${tracked[@]}"
git -C "$studio" -c user.name="Vextrus Studio" -c user.email="studio@localhost" commit -q -m "studio: bootstrap from the Managed Agents session's output"
echo
echo "done: $(git -C "$studio" ls-files | wc -l) files in the studio's first commit. Next:"
echo "  cd $studio && claude"
echo "  then paste the first message from docs/handoff/session-31-prompt.md"
