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
- `uv run python -m scripts.factory.launch cloud --branch <branch> --ticket <ticket> --tier ordinary|hard --prompt-file <f> --budget-minutes <n>`
- `uv run python -m scripts.factory.launch local --ticket <ticket> --branch <branch> --tier ordinary|hard --name <name> --prompt-file <f> --budget-minutes <n>`
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
- `uv run python -m scripts.factory.review run <PR> --round n [--exception <kind> --reason "<text>"]
  [--where cloud]` from the main checkout, with the Bash tool's `run_in_background`: one review round by
  code (the head from the PR, a claimed slot, the tier, the lenses, the replays, one batched refuter,
  the ledger record); it prints one JSON object and appends a line to
  `.private/work/factory/review-cost.jsonl`. Exit 3: refused, nothing recorded (its `refused` field says
  why: a lens past its cap or outside its schema is named); run the round again: every lens starts
  again, fresh (no answer is reused). `--where cloud` launches one cloud reviewer per lens and records nothing; when every
  reviewer has pushed its verdict, `uv run python -m scripts.factory.review collect <PR> --round n`
  records ONE decision from all of them (refused, nothing recorded, while any lens is missing); a
  lens with no launch (its launch failed or was cut off) is launched by running the round again with
  `--where cloud`; a lens whose session died is launched again only when named, `--relaunch <lens>`
  (a lens with an accepted verdict is kept; `collect` takes each lens's newest).
- `uv run python -m scripts.factory.review fix-message <PR> --from-verdict`: the fix message of the PR's
  latest recorded round (one line per standing finding), for the builder's fix round.
- `uv run python -m scripts.factory.review run <PR> --round <n>` on each READY head; the ledger holds
  its verdict (no slash command reviews: `/review-pr` is retired).

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
