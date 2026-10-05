#!/usr/bin/env bash
# The owner's disk cleanup (docs/specs/factory.md 3.13; owner action O7: when the band shows disk under
# 40 GB). Run it yourself, at a terminal:
#
#   scripts/owner/clean.sh          dry run: lists each candidate with its size, and the test databases
#   scripts/owner/clean.sh --yes    deletes the listed candidates after you confirm at the terminal
#
# Candidates are the entries directly under each root of VEXTRUS_CLEAN_ROOTS (colon-separated folders;
# default: <main checkout>/.claude/worktrees, the builders' worktrees). A registered git worktree is
# removed with `git worktree remove --force`, anything else is deleted. --yes is refused when standard
# input is not a terminal or VEXTRUS_ROLE is set: an agent can never use this script to get round the
# guard's refusal of recursive deletes. Databases are only listed (vextrus* names, through psql); this
# script never removes one. Exit 0 done, 2 refused, 64 usage.
set -euo pipefail

usage() { sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

yes=0
case "${1:-}" in
  "") ;;
  --yes) yes=1 ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac

if ((yes)); then
  if [[ -n "${VEXTRUS_ROLE:-}" ]]; then
    echo "clean.sh: refused: VEXTRUS_ROLE is set (${VEXTRUS_ROLE}); only the owner deletes, by hand." >&2
    exit 2
  fi
  if [[ ! -t 0 ]]; then
    echo "clean.sh: refused: --yes needs the owner at a terminal (standard input is not one)." >&2
    exit 2
  fi
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
common="$(git -C "$here" rev-parse --path-format=absolute --git-common-dir 2> /dev/null || true)"
main="${common:+$(dirname "$common")}"
main="${main:-$here}"
IFS=: read -r -a roots <<< "${VEXTRUS_CLEAN_ROOTS:-$main/.claude/worktrees}"

candidates=()
echo "Candidates (size, path):"
for root in "${roots[@]}"; do
  [[ -n "$root" && -d "$root" ]] || continue
  while IFS= read -r -d '' entry; do
    candidates+=("$entry")
    size="$(du -sh -- "$entry" 2> /dev/null | cut -f1)"
    printf '  %8s  %s\n' "${size:-?}" "$entry"
  done < <(find "$root" -mindepth 1 -maxdepth 1 -print0 | sort -z)
done
echo "  (${#candidates[@]} candidates)"

echo "Databases (listed only; this script never removes one):"
if ! command -v psql > /dev/null 2>&1; then
  echo "  psql unavailable: not on PATH"
elif ! names="$(psql -w -h 127.0.0.1 -U vextrus -d postgres -At \
  -c "select datname from pg_database where datname like 'vextrus%' order by 1" 2>&1 < /dev/null)"; then
  echo "  psql unavailable: $(printf '%s\n' "$names" | sed -n 1p)"
else
  printf '%s\n' "$names" | sed 's/^/  /'
fi

if ((!yes)); then
  echo "Dry run: nothing deleted. Run with --yes at your terminal to delete the candidates."
  exit 0
fi
if ((${#candidates[@]} == 0)); then
  echo "Nothing to delete."
  exit 0
fi
read -r -p "Delete these ${#candidates[@]} candidates? Type yes: " answer
if [[ "$answer" != "yes" ]]; then
  echo "Nothing deleted."
  exit 0
fi
registered="$(git -C "$main" worktree list --porcelain 2> /dev/null || true)"
for entry in "${candidates[@]}"; do
  if grep -qxF "worktree $entry" <<< "$registered"; then
    git -C "$main" worktree remove --force "$entry"
  else
    rm -r -f --one-file-system -- "$entry"
  fi
  echo "deleted $entry"
done
git -C "$main" worktree prune || true
