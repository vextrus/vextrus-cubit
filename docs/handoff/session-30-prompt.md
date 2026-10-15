# Session 30: M0's last walks, then M1 starts; session 29's unfinished factory items beside it

**Budget:** the owner sets it at the start (session 29's was 8 h). Clock: `uv run python -m scripts.factory.stamp start
--budget <b> --state .private/work/s30/STATE.md --phases "<...>"`. Read `.private/work/s29/STATE.md` (the log) and
`.private/work/s29/close/measures.md` (the measures) first.

**The goals, in order:**
1. **M0's walks.** G1 walk #2 ran on main 1e6062eeacebb57713025246bf2ec9dacb04fb87 (after #885; 01:25Z 15 Oct; the
   owner's ruling "Wait for M0b, walk #2 ~01:00Z"). **Script layer: 15 of 16 PASS; FAIL `bulk_confirmable_share` on the
   Edison set**: electrical 31 of 39 bulk-confirmable (0.795 against 0.8; walk #1 had 32), plumbing 24 to 22, the Sample
   Project's structural 32 to 31. The likeliest cause is #882 (a run's row now breaks where a sheet of its series lies
   strictly between two members, so a few sheets leave bulk rows); unproven. The agent layer was not run (the script
   layer's FAIL fails the walk; the session's usage window and budget were spent) and no verdict.json was written.
   `act_p95_during_read` PASSed on both sets: Edison undo p95 652 ms (walk #1 1,159) with lock wait p95 7.8 ms, so undo's
   tail was server work, not queueing, and #885's statement cut moved it. First ticket: diagnose the bulk drop on the
   real set (which sheets left bulk rows, and whether the break is right for them); if #882's rule is too eager, fix
   it with a pin; then walk #2 again (fresh) and walk #3 as its repeat on a quiet machine with no product path landed
   between (`ready.py`: `vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`). `uv run python -m
   scripts.walk.ready origin/main` must exit 0 before the owner is told to walk.
2. **M1 starts** (docs/plans/M1.md; Q23: never held hostage). M1-00 merges only after the owner's M0 walk (O2).
3. **Session 29's unfinished factory items** (Q14: at most 25 % of builder-hours from session 30), each with its measure.

## Where session 29 left things (15 Oct 2026, about 01:30Z)
- **Merged:** #882 (S29-M0a, walk #1's f-1: a Step 1 row shows only the run sheets it holds; the server's whole-run check
  follows the web's rows), #886 (S29-F1, CI speed: timing file, shard balance check, lint tests in parallel), #883 (S29-F3,
  the main watcher: reverts a red main's culprit; the review passes the revert by code), and #885 (its posting run
  clean; S29-M0b: undo 126 to 102 statements, `Server-Timing: app, lock` on Step 1's acts but never past the tenant wall,
  `act_times` in walk.json, the walk's hold ends on verdict.json).
- **Held open:** #893 (S29-F2a, `verify --fast`: 3.6-4.2 min against 25 min full; review PASS; it owes the real-drawing
  check and a design gate because it touches `vextrus/testing` and `web/vite.config.ts`; land after walk #3, it is a
  product path), #887 (S29-F2b at the review cap: split #865's walk-gate fix into its own PR; reframe the shift-left hook
  as advisory, #895), #896 (S29-F7 rebuild at the cap: replan the risk tier, #898).
- **Not started:** S29-F4 (overlap landing; acceptance be4dd49a1 on s29-f4; prompt `.private/work/s29/f4/prompt.md`;
  needs F7), wave 2 (F8 probes, F9 cloud walks, F10 subtraction, F11 tokens, F12 rules and the ADR, F13 display), F5.
- **Exit criteria (docs/plans/factory-s29.md):** `ci` median 6 min or less: 5.5 on the first run after F1 (one sample;
  re-measure). Fast verify 8 min or less: met in the cloud (one sample), not yet on main. Both probes: not run. The
  watcher reverts a planted red commit: proved on a local fixture only (ts29f3), not live. One small ticket through the new
  flow: #882 went fresh fix, review, gate, merge; tiered review and overlap landing did not exist yet (F7, F4 missed).

## The owner's rulings in session 29 (their words)
- Undo: "Also change undo now" (done as a query cut; whether it moves the tail is walk #2's `act_times` to say).
- Q25: "Accept (Recommended)": the Development Sets are free for development; Held-out Sets stay held out; client sets
  per written permission; nothing from a drawing enters the public repo.
- Holds: "Confirm all (Recommended)" (S28-R1's three and the Plot words "Plot: matching its pages to sheets.").
- F10: "Retire none; F5 narrows (Recommended)".
- After the usage limit: "carry on, session resets and go with your full potential".
- The walks: "Wait for M0b, walk #2 ~01:00Z" (walk #3 moves to this session).

## Questions for the owner at the start (Q28: at most 15 minutes, recommendation first)
1. Session 27's six, carried twice: storeys correction stays quiet; fire allowance ৳120/sft from 7 storeys; the "File"
   and "at x" words; whether M1-00 may merge right after the owner's walk; the MD's access notice on every project page
   (recommendation: yes); an in-list mark for a long-titled series (recommendation: no, 6.2 is met).
2. Session 29's factory remainder against M1: run F4, F7's replan and F2b's split in this session within Q14's 25 %
   (recommendation: yes, F7 then F4 first, because review spend and open-to-merge rest on them), and wave 2 in session 31.
3. The usage window: eight Opus `high` writers and six builders used the whole window in 100 minutes. Recommendation: at
   most four writers and four builders at once until the governor forecasts spend (lessons, session 29).

## Leftovers (with numbers)
Filed in session 29: #881 (copy order of one number, server vs web), #888 #889 (watcher: cancelled runs; a second bad
merge in a revert's window), #890 (Cut section check), #891 (undo toast offers an act the server refuses), #892 (Step 1
grid aria-required-children), #894 (fast verify gaps), #895 (F2b replan), #897 (ledger gap after a refused round 1),
#898 (F7 replan); a t16 viewer flake noted on #245; a `test_watch.py::test_w12` SIGTERM timeout seen once (file if it repeats).

## Before the session: the owner's steps (check each in the first 15 minutes)
1. Stop the idle local sessions s29-m0a, s29-m0a-f1 and s29-m0b-v (their work is merged), and the cloud sessions of
   S29-F7-F1 (superseded by F7-R) if still open.
2. Remove the session's scratch worktrees: `.claude/worktrees/S29-M0a`, `S29-M0a-F1`, `S29-M0b-V`,
   `.private/work/s29/gate882/tree`, `.private/work/s29/m0b/tree`, `.private/work/s29/close-wt`, the writers'
   throwaways under `.private/work/s29/*-writer/`, and `.private/work/s29/m0a-writer/scratch`.
3. Drop the gate database `vextrus_gate882` and the S29 local builders' databases with their `_test_*` copies.
