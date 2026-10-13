# Session 26: the factory's measured fixes and M0 walk-ready twice, in 6 hours

**Budget: 6 h** (the owner, 13 Oct 2026: a standard session is now 6 h for the work the old 12 h did). Orchestrator: Opus 5.5
`medium` all session (CLAUDE.md). Clock: `uv run python -m scripts.factory.stamp start --budget 6h --state
.private/work/s26/STATE.md --phases "land=195,g1=115,close=50"` (phases overlap in practice; `stamp phase` marks
the one leading).

**The goal, in one line:** `uv run python -m scripts.walk.ready origin/main` exits 0 (two counted G1 PASS on main's current
product code), so the owner walks M0. It exits 1 today (0 of 2). Beside it: the factory fixes FX0-FX6 land, and M1 wave 0's
docs move. **Success this session = the factory fixes merged, every M0 ticket merged, and one G1 PASS; walk #2 opens session 27, then the owner walks.**

## The plan, built around the two clocks that bind: the real-drawing lock and the walk
Session 25 measured: a posting run 25-45 min (with `land update` and CI, ~50 min), one at a time
(`scripts.factory.rdlock`), stale after any engine merge; a G1 walk ~70 min script layer + ~45 min agent layer (~115 min),
on a quiet machine (no posting run, no local suite). Product paths (they reset walk-ready, `scripts/walk/ready.py:43-44`):
`vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`. FX paths (scripts/, tools/, .github/, .claude/, docs/) may
land during a walk. **The honest target (the owner's Q-R10/Q-R11):** the factory fixes merged, M0's last tickets merged,
**one G1 PASS** in this session, and walk #2 (a repeat on the same product code counts) opening session 27; two PASS only if
the final product head is on main by about 1:00, which session 25's measures say it will not be.

1. **0:00-0:15:** the checks below; read CLOSE.md; triage the stale PRs.
2. **0:00-1:45, the last M0 tickets to PASS, each on its own PR:**
   - **Web-only (no posting run), land one by one as each passes:** D1 #774 (shared files with what merged: `Step1Inspector.tsx`,
     `step1/en.po`; land update and re-verify), then D4 #771 if it passes (not on G1's path). D2 #773 merged in session 25.
   - **Engine-path (Q-R10): D3 #772 (r1 PASS), D5 #778 (r1 PASS, gate posted), B2 #777 (fix round owed), E1 #775 (round 3
     owed)** (B1 #751 merged at session 25's close): each passes review and its gate on its own PR; none is landed alone.
3. **~1:45-3:15, the integration land (Q-R10):** branch `s26-m0-int` from main, merge the passed heads in the order D3,
   D5, B2, E1 (regenerate the catalogue on a conflict, never hand-merge it), verify once, open one PR naming every ticket
   and its source PR. One no-post run; judge its table line by line against each ticket's intent (gains real, nothing
   lost, no failed stage; E1's three continuations extended and no conflict gained). Then one posting run with the judged
   reason, the design gate, land; close the five ticket PRs as "landed in #<int>".
4. **FX0-FX6 from 0:00, beside steps 2-3** (acceptance writers first, then builders; tiers below). Not product paths.
5. **G1 walk #1 only when every G1-path ticket has merged (Q-R11)** (`uv run python -m scripts.walk.run <sha40>
   --hold-minutes 90`, then the `real-set-walk` workflow), about 3:15-5:10, quiet machine. If it PASSes, walk #2 on the same
   product code opens session 27 (it counts as the second PASS); if it finds a BLOCK, misleading finding or failed item,
   fix it before any second walk.
6. **5:10-6:00:** measures (`scripts.factory.measures`), lessons, session 27's brief, `stamp end`. "Walk now" to the owner
   only if `scripts.walk.ready origin/main` exits 0 (the Stop hook enforces it).
- **Budgets:** a builder 45 min, a fix round 30 min; review spend this session about $100 (session 25: $94 over 37 runs);
  over it, stop new FX reviews before any M0 review.
- **Reviews** run through `uv run python -m scripts.factory.review run <PR> --round <n>` (CLAUDE.md), not `/review-pr`.

## Before the session: the owner's steps (check each in the first 15 minutes)
1. The remote branch `s25-close` is deleted on GitHub (its first commit carries one member mark from the Sample Project; the
   guard refuses the orchestrator a remote branch deletion). Closed PR #767 still shows that commit: the owner judges it.
2. Nothing for e2e yet: FX0 makes it run on PRs; the owner adds `smoke` to ruleset `main` only after that (Q-R6).
3. The scratch worktrees under `.private/work/` and the gate databases (`vextrus_gate714`, `vextrus_gate751`) are removed.
4. Each local builder stopped once its work is committed (`s25-e1`, `s25-w3`, `m1-24`, `m1-06`); cloud builders D1, D2, D4,
   D5 may still update their branches.

## First 15 minutes
1. `date -u`; `stamp start` (above); triage the stale PRs #572, #595-#598, #601 (sessions 15-16; one of their kind blocked a crosspr): close what is superseded, keep #601 as M1's reference; `uv run python -m scripts.factory.state`; then read **every live ticket's branch tip
   yourself**: origin (`git ls-remote origin`) AND each local builder's local branch (`git rev-parse <branch>`). Until FX1 and
   FX2 land, the event log misses BLOCKED pushes without a Factory-Reason, every carried-over ticket, renamed local branches and
   all builder replies (#761). Arm one Monitor on events.log and one that polls `git ls-remote origin` for the live branches plus `git rev-parse` of the
   local builders' branches (session 25's stopgap); re-arm both every 30 minutes.
2. `df -h /`, `free -g`, `swapon --show`; `gh run list --workflow e2e.yml --branch main --limit 5` (green on every main run since #749 at 04:04Z on 13 Oct).
3. Read `.private/work/s25/STATE.md` (timeline, every ruling), `.private/work/s25/CLOSE.md` (each ticket's exact head and
   next step at close), `.private/work/s25/explore/` (retro.md, factory-mod-design.md, claude-code-features.md,
   brief-coldread.md, brief-refute.md) and `.private/work/s25/walkA-briefs.md`.

## M0: where each G1 item stands (walk A on main a492e91a, 13 Oct: FAIL)
Script layer 15/16 (the Sample Project's act sampling); agent layer 0 BLOCKS (walk 1 had 4), 3 misleading, FL8 and FL9
FAIL, FL1/FL10/FL11 NOT_WALKED. **The PASS rule needs every item PASS** (`docs/specs/factory.md` 876-883) and the owner ruled
(Q-R8) that a real defect in the finish line fails its item, misleading or not: B2 and E1 are on the critical path.
| Item | Fix | Its state at close: see CLOSE.md for heads |
|---|---|---|
| FL8 f-1 one-source continuation run | C1 #738 | merged |
| FL13 status bar, save state | A3 #714 | merged |
| FL1/FL10/FL11 not walked | W3 #766 (every role signed in, a role walker, one retry) | merged |
| FL10 words, inspector history | B1 #751 | merged |
| FL10 walk 1 f-5: the Engineer's acts panel names the sheet and its earlier reason (§4.4, #719) | D5 #778 (B1 did not fix it) | r1 PASS, gate posted |
| FL8 f-3 dead "Next open item" | D2 #773 | merged |
| FL5 f-4 Discipline totals drop left-out sheets | D3 (branch s25-d3) | see CLOSE.md |
| FL9 f-1 copies table | D1 (branch s25-d1, rebuilt on #714) | see CLOSE.md |
| FL8 f-2 E corrects no storeys | B2 #777 (carries a migration and tenancy-wall grants: a trust boundary) | fix round owed (see CLOSE.md) |
| FL9 f-6 hyphenated member-mark ranges | E1 #775 (local builder; an engine change; the owner's Q-R9: ranges sharing one boundary mark continue, W-334 amended) | see CLOSE.md |
| Script: act sampling | W2 #768 | merged |
| FL13's later polish: save words after reconnect, jump to a sheet | D4 #771 | not on G1's path (FL13 passed in walk A); lands when it passes |

## The factory fixes (each names the cost it removes; `.private/work/s25/explore/`)
Writers first (CLAUDE.md: acceptance tests come first), then one builder each. FX paths are not product paths.
| FX | What | Files | Tier | Cost removed (session 25, measured) |
|---|---|---|---|---|
| FX0+FX5 | e2e runs on PRs (a product-path PR runs `smoke`; any other PR gets `smoke` reported passing, as `real-drawings-na.yml` does for its check); and `real-drawings-na.yml` posts design-gate "not applicable" when every `web/**` path a PR changes is a test (`web/src/acceptance/**`, `web/e2e/**`, `*.test.*`) (Q-R2) | `.github/workflows/e2e.yml`, `real-drawings-na.yml` | cloud, ordinary | a PR could break the served product unseen; ~20 min and a refused land for each test-only web PR (#711, #724) |
| FX1 | The watcher: `trailers.py:111-113` (BLOCKED without a reason writes no event), `watch.py:427` (carried-over launches dropped), renamed local branches; events for walk.json, verdict.json and `Factory-Status:`; and the Q-R6 rule that a builder answers a status message with an empty `Factory-Status:` commit, which today would make `ci_gate.is_ready` false: change `scripts/factory/ci_gate.py` (a `Factory-Status:`-only commit on a READY head keeps it READY), `scripts/merge_ready.py` and `.claude/agents/builder.md` together | `scripts/factory/` | cloud, ordinary, `high` | ~290 builder-minutes unseen; the owner relayed a builder's reply by hand (#761) |
| FX2 | The factory mod's wake (Q-R4): its 15 s poll submits one batched wake prompt on READY, BLOCKED, a builder commit, a walk file or CI red (one per ticket per 15 min, 12 an hour); a status band of live tickets. (Separately, the orchestrator itself sends `SendMessage ... notify_when_idle` to each local builder it launches: an act, not code.) | `tools/mod/vextrus-factory/` | LOCAL (cloud loads no plugins), after FX1 | the 30-minute Monitor re-arms; unseen heads |
| FX3 | `scripts/verify.py` re-runs a web test file that failed only by timing out, alone, with vitest workers capped; a real failure still fails (Q-R3) | `scripts/verify.py` | cloud, ordinary | 3 builders BLOCKED by load and verified locally (~55 min each); parallel local verifies timed out too |
| FX4+FX7 | At the round cap, a fix-only delta review (Q-R1): round 3 reviews only the fix's own diff and re-runs the earlier rounds' attack tests, and merges if it passes; and no lens starts on a head whose CI is red | `scripts/factory/review.py`, ledger | cloud, hard (the ledger is a trust boundary) | 5 PRs cut at the cap: 15 of 37 review runs, $45.83 of $94.04, none merged; $12.05 on 3 refused runs |
| FX6 | `scripts.factory.publish` runs merge_ready's Cut check on the body it builds and refuses before opening the PR (#759) | `scripts/factory/publish.py` | cloud, ordinary | 4 refused lands (#755, #757 twice each) |
- **The 30 % cap (Q17) is waived for FX0-FX6 only** (Q-R5). An FX still in review at 2:00 keeps going (FX paths do not touch
  the walks); new factory tickets start only if all six have landed.
- **Then, only with time left:** the seed-figure lint #765 (branch s25-seedlint, fix 2dc5c093 READY; its round 3 under FX4's
  delta review), M1-24 on it; F1 `review self` (#754, branch s25-f1); F4 the guard (acceptance c825631d on the LOCAL branch
  s25-f4, never pushed; needs its own small design first: no command exists yet for a throwaway cloud launch that proves the cloud CLI keeps the
  settings file and the guard's selftest still refuses a forced update of a remote branch). Filed: #739-#746, #752, #758, #760, #764, #735.
- **After FX0 has run green on a PR and every open PR shows a `smoke` status:** the owner adds `smoke` to ruleset `main`
  (id 24103083) (Q-R6). Not before: a required check that never reports holds every PR.

## M1 wave 0 (docs/plans/M1.md O2: docs and owner-time only until the owner's M0 walk)
- **M1-24 m1-screens:** after #765 lands, a fresh PR from branch s25-m1-24b (local head b84c18e7: the qs-critic's N1-N6 and
  #756's round 3 fixes); the lint green on it, review, the qs-critic signs.
- **M1-02 and M1-05:** counted and ruled (`.private/work/m1-02/`, `.private/work/m1-05/`, kept out of git). Next: the owner
  confirms both drafts on a review page (~1.5 h a set, M1.md:223) and runs custody once; M1-01 builds that step after the walk.
- **M1-06 the Held-out instance:** its own PostgreSQL 18 cluster (the owner's ruling). A code ticket: after the owner's M0
  walk, and it needs the key user's `initdb` (an owner step then). #753 stays open as the reference.
- **Q15's act** is in `docs/specs/M1.md` (#734, story 125); #735 owes its Revision rule.

## The owner's rulings of session 25 (13 Oct 2026; they bind)
| Q | Ruling |
|---|---|
| Start | Q10's production-grade numbers are M1's finish line. A trust-boundary finding of 50-74 still blocks (the bar, #757). factory.md:652 lifted for the factory mod. |
| f-2 | A view on a confirmed sheet takes its sheet kind's steps (#733). |
| M1-05 | Ten Edison count rulings, as conventions: tanks and what carries them are step 10 (M2), never storeys; tie beams and slab on grade are step 5 (M2); a vertical piece counts once per storey; a beam that splits a slab makes two panels. Detail: `.private/work/m1-05/rulings.md`. |
| M1-02 | The analyst route (reverses plan Q2); both disagreements ruled (`.private/work/m1-02/disagreements.md`). |
| #687 | Keep "plot setback". |
| #705 | Keep the 4.5-6 kg/sft check and the ruled allowances (4.91 at G+9). |
| M1-06 | Its own PostgreSQL cluster. |
| A4 | M1-24's example prices Steps 9-14 from research B.4. |
| Save state | After a lost act, once the connection is back: "Not saved: your last change did not reach Vextrus. Do it again." No automatic retry (D4). |
| Budget | 6 h a session from now, for the same work. |
| Q-R1 | At the round cap: a fix-only delta review, not a cut (FX4). |
| Q-R2 | Design gate: automatic "not applicable" for test-only web PRs (FX5). |
| Q-R3 | Verify re-runs timed-out files alone (FX3). No spending. |
| Q-R4 | The factory mod may submit one batched, rate-capped wake prompt into the orchestrator's session (FX2). |
| Q-R5 | Factory fixes beside M0 from the start; the cap waived for FX0-FX6. |
| Q-R6 | e2e becomes required once it runs on PRs (FX0); builders answer status messages with a `Factory-Status:` commit (FX1). |
| Q-R7 | Session 25 finished M0's heads before closing (CLOSE.md). |
| Q-R8 | Every real defect in the finish line fails its G1 item: B2 and E1 are needed. |
| Q-R9 | Two member-mark ranges sharing exactly one boundary mark (one member continued on the next sheet) continue one another. |
| Q-R10 | M0's last engine-path tickets pass review on their own PRs, then land as one integration PR with one real-drawing run. |
| Q-R11 | No G1 walk until every G1-path ticket has merged. |

## Binding lessons (docs/knowledge/lessons.md, Session 25)
- The event log is not enough: read origin and local tips each check-in until FX1/FX2 land.
- An accept reason comes from that posting run's own table; after an engine merge, `land update` and a fresh no-post first.
- Local verifies run one at a time (parallel ones time out) until FX3 lands.
- A docs page with a seed table goes through the seed lint before review.
- Nothing from a real drawing in a commit, PR or brief: session 25's first close PR carried one member mark and was replaced.
- An orchestrator's READY commit names no fix it has not diffed into the tree (session 25: D2's READY claimed a fix its tree lacked; round 2 caught it).
- Product UI fixes made new faults in round 2 on D1, D2 and D4 alike: give each fix message the earlier rounds' attack tests to re-run, and use FX4's delta review.

## Measures of session 25 (`.private/work/s25/explore/retro.md`, window 02:10Z-07:40Z, plus the close)
| measure | value |
|---|---|
| PRs merged | 19 (#732 #724 #734 #725 #723 #749 #750 #711 #733 #757 #755 #738 #769 #770 #714 #766 #768 #751 #773) |
| round-1 PASS | 5 of 14 (product 0/3, factory 4/8, docs 1/3) |
| rounds per merged PR / per ticket incl. closed | 1.64 / 2.27 |
| review spend | $94.04 over 37 runs (window) |
| factory share of builder minutes | 0.79 (cap 0.30) |
| e2e on main | green for the first time (after #749), every main run since |
| G1 | walk A FAIL (15/16; 0 BLOCKS; 3 misleading) |

## Laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full. No dynamic workflow but `real-set-walk`. Nothing from a real drawing
in git, an issue, a PR or a cloud prompt.
