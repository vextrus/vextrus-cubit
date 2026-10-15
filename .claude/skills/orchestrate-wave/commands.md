# The runbook's commands

Each line is one the guard accepts from the orchestrator in the main checkout (SKILL.md's steps, in order).
`tools/lint/docs_paths.py` refuses a module or subcommand that does not exist; the acceptance test
`p6-docs-runbook.test.mjs` judges each concrete line with the guard. Anything the guard or the auto-mode
classifier refuses is the owner's to run: say the exact command and let the owner type `! <command>`.
SKILL.md keeps the gate lines (design-gate, real-drawings) word for word: the guard accepts only those.

## The clock
- `uv run python -m scripts.factory.stamp start --budget <with unit: 8h, 90m, 5h30m> --state <STATE.md> --phases "<p=min,...>"`: the
  session's budget and phases (`--force` only over a session that never ran `stamp end`).
- `uv run python -m scripts.factory.stamp phase <name>`: the phase now running.
- `uv run python -m scripts.factory.stamp elapsed --ticket <ticket>`: a ticket's `[elapsed n/m min]`.
- `uv run python -m scripts.factory.stamp end`: a session ends with it; the next `start` needs no `--force`.

- `uv run python -m scripts.factory.state`: the open-work table, read from git, `gh`, the ledger, `claude agents` and the lock; the orchestrator runs it instead of reading memory, and `uv run python -m scripts.factory.state --resume-md <path>` before a compaction or a restart.

## 1. Governor
- `uv run python -m scripts.factory.governor check <unit>`: units `cloud-session`, `local-agent`, `review`,
  `pytest`, `web-tests`, `walk`, `rd-run`. A refusal waits or holds the ticket.

## 3. Launch and messages
- `uv run python -m tools.lint.acceptance_lint origin/main <branch> [<branch> ...]`: run on each acceptance
  commit before launching its builder. The first branch is the one judged in full; name every other open
  ticket's branch after it, read for its `pin:` lines only, so contradicting pins show. Exit 1 goes back to the
  acceptance-writer, never to a builder.
- `uv run python -m scripts.factory.launch cloud --branch <branch> --ticket <ticket> --tier ordinary|hard --prompt-file <f> --budget-minutes <n>`
- `uv run python -m scripts.factory.launch local --ticket <ticket> --branch <branch> --tier ordinary|hard --name <name> --prompt-file <f> --budget-minutes <n>`
- `uv run python -m scripts.factory.say <session-uuid> --file <f> --elapsed <n/m>`: prints the text to send
  with SendMessage when the builder is alive, and runs the resume itself when it is `stopped` or `failed`
  with no `pid`. Never type `claude --bg --resume` by hand: the guard refuses it.
- A cloud builder is messaged through `uv run python -m scripts.factory.launch say <session-id> --ticket <ticket> --file <f>`.

## 4. Watch
- `uv run python -m scripts.factory.watch ensure`: starts the watcher when its pidfile is stale; the
  `vextrus-factory` mod reads `events.log` under `.private/work/factory/` and wakes the orchestrator.
- The kinds that wake it: READY, BLOCKED, LEAK-HIT, BUDGET-PASSED, LOCAL-IDLE and every other kind, but
  READY-WAITING, BUILDER-QUIET, FLOOR-CROSSED, SAID and SAY (they ride along) and PUSH and COMMIT past the
  first per ticket in 15 min.
- `uv run python -m scripts.factory.main_watch run [--interval 120]` (or `once`): the main watcher; when main goes red it opens `revert/<short sha>` of the culprit merge against main (review tier `revert`, no model) and logs `red`, `culprit`, `revert-opened`, `landed` in `.private/work/factory/main-watch.log`.

## Real drawings
- `uv run python -m scripts.factory.rdlock run --kind <kind> --head <sha> --ticket <ticket> -- <cmd>`: one real-drawing
  run at a time (`posting`, `scored` or `no-post`), queued visibly; a posting run without `--ticket` is
  never checked against a newer head.

## 5. Review
- `uv run python -m scripts.factory.review run <PR> --round <n> [--exception <kind> --reason "<text>"]
  [--where cloud]` from the main checkout, with the Bash tool's `run_in_background`: one review round by
  code (the head from the PR, a claimed slot, the tier, the lenses, the replays, one batched refuter,
  the ledger record); it prints one JSON object and appends a line to
  `.private/work/factory/review-cost.jsonl`. Exit 3: refused, nothing recorded (its `refused` field says
  why: a lens past its cap or outside its schema is named); run the round again: every lens starts
  again, fresh (no answer is reused). `--where cloud` launches one cloud reviewer per lens and records nothing; when every
  reviewer has pushed its verdict, `uv run python -m scripts.factory.review collect <PR> --round <n>`
  records ONE decision from all of them (refused, nothing recorded, while any lens is missing); a
  lens with no launch (its launch failed or was cut off) is launched by running the round again with
  `--where cloud`; a lens whose session died is launched again only when named, `--relaunch <lens>`
  (a lens with an accepted verdict is kept; `collect` takes each lens's newest).
  Past the two-round cap, `--round <n> --exception delta-review --reason "<text>"` (n 3 to 9, round
  n-1 recorded; local only): one lens on the fix's own diff since round n-1's head (merges of main left
  out; a rewrite or another branch merged in is refused, exit 3), and the earlier rounds' kept attack
  tests re-run on the head first: a failed replay is a claim for the round's refuter (refuted, it does
  not block), and one failing elsewhere than on its own round is STALE, its finding handed to the lens
  as text; PASS only when no finding could block. It may re-run on the same head only after a FIX that
  rested only on replays no refuter confirmed (S26-FX9). A head whose `ci` is red or not yet finished
  starts no lens (exit 3).
- `uv run python -m scripts.factory.review fix-message <PR> --from-verdict`: the fix message of the PR's
  latest recorded round (one line per standing finding), for the builder's fix round.
  An allowlist-only PR, a docs-only PR (`review_tiers.toml` `docs_only`) and the main watcher's revert of its logged culprit get no model and pass by code
  checks (ADR 0043). A PR with any path off the review bar's lax set (`[lax]` less `[strict]`), a `conftest.py`, or on
  `review_tiers.toml`'s `[risk]` or `[docs_only] never` list is `risk`: lens A and lens B, the refuter on every head; every other PR is
  `ordinary`: lens B alone, the refuter on one head in five
  (`scripts.factory.tiers`; the cost line's `refuter`), where a finding nothing reproduced is filed, never
  blocking (S29-F7; Q5, Q15, Q21). `/review-pr <PR> <head> <round>` stays until S14-R3 retires it; the ledger holds the verdict.

## 6. Land
- `uv run python -m scripts.land <PR> [<PR> ...]`: it orders the PRs itself (engine PRs with a ledger PASS
  first, then by number), refuses a head behind main only for a risk-tier PR or one whose files overlap main's since its merge-base (naming `land update` and each overlapping file) and a conflicting PR, else lands it as it stands, waits for CI, prints the gates still owed and merges.
- `scripts.land update <PR>` (words, not a line to type): main into the PR's branch, merging nothing; the
  only path that moves a head (the lander never updates).
- `uv run python -m scripts.land <PR>`: one PR, the same way.
- `uv run python -m scripts.merge_ready <PR>`: the last check before any merge, by hand or by the lander.

## Open a PR (a READY head, local or cloud)
One call, from the main checkout:

```
uv run python -m scripts.factory.publish <branch>
```

It range-scans `<merge-base>..<head>` (every commit, `--ref <branch>`), refuses a hit naming only `file:line`
and pushes nothing, pushes exactly that head (`git push origin <branch>`), builds the body from the READY
commit's message without its `Factory-` and attribution trailers, scans it and opens the PR with
`--body-file`. On a branch with an open PR it names the PR and changes nothing. Judged-public hits go into
one allowlist PR: `uv run python -m scripts.factory.allowlist batch --from <hits file>` (one
`<branch>:<file>:<line> [<commit>]` per line, the commit publish names beside the hit; any bad line
refuses the batch).

Only when publish cannot run, the same steps by hand, each its own call (body: the last commit's body,
written to `.private/work/<id>/pr-body.md` first):

```
uv run python -m tools.leakscan range <merge-base>..<head> --ref <branch>
git push origin <branch>
uv run python -m tools.leakscan file .private/work/<id>/pr-body.md
gh pr create --title "<at most 72 characters>" --body-file .private/work/<id>/pr-body.md --base main --head <branch>
```

`gh pr create` runs as its own call: the guard refuses a body-file write that shares a call with anything
else, and one whose file has no leak stamp.

CI runs its heavy jobs on a PR only while the head reads READY (`scripts/factory/ci_gate.py`), and `ci` and
`engine` fail on any other head when the PR's changes need a heavy job: a fix round must end with a
`Factory-State: READY` commit (verify first), and so must every head the lander merges main onto. A PR of
documents alone (briefs, ADRs, `docs/`, root `.md` files) needs none and passes with no trailer. `ci`
answers for the backend and the web (`web`'s own check is a skipped job without a READY head, which passes),
`engine` for the engine.
`merge_ready` refuses a head the gate reads not READY unless the PR changes documents alone.

Change a PR body as the hand steps do, scanned first:
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
- `uv run python -m scripts.walk.run <sha40>` on main's head, then `/real-set-walk <sha40>` to finish G1.
- Walk #2 (the owner's ruling Q24): `scripts.walk.run <sha40>` as above, then `/real-set-walk <sha40> --repeat <walk #1's
  sha40>`: the critics walk walk #1's items, its findings' reproduction steps and the fixes since, not a fresh exploration.

## Housekeeping
- `uv run python -m scripts.factory.sweep`: lists stale worktrees and storage; `--apply` removes them.
- `uv run python -m scripts.factory.sweep --old-sessions [--days N] [--apply]`: for each registered worktree
  under `.claude/worktrees/`, lists its `.venv` and `web/node_modules` (those two exact paths, nothing walked,
  `.private/work/` never touched) when older than N days and the worktree is not current or in use; `--apply`
  removes those by name and keeps their folders.
- `uv run python -m tools.leakscan sweep-remote [--hits-file <path>]`: at each session close, after
  `git fetch --prune origin` (a plain fetch keeps refs of branches deleted on origin); range-scans every origin branch against `origin/main` and prints `<branch> <file>:<line>`
  per hit (a branch named by a corpus string prints `ref:<i> name`), exit 1 with a hit, 2 when a branch cannot
  be scanned; `--hits-file` lists the hit branches for the owner to delete.
