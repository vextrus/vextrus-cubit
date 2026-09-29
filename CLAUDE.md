# VEXTRUS

Vextrus is an AI-native platform for the AEC business, starting with Bangladeshi real-estate
Developers. A QS turns a Developer's 2D AutoCAD drawings (structural, architectural and MEP) into the
Live Model, a confirmed 3D dataset of every Building's Elements, through a Takeoff the machine assists;
the Priced BOQ, the Material Schedule and every later module are readings of it. The owner is a
civil engineer and the CEO and co-founder. The previous product (Vextrus Cubit) was reset on
25 Sep 2026: read `docs/postmortem.md` once. Its code lives only on branch `dev-lane-and-jev`.

**Start here:** the newest `docs/handoff/session-<NN>-prompt.md` is the current brief.

## Where things are
- `docs/intent.md`: what we build and why. `CONTEXT.md`: the domain's words; use them exactly.
- `docs/adr/`: every decision so far. `docs/architecture.md`: the module map and build rules.
- `docs/milestones.md`: M0–M5 and their finish lines. `docs/sdlc.md`: how we build.
- `docs/research/`: the cited evidence behind the decisions.
- `.private/` (never in git): real drawings under `reference/`, derived work under `work/`.
- `~/reference/`: OpenConstructionERP (runs at http://127.0.0.1:8080 via `~/reference/oce.sh`),
  cad2data's docs, the Data-Driven Construction book, Glodon's BIM 2.0 paper. Its `README.md` holds the
  law for using them.

## How we work
- **The owner decides; you recommend.** Product, scope, business, stack, spending and anything
  irreversible are the owner's. Ask one question at a time, with your recommendation first and the
  reason in a line. Don't ask what research, the code or a sensible default can answer.
- **Evidence, not claims.** Only a tool result is evidence. Cite sources. Say what you don't know.
- **Honesty over comfort.** Lead reports with what is broken or unmeasured. Green CI is not done; the
  owner's walk of the running product on real drawings is.
- **Plain words.** Say what you did, what you found and what you need, briefly.
- **Keep the context for the owner.** Fan read-heavy work out to background agents, one question
  each, each returning a cited file.
- **Effort:** the orchestrator runs at `xhigh` in the CLI (the owner, session 04: "next session we'll
  run the main session on xHigh effort … No Worries on Tokens"); build sessions at `xhigh` too
  (`modelSettings` in `.claude/settings.json`); reviewers at `high`. Opus 5.5 starts at `medium` unless a
  level is saved for it, so the level is always set, never assumed.
- **Everything runs locally** (the owner, 29 Sep 2026): each ticket in its own background session and
  worktree (`claude --bg`); no cloud sessions. Builders commit and never push; the orchestrator pushes
  and opens PRs with the owner's yes.
- **A mistake made twice goes into this file.**
  - Agents deleted their own build output recursively twice (26 Sep 2026); the guard now refuses a
    recursive `rm`. Delete files by name, or leave build output and say so.
  - Parallel agents share one chrome-devtools browser: select your own page by URL before every
    action; per-page viewport emulation only; never touch another agent's page.
  - The design gate's first walk failed both UI tickets (01b, 03; 28 Sep 2026) on keys, empty routes
    and focus rings: a UI ticket walks m0-screens §8 by keyboard itself before its PR.
  - The design gate failed twice on the same class (wave 1's walks; wave 2a's words): a backend ticket
    that words codes in `web/src/messages/` gets a `ux-critic` review of those words before its PR.
  - A failure's name was lost twice (29 Sep 2026: #82's engine run, never identified; 20a's sign-in
    test, found only in a reviewer's screenshot): every suite run's output is kept in a file under
    `.private/work/` (pytest with `-rf`).

## Law
- **Secrets** are never printed, written or committed (`TYPESAFE_API_KEY` lives in `~/.bashrc`).
- **Real drawings** (the Edison set, the Sample Project, client sets) are read locally under
  `.private/`. Nothing from them enters git, an issue or a PR; carry out conventions, never content.
  Their text may go to TypeSafe's Jev during development, under the local key only (ADR 0013).
- **OpenConstructionERP is AGPL-3.0:** learn from it, never copy its code, schemas, strings or data.
  **cad2data's converters are proprietary** and are never run; nor are converters OCE downloads.
- **The repository is private** (ADR 0024); write issues and PRs as if they could leak anyway.
- **Permissions:** push, reset, checkout, worktree and `rm -r` ask the owner. PowerShell is denied;
  never route around it (the owner runs Windows commands with `! <command>`). Only the owner merges.

## The machine
WSL2 with mirrored networking: use `127.0.0.1`, never `localhost`. PostgreSQL 18 runs natively on 5432
with two roles, `vextrus` (owns the schema, migrates) and `vextrus_app` (the app), passwords in
`~/.pgpass`; PostgreSQL 16 on 5544 is the old product's: never touch it. The toolchain (Python 3.14,
LibreDWG, .NET) lives under `/opt/vextrus`; make the venv with `UV_PYTHON_INSTALL_DIR=/opt/vextrus/python`
(ADR 0034). Node 24. The harness's `grep` is ugrep. `/tmp` does not survive a reboot. Commit with
explicit paths (the guard refuses `git add -A`); a hook runs `sync` after each commit.

## Commands (backend, from the checkout's root)
- `uv sync --locked` (nothing is ever built). `uv run manage.py ensure_database && uv run manage.py
  migrate`: this worktree's own database (`vextrus`, or `vextrus_<worktree>`; `VEXTRUS_DB_NAME`
  overrides); `migrate` and `flush` always run as `vextrus`. `uv run manage.py sync_library`: every
  module's Library rows (the Market's Disciplines among them), idempotent, as `vextrus`. `uv run manage.py
  seed_demo`: the demo; it runs `sync_library` first (or refuses, naming it).
- `VEXTRUS_DEBUG=1 uv run manage.py runserver 127.0.0.1:8000`: the API at `/api/`, the admin at `/admin/`.
- `uv run manage.py worker`: the job worker on the default queue (it runs the stalled-job retrier);
  `uv run manage.py worker --queue cad`: the CAD queue's, one job at a time, with no memory cap yet
  (`VEXTRUS_CAD_WORKER_MEMORY_BYTES` is `None` in `vextrus/settings/jobs.py` until ticket 24 measures
  it). Both refuse to start unless connected as `vextrus_app`. Stop one with Ctrl-C or SIGTERM: a running job
  finishes its current step and is tried again later, its completed steps skipped.
- `uv run pytest`: as `vextrus_app`, on a test database named by the migrations' hash (`-m
  needs_toolchain`, `needs_bwrap` or `live` runs those left out). **Fast check:** `uv run pytest
  vextrus/<module> && uv run mypy && uv run lint-imports`.
- **Lints and scans** (as `ci.yml` runs them): `uv run ruff check . && uv run ruff format --check .`;
  `uv run python -m tools.lint.<scan>` (`market_literals`, `migration_ids`, `migration_leaves`,
  `lock_sources`); `uv run manage.py makemigrations --check --dry-run`. The OpenAPI schema:
  `uv run manage.py export_openapi_schema --api vextrus.api.api` (never committed).

## Commands (web, from the checkout's root; `npm --prefix web run <script>`)
- `npm --prefix web ci`, then once `npx --prefix web playwright install chromium`. `dev`: 127.0.0.1:5410,
  the shared pieces at `/dev/specimen` (`?lang=en-XB`: the test-only right-to-left language).
- `web.yml`'s checks: `typecheck`, `lint` (the catalogue and logical-CSS lints), `messages:check`, `npm
  --prefix web test`, `build`; and `lint:design-docs`, its own job. `messages:extract` after adding words; a
  backend code's English goes in `web/src/messages/<module>/<submodule>/en.po`. API types:
  `OPENAPI_SCHEMA=<file|URL> npm --prefix web run api:types`.

## The harness
- **Hooks** (`.claude/hooks/`): `guard.mjs` refuses secrets printed, staging everything, staging
  `.private/` or drawings, deleting untracked files, history rewrites, skipped hooks, PowerShell and
  edits to reference drawings; `state.mjs` prints the checkout's state at session start.
- **Agents:** `pr-reviewer` (every PR and every fix round), `refuter` (one claim), `ux-critic` (a walk,
  or the words-only design gate), `qs-critic` (read-only reviewers) and `drawing-analyst` (local).
- **Skills:** Matt Pocock's (`/ask-matt` routes; his review skill is `/spec-review`), plus our
  `orchestrate-wave` (the orchestrator's runbook: launch, review loop, owner steps, measures),
  `product-review` and `real-drawings`. The built-in `/code-review` and `/code-review ultra` review PRs.
- **MCP:** `chrome-devtools` (a headless browser for walking products).
- **Background agents** die when the app restarts: each long one keeps a `NOTES.txt` progress log
  and is told how to resume from it. Their scratch copies live under `.private/work/`, never `/tmp`.
- **Accounts:** the CLI's default config is signed in to the same account and organisation as account
  B's, `CLAUDE_CONFIG_DIR=~/.claude-b`; account A is `~/.claude-a`. A session can message (SendMessage,
  idle notices) only sessions of its own config dir, so the orchestrator and its builders run from one
  config.

## Compact instructions
When the context is compacted, keep: the session's goal and each finish-line condition's state; the
owner's rulings in their words; open questions; decisions recorded (ADR ids, `CONTEXT.md` terms);
research files and their conclusions; commits; the exact next step. No narrative.
