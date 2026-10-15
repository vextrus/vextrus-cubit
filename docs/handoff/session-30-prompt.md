# Session 30: M0's last walks, then M1 starts; session 29's unfinished factory items beside it

**Budget:** the owner sets it at the start (session 29's was 8 h). Clock: `uv run python -m scripts.factory.stamp start
--budget <b> --state .private/work/s30/STATE.md --phases "<...>"`. Read `.private/work/s29/STATE.md` (the log) and
`.private/work/s29/close/measures.md` (the measures) first.

**The goals, in order:**
1. **M0's walks.** G1 walk #2 started on main after #885 (session 29, about 01:45Z 15 Oct; the owner's ruling "Wait for
   M0b, walk #2 ~01:00Z"). Read its verdict (`.private/work/walks/<sha40>/verdict.json`) before anything else. If it
   PASSed: walk #3 is its repeat, `/real-set-walk <sha40> --repeat <walk #2 sha40>` after `scripts.walk.run <sha40>
   --hold-minutes 150`, on a quiet machine (no real-drawing run, no local builder), with no product path landed between
   (`ready.py`: `vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`). `uv run python -m scripts.walk.ready
   origin/main` must exit 0 before the owner is told to walk. If walk #2 FAILed: its BLOCKS and reproductions are the
   first tickets; walk #2's `act_times` (request, app and lock per act kind) now split undo's tail into work and queueing.
2. **M1 starts** (docs/plans/M1.md; Q23: never held hostage). M1-00 merges only after the owner's M0 walk (O2).
3. **Session 29's unfinished factory items** (Q14: at most 25 % of builder-hours from session 30), each with its measure.

## Where session 29 left things (15 Oct 2026, about 01:30Z)
- **Merged:** #882 (S29-M0a, walk #1's f-1: a Step 1 row shows only the run sheets it holds; the server's whole-run check
  follows the web's rows), #886 (S29-F1, CI speed: timing file, shard balance check, lint tests in parallel), #883 (S29-F3,
  the main watcher: reverts a red main's culprit; the review passes the revert by code), and #885 if its posting run was
  clean (S29-M0b: undo 126 to 102 statements, `Server-Timing: app, lock` on Step 1's acts but never past the tenant wall,
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
