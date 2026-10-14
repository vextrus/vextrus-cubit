# Session 27: M0's G1 fix wave, two G1 PASS, then M1's contract freeze, in 6 hours

**Budget: 6 h** (the owner, 13 Oct 2026). Orchestrator: Opus 5.5 `medium` all session (CLAUDE.md). Clock: `uv run python
-m scripts.factory.stamp start --budget 6h --state .private/work/s27/STATE.md --phases "fix=150,g1=150,m1=60"`
(phases overlap; `stamp phase` marks the one leading). Session 26 ran 14 h 20 min on the owner's waiver ("quality over
budget", 13 Oct 15:11Z and 21:52Z); that waiver was for session 26 only.

**The goal, in one line:** `uv run python -m scripts.walk.ready origin/main` exits 0 (two counted G1 PASS on main's current
product code), so the owner walks M0. It exits 1 today (0 of 2).
**Where M0 stands at session 26's close:** every M0 ticket is merged (D1 #774, D4 #771, D6 #801, D7 #805, and the integration
#811 with D3, D5, E1, B2), and every factory fix FX0-FX11 is merged. G1 walk #1 on main 3aca44fa (14 Oct 00:47Z) FAILED:
the script layer passed 16/16, the agent layer failed FL3 FL4 FL5 FL6 FL7 FL8 FL9 FL10 FL13 (FL1 FL2 FL11 PASS), with 2 BLOCKS
(#827 FL3, #828 FL6), 8 misleading, 19 findings (issues #827-#833 and 12 comments on older walk issues). The triage
(`.private/work/s26/close/g1-walk1-triage.md`, read it first) found **no confirmed regression from session 26's merges**
(one suspected: the act lag f-6 after D7, unmeasured): both BLOCKS are older code walk A never exercised (it never tried
that cancel order, never timed the main thread).
**Success this session:** S27-G1 to G8 merged, G1 walk PASS twice on the same product code, then "walk now" to the owner
(the Stop hook enforces it). M1-00 (the contract freeze) is built and reviewed beside the walks and merged only after the
owner's walk (O2).

## The plan
1. **0:00-0:15:** the checks below.
2. **0:00-2:30, the G1 fix wave** (the triage's tickets; acceptance writers first, all in parallel, then builders). Run the
   local three together (disjoint paths; `governor check` first), the cloud four beside them:
   | Ticket | What | Clears | Tier, where |
   |---|---|---|---|
   | S27-G1 | Plot never matches a page across a known Discipline; the re-match after the DWG reads decides again (`engine/plot/registration.py:174`, `:368`; `vextrus/takeoff/services/read_propose/plot.py`; #331) | f-1 BLOCKS, f-5 | hard, local (real drawings) |
   | S27-G2 | A cached sheet interactive <= 1,500 ms on the densest sheet (M0.md's measured item): decode in a Worker, keep decoded sheets cached, measure first (`web/src/sheet/SheetViewer.tsx:122`, `gl.ts:348`) | f-2 BLOCKS | hard, local (real drawings) |
   | S27-G3 | An architect's structure-drawing plans are proposed out, not to Walls + Rooms (#336; M0 finish line item 7) | f-14 | hard, local (real drawings) |
   | S27-G7 | Enter-to-count lag: time it with D7 reverted first, then stop refetching the whole proposals list per answer (#319) | f-6 | hard, local |
   | S27-G4 | Words and marks: the convention signer named, the source words agree, the toolbar's check mark when all settled, the Fonts headings, the Coverage click (ux-critic words review) | f-4, f-8, f-11, f-12, f-9 | ordinary, cloud |
   | S27-G5 | A group row's title not cut to nothing by its note (#670) | f-3 | ordinary, cloud |
   | S27-G6 | Members truth: refuse an invitation for an address with no account at invite time; Ended rows offer Renew only; acts per access period; the MD's "who from Vextrus has access" notice (a trust boundary: a committed check) | f-7, f-13, f-19, f-18, f-17 | hard, cloud |
   | S27-G8 | Factory: a G1 item FAIL must name its finding (factory.md 5; FL9 failed with none) | FL9 | ordinary, cloud |
   | S27-G9 (only with time left) | Discipline-qualified `?sheet=` for repeated or missing numbers | f-10 | ordinary, cloud |
   Merge G7 before G4 (G4's check mark reads the counts G7 changes). Each product ticket gets its design gate on the REAL
   API (session 26's lesson). Engine tickets (G1, G3) land as one integration PR with one no-post and one posting run (Q-R10).
3. **~2:30-5:00, G1 walk #1 and #2** on the same main (`uv run python -m scripts.walk.run <sha40> --hold-minutes 90`, then the
   `real-set-walk` workflow). The walk must repeat CW-01's cancel order and time per-sheet stalls. Quiet machine: no posting
   run, no local suite, swap under 2 GB (`swapon --show`; the owner cleared it with `swapoff -a && swapon -a` in session 26).
   A BLOCK, misleading finding or failed item is fixed before the second walk (Q-R8).
4. **Beside the walks, M1-00** (the contract freeze, docs/plans/M1.md:786-805; orchestrator + acceptance-writer, budget 3 h,
   one PR): built and reviewed, merged only after the owner's walk (it touches `vextrus/` and `engine/`, so merging resets
   walk-ready). Wave 1's acceptance writers start the moment it merges (session 28 if the walk falls there).
5. **5:15-6:00:** measures, lessons, session 28's brief, `stamp end`. "Walk now" to the owner only if `scripts.walk.ready
   origin/main` exits 0.

## Wave 1 of M1, for when M1-00 merges (docs/plans/M1.md rolling order :711-727)
M1-01 scorer (cloud, hard), M1-07 Rule Set (cloud, ordinary high), M1-08 live_model spine (cloud, hard), M1-10a placement
(cloud + one posting run), M1-12 drawings profiles, M1-13 Jev nodes, M1-14 rates (after M1-07), M1-44 projects area,
M1-47 platform walls (cloud, hard), M1-29 guarded repair (local, hard). Acceptance writers in two batches of at most six
local agents. Expect launches in session 27 or 28 and merges in session 28.

## Before the session: the owner's steps (check each in the first 15 minutes)
1. Remove the gate databases `vextrus_gate774`, `vextrus_gate771`, `vextrus_gate811`, `vextrus_diagcount`, and session 25's
   `vextrus_gate714`, `vextrus_gate751` if still there.
2. Remove the scratch worktrees (left because recursive deletes are refused): `.private/work/s26/wt/*`, the gate folders'
   `tree/` worktrees (`.private/work/s26/gate*/tree`, `diag-count/tree`, `refute771/wt`, `refute786/wt*`), the writers'
   throwaways (`.private/work/s26/*-writer/throw*`), and `.claude/worktrees/S25-E1`, `.claude/worktrees/M1-24`,
   `.claude/worktrees/S26-FX2` once their sessions are stopped.
3. Stop the local builder sessions left idle: E1 (copies of 472fc490), M1-24 (copies of ed74f859), FX2 (f0abe17b).
4. Q-R6: add `smoke` to ruleset `main` (id 24103083) once every open PR shows a `smoke` status (FX0 #783 merged; check
   `gh pr list` statuses first).
5. Before M1-06: the key user's `initdb` for the Held-out cluster (the owner's ruling), when the orchestrator asks.

## First 15 minutes
1. `date -u`; `stamp start` (above); `uv run python -m scripts.factory.state`; `uv run python -m scripts.factory.watch
   ensure`. The factory mod's wake reports events: arm no events Monitor; send `notify_when_idle` to each local builder.
2. `df -h /`, `free -g`, `swapon --show`; `gh run list --workflow e2e.yml --branch main --limit 5`; `gh run list --workflow
   web.yml --branch main --limit 3` (main was red 21:49Z-23:06Z on 13 Oct until the hotfix #817).
3. Read `.private/work/s26/close/g1-walk1-triage.md` (the wave), `.private/work/s26/STATE.md` (every ruling) and
   `.private/work/s26/close/measures.md`.

## Maximum safe parallelism (from the code, not memory)
- **Cloud builders: up to 9 at once in wave 1** (the 9 cloud rows above, M1-10a's cloud half among them). The platform
  cap is 16 (`governor.py:111`), but `AREA_CAP = 3` per hot-file area (`governor.py:114`) may hold some of the 9 first:
  several wave-1 tickets add migrations under `vextrus/`. Fix rounds and the integration fixes share that cap. Launch one first, check it cloned
  `vextrus/vextrus-cubit` and pushed, then fan out.
- **Local agents: at most 6 at once** (`MAX_LOCAL_AGENTS`, `governor.py:107`; M1.md:781). That counts acceptance writers,
  M1-29's builder, M1-24's builder, gate walkers (ux-critic), refuters and the G1 walk's agent layer. During a G1 walk,
  keep local agents to the walk's own (quiet machine).
- **Reviews: 8 slots** (`REVIEW_SLOTS`), **3 tickets per hot-file area** (`AREA_CAP`, `governor.py:114`).
- **Floors:** 5.4 GB free memory after the unit's cost, swap above 2 GB refuses, disk below 30 GB refuses
  (`governor.py:102-106`). Run `uv run python -m scripts.factory.governor check <unit>` before every launch, review,
  test run and walk. A refusal waits; it is never talked round.
- **One real-drawing run at a time** (`scripts.factory.rdlock`), 25-45 min each. In wave 1 only M1-10a and M1-01 need one.

## What session 26's factory upgrades change in the runbook
Every one below merged on 13 Oct (`.claude/skills/orchestrate-wave/SKILL.md` and `commands.md` as merged).
| Upgrade | PR | What changes |
|---|---|---|
| The factory mod's wake | FX2 #794 | No Monitor on `events.log` and no 30-minute re-arms. The mod wakes you with one batched message (12 an hour, then `wakes capped`), plus a band of live tickets. Monitor stays only for one foreground command's log. Send `SendMessage ... notify_when_idle` to each local builder you launch. |
| The watcher's missed events; Factory-Status replies | FX1 #786 | BLOCKED without a reason, carried-over launches, renamed local branches, walk.json/verdict.json and `Factory-Status:` commits now write events. A builder answers a status message with an empty `Factory-Status:` commit, and a READY head stays READY under it. You no longer read origin and local tips by hand at every check-in. |
| Delta review past the cap | FX4 #789 | Round 3 to 9 is `review run <PR> --round <n> --exception delta-review --reason "<text>"`: one lens on the fix's own diff, plus replays of the earlier rounds' kept attacks. Session 25's cap closed 5 PRs; this merged 9 in session 26 at $1.19 a run. |
| Replays judged, not trusted | FX9 #808 | A failed replay is a claim for the round's refuter. A replay failing off its own round is STALE. A same-head re-round is allowed only after a FIX that rested on replays no refuter confirmed. No re-round after a refuter-CONFIRMED replay (the orchestrator's ruling: no refuter shopping). |
| No lens on unfinished CI | FX7 (in #789) | `review run` exits 3 on a head whose `ci` is red or unfinished. Wait for green CI; do not queue a review behind running CI. If GitHub shows a finished job as in progress, re-run ci (lessons-draft). |
| verify = CI | FX3 #784, FX10 #806, FX11 #809 | Local verify re-runs a timed-out web file alone (workers capped), runs CI's harness node tests (argv read from `ci.yml`) and runs the slowed-fake web pass (latency read from `web.yml`). A local verify now matches CI, so a READY head should not go red on CI for these classes. |
| publish's Cut check; empty-Cut words | FX6 #782, FX8 #792 | `scripts.factory.publish` refuses a body merge_ready would refuse, before opening the PR. An empty Cut is "None.", "Nothing.", "None cut.", "Nothing cut." or "Nothing was cut." (`scripts/tests/acceptance/ts26fx8/`). Builders write "None.". |
| e2e on PRs; design gate n/a for test-only | FX0 #783 | A product-path PR runs `smoke`; a PR whose `web/**` changes are all tests gets design-gate "not applicable" automatically. |
| rdlock and the branch it reads | F3 #737 | The runner refuses when the local branch is not `--head`. `builder-live` is in the launch contract (exit 2). |
| The seed-figure lint | SEEDLINT #765 | A docs page with a seed table goes through the lint before review (M1-24). |
- **Owner step still open from Q-R6:** add `smoke` to ruleset `main` (id 24103083) once every open PR shows a `smoke`
  status. Not done at close (see the owner's steps).

## The owner's questions (one at a time, recommendation first)
Confirm these three at the M0 walk. Each is the orchestrator's ruling from session 26, already built in:
| Ruling (session 26) | Where | The question |
|---|---|---|
| A typed storeys correction is the QS's own word: no Question restating it; ", corrected" at once (19:50Z). | B2 #780 / #811 item 1 | Confirm: the title-vs-plans Check stays quiet on a storeys count the QS typed. Recommendation: yes, because the QS has already answered it. |
| Fire allowance ৳120/sft from 7 storeys (৳50/sft below), stated in m1-screens §9 (16:52Z). | M1-24 #798; docs/specs/M1.md:1022-1023 (Q32) | Confirm the threshold and rates as the spec states them. Recommendation: yes, because the signed spec says so; A4 (B.4 as price source) is not a fire decision. |
| The copies card header stays "File", and options keep "at x" (18:56Z). | D6 #801; pinned by `ts25d1`, `ts24a3` | Confirm the words. Recommendation: yes, because m0-screens 6.7's words table covers the File cell only, and the committed tests pin both. |
Also ask, before M1-00 merges if main is not yet walked: may M1-00 be built and reviewed before the walk and merged
right after it? Recommendation: yes. Building it does not change main, and O2 binds the merge, not the branch.

## Leftovers (with numbers)
- **Open:** #753 M1-06 (rebuild around its own cluster after the walk); #601 (M1's slice reference, kept).
- **G1 walk #1's issues:** #827 #828 #829 #830 #831 #832 #833 (and 12 comments on older walk issues; the triage warns
  f-17 was filed onto #763, a different issue: treat it as new).
- **Gate-found (session 26):** #791 #795 #796 #803 #807 #810 #812 #813 #814 #818 (#818: the Correct form's Save below
  the fold under a Question card; consider it with G4/G5).
- **Review-found (filed):** #781 #785 #787 #788 #790 #793 #797 #799 #800 #802 #815 #816.
- **Owed checks (factory, filed at close):** #819 stale ci rollup holds FX7; #820 launch prints REFUSED last; #821 a backend
  test per fake-API promise; #822 fix messages name the acceptance pins (also in CLAUDE.md now); #823 cloud verify timeouts
  after FX3; #824 the eslint config flake; #825 the lander must not merge a head whose CI predates main's tip (D4 over D7
  broke main); #826 the wake table keeps merged tickets. Take #825 and #821 early: both cost hours this session.
- **From session 25, still open:** F4 the guard (local branch `s25-f4`, needs its own design); #739-#746, #752, #758, #760,
  #764, #735 (#735 owes Q15's Revision rule).

## Binding lessons (docs/knowledge/lessons.md, Session 26)
- Read the whole launch output; never pipe it to `tail -1`; never paste review summaries into a cloud prompt.
- A design gate walks the REAL API; every UI head gets a gate walk after every fix, delta PASS or not (gates failed 5 items
  on heads review had passed).
- A fix message or gate brief that asks for words first reads the acceptance tests that pin them (#822; CLAUDE.md).
- A delta review's replay is a claim for the refuter (FX9); never re-review the same head to shop for a refuter.
- The integration review and no-post run find what separate PRs miss (three tickets BLOCKED at #811 r1).
- Before landing a PR whose CI predates main's tip, `land update` and let CI run again (#825; D4 over D7 broke main).
- Fast-forward a local builder's branch before a real-drawing run on it (F3's rdlock check refuses a mismatch now).

## Measures of session 26 (`.private/work/s26/close/measures.md`)
| measure | value |
|---|---|
| PRs merged | 23: FX0-FX11 (#783 #786 #794 #784 #789 #782 #792 #808 #806 #809), F1 #748, F3 #737, SEEDLINT #765, M1-24 #798, D1 #774, D4 #771, D6 #801, D7 #805, HF1 #817, and #811 (with #772 #775 #778 #780) |
| round-1 PASS | about 0.40 (product 0.50, factory 0.40, docs 0.00; window to 21:52Z) |
| review spend | about $107 to 21:52Z over 48 runs, plus the later rounds (see measures.md) |
| delta review | 9 capped PRs merged by 21:52Z, more after; 3 false FIX before FX9 |
| design gates | 16 walks; 6 failed an item on a head review had passed |
| G1 | walk #1 on 3aca44fa: FAIL (script 16/16; agent 3/12 items PASS; 2 BLOCKS, both older code) |
| main red | 21:49Z-23:06Z (D4 over D7; hotfix #817) |

## Laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full. No dynamic workflow but `real-set-walk`. Nothing from a real drawing
in git, an issue, a PR or a cloud prompt. M1's wave 0 waits on the owner's M0 walk (O2); acceptance writers wait on M1-00.
