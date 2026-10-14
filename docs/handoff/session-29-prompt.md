# Session 29: the factory rebuilt (docs/plans/factory-s29.md), with M0's last fix as its real ticket and two G1 walks

**Budget: 8 h** (the owner's Q12). Orchestrator: Opus 5.5 `high` (the owner's Q27a, for this session only). Clock:
`uv run python -m scripts.factory.stamp start --budget 8h --state .private/work/s29/STATE.md --phases
"wave1=200,m0=180,wave2=150,close=45"` (phases overlap). Wave 2 starts in a fresh orchestrator from wave 1's handoff (Q22).

**The goals, in order:**
1. The plan's wave 1 (F1-F4, F7) and wave 2 (F8-F13), cut from the bottom (F13 first), each item with a measured before
   and after. The plan is the brief for them: `docs/plans/factory-s29.md` (rulings, baselines, items, exit criteria).
2. **M0** (the owner's ruling at session 28's close: "Undo fix as the real ticket"): the M0 fix below is the plan's exit
   criterion "one real small ticket carried end to end through the new flow", then G1 walk #2 (fresh) and walk #3 (the
   repeat, `/real-set-walk <sha40> --repeat <walk #2 sha40>`) on a quiet machine between the waves, so that
   `uv run python -m scripts.walk.ready origin/main` exits 0 and the owner walks M0. It exits 1 today (walk #1 FAIL).

## Where M0 stands at session 28's close (14 Oct 2026, ~18:40Z)
- Merged in session 28: G4 #838 (Step 1's words and marks), the engine integration #870 (G1, a Plot stays in its
  Discipline; G3, an architect's structure plans proposed out; superseding #844, which was closed: its round 3 could not
  take a delta review), and the first tasks: S28-W1 #871 (G1's evidence bar, walk #2's repeat mode), S28-C1 #873 (#864:
  shards collect each test once; the slowed web pass its own job), S28-R1 #874 (the review evidence bar: UNPROVEN never
  blocks; a 50-74 blocks only when `observed=yes` or on a trust boundary).
- **G1 walk #1 on main 9101c0059a97dd296099ba5df2ccac4f54c5c54a: FAIL**, on two grounds:
  1. Script layer, 15 of 16 checks PASS; `act_p95_during_read` FAILed on the Edison set (p95 1,159 ms against 1,000;
     worst 1,370 against 3,000; 0 failed acts; the Sample Project's p95 715 ms). The slow kind is undo. A read-only
     diagnosis (`.private/work/s28/undo/finding.md`) found no server regression: no commit since session 26 touched the
     undo path, undo's median is unchanged (654 against 656 ms) and its query count equal (126 on a 3-sheet project);
     only the tail moved, and p95 over 13 samples is the one or two worst. The walk records no server time per act, so
     request time and queueing (reads, the cad worker, `/drawings/files` polls up from 4,171 to 4,824) are not told apart.
  2. Agent layer under the new bar: 11 of 12 items PASS; M0-FL9 FAILs on **f-1, BLOCKS, misleading, with its
     reproduction** (private: `.private/work/walks/9101c005…/repro/f-1.md`): a Step 1 row of a series shows the whole
     run's continuation title and number range while holding only part of the run (`web/src/takeoff/SheetList.tsx:565`
     prints the run's `continuation_title` for any row of it; `web/src/takeoff/model.ts` groups adjacent members by
     state), so a confirmed row claims sheets it does not hold. Deduplicated onto #322. 13 OTHER findings filed (3 new
     walk issues, 10 comments). Misleading findings: 1 (they ran 13, 8, 8, 3, 8 under the old bar).

## The M0 ticket (S29-M0; the plan's "one real small ticket", local for its real-set check)
- **Fix f-1:** a row shows a title as drawn on its own sheets, or a range built from the sheets it holds; a number range
  never spans sheets the row does not hold. Acceptance first (Opus `high`), from the repro's convention (invented titles
  from convention words only; the seed's series, #858, if it lands with it).
- **Measure undo, don't guess:** the walk records server-side duration and lock wait per act beside the request time
  (walk.json, counts only), so a tail is split into work and queueing; plus a query-count ceiling test for undo that does
  not grow with sheets. A code change to undo only if that measure names a cause.
- **The walk's hold:** `scripts/walk/run.py` ended its 90-minute hold while the agent layer still ran (walk.json at +46
  min, the agent layer 96 min). Start walk #2 with `--hold-minutes 150`, or make the hold end on verdict.json alone.
- Then walk #2 (fresh, `scripts.walk.run <sha40> --hold-minutes 150`, then `/real-set-walk <sha40>`); if it PASSes,
  walk #3 is its repeat on the same product code. `ready` needs the two newest verdicts both PASS with no FAIL between.

## Before the session: the owner's steps (check each in the first 15 minutes)
1. Remove the gate databases of sessions 27 and 28: `vextrus_gate837`, `vextrus_gate837b`, `vextrus_gate842`,
   `vextrus_gate842b`, `vextrus_gate842c`, `vextrus_gate842d`, `vextrus_gate843`, `vextrus_gate843b`,
   `vextrus_gate843c`, `vextrus_gate843d`, `vextrus_gate846`, `vextrus_gate846b`, `vextrus_gate846c`,
   `vextrus_gate838`, `vextrus_gate870`, `vextrus_gate870b`, their `_test_*` copies, and `vextrus_undo_diag_test_*`.
2. Remove the scratch worktrees: session 27's (`.private/work/s27/wt/*`, `gate*/tree`, `*-writer/throwaway`) and session
   28's (`.private/work/s28/wt/*`, `.private/work/s28/gate*/tree`, `.private/work/s28/w1-writer/throwaway`), and
   `.claude/worktrees/S27-G1` and `S27-G3`.
3. Stop the idle local builder sessions s27-g1, s27-g3 (#870 landed), s27-g2 and s27-g7.
4. Delete the 96 old-product `inc/*` branches with leak hits (`.private/work/s28/sweep-hits.txt`; the same 96 as session
   27's list; still on origin at 11:45Z).

## Owner rulings in session 28 (their words)
- Budget: "8 h (Recommended)".
- Session 29 and M0: "Undo fix as the real ticket (Recommended)". The evidence since narrows it: the fix is f-1 and the
  undo work is a measurement first (above); a hold under Q9, to be confirmed at the session's start.

## Holds the orchestrator took (Q9; confirm or reverse at the start)
- S28-R1: a FINDING line without `observed=` reads as `observed=no`; a replayed attack (`r<n>-`) still blocks as
  UNPROVEN until its refuter judges it (so a fix that brings a bug back is not passed when the refuter fails); a new
  refuter word UNJUDGED (no answer, a cap, a schema miss) stands, so the ledger fails closed.
- Pending Plot words: "Plot: matching its pages to sheets." for a PDF whose own-Discipline DWG is read (#870's gate).

## Session 28's measures (the plan's baselines get a "session 28" column from these)
Full tables: `.private/work/s28/close/measures-draft.md` (subtraction table per gate and lens; the baseline column).
- `ci` wall on main: 10.4 min median since 11:39Z; after #873 two runs at 10.1 and 10.2: **C1 has not moved `ci` yet**
  (find the new critical path first in F1). `web`: 7.1 and 7.2 after #873.
- Real-drawing lock: 89.8 min (one no-post 44.7, two postings 22.8 and 22.3); S27 127.8.
- Reviews per merged PR 1.8 (S27 2.44); round-1 PASS 0.75; review spend $5.29 mean, $4.10 median a merged PR.
- Gate failures on reviewed heads: 1 of 3 walks (#870's, on a head review round 1 had passed).
- Open-to-merge: median 113 min for the four PRs opened this session (target 120).
- Unmeasured: cloud verify per check, main red after a bad merge, orchestrator context, builder tokens.
- Subtraction table, rows with no real catch in sessions 26-28: the acceptance lint, the leak scan (none tied to a PR),
  the real-drawing check (every run 0 gained, 0 lost). F10 reads them; retiring a gate an ADR set is the owner's.

## Questions for the owner at the start (one round, recommendation first; with the plan's two)
1. Confirm the M0 ticket's narrowing (f-1 fixed, undo measured first). Recommendation: yes, a code change to undo
   without a named cause would be a guess.
2. Carried from session 27: storeys correction stays quiet; fire allowance ৳120/sft from 7 storeys; "File" and "at x"
   words; whether M1-00 may merge right after the owner's walk; the MD's access notice on every project page
   (recommendation: yes); an in-list mark for a long-titled series (recommendation: no, 6.2 is met).

## Leftovers (with numbers)
- **Filed in session 28:** #868 (seed BP-02: a read-anyway sheet answers 404 with wrong-address words), #869 (Step 1
  polish from #838's gate), #872 (G3: an architect's floor plan beside a column layout can be proposed out, review 50),
  #875 (seed Plot emptied by a Discipline change; focus lost after a change; report repetition), #876 (a PDF report
  lists the old page outcome while its Plot is matching), and walk #1's three new walk issues #877, #878, #879.
- **Owed checks from session 28's lessons** (docs/knowledge/lessons.md, session 28): review.py's delta refusal names the
  clean-line remedy; the walk's hold ends on verdict.json; server time per act in the walk's record.
- **M1-00** (branch m1-00, READY 698e6877, heading commit def572b97): cut from session 28 (its local verify would have
  loaded the machine during the walk); publish needs a local verify of its tree after a main merge, and a migration check
  against drawings 0008 (#870). Merges only after the owner's walk (O2).
- **Not done in session 28:** #865 (the walk gate blocks negated sentences; F2 carries it), S27-G9 (Discipline-qualified
  `?sheet=`; #869's raw id in the address bar is the same family).
- Earlier: #827-#833 (#827 and #830 close with #870's content: verify and close), #753 M1-06, #601, #847-#862, #864 (C1
  merged its first half; the rebalancing is F1).
