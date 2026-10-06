# The runbook's commands

Each line is one the guard accepts from the orchestrator in the main checkout (SKILL.md's steps, in order).
`tools/lint/docs_paths.py` refuses a module or subcommand that does not exist; the acceptance test
`p6-docs-runbook.test.mjs` judges each concrete line with the guard. Anything the guard or the auto-mode
classifier refuses is the owner's to run: say the exact command and let the owner type `! <command>`.
SKILL.md keeps the gate lines (design-gate, real-drawings) word for word: the guard accepts only those.

## The clock
- `uv run python -m scripts.factory.stamp start --budget <h> --state <STATE.md> --phases "<p=min,...>"`: the
  session's budget and phases (`--force` only over a session that never ran `stamp end`).
- `uv run python -m scripts.factory.stamp phase <name>`: the phase now running.
- `uv run python -m scripts.factory.stamp elapsed --ticket <ticket>`: a ticket's `[elapsed n/m min]`.
- `uv run python -m scripts.factory.stamp end`: a session ends with it; the next `start` needs no `--force`.

## 1. Governor
- `uv run python -m scripts.factory.governor check <unit>`: units `cloud-session`, `local-agent`, `review`,
  `pytest`, `web-tests`, `walk`, `rd-run`. A refusal waits or holds the ticket.

## 3. Launch and messages
- `uv run python -m scripts.factory.launch cloud --branch <branch> --ticket <ticket> --effort medium --prompt-file <f> --budget-minutes <n>`
- `uv run python -m scripts.factory.launch local --ticket <ticket> --branch <branch> --effort medium --name <name> --prompt-file <f> --budget-minutes <n>`
- `uv run python -m scripts.factory.say <session-uuid> --file <f> --elapsed <n/m>`: prints the text to send
  with SendMessage when the builder is alive, and runs the resume itself when it is `stopped` or `failed`
  with no `pid`. Never type `claude --bg --resume` by hand: the guard refuses it.
- A cloud builder is messaged through `uv run python -m scripts.factory.launch say ...`.

## 4. Watch
- `uv run python -m scripts.factory.watch ensure`: starts the watcher when its pidfile is stale; then Monitor
  on `events.log` under `.private/work/factory/`.

## Real drawings
- `uv run python -m scripts.factory.rdlock run --kind <kind> --head <sha> -- <cmd>`: one real-drawing run at a
  time (`posting`, `scored` or `no-post`), queued visibly.

## 5. Review
- `/review-pr <PR> <head> <round>` on each READY head; the ledger holds its verdict.

## 6. Land
- `uv run python -m scripts.land <PR> [<PR> ...]`: it orders the PRs itself (engine PRs with a ledger PASS
  first, then by number), brings each up to date, waits for CI, prints the gates still owed and merges.
- `uv run python -m scripts.merge_ready <PR>`: the last check before any merge, by hand or by the lander.

## Open a PR (a local builder's READY head)
Each step is its own call:

```
uv run python -m tools.leakscan range <merge-base>..<head> --ref <branch>
git push origin <branch>
uv run python -m tools.leakscan file .private/work/<id>/pr-body.md
gh pr create --title "<at most 72 characters>" --body-file .private/work/<id>/pr-body.md --base main --head <branch>
```

CI runs its heavy jobs on a PR only while the head reads READY (`scripts/factory/ci_gate.py`), and `ci` and
`engine` fail on any other head when the PR's changes need a heavy job: a fix round must end with a
`Factory-State: READY` commit (verify first), and so must every head the lander merges main onto. A PR of
documents alone (briefs, ADRs, `docs/`, root `.md` files) needs none and passes with no trailer. `ci`
answers for the backend and the web (`web`'s own check is a skipped job without a READY head, which passes),
`engine` for the engine.
`merge_ready` refuses a head the gate reads not READY unless the PR changes documents alone.

Write the body (its last commit's body) to `.private/work/<id>/pr-body.md` first. `gh pr create` runs as its own
call: the guard refuses a body-file write that shares a call with anything else, and one whose file has no
leak stamp. Change a PR body the same way, scanned first:
`gh api -X PATCH repos/vextrus/vextrus-cubit/pulls/<PR> -F body=@<f>` (gh pr edit dies on gh 2.45).

## Issues
- `gh issue create --title "<title>" --body-file <f>` and `gh issue comment <n> --body-file <f>`, each after
  `uv run python -m tools.leakscan file <f>`; read with `gh issue view <n> --json title,body,labels,comments`.
- Before filing a cut item: `uv run python -m scripts.factory.jev same-issue --text "<defect>" --issues <f>`
  (advice only).

## Amend an acceptance test (a builder BLOCKED with proof)
- `uv run python -m scripts.factory.amend --subject "<text>" --red <n> --green <n> [--body-file <f>] <path>...`:
  commits the writer's amended test as an `acceptance:` commit on the branch; the builder merges it.

## 7. G1 walk
- `uv run python -m scripts.walk.run <sha40>` on main's head, then `/real-set-walk` to finish G1.

## Housekeeping
- `uv run python -m scripts.factory.sweep`: lists stale worktrees and storage; `--apply` removes them.
