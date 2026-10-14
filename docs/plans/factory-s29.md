# Session 29: the factory, rebuilt for speed without losing quality (plan)

**What this is:** the plan for session 29, the factory-only session the owner set on 14 Oct 2026. Its evidence is
`docs/research/2026-10-14-factory-review.md`; its rulings are the owner's answers to 28 questions (below, in their words where
they matter). Session 28's close turns this plan into session 29's brief, with session 28's measures and subtraction table.

**The owner's goal, in their words (14 Oct):** "continuous fastest production grade quality development of Vextrus", with
"tokens consumptions and usage limit [...] our last concern", and from session 30 a factory and product that keep improving
themselves (RSI).

**The diagnosis in one paragraph:** execution does not converge because work waits, not because the models write slowly.
The real-drawing lock takes 26-63 % of each session and covers nearly every backend PR. CI takes 10-12 min before every
review, partly running tests twice. Landing is serial (about an hour a PR). Fix rounds patch patches. Gates find defects
after review. G1's pass bar cannot converge (misleading findings 13, 8, 8, 3, 8 across five walks). Review compute is 5-11 %
of a PR's life. Most of the fix is subtraction and parallelism, not new gates.

## Sessions
- **Session 28** (brief: docs/handoff/session-28-prompt.md): land the G1 fix wave and get two G1 PASS so the owner signs M0
  off. First tasks, before walk #1 (Q24, Q26): the G1 evidence bar, the CI speed-up (#864) and the review evidence bar. Its
  measures carry the subtraction table (Q11).
- **Session 29: factory only, 8 h, two waves** (Q12). Orchestrator Opus 5.5 `high` (Q27a). The context cap is piloted from
  minute one (Q22): wave 2 starts in a fresh orchestrator from the wave 1 handoff.
- **Session 30:** M1 starts (M1-00 merges after the owner's M0 walk; then M1's wave 1, docs/plans/M1.md), M1 is never held
  hostage to a missed exit criterion (Q23).

## The rulings (14 Oct 2026)
| Q | Ruling |
|---|---|
| 1 | Session 28 as drafted (it may be improved), session 29 factory only, M1 from session 30. |
| 2 | Measure and cap by tokens; Max 20x; a second subscription is on the table; optimise tokens without losing quality. |
| 3 | Speed up CI first, then a fast verify before READY; CI is the full gate. |
| 4 | Fixes in fresh context; one round; then split. |
| 5, 15 | One lens plus CI for ordinary PRs; the full panel on a risk tier written down as paths (engine, takeoff, money, access and members, migrations, factory gate code, hooks, the scorer); session 29 confirms the globs against the module map. |
| 6 | The Chromium probe first; local builders for UI tickets until it passes. |
| 7, 17, 18 | The drawings-repo probe; cloud browser walks on the two Development Sets; a cloud walk returns a verdict file only, screenshots stay in the cloud; counted G1 walks stay local, practice walks and design gates move to cloud. |
| 8 | No third-party sandboxes or rented servers for now: the owner's machine and Claude cloud sessions. |
| 9 | Reversible choices proceed on the recommendation; spending, scope and irreversible choices wait for the owner. |
| 10 | Display: freshness first, then one rich band and pane, at most 1.5 h. |
| 11 | A subtraction pass over every gate and lens; the table is in session 28's measures. |
| 12 | 8 h, items 1-4 then 5-9, cut from the bottom, a measured before and after for each. |
| 13 | The owner switches accounts before a fresh session; the factory does nothing about it. |
| 14 | From session 30, factory work at most 25 % of builder-hours; each factory change names the measure it moves and is reverted if it has not moved in two sessions; adding or removing a gate an ADR set is the owner's. |
| 16 | Split: a blocking finding outside the ticket's acceptance scope is filed as a new ticket (test first) and the PR lands; inside scope or a regression: one more fresh rebuild, never a third, then back to planning, smaller. "Don't stuck at code review and adversarial loop forever". |
| 19, 20 | Landing: #825's refusal stays for risk-tier PRs and PRs overlapping anything merged since their CI ran; ordinary PRs with no overlap merge on their own green CI; a gate is walked again only when the update changed `web/**` it covered. Condition: a main watcher that reverts a red main's culprit at once. |
| 21 | A finding blocks only with a reproduction on that head; reviewers judge intent and user impact; the refuter runs the reproduction. |
| 22 | Orchestrator context capped near 320k; a fresh orchestrator per wave; no polling loops; hand-backs at most about 1,500 characters with the rest in a file; the 5-minute cache for review lenses. |
| 23 | Exit criteria below; M1 is never held hostage. |
| 24 | G1: BLOCKS fail; a misleading finding fails only with a reproduction on that head; walk #2 is a scripted repeat; new non-BLOCK findings on walk #2 are filed. Built in session 28 before walk #1. |
| 25 | A real-drawing run only when a PR changes code the reading job imports; an unchanged head keeps its result; a run on main after each engine merge. "The real-drawings are fully permit to use as any way for the development of Vextrus product." |
| 27 | Session 29's orchestrator at `high`; in session 30's wave 1, half the ordinary tickets on Opus 5.5 `high`, half on Sonnet 5.5 `medium`, decided by session 31. |
| 28 | From session 30, the orchestrator grills the owner at the start (at most 15 min) and the end (at most 20 min) of every session; never mid-session. |

## Baselines and targets (each item records its before and after in session 29's measures)
| Measure | Today | Target | How |
|---|---|---|---|
| `ci` wall on main, median | 10.4 min (p90 12.3) | 6 min or less | `gh run list --workflow ci.yml --branch main --limit 30 --json createdAt,updatedAt,conclusion` |
| `web` wall, median | 7.2 min (p90 11.2) | 5.5 min or less | the same, `web.yml` |
| Cloud verify | about 20 min, never timed per check | a fast verify of 8 min or less, per-check times recorded | the verify record's new timings |
| Real-drawing lock a session | 143-233 min | 45 min or less, and none on non-reading PRs | rdlock's log |
| Reviews per merged PR | 2.9 (S26) | 1.6 or less | `uv run python -m scripts.factory.measures` |
| Round-1 PASS | about 0.40 | 0.60 or more | the same |
| FIX resting only on 50-74 findings | 23 of 30 since 13 Oct | measured after F7 | `.private/work/factory/review-cost.jsonl` |
| Gate failures on reviewed heads | 5/12 (S26), 5/7 (S27) | 2 in 10 or fewer | STATE logs |
| A PR's open-to-merge | about 411 min (S27 sample) | 120 min or less | `gh pr list --state merged --json createdAt,mergedAt` |
| Main red after a bad merge | 77 min (13 Oct) | 15 min or less, by automatic revert | the watcher's log |
| Orchestrator context, median | 450-510k | 320k or less | the status line's context, per turn |
| Review spend a merged PR | about $6 | $4 or less | `review-cost.jsonl` |
| Builder tokens a ticket | unmeasured | measured | the new per-builder usage record |
| G1 misleading findings a walk | 8 (14 Oct) | after S28's bar | the walk verdicts |

## Wave 1 (items 1-4 of Q12, with the landing and lock changes the rulings tie to them)
Order matters: F3 before F4; F1 first because every later PR's CI pays for it. Acceptance tests first for each (Opus `high`).
1. **F1 CI speed** (cloud, ordinary `high`; whatever session 28 left of #864): every shard's collected node ids disjoint
   and complete (a lint that runs `pytest --collect-only`); the slowed web pass as its own parallel job; shards rebalanced
   on measured step times; `tools/lint/tests` in parallel; `engine.yml` split. Never touch `pyproject.toml` while a walk holds.
2. **F2 Fast verify and shift-left** (cloud, hard; amends ADRs 0041/0042): the verify record keeps each check's start and end
   (#823's owed check); `verify --fast` runs the changed modules and their importers, changed web files, a narrowed crosspr,
   web timeouts scaled by the machine; CI is the full gate. The leak scan, lint and the Cut check run at `git commit` and
   `gh pr create` (PreToolUse), so a builder meets them before committing, never after (insights). Timing assertions
   (#851, ts15a2's 500 ms) become counts or scaled bounds. The walk gate passes negated and quoted sentences (#865).
3. **F3 The main watcher** (cloud, hard): when main goes red, find the culprit among the merges since the last green run,
   open a revert PR at once and land it by the light path; the post-merge real-drawing run on main (F5) feeds it. Proof: a
   planted red commit on a throwaway branch is reverted (exit criterion).
4. **F4 Overlap landing** (cloud, hard; narrows #825, ADR 0041): `scripts/land` and `merge_ready` refuse a head behind main
   only for risk-tier PRs or when the PR's files overlap anything merged since its CI ran (`git diff --name-only`); a gate is
   walked again only when the update changed covered `web/**` files.
5. **F5 The real-drawing scope** (local, hard; amends ADR 0030): replace the module trees in `.github/engine-paths.txt` with
   the reading job's computed import closure, file by file; a head whose closure is unchanged since its last run keeps its
   result; one run on main after each engine merge (F3 reverts a regression). No-post runs move to cloud after F8.
6. **F6 Fresh-context fixes and the split** (cloud, hard): a FIX starts a new builder session with the standing findings and
   the touched scope, never a message to the old one; one round, then Q16's split. `acceptance-writer` enumerates the whole
   input class (every title pattern, event kind or upload order) as a variant table before the builder starts (insights;
   the lintel-then-framing treadmill).
7. **F7 Review tiers and the bar** (cloud, hard; amends ADR 0043): `review_tiers.toml` gets the risk tier as paths; ordinary
   PRs get one clean-context lens plus CI; the refuter samples one in five off the risk tier; a 50-74 finding blocks only on
   an input a QS would meet (a Development Set, the demo, the served product) or on a trust boundary, the rest filed with
   their owed check; the lens brief says to judge intent and user impact; lenses use the 5-minute cache.

## Wave 2 (items 5-9 of Q12), in a fresh orchestrator
8. **F8 Probes** (cloud, 10 min each): Chromium installed by the cloud setup script and driven headless; the drawings repo
   cloned with a read-only token in a cloud session (ADR 0042's route). Record both results.
9. **F9 Cloud walks** (after F8 passes): design gates and practice G1 walks on the two Development Sets in cloud; a verdict
   file only comes back (Q17); `--no-post` runs in cloud, in parallel, with no lock; UI builders move to cloud and drive the
   served product on the real API before READY, committing their evidence (Q6). Counted G1 walks stay local (Q18).
10. **F10 Subtraction** (orchestrator): from session 28's table, retire each gate or lens with no recent real catch; those an
    ADR set go to the owner at the session's end.
11. **F11 Tokens** (cloud, ordinary): the orchestrator's context cap in `scripts/factory/orchestrator.settings.json`; the
    per-wave handoff; no polling Monitors (the mod batches events); hand-backs capped with the rest in a file (agent files);
    `subagentPromptCacheTtl` 5 min; a per-builder usage record; a screenshot cap in the ux-critic brief.
12. **F12 The rules** (orchestrator, one PR): an ADR for the factory's second shape (amending 0030, 0041, 0042, 0043) and
    CLAUDE.md: holds (Q9), the session start and end grilling (Q28), models and effort (Q27), real drawings (Q25 as the
    owner states it at the start), RSI (Q14), landing (Q19, Q20); the pinned acceptance suite before READY; one source for
    every figure a design doc repeats (extend the seed-figure lint).
13. **F13 Display** (cloud, ordinary; at most 1.5 h; cut first): #866's freshness (a status line `refreshInterval`; the
    watcher's PR window; the newest verdicts; a poll time and a stale mark), then one rich band and pane: tickets by stage
    with timers against budget, CI and review state per PR, the lock holder, machine headroom, usage and the session clock.

**Cut order if time runs short:** F13, then F11's lesser items, then F10's retirements (keep the table), then F9's UI-builder
move. Never cut F1-F4 or F7.

## Exit criteria (Q23; a miss is listed, M1 still starts)
`ci` median 6 min or less on main; a fast verify of 8 min or less on a cloud builder; both probes run with a result; the
watcher reverts a planted red commit; one real small ticket carried end to end through the new flow (fresh fix, tiered
review, overlap landing); every item's before and after recorded.

## Not to do
A reviewer swarm until zero findings (it contradicts Q16 and Q21 and the token measures); a new gate without a removed one;
forks for subagents (they inherit the orchestrator's context); shrinking CLAUDE.md or the agent files (2 % of tokens);
dropping either review lens outright (lens B alone finds 8 % of real findings).

## Session 30 onward
- **Start (at most 15 min):** `qs-critic`, `ux-critic` and `product-review` prepare evidence-backed product questions in a file
  before the session; one grilling round, recommendation first; each ruling lands as a spec or ADR amendment PR that session.
- **End (at most 20 min):** what shipped, what the critics found, proposed amendments; answers the owner gives later are read
  at the next start. Mid-session: Q9.
- **RSI:** Q14's 25 % cap, each factory change with its measure and its revert date.
- **The model pilot:** Q27b in M1's wave 1.

## Questions for the owner at session 29's start (one round, recommendation first)
1. Q25's scope. Recommendation: the two Development Sets are fully free for development (cloud, any agent, no lock beyond
   the machine's); Held-out Sets stay held out, because they are the independent measure milestones pass on (ADR 0005);
   founding clients' sets follow each client's written permission; nothing from any drawing enters this repository while
   it is public.
2. The gates an ADR set that the subtraction table finds with no recent catch: retire each? (Recommendation per row.)
