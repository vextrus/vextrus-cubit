# VEXTRUS

Vextrus is an AI-native platform for the AEC business, starting with Bangladeshi real-estate
Developers. A QS turns a Developer's 2D AutoCAD drawings into a confirmed 3D Building Model through a
Takeoff the machine assists; from it come the Priced BOQ and the Material Schedule. The owner is a
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
- **Effort:** `medium` by default. Suggest `/effort high` for genuinely hard decisions, then drop back.
- **A mistake made twice goes into this file.**

## Law
- **Secrets** are never printed, written or committed (`TYPESAFE_API_KEY` lives in `~/.bashrc`).
- **Real drawings** (the Edison set, the Sample Project, client sets) are read locally under
  `.private/`. Nothing from them enters git, an issue or a PR; carry out conventions, never content.
  Their text may go to TypeSafe's Jev during development (ADR 0013).
- **OpenConstructionERP is AGPL-3.0:** learn from it, never copy its code, schemas, strings or data.
  **cad2data's converters are proprietary** and are never run; nor are converters OCE downloads.
- **The repository is private** (ADR 0024); write issues and PRs as if they could leak anyway.
- **Permissions:** push, reset, checkout, worktree and `rm -r` ask the owner. PowerShell is denied;
  never route around it (the owner runs Windows commands with `! <command>`). Only the owner merges.

## The machine
WSL2 with mirrored networking: use `127.0.0.1`, never `localhost`. Postgres 16 runs natively on 5544
(superuser in `~/.pgpass`). Node 24 and uv/Python 3.13. The harness's `grep` is ugrep. `/tmp` does
not survive a reboot. Commit with explicit paths (the guard refuses `git add -A`); a hook runs `sync`
after each commit. There are no build or test commands yet; M0 adds them here.

## The harness
- **Hooks** (`.claude/hooks/`): `guard.mjs` refuses secrets printed, staging everything, staging
  `.private/` or drawings, deleting untracked files, history rewrites, skipped hooks, PowerShell and
  edits to reference drawings; `state.mjs` prints the checkout's state at session start.
- **Agents:** `refuter`, `qs-critic`, `ux-critic` (read-only reviewers) and `drawing-analyst` (local).
- **Skills:** Matt Pocock's (`/ask-matt` routes; his review skill is `/spec-review`), plus our
  `product-review` and `real-drawings`. The built-in `/code-review` and `/code-review ultra` review PRs.
- **MCP:** `chrome-devtools` (a headless browser for walking products).

## Compact instructions
When the context is compacted, keep: the session's goal and each finish-line condition's state; the
owner's rulings in their words; open questions; decisions recorded (ADR ids, `CONTEXT.md` terms);
research files and their conclusions; commits; the exact next step. No narrative.
