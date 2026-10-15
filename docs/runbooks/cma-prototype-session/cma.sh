#!/bin/bash
# The one Managed Agents prototype session, driven from the owner's main checkout (README.md).
#
#   cma.sh check                     tools, credentials and inputs are in place
#   cma.sh prepare <design.html>     DWG -> DXF with LibreDWG 0.14, then pack the uploads (.private/work/cma/)
#   cma.sh upload                    upload the three files (expire in 30 days); IDs to .private/work/cma/files.env
#   cma.sh apply [--yes]             create or update the five agents and the environment (ant apply)
#   cma.sh smoke                     a $4 setup check: mounts, DXF counts, a WebGL screenshot; not the work
#   cma.sh launch                    the real session: kickoff + outcome 1, budget $70
#   cma.sh outcome <2|3>             send the next outcome's rubric to the Lead, then the outcome
#   cma.sh budget <cents>            change the session's cap (e.g. 13000 = $130); resumes a paused session
#   cma.sh status                    status, stop reason, list cost, outcome results
#   cma.sh watch                     open the Console session viewer locally (every thread)
#   cma.sh fetch                     download every file the session wrote to .private/work/cma/outputs/
#
# Needs: ant (1.30+), jq, curl; ANTHROPIC_API_KEY (or an `ant auth login` profile) for the Vextrus
# workspace; GITHUB_TOKEN_RO, a fine-grained token with Contents: Read on vextrus/vextrus-cubit only.
# Nothing here prints a secret. Drawings and everything derived stay under .private/ (CLAUDE.md, Law).
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# The main checkout (where .private/ lives), even when this runs from a worktree of the branch.
root=$(dirname -- "$(git -C "$here" rev-parse --path-format=absolute --git-common-dir)")
work="$root/.private/work/cma"
edison="${EDISON_DIR:-$root/.private/reference/edison}"
dwg2dxf="${DWG2DXF:-/opt/vextrus/libredwg/bin/dwg2dxf}"
workspace="${CMA_WORKSPACE:-default}"        # the Console workspace's ID, or "default"
repo_url=https://github.com/vextrus/vextrus-cubit
mkdir -p "$work"

die() { echo "cma: $*" >&2; exit 1; }
sid() { [ -s "$work/${1:-session}.sid" ] || die "no ${1:-session} yet"; cat "$work/${1:-session}.sid"; }
lock_id() {                                  # lock_id <path fragment>: an ID from claude-lock.json
  local id
  id=$(jq -r --arg k "$1" 'first(.resources | to_entries[] | select(.key | contains($k)) | .value.id) // empty' \
    "$here/claude-lock.json" 2>/dev/null) || true
  [ -n "$id" ] || die "no $1 in claude-lock.json: run cma.sh apply --yes"
  echo "$id"
}
auth_header() {                              # the header curl needs, without printing it
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then printf 'x-api-key: %s' "$ANTHROPIC_API_KEY"
  else printf 'Authorization: Bearer %s' "$(ant auth print-credentials --access-token)"; fi
}
console() { echo "watch: https://platform.claude.com/workspaces/$workspace/sessions/$1"; }

resources_yaml() {                           # the session's mounts
  [ -s "$work/files.env" ] || die "no uploads yet: run cma.sh upload"
  # shellcheck disable=SC1091
  . "$work/files.env"
  [ -n "${GITHUB_TOKEN_RO:-}" ] || die "set GITHUB_TOKEN_RO (Contents: Read on vextrus/vextrus-cubit)"
  cat <<YAML
resources:
  - type: github_repository
    url: $repo_url
    authorization_token: "$GITHUB_TOKEN_RO"
    checkout: {type: branch, name: main}
    mount_path: /workspace/vextrus-cubit
  - {type: file, file_id: $DWG_FILE, mount_path: /edison/edison-dwg.tar.gz}
  - {type: file, file_id: $DXF_FILE, mount_path: /edison/edison-dxf.tar.gz}
  - {type: file, file_id: $DESIGN_FILE, mount_path: /claude-design/live-model-g9-v2.html}
YAML
}

create_session() {                           # create_session <name> <cents> <title> <initial_events yaml>
  local id agent env mounts
  agent=$(lock_id agents/vextrus-lead/); env=$(lock_id environments/vextrus-cma); mounts=$(resources_yaml)
  id=$(cd "$here" && ant beta:sessions create --transform id -r <<YAML
title: "$3"
agent: $agent
environment_id: $env
budget: {type: limit, max_list_cost: {amount: "$2", currency: USD}}
metadata: {project: vextrus, runbook: cma-prototype-session}
$mounts
initial_events:
$4
YAML
)
  echo "$id" > "$work/$1.sid"
  echo "session: $id"; console "$id"
}

indent() { sed 's/^/    /; 1s/^    /  - /'; }   # a YAML mapping file as one list item

case "${1:-}" in
  check)
    command -v ant >/dev/null || die "install ant: https://github.com/anthropics/anthropic-cli/releases"
    command -v jq >/dev/null || die "install jq"
    ant --version
    ant auth status >/dev/null 2>&1 || [ -n "${ANTHROPIC_API_KEY:-}" ] || die "no Anthropic credential"
    [ -n "${GITHUB_TOKEN_RO:-}" ] || echo "cma: GITHUB_TOKEN_RO is not set yet"
    [ -x "$dwg2dxf" ] || die "no LibreDWG at $dwg2dxf"
    [ -d "$edison" ] || die "no Edison set at $edison"
    echo "Edison DWGs: $(find "$edison" -iname '*.dwg' | wc -l)"
    df -h "$root" | tail -1; free -h | sed -n 2p
    ;;
  prepare)
    [ -f "${2:-}" ] || die "usage: cma.sh prepare <path to 'Live Model G+9 v2.html'>"
    rm -f "$work/dxf.log"; mkdir -p "$work/dxf"
    while IFS= read -r -d '' f; do
      rel=${f#"$edison"/}; out="$work/dxf/${rel%.*}.dxf"; mkdir -p "$(dirname "$out")"
      if "$dwg2dxf" -y -o "$out" "$f" >>"$work/dxf.log" 2>&1 && [ -s "$out" ]; then
        printf '%s\t%s\n' "$(stat -c %s "$out")" "$rel"
      else
        printf 'FAILED\t%s\n' "$rel"         # never trust the exit code alone: the size is shown too
      fi
    done < <(find "$edison" -iname '*.dwg' -print0) | tee "$work/dxf.tsv"
    tar -czf "$work/edison-dwg.tar.gz" --exclude='*Zone.Identifier' -C "$edison" .
    tar -czf "$work/edison-dxf.tar.gz" --exclude='*Zone.Identifier' -C "$work/dxf" .
    cp -- "$2" "$work/live-model-g9-v2.html"
    ls -lh "$work"/edison-*.tar.gz "$work/live-model-g9-v2.html"
    echo "check dxf.tsv: a DXF far smaller than its neighbours is a thin conversion"
    ;;
  upload)
    : > "$work/files.env"
    for pair in DWG_FILE:edison-dwg.tar.gz DXF_FILE:edison-dxf.tar.gz DESIGN_FILE:live-model-g9-v2.html; do
      var=${pair%%:*}; name=${pair#*:}
      [ -s "$work/$name" ] || die "no $name: run cma.sh prepare"
      id=$(curl -fsS https://api.anthropic.com/v1/files -H "$(auth_header)" \
        -H "anthropic-version: 2023-06-01" -F "file=@$work/$name" -F expires_in_seconds=2592000 | jq -er .id)
      echo "$var=$id" >> "$work/files.env"; echo "$name -> $id"
    done
    ;;
  apply)
    cd "$here"
    files=(environments/vextrus-cma.yaml agents/drawing-dissector/agent.md agents/qs-critic/agent.md
           agents/adversary/agent.md agents/bim-researcher/agent.md agents/vextrus-lead/agent.md)
    ant apply --dry-run -v "${files[@]}"
    if [ "${2:-}" = --yes ]; then ant apply --yes "${files[@]}"
    else echo "that was the plan only; re-run with --yes to apply it"; fi
    ;;
  smoke)
    create_session smoke 400 "Vextrus CMA setup check" "$(cat <<'YAML'
  - type: user.message
    content:
      - type: text
        text: >-
          This is a setup check, not the work: do not plan, delegate or start any outcome. Only:
          list /mnt/session/uploads and /workspace; extract both Edison archives under /workspace/edison;
          count the DXF files and, with ezdxf, the entities in the three largest; run `git -C
          /workspace/vextrus-cubit log -1 --oneline`; open the Claude Design HTML in Chromium with
          --use-angle=swiftshader --enable-unsafe-swiftshader and save a screenshot to
          /mnt/session/outputs/smoke/design.png; report `df -h /workspace` and `free -h`; make the
          analysis venv the system prompt names and check that ezdxf and ifcopenshell import there.
          Then stop and report in ten lines.
YAML
)"
    ;;
  launch)
    [ ! -s "$work/session.sid" ] || die "a session exists already ($(cat "$work/session.sid")); remove $work/session.sid only if you mean a second one"
    create_session session 7000 "Vextrus final prototype and spec" "$(cat <<'YAML'
  - type: user.message
    content:
      - {type: text, text: "@./kickoff.md"}
YAML
grep -v '^#' "$here/outcomes/1-dissect.event.yaml" | indent)"
    ;;
  outcome)
    case "${2:-}" in 2) f=2-prototype ;; 3) f=3-spec ;; *) die "usage: cma.sh outcome <2|3>" ;; esac
    # The grader alone receives an outcome's rubric; the agent sees only its description (outcome 1
    # showed this). So a message carrying the rubric goes first, then the outcome itself.
    { cat <<YAML
events:
  - type: user.message
    content:
      - type: text
        text: >-
          From the owner. Outcome $2 follows this message. Here is the rubric its grader will use,
          word for word: write to exactly its paths and meet every criterion before you ask for a
          grade. Keep within the budget I set for it; record anything deferred in CHECKPOINT.md.
      - {type: text, text: "@./outcomes/$f.rubric.md"}
$( [ -f "$here/outcomes/$f.notes.md" ] && printf '      - {type: text, text: "@./outcomes/%s.notes.md"}' "$f" )
YAML
      grep -v '^#' "$here/outcomes/$f.event.yaml" | indent; } |
      (cd "$here" && ant beta:sessions:events send --session-id "$(sid)" > /dev/null)
    echo "sent outcome $2"
    ;;
  budget)
    [[ "${2:-}" =~ ^[1-9][0-9]*$ ]] || die "usage: cma.sh budget <cents>"
    ant beta:sessions update --session-id "$(sid)" --transform '{status,budget}' <<YAML
budget: {type: limit, max_list_cost: {amount: "$2", currency: USD}}
YAML
    ;;
  status)
    ant beta:sessions retrieve --session-id "$(sid "${2:-session}")" \
      --transform '{status,stop_reason,list_cost:usage.list_cost,active_seconds:usage.active_seconds,budget,outcomes:outcome_evaluations}' \
      --format yaml                          # the default table folds the outcomes into "[...1 item...]"
    ;;
  watch)
    ant beta:sessions connect "$(sid "${2:-session}")" --web
    ;;
  fetch)
    s=$(sid "${2:-session}"); out="$work/outputs/$s"; mkdir -p "$out"
    # The listing also holds the session's read-only copies of the uploads (downloadable: false); only the
    # files the session wrote to /mnt/session/outputs/ can be downloaded. The list goes to a file first:
    # `ant files download` reads a piped stdin as a request body, so it gets /dev/null.
    ant beta:files list --scope-id "$s" --beta managed-agents-2026-04-01 \
      --transform '{id,filename,downloadable}' --format jsonl > "$out/.files.jsonl"
    jq -r 'select(.downloadable == true) | [.id, .filename] | @tsv' "$out/.files.jsonl" |
      while IFS=$'\t' read -r id name; do
        name=${name//\//_}
        ant files download --file-id "$id" --output "$out/$name" < /dev/null && echo "$name"
      done
    echo "$(jq -s 'map(select(.downloadable != true)) | length' "$out/.files.jsonl") upload copies skipped"
    if [ -f "$out/outputs.tar.gz" ]; then
      mkdir -p "$out/tree" && tar -xzf "$out/outputs.tar.gz" -C "$out/tree" && echo "unpacked: $out/tree"
    fi
    ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
