#!/usr/bin/env bash
# The sprint's only coordination: local git. Tasks are files on the `sprint` branch; a claim is
# the ref refs/sprint/claims/<id>, created only if absent (git's compare-and-swap is the lock);
# landing moves `sprint` forward only if nobody else moved it first. No server, no state store.
#   sprint.sh next              ready tasks, most important first
#   sprint.sh claim <id>        take a task (exit 1: taken)
#   sprint.sh release <id>      give a task back
#   sprint.sh land <id>         merge sprint in, run the check, move sprint to HEAD, mark <id> done
#   sprint.sh status            every task's state, for the owner
set -uo pipefail
BR=sprint
TASKS=docs/sprint/tasks
STALE_HOURS=${SPRINT_STALE_HOURS:-3}
ZERO=0000000000000000000000000000000000000000
AGENT=${SPRINT_AGENT:-$(basename "$(git rev-parse --show-toplevel)")}

die() { echo "sprint: $2" >&2; exit "$1"; }
ids() { git ls-tree --name-only "$BR" "$TASKS/" 2>/dev/null | sed -n 's#.*/\(.*\)\.md$#\1#p'; }
field() { git show "$BR:$TASKS/$1.md" 2>/dev/null | sed -n "s/^$2:[[:space:]]*//p" | head -1; }
is_done() { git rev-parse -q --verify "refs/sprint/done/$1" >/dev/null; }
claim_info() { git cat-file -p "refs/sprint/claims/$1" 2>/dev/null; }
claim_age_h() {
  local t; t=$(claim_info "$1" | awk '{print $2}'); [ -n "$t" ] || { echo 999; return; }
  echo $(( ( $(date -u +%s) - $(date -u -d "$t" +%s) ) / 3600 ))
}
state() {
  local id=$1 d
  is_done "$id" && { echo done; return; }
  if claim_info "$id" >/dev/null; then
    [ "$(claim_age_h "$id")" -lt "$STALE_HOURS" ] && { echo claimed; return; }
    echo stale; return
  fi
  for d in $(field "$id" deps); do is_done "$d" || { echo blocked; return; }; done
  echo ready
}

cmd=${1:-}; shift || true
case "$cmd" in
  next)
    for id in $(ids); do
      s=$(state "$id"); [ "$s" = ready ] || [ "$s" = stale ] || continue
      printf '%s\t%s\t%s\t%s\n' "$(field "$id" priority)" "$id" "$s" "$(field "$id" title)"
    done | sort -n | cut -f2-
    ;;
  claim)
    id=${1:?id}; git cat-file -e "$BR:$TASKS/$id.md" 2>/dev/null || die 1 "no task $id on $BR"
    s=$(state "$id")
    blob=$(printf '%s %s\n' "$AGENT" "$(date -u +%FT%TZ)" | git hash-object -w --stdin)
    case "$s" in
      ready) git update-ref "refs/sprint/claims/$id" "$blob" "$ZERO" 2>/dev/null || die 1 "$id was just taken" ;;
      stale) old=$(git rev-parse "refs/sprint/claims/$id")
             git update-ref "refs/sprint/claims/$id" "$blob" "$old" 2>/dev/null || die 1 "$id was just taken" ;;
      *) die 1 "$id is $s" ;;
    esac
    echo "claimed $id as $AGENT"
    ;;
  release)
    id=${1:?id}; git update-ref -d "refs/sprint/claims/$id" && echo "released $id"
    ;;
  land)
    id=${1:?id}
    [ -z "$(git status --porcelain --untracked-files=no)" ] || die 4 "commit or restore your changes first"
    git cat-file -e "HEAD:docs/sprint/notes/$id.md" 2>/dev/null || die 4 "write and commit docs/sprint/notes/$id.md first"
    git show "HEAD:docs/sprint/notes/$id.md" | grep -q '^Review:' || die 4 "notes/$id.md needs its 'Review:' line"
    for try in 1 2 3 4 5 6; do
      old=$(git rev-parse "$BR")
      git merge -q --no-edit "$BR" >/dev/null 2>&1 || die 2 "merge conflict with $BR: resolve it, commit, and land again"
      bash docs/sprint/check.sh "$old" || die 3 "the check failed: fix it and land again (log: .private/work/sprint/check.log)"
      new=$(git rev-parse HEAD)
      if git update-ref "refs/heads/$BR" "$new" "$old" 2>/dev/null; then
        git update-ref "refs/sprint/done/$id" "$new"
        git update-ref -d "refs/sprint/claims/$id" 2>/dev/null
        echo "landed $id at ${new:0:12}"; exit 0
      fi
      echo "sprint: $BR moved during the check; merging again (try $try)" >&2
    done
    die 5 "$BR kept moving; land again"
    ;;
  status)
    for id in $(ids); do
      s=$(state "$id"); extra=""
      [ "$s" = claimed ] || [ "$s" = stale ] && extra="$(claim_info "$id")"
      [ "$s" = done ] && extra="$(git rev-parse --short "refs/sprint/done/$id")"
      [ "$s" = blocked ] && extra="needs: $(field "$id" deps)"
      printf '%-4s %-8s %-8s %s  %s\n' "$(field "$id" priority)" "$id" "$s" "$(field "$id" title)" "$extra"
    done | sort -n
    ;;
  *) sed -n '2,10p' "$0"; exit 64 ;;
esac
