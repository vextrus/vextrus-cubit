# Session 04: M0 wave 2a, and wave 1's remedies

You are the orchestrator of the second build session of the new Vextrus, **run on account B** (the owner's
ruling, 28 Sep 2026: local sessions on B while its plan lasts; every cloud session on account A).
Session 03 (28 Sep 2026) built wave 0 and wave 1 and ran the first real baseline of the real-drawing
check: the foundation of M0 is on `main`. Its record, measures and every ruling are in the M0 milestone
issue, **#45**; its lessons are in `docs/knowledge/lessons.md` ("Session 03"). **This session builds wave
2a (07, 08, 09, 28) and closes wave 1's open remedies**, then 2b (10, 11, 12) if the gates allow. Effort is
`high`.

## The owner's rulings that frame this session (28 Sep 2026; #45 has them in full)
- **Cost is not the constraint; quality is.** "These Cloud sessions credits are promotional credits and
  after they ended we can still run Cloud sessions throughout our subscription … focus on producing
  production grade highest code quality on every merge, every wave and every sessions: eventually our
  sdlc will be all about continuous learning, quality production, fast delivery." Run as many sessions
  in parallel, cloud and local, as quality allows; learn from each wave and apply it to the next.
- **Accounts:** cloud tickets on **A** (`CLAUDE_CONFIG_DIR=~/.claude-a`, default environment `vextrus`);
  local sessions on **B** (`~/.claude-b`). Neither environment holds a GitHub token (the compiled ezdxf
  wheel reaches a session through its GitHub proxy).
- **Continuations:** "go ahead with the continuations, no need to ask each time": send review fixes into
  a ticket's cloud session yourself, and count each in #45.

## Read first, in this order
1. `CLAUDE.md` (it gained the commands for both halves and "UI tickets walk §8 by keyboard before their
   PR"), `docs/sdlc.md` ("Waves": the accounts and the cost ruling), `docs/knowledge/lessons.md`
   (session 03's eleven lessons: read them all before launching anything).
2. **#45**, the M0 milestone record: wave 1's table and measures, every continuation, the baseline.
3. `docs/plans/M0.md`: "Wave 2" (the entries for 07, 08, 09 and 28, then 10, 11 and 12), "The contracts
   fixed here", "The real-drawing check", "Labels". Then what each ticket names.
4. The wave-1 working files (outside git): `.private/work/session-03/wave1/common.md` (the shared ticket
   prompt, **already updated with wave 1's remedies**), `review-brief.md` (the reviewer's brief), and one
   ticket prompt for the shape (`02.md`).

## What is broken, unmeasured or waiting (read before acting)
- **The real-drawing check has never posted.** The poster (`/usr/local/lib/vextrus/post-status`) has
  never run as the key user and the App (`vextrus-status`, App ID 5102506, installation 165622751) has
  never been called. The first engine PR (2b: 10, 11 or 12) makes the first posting run; the first UI
  PR (20a or 20b) the first `design-gate`. Both statuses are **required by the ruleset**, unpinned: a
  PR touching an engine path or `web/**` cannot merge until the App posts, so watch the first ones.
- **The baseline measures reading only:** run `20260928T101921Z-3c57935fe250-0a67` on main 3c57935f,
  11 files, 42 s, failed_stages 0, **entity_counts 116 items**, every other measure empty (not built).
- **The check caches a failed run** (the review of #64, scored 50): an environmental failure on main
  (a timeout, an OOM kill, `SandboxUnavailable`) is reused until `sandbox.py` changes; `wheels.py` is not
  in the cache key. Until fixed, a failed run is re-read by removing its folder under
  `~/.cache/vextrus-real-drawings/`.
- **The M0 plan is not amended** for #64: the sandbox's writable places (`/work/out` and a private
  `/tmp`), the cache key, not-applicable design-gate items, and the `failed_stages` measure added after
  the first result (docs/plans/M0.md lines around 378, 487, 510 and 799).
- **The check's own sandbox tests never run in CI:** `scripts/` is not an engine path, so `engine.yml`'s
  toolchain job skips them. Add a CI job for them without widening the engine paths (which decide who
  needs a `real-drawings` status).
- **#66:** 06b's `test_peak_memory_is_each_files_own` fails on the owner's machine (passes in CI), and a
  fork-chain test is flaky there. A test failing on the owner's machine hides real failures.
- **The render-F1 thresholds' exact edges** are not testable in floating point (the review of #64):
  moves under 0.0002 stay green. Consider a tolerance-aware comparison documented in the plan.
- **The main checkout's `.venv` runs on a Python under the owner's home** (made before `/opt/vextrus`):
  rebuild it with `UV_PYTHON_INSTALL_DIR=/opt/vextrus/python` (ask before removing anything).
- **Leftovers of session 03** (ask the owner before removing): the worktrees under
  `.claude/worktrees/agent-*` (01a, 01b, 01c, 06a: all merged) and their test databases
  `vextrus_agent_*`; `/home/riz/vextrus-builder-work/…` is the old product's worktree: leave it.
- **The cloud setup** takes 235–250 s of its 300 s budget (LibreDWG from source); a slower VM could run
  over. `docs/research/sdlc-waves-and-cloud.md` §6.5's checklist is stale (Python 3.13).
- **Before the beta (M6):** the web and the worker run without `DATABASE_OWNER_URL`; the startup check
  does not yet refuse a process holding it (from #60).
- **Open question for the owner before M1:** values copied out of a message carry invisible direction
  marks (U+2068/U+2069; `Number("12⁩")` is NaN). Strip them on copy in left-to-right languages, or
  keep them (m0-screens 1.8). Ask when M1's Question cards come near.
- **The owner's review minutes** were not recorded in wave 1; ask for a rough figure per PR.

## The finish line of this session
1. **Wave 1's remedies merged**, local, in parallel with 2a: the check's failed-run cache and the
   `wheels.py` key; the plan amended for #64; a CI job for `scripts/`' sandbox tests; #66 diagnosed and
   fixed; the main checkout's venv rebuilt; session 03's leftovers removed with the owner's yes.
2. **Wave 2a merged:** 07 (auth, roles, invitations, Project scope, activity), 08 (Projects, Site and
   Buildings; medium), 09 (jobs, storage and the worker), 28 (the Live Model's empty tables; medium), all
   `cloud`, each reviewed by the five-pass brief and fixed before the owner merges. None is an engine or
   UI PR, so the check posts "not applicable" for them.
3. **Wave 2a's measures** in #45 (cost from A's balance, time to PR, continuations, the owner's minutes),
   and the gate decided: widen 2b if at most one PR in four needed a second continuation.
4. If time allows, **wave 2b** (10, 11, 12: engine PRs, `cloud+local`): **the first posting runs** of
   `real-drawings` through the App, the first real test of the whole check.

## How to run it (what session 03 learned)
- **Launch** each cloud ticket with its prompt = its own part + `common.md`:
  `CLAUDE_CONFIG_DIR=~/.claude-a claude --cloud "<prompt>"`, run under `script -q -e -c '…' <log>`
  (it refuses without a terminal); record the session id in #45. **Follow-ups** go the same way:
  `claude -p "<message>" --cloud <session_id>`. Send a follow-up carrying the decision **before**
  posting a review comment that a session could act on first (06b reshaped its export on a comment, then
  reverted it).
- **Review** each PR with a background agent given `review-brief.md` and a focus for its trust boundary;
  it reports to you, never posts. Post only issues scored 80 or more, in the `/code-review` format.
  **Verify each fix yourself** (a scratch `git archive` copy; PostgreSQL 18 with a throwaway
  `VEXTRUS_DB_NAME`, dropped afterwards by name) before telling the owner a PR is ready.
- **Where tickets meet at a contract** (07 and 08 both use 02's tenancy; 09 is what 21a builds on), the
  review runs them together against `main`, never against an assumed shape.
- **UI PRs:** the `ux-critic` design gate on a clean served copy, then the poster:
  `post-status design-gate <PR> <commit> --passed … --failed … --not-applicable …`, run by the owner as the
  key user. Never `npm run build` in a folder whose dev server runs.
- **Engine PRs** (from 2b): the owner runs `scripts/real-drawings <PR>` (a posting run); read the
  "Failed on the head" line before the table.
- **The guard** refuses the key user's name, `sudo`, the statuses path, `check-runs`, `gh auth token`,
  `~/.bashrc` reads and recursive `rm` in a Bash command: write such text with the Write tool.
- **Push only with the owner's yes, every time.** Only the owner merges.

## Law in force
Secrets are never printed or written. Real drawings stay in `.private/`; only conventions and counts
leave it (the check's status carries counts only). OpenConstructionERP is AGPL: learn, never copy. No
proprietary converter is ever run. The product's word is **Rebar**. No market literal in code; every
visible string through a catalogue; logical CSS only.

## Suggested skills
`implement`, `tdd`, `diagnosing-bugs` (#66), `codebase-design`, `real-drawings` (2b), `product-review`
and `ux-critic` (UI), `/code-review`, `writing-for-agents` (ticket prompts), `handoff` (the session's end).
