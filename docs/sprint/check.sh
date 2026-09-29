#!/usr/bin/env bash
# The one gate before landing: what CI runs, run here, on the parts the change touched.
# $1: the sprint commit this change is landing on. Output goes to a log; only failures are shown.
set -uo pipefail
base=${1:-sprint}
log=.private/work/sprint/check.log
mkdir -p "$(dirname "$log")"; : > "$log"
changed=$(git diff --name-only "$base" HEAD)
py=$(grep -vE '^(web/|docs/)' <<<"$changed" || true)
web=$(grep -E '^web/' <<<"$changed" || true)
fail=0
run() { echo "== $*" >>"$log"; "$@" >>"$log" 2>&1 || { echo "FAILED: $*" | tee -a "$log"; fail=1; }; }
if [ -n "$py" ]; then
  run uv run ruff check .
  run uv run ruff format --check .
  for s in market_literals migration_ids migration_leaves lock_sources; do run uv run python -m tools.lint.$s; done
  run uv run manage.py makemigrations --check --dry-run
  run uv run mypy
  run uv run lint-imports
  run uv run pytest -q -p no:cacheprovider
fi
if [ -n "$web" ]; then
  for s in typecheck lint messages:check test build; do run npm --prefix web run --silent "$s"; done
fi
if [ "$fail" = 1 ]; then
  grep -nE 'FAILED|Error|error:|failed|✗|×' "$log" | head -60
  exit 1
fi
echo "check: passed ($( [ -n "$py" ] && echo python ) $( [ -n "$web" ] && echo web ))"
