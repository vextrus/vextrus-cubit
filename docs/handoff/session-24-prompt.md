# Session 24: M0 done — every G1 blocker built in parallel, G1 PASS twice on main, M1 wave 0 ready

**The goal, in one line:** `uv run python -m scripts.walk.ready origin/main` exits 0 (two counted G1 PASS verdicts
on main's current product code), then M1 wave 0 starts. Everything below serves that line. Today it exits 1:
"0 counted PASS verdict(s) on main, 2 needed".

## Session 23's measures (`scripts/factory/measures.py`, 12 Oct 06:52Z to 13:11Z; then 13:17Z-14:49Z)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 2 | 6 | |
| merge_p50_min | 295.3 | 77.8 | |
| rounds_per_pr | 2 | 1.67 | |
| rdlock_min | 146.6 | 196.6 | |
| verify_p50_min | 8.5 | 7.1 | |
| verify_p90_min | 10.7 | 13.6 | 10 |
| ci_wall_p50_min | 9.9 | 10.7 | 10 |

rounds_per_pr counts merged PRs only: FL5, FL7 and FL8 took 17 review rounds over seven PRs. Session 23 put about
187 minutes into real-drawing runs; about 60 went to heads that landed (the rest: superseded heads, a no-post run
followed by a posting run that re-read everything). One owner question held the orchestrator for two hours.

## Why G1 has never passed (eight sessions, 16-23)
Throughput by session: 7, 6, 2, 0, 2, 6, 2 PRs. G1 never passed; it was run on main once (walk 1, 51507b85: script
layer 15/16, agent layer 5/12 items). The causes, in order of hours lost:
1. **Review rounds on heuristic code that never converge** (2.5-4 h a session). Recogniser rules (FL5 titles, FL7
   site works) and undo chains (FL8) drew a new 50-65 finding every round; 17 of 18 blocking findings in session 23
   scored 50-75 on strict paths. Each came right only when the shape changed, usually after the cap.
2. **The real-drawing lock** (1.5-3.5 h): runs of 22-41 min, one at a time, each re-installing and re-reading main;
   no-post then posting doubles it; runs on superseded heads waste the rest.
3. **G1 is scheduled last, so it is cut** (sessions 17-23). Nothing walks a candidate head before merge.
4. **The orchestrator blocks** on owner questions (5 h, 3.5 h, 2 h) and leaves READY heads unread.
5. **Power cuts** (four), killing sessions with no restart.
6. **"Non-blocking" items still fail G1:** FL6 and FL13 count (every walked item must PASS), and nobody owned them.

## Where main stands, item by item (audit: .private/work/s23/g1-gaps.md; predicted, not walked)
| Item | State on main 42b5aca8 | What remains |
|---|---|---|
| FL1-FL4, FL11 | PASS likely | #668 (FL4 words) optional |
| FL5 sheet list | FAIL | #692 (branch s23-fl5c, 413f6764): review 2 FIX — 65: a ruled schedule's box counts as a drawing a 13-16 word footnote can title; 55: the "no short title at that drawing" guard is narrower than pairing's TITLE_GAP. Round 3 under `fix-regression` is the last. |
| FL6 legible, paged | FAIL | #665 (note diagrams on General sheets read as Plan views), #660 (Plot matching gives one sheet two pages; another none), #661 (annotation overlaps and overflow). Untouched. Real drawings. |
| FL7 coverage | likely FAIL | #687 landed; #664 (misleading: Coverage figures disagree) and #690 stand; Edison's unaccounted count unmeasured. |
| FL8 Questions, fixes | FAIL | #691 (branch s23-fl8c, 1b76c0dc): review 2 FIX — 70/60: the server's undo now passes over a moved-on correction to the person's earlier act, but the web's Ctrl Z and the toast's Undo word the result from the tab's own history; 35/35 words. Round 3 (`fix-regression`) is the last. Critics may also want storeys by E (#677). |
| FL9 Sample Project | likely PASS | act p95 674 and 905 ms (limit 1000) on two script walks; Edison 980 ms in walk 1 — unmeasured since. |
| FL10 roles | FAIL | #681 landed; #314 (misleading) stands: the inspector's Act shows one decision per sheet, never "Confirmed back in" (Who did what from the event log, #678). |
| FL13 words | FAIL | #666/#581 (cursor and save-state status items missing), #667/#580 ("Needs you … in the order Enter takes them" shown to MD and Guest, `SheetList.tsx`); with them #670, #663, #672. |
| question cap | at risk | `questions_per_discipline` failed on 4bc05e8e (Structural 4 > 3) and passed at exactly 3 on cf2aa78f. |
| Misleading findings open | 5 | #660, #665, #314, #664, #667 — G1 needs 0. |

Critics will also look where no script does: storeys meaning, the Discipline split (walk 1 on Edison: General 9 vs
3, Mechanical 0 vs 4, Structural 57 vs 65 — #671), the correction's provenance line (#689 D1), Bangla titles as
boxes (no Bengali font, #689).

## First 15 minutes (do these before anything else, in this order)
1. `date -u`; once the budget is known (step 4):
   `uv run python -m scripts.factory.stamp start --budget <h> --state .private/work/s24/STATE.md --phases "waveA=240,g1=180,m1=60"`.
   Until then, launch only.
2. `uv run python -m scripts.factory.state`; `claude agents --json` (respawn any `failed` builder with
   `claude respawn <id>`; after a power cut, `claude respawn --all`); `df`, `free`;
   `uv run python -m scripts.factory.watch ensure`; arm Monitor on `.private/work/factory/events.log` (READY,
   BLOCKED, LEAK-HIT, CI-RED, WALK done) before any question.
3. **Launch Wave A's first three now** (they need no ruling): A0 (G1 script layer on main, detached), A1 (FL8 round
   3), A3 (FL13 web). Then the rest of Wave A.
4. **One batched AskUserQuestion, at most four questions, each with the recommendation first**, and only after
   step 3, so builders work while the owner reads:
   - Budget: **12 hours** (two G1 walks with their agent layer need about 3 h after the last merge).
   - Review bar: **move `engine/recognise/**` and `engine/plot/**` to `[lax]` for this session** (75 blocks; 50-74
     become issues), so heuristic rules land on the real-set evidence and G1's critics judge them.
   - Real-drawing runs: **posting runs only, after a review PASS; and allow two runs at once** if one run's peak
     memory (measured at the first run) leaves 8 GB free.
   - M1: **start M1 wave 0's docs and owner-time tickets in parallel (M1-24 m1-screens, M1-02, M1-05, M1-06)**,
     though the M1 plan's O2 says after M0's walk.
   Also say, not ask: #687 changed `tools/scorer/`; the owner's custody re-run is owed (give the exact `! <command>`).
   Never ask anything else mid-session: a question holds the turn.

## Wave A (parallel; dependency-free)
| Ticket | What | Where, tier | Notes |
|---|---|---|---|
| A0 | G1 script layer on main now (`uv run python -m scripts.walk.run <main sha40>`), both sets | detached | measures Edison act p95 and the question cap on main; 60-75 min; read walk.json, file what fails |
| A1 | FL8 #691 round 3 (`fix-regression`): web Ctrl Z and toast word the result from the server's reply; correction_moved_on names its sheet; the limits as `{limit}` placeholders | local builder s23-fl8 (alive), ordinary/high | then design gate (keyboard walk of E, undo, the refusal words) on a served head |
| A2 | FL5 #692 round 3 (`fix-regression`): a table box is never a drawing a long line may title unless it holds a drawing's geometry; the guard uses pairing's own TITLE_GAP rule | local builder s23-fl5 (alive), hard | real drawings; its builder's direct read on 413f6764: Edison architecture 8 phantoms gone, 4 long titles gained, 0 lost |
| A3 | FL13 + FL7 words: #666/#581 cursor and save-state items; #667/#580 role-aware "Needs you"; #670, #663, #672; #664/#690 Coverage totals agree | cloud, ordinary/high | acceptance-writer first (m0-screens' words verbatim) |
| A4 | FL6 #661: annotation text fits its box | local, hard | real drawings |
| A5 | FL6 #660: one sheet, one Plot page | local, hard | real drawings |
| A6 | Factory quick wins (one PR): `rdlock` refuses a posting run without a review PASS and cancels runs on superseded heads; `launch` refuses a second builder on a ticket; the watcher watches carried-over tickets and prunes merged ones; #685 uses the best-of helper | cloud, ordinary | no owner ruling needed |

Then **Wave B**: B1 Who did what from the event log (#314, #678, #689 D1; after A1, A3; cloud); B2 storeys by E
(#677; after A1; cloud); B3 FL6 #665 note diagrams not Plan views (after A2, same files; local, hard).

At most 3 local builders at once (eight filled swap once); cloud for everything provable by committed tests.

## How this session runs (binding)
- **Never idle, never blocked.** Every READY head is pushed and reviewed within 10 minutes (events.log READY). While
  waiting: file 50-74 findings as issues, write cases tables, warm main's real-drawing cache after each merge.
- **Heuristic rules:** a builder writes a cases table from the real sets before round 1 (drawing-analyst), and after
  any round-1 FIX on a recogniser rule the next round changes the shape, never a constant or a word list.
- **Real drawings:** one posting run per head, after review PASS, with the reason judged from the builder's own
  no-post or direct read; cancel any run whose head a fix replaced.
- **G1 rehearsal before the merge freeze:** when A1 and A2 pass review, merge them and every Wave A PR that passed
  into an integration branch and run the G1 script layer on it (`scripts/walk/run.py <sha>`; 60-75 min), then the
  agent layer (`/real-set-walk`); its findings become Wave C tickets while the PRs land.
- **Merge freeze at hour 7 of 12:** land what passed, cut the rest (issues under `## Cut`), then walk main: G1 #1
  (script and agent layer), fix what blocks, G1 #2 on the same product code. Only after `scripts.walk.ready
  origin/main` exits 0 may the owner be told the milestone is ready (the walk-gate Stop hook enforces it).
- **Power cuts:** every builder keeps `.private/work/<ticket>/NOTES.txt`; on restart `claude respawn --all`, then
  `scripts.factory.state` and re-check every head.

## Claude Code features to use (official docs, Oct 2026; CLAUDE.md's limits stand unless the owner rules)
- `claude agents`, `claude respawn`, `claude attach` for local builders (a session cut by a crash shows `failed`;
  respawn resumes its conversation).
- `SendMessage` with `notify_when_idle` to every builder you message; Monitor on events.log for READY and BLOCKED.
- Subagent frontmatter (`model`, `effort`, `isolation: worktree`) for every agent you launch; set both model and
  effort each time.
- The `real-set-walk` workflow for G1's agent layer (the only workflow allowed, per CLAUDE.md); resume a failed run
  with `resumeFromRunId`.
- `CronCreate` or `ScheduleWakeup` for a self-check every 20 minutes (`scripts.factory.state`: any READY head
  unpushed, any run on a superseded head) instead of memory.
- Hooks in place: the guard, walk-gate, precompact, stop-gate. None added this session without a ticket.

## M1 (after G1 PASS twice, or in parallel if the owner says so in step 4)
M1 is "the frame and piles, priced" (docs/milestones.md). Startable without touching M0 code: M1-24
(`docs/design/m1-screens.md`, docs only), M1-02 (the Sample Project's element key, 1.5 h of the owner's time),
M1-05 (Edison's counts per family per storey, 1.5 h), M1-06 (the Held-out instance script; the owner runs it with
sudo). Not before M0's G1: M1-00 (stubs every route). The drafts #595-#598 and #601 are 515 commits behind main:
harvest ideas ticket by ticket, never merge them.

## Finish line (checked by its command)
1. `uv run python -m scripts.walk.ready origin/main` exits 0.
2. Every G1 finding of block or misleading closed or filed; FL6 and FL13 PASS.
3. `docs/handoff/session-25-prompt.md` merged, opening with session 24's measures and M1 wave 0's plan.

## Housekeeping
- Never push local branches s22-fl7, s22-fl7b, s22-fl5b (real titles or a leaking commit).
- Session 23's evidence: .private/work/s23/ (g1-gaps.md, factory-gaps.md, fl5-cases.md, review-*.json, ux-*.md).
- Issues from session 23: #685 (flaky timing test), #689 (Correct form mays), #690 (Coverage totals).
- Open for the owner: #687 narrowed "setback" to "plot setback" (a Structural sheet titled only "SETBACK
  ARRANGEMENT" leaves its untitled section unaccounted, where the 11 Oct ruling gives Step 14).

## Binding from session 23 (`docs/knowledge/lessons.md`, Session 23)
- Before asking the owner anything, every running builder has its next message; ask once, at the start.
- A recogniser rule a review sent back once is designed from a cases table of the real sets first.
- Queue a posting run only for a head whose review passed; cancel a run whose head was replaced.
- The design gate names every item 1-11 once.

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full. The orchestrator stays Opus 5.5 `medium`, with no
Ultracode and no workflow but `real-set-walk`, unless the owner rules otherwise in step 4.
