# Session 28: land the rest of the G1 fix wave, two G1 PASS, then "walk now"; M1-00 merges after the owner's walk

**Budget: 8 h recommended, 6 h drafted** (ask the owner once at the start; see "First tasks"). Orchestrator: Opus 5.5 `medium`
all session (CLAUDE.md; the owner's Q27). Clock: `uv run python -m scripts.factory.stamp start --budget 8h --state
.private/work/s28/STATE.md --phases "first=150,land=120,g1=240,close=45"` (phases overlap; with 6 h: `--budget 6h` and
`"first=120,land=90,g1=210,close=45"`). **Read "First tasks, before G1 walk #1" below before launching anything.**

**The goal, in one line:** `uv run python -m scripts.walk.ready origin/main` exits 0 (two counted G1 PASS on main's current
product code), so the owner walks M0. It exits 1 today (0 of 2; no G1 walk ran in session 27).

**Where M0 stands at session 27's close (14 Oct 2026, 08:50Z):**
- Merged in session 27: G5 #837 (a shared title survives its note), G2 #842 (a dense sheet decodes off the main thread; a cached
  re-open has no stall; 4.6's first-open state; focus kept with a ring), G8 #840 (a G1 item FAIL must name its finding), and the
  factory fixes #839 (#835 the watcher and the wake ignore old launches and lines), #841 (#836 `uv run python -m tools.leakscan
  sweep-remote`), #845 (#825 the lander and merge_ready refuse a head that does not contain main's tip; ADR 0041 amended).
  Also merged: G6 #846 (Members and access tell the truth; its real-drawing run accepted clean, 0/0/0). G7 #843: see item 1.
- **Open, in landing order (each: `scripts.land update <PR>`, then a design-gate walk of THAT head, then land; the owner's
  ruling, 14 Oct: "Re-walk every new head"):**
  1. G7 #843 (round 3 PASS at 2589d363; gate PASS there; at close it was being updated with main after #846): a gate walk of
     the updated head, then land. If it merged at close, skip.
  2. G4 #838 (merges after G7): round 3 PASS at cbb59cf8 (after two fix rounds: the ✓ read through the snapshot, the
     typed-number source line, the ✓ waits for reading files, a cached arrival never shows "Proposals ready"). Update after
     G7, then its first gate walk, then land.
  3. The engine integration #844 (G1 + G3, branch s27-eng): re-integrated at 5138e2c80 with both fix rounds (G1: a Discipline
     change re-matches the Plot as a job on the cad queue, migration drawings 0008; the job ran inline only, never in a real cad
     worker; G3: a lintel beam is not a structure word). Round 2 at 33f845ae4 was FIX: G1's re-match skips a held DWG read
     anyway (50); G3's "framing" counts as structure on an architect's ceiling/partition framing view (55). G1's round 2 is
     pushed (711eeb9a4; review_self not run); G3's round 2 was still running at close (s27-g3b): merge their READY heads into s27-eng with main, verify,
     READY commit, CI, round 3 (delta review), the posting real-drawing run
     (`--accept` the judged gain: G3's 20 re-routed views; G1 changes no measure in the normal read order), land. Then run the
     cad worker once on a real set and watch the match_plot job land.
- **Then G1 walk #1** on main (`uv run python -m scripts.walk.run <sha40> --hold-minutes 90`, then `real-set-walk`): quiet machine,
  the walk repeats CW-01's cancel order (a PDF before its DWG with colliding numbers) and times per-sheet stalls on the densest
  sheet (G2's measure on a real GPU is still unmeasured). A BLOCK, misleading finding or failed item is fixed before walk #2.
- **M1-00 (the contract freeze, branch m1-00, READY 698e6877, my heading commit def572b97):** built, not yet published: publish
  needs a local verify record for tree 78a03b57c (`scripts.verify` in .private/work/s27/wt/m1-00; it was stopped for memory).
  Then review; merge only after the owner's walk (O2). Check its migrations against drawings 0008 from #844.

## Before the session: the owner's steps (check each in the first 15 minutes)
1. Remove session 27's gate databases: `vextrus_gate837`, `vextrus_gate837b`, `vextrus_gate842`, `vextrus_gate842b`,
   `vextrus_gate842c`, `vextrus_gate842d`, `vextrus_gate843`, `vextrus_gate843b`, `vextrus_gate843c`, `vextrus_gate843d`,
   `vextrus_gate846`, `vextrus_gate846b`, `vextrus_gate846c` and their `_test_*` copies.
2. Remove session 27's scratch worktrees (36 registered; recursive deletes are refused): `.private/work/s27/wt/*` (keep
   `eng`, `g6`, `m1-00` and `close` until their PRs land), `.private/work/s27/gate*/tree`, every `*-writer/throwaway`,
   `g7-writer/tw`, `g6-amend`.
3. Stop the idle local builder sessions s27-g2 and s27-g7; keep s27-g1 and s27-g3 until #844 lands (s27-g3's round 2 on
   "framing" was still running at close: its head may be local only on s27-g3b; push it after a leak scan).
4. Q-R6: add `smoke` to ruleset `main` (id 24103083): every open PR showed `smoke` green in session 27.
5. Delete the 96 old-product `inc/*` branches with leak hits (`.private/work/s27/sweep-hit-branches.txt`) if not done.
6. Before M1-06: the key user's `initdb` for the Held-out cluster, when the orchestrator asks.

## Owner rulings in session 27 (their words)
- #825: "Yes, always (Recommended)": the lander refuses a head that does not contain main's tip.
- Gates after `land update`: "Re-walk every new head (Recommended)". Never carry a gate verdict to a new head (I did once on
  #842 and the classifier refused the land; the real walk then passed).
- Session 27's two cuts (orchestrator, for budget): G1 walk #2 and then walk #1 moved here; S27-G9 (Discipline-qualified
  `?sheet=`) not started.

## First tasks, before G1 walk #1 (the owner's rulings, 14 Oct 2026)
A factory review ran beside session 27 (`docs/research/2026-10-14-factory-review.md`); the owner ruled on 28 questions
(`docs/plans/factory-s29.md`): session 29 is factory-only, M1 starts in session 30. For this session the owner ruled that G1's
new bar is "built as session 28's first tasks before walk #1, we'll not take any risk of ending with G1 at 0 of 2 again", and
that this session takes "every minimum actions applying the evidence rule in session 28 now and have the most necessary
factory fixes, changes that will have the direct impacts on shortening the loops between us and the M0 walks".

Launch at 0:15, beside the land phase: acceptance writers first (Opus `high`), then cloud builders. None touches a product
path (`vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`), so none stales a walk; keep it that way.
1. **S28-W1, G1's evidence bar** (cloud, hard; merges before walk #1). Today a PASS needs zero BLOCKS and zero misleading
   findings on two walks in a row, an item fails when any critic fails it, and misleading findings ran 13, 8, 8, 3, 8 over
   five walks. In `.claude/workflows/real-set-walk.js` (triage and the critics' briefs):
   - an item FAILs only on a BLOCKS finding (a wrong number, a blocked demo, blocked signing) or on a misleading finding with
     reproduction steps on that head; every other finding is OTHER: filed as a walk issue and listed for the owner at
     sign-off, and its item stays PASS. Triage step 1 changes with it: today "an item is FAIL if either says FAIL"; after
     W1, triage turns a critic's FAIL into PASS when the only findings naming the item are OTHER (never the reverse);
   - a finding is misleading only when the display would lead a QS to a wrong quantity, a wrong sign-off or a wrong belief
     about what was read, and only with its reproduction steps (kept in the walk's private folder, never in an issue);
   - a repeat mode for walk #2: the critics walk walk #1's items, its findings' reproduction steps and the fixes since, not a
     fresh exploration; a new finding there fails the walk only if it BLOCKS; other new findings are filed;
   - `scripts/walk/verdict.py` and `scripts/walk/ready.py` change only if the tests need it; docs/specs/factory.md 5 "G1" and
     ADR 0042's history carry the ruling.
   Acceptance pins: an OTHER finding naming an item leaves the item PASS; a misleading finding without reproduction steps is
   OTHER; a BLOCKS finding still fails its item and the walk; the repeat mode walks only the prior items and fixes.
2. **S28-C1, CI speed** (cloud, ordinary `high`): #864 (the `rest` shard re-runs `scripts/` and `engine/` tests, 7,503 tests
   in 697 s on CI's critical path; a lint that every shard's collected node ids are disjoint and complete) and the slowed
   web pass as its own parallel job in `web.yml`. Merge it early: every later CI run is shorter.
3. **S28-R1, the review evidence bar** (cloud, hard: gate code). Measured: blocking findings are already reproduced by attack
   tests (none of 260 FIX verdicts rested on UNPROVEN findings alone), but since the 13 Oct bar 23 of 30 FIX verdicts rested
   only on 50-74 findings, many "real but rare". So: an UNPROVEN finding no longer blocks (`scripts/ledger.py` `STANDS`); a
   50-74 finding blocks only when its input is one a QS would meet or it is on a trust boundary, else it is filed with its
   owed check. Mechanically: each lens tags a finding `observed=yes|no` beside `class=` and `boundary=` on its FINDING line
   (`yes` when the attack test's input comes from a Development Set's conventions, `seed_demo` or the served stack), and
   `ledger.could_block` for 50-74 requires `observed=yes` or `boundary=yes` (75 and more unchanged); the lens brief in `scripts/factory/review.py` says to judge
   intent and user impact, not to stack defensive edge cases. It applies to every round after it merges (#844's round 3).
4. If a cloud slot is idle: #865 (the walk gate blocks sentences that say the walk is not ready).

**The critical path:** W1's writer at 0:15, W1 merged by about 2:30; G4 and #844 landed by then; walk #1 at about 3:00;
fixes; walk #2 (the repeat mode) at about 5:30. If W1 is not merged by 2:30, walk #1 runs on the old bar anyway (its
findings still need fixing) and W1 lands before walk #2. C1 and R1 run beside it and never delay a walk.
**Budget:** the draft's 6 h does not hold these first tasks and two walks. Ask the owner once at the start: 8 h
(recommended). Without an answer, keep 6 h and cut M1-00's review first, then S28-R1; never the walks or S28-W1.
**Holds (the owner's Q9, applies now):** ask, then proceed on the recommendation for anything reversible and note it in
STATE.md; spending, scope and irreversible choices wait.
**Measures at close (for session 29's baselines):** the subtraction table (the owner's Q11: one row per gate and lens: the
failure it was built for, its last real catch with a PR number, the minutes it adds a PR; an Explore agent at `low` reads
the STATE logs and the review ledger), and the baseline table of `docs/plans/factory-s29.md` filled with this session's
numbers. Session 28's close writes session 29's brief from that plan; issues the review filed: #864, #865, #866.

## The owner's questions still open (one at a time, recommendation first)
The three from session 27's brief (storeys correction stays quiet; fire allowance ৳120/sft from 7 storeys; "File" and "at x"
words) and whether M1-00 may merge right after the walk: ask at the walk. New: (1) the MD's Vextrus-access notice shows only on
Step 1 (6.12 places it there): carry it to every project page? Recommendation: yes, the MD should see who has access wherever
they are. (2) An in-list mark for a long-titled series (today: tooltip and inspector only). Recommendation: no, 6.2 is met.

## First 15 minutes
1. `date -u`; `stamp start`; `uv run python -m scripts.factory.state`; `uv run python -m scripts.factory.watch ensure`.
2. `df -h /`, `free -g`, `swapon --show`; `gh pr list`; `gh run list --workflow web.yml --branch main --limit 3`.
3. Read `.private/work/s27/STATE.md` (every step and ruling) and `.private/work/s27/close/measures.md`.
4. Run `uv run python -m tools.leakscan sweep-remote --hits-file .private/work/s28/sweep-hits.txt` after
   `git fetch --prune origin`; list hit branches for the owner (96 old-product `inc/*` branches were listed in session 27).

## Binding lessons (session 27; docs/knowledge/lessons.md)
- Update with main first, then gate and land that head; a gate walks every head that lands.
- Acceptance writers leak-scan their range before reporting; write invented titles from convention words only.
- Run new acceptance tests as CI does (no bwrap, no toolchain) before pushing them.
- A cloud verify that fails only on load timing: verify locally on the same tree and commit READY from the main checkout.
- Keep local agents and local verifies under the memory floor: stop the heaviest non-critical job first.
- Cloud push refused: branch check, `git switch -C <branch> <sha>`, `git push -u origin HEAD` (cause owed, see issues).

## Leftovers (with numbers)
- **Filed in session 27:** factory #847 (writers leak-scan their range), #848 (acceptance_lint runs tests as CI does), #849
  ("For later tickets" under Cut), #850 (CLOUD_PUSH refusals, cause unknown), #851 (ts15a2 500 ms flake), #852 (local verify
  for load-only cloud failures), #853 (local verify memory), #854 (pre-push ref matcher misses slug-form names), #855 (wake:
  dropped count; PR-less launches of an ended session), #856 (entity_kinds on NumPy 2.5); product polish #857 (Step 1 list),
  #858 (a series in seed_demo), #859 (sheet viewer, and t16's "fits again" flake), #860 (answering: one source of truth,
  locks, cues; the reply could carry the open Questions), #861 (Members words), #862 (Step 1 marks: check against G4's
  round 2 before working it).
- **Not filed, fixed on pending heads:** the members page's 500 past ~832 accesses (G6's round 1), a lintel beam read as
  structure (G3's fix), a Discipline change never re-matching the Plot (G1's fix). File any of them if its head does not land.
- **From earlier sessions, still open:** G1 walk #1's issues #827-#833 (#827 and #830 close with #844; #828 closed by #842;
  #829 and #833 close with #838; #831 with #846), #753 M1-06, #601, and session 26's leftovers listed in its brief.
