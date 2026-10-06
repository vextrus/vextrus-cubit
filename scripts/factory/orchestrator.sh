#!/usr/bin/env bash
# The orchestrator's start (docs/specs/factory.md 2.2 "Start"):
#
#   scripts/factory/orchestrator.sh [claude arguments...]      e.g. --resume <session id>
#
# Refuses while $VEXTRUS_FACTORY_DIR/g1.pid or rd.pid names a live G1 walk or real-drawing run that a
# restart would orphan (watch.pid never blocks). Drops CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC and
# DISABLE_GROWTHBOOK (either turns Remote Control off). Ensures the watcher (a failure only warns), then
# execs
#   claude --model claude-opus-5-5 --settings <repo>/scripts/factory/orchestrator.settings.json
#          [--plugin-dir <repo>/tools/mod/vextrus-factory] "$@"
# with VEXTRUS_ROLE=orchestrator and CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS=8. <repo> is this
# script's own repository, whatever the cwd; --plugin-dir is dropped while
# $VEXTRUS_FACTORY_DIR/mod-disabled exists. VEXTRUS_FACTORY_DIR defaults to
# <main checkout>/.private/work/factory. Exit 3 when refused.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
common="$(git -C "$root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
main="${common:+$(dirname "$common")}"
factory="${VEXTRUS_FACTORY_DIR:-${main:-$root}/.private/work/factory}"

for name in g1.pid rd.pid; do
  file="$factory/$name"
  [[ -f "$file" ]] || continue
  pid=""
  read -r pid < "$file" || true
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2> /dev/null && [[ -d "/proc/$pid" ]]; then
    echo "orchestrator.sh: refused: $file names live pid $pid; a restart now would orphan that run." >&2
    echo "Wait for it to finish (or stop it yourself), then start again." >&2
    exit 3
  fi
done

unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC DISABLE_GROWTHBOOK

if ! (cd "$root" && uv run --no-sync python -m scripts.factory.watch ensure); then
  echo "orchestrator.sh: warning: the watcher could not be ensured; the band will say WATCHER DOWN." >&2
fi

args=(--model claude-opus-5-5 --effort medium --settings "$root/scripts/factory/orchestrator.settings.json")
if [[ ! -e "$factory/mod-disabled" ]]; then
  args+=(--plugin-dir "$root/tools/mod/vextrus-factory")
fi
exec env VEXTRUS_ROLE=orchestrator CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS=8 claude "${args[@]}" "$@"
