# Session 17: make the factory fast, then take M0 to 100 %

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g` (keep 40 GB free; it was 37 GB
   at session 16's close).
2. Stop every idle background session: `claude agents --json`, then `claude stop <id>` for each, and check with
   `claude agents --json | grep -c pid` (in session 16 three "stopped" sessions kept their pids and held the six
   local slots).
3. The session-16 demo stack (`.claude/worktrees/s16-demo`, ports 8716/5716, database `vextrus_s16demo`) may keep
   running for the founders; it is not main and nothing in this session depends on it. Stop its cloudflared tunnel.
4. `unset FORCE_COLOR PY_COLORS CLICOLOR_FORCE`, then `scripts/factory/orchestrator.sh`, and say:
   "Read docs/handoff/session-17-prompt.md and run it."

---

You are the orchestrator of session 17. **Make verify and CI fast first, then take M0 to 100 %: its finish line met
and G1 PASS twice on main's current product code. Then adjust M1's plan (documents only). No M1 building.**

## The owner's rulings (verbatim, 7 Oct 2026, at session 16's close)
- "my goal for next session is at first we should achieve 100% of M0 and just adjust the plan for M1 and get prepared
  for M1 building for later sessions."
- "we'll target to fulfill our tasks 100% achievable and must be achieved in any way at any cost."
- "our /verify and CI process are too much slow which is hindering our development progress a lot and making
  everything more slower and slower, each sessions work is slowed down with really slow verify process and merge
  process is being hindered by really slow CI workflow inside GitHub."
- "the factory itself should be easygoing self-learning improving factory where on each sessions run it'll correct
  itself and improve for better performance."
- On session 16's showing: "this isn't the live demo I intended. The product is nowhere near the real milestone
  achievement or in terms of quality we're way behind of everything."

## The evidence (read these four first; each ends with a summary)
`.private/work/session-16/close/`: `m0-gap.md` (M0's finish line condition by condition), `verify-ci-speed.md`
(where verify and CI spend their time, measured), `factory-retro.md` (sessions 12-16: where the hours went),
`m1-plan-delta.md` (what the M1 slice proved wrong in the plan). What they say, in short:
- **Nothing has ever passed G1.** The last script-layer walk (dddce3f8) failed 13 of 16 checks; Edison: Questions per
  Discipline 27 (limit 3), bulk share 0.06 (limit 0.8), act p95 12.2 s (limit 1 s), storeys 30/108 wrong (limit 0).
  I1, A1, A5 and W1 landed after it: G1 on main's current head is unmeasured.
- **Sessions 12-16: ~60 h, ~14 product PRs on main, 57 factory PRs.** Builders reach READY at half their budget;
  the time goes after READY: review rounds that do not converge (22 % pass round 1; 1.8 % of findings 50+ refuted),
  the serial real-drawing lock (224 min in S13, 372 min in S15), verify (p90 25 min, max ~91), re-runs after updates.
- **Serial pytest is ~75 % of all waiting.** xdist works (takeoff acceptance 458 s serial, 100 s at `-n 8`; the whole
  suite ~7.5 min at `-n 8`) but `scripts/verify.py`, `scripts/factory/crosspr.py`, CI's python shards and engine's
  toolchain job all run serially. crosspr re-runs every overlapping PR's baseline on every verify (up to 50 min).
- **The M1 slice was built on contracts that named types, not fields**; 16 integration defects surfaced only by
  walking the product. Train #601 (CI red, never verified, 8 of 12 tickets unreviewed) and `s16-showing-fixes`
  (16 unreviewed commits) stay unmerged; M1 harvests them ticket by ticket later (`m1-plan-delta.md` §3).

## Phase 0 (first ~3 hours): the speed and the loop, before any product work
Ask the owner these at the start, one at a time, recommendation first (`factory-retro.md` §owner, `verify-ci-speed.md`):
1. Turn off the ruleset's "require branches to be up to date" (or land only trains)? Recommend: off, because each
   landing re-runs full CI and a real-drawing re-post (15-40 min a landing); main's CI still runs after merge.
2. Block review only at 75, keep 50-74 blocking only on security walls, migrations, money and readers, file the rest
   as issues; refute a sample, not every finding? Recommend: yes (70 of 101 FIX rounds rested on 50-74 findings).
3. Freeze new factory features until G1 passes twice (the speed tickets below excepted)? Recommend: yes.
4. Real-drawing posting runs only on train heads, batched? Recommend: yes.
Then build, each through the normal review with its timing measured before and after (`verify-ci-speed.md` §4):
- **F1 CI parallel:** `-n 4` in the python shards with `rest` split into three, engine toolchain `-n 3`; keep
  `tools/lint/tests` serial until #585 is fixed. Target: CI wall under 10 min.
- **F2 verify parallel:** `scripts/verify.py` runs pytest with `-n auto` (per-worker databases exist); concurrent cheap
  checks. Target: p90 under 10 min.
- **F3 crosspr:** cache each PR's baseline by its head and run it with `-n`. Target: under 5 min.
- **F4 the loop:** `scripts/factory/measures.py`, run by `stamp end`, writes the session's measures table (PRs
  merged, time to merge, rounds, lock minutes, verify p50/p90, CI wall) from the existing logs into STATE.md and a
  committed targets file; the next brief opens with any measure that regressed. `stamp end` refuses while a
  `LESSON` line in STATE.md has no `docs/knowledge/lessons.md` bullet with its `Check:`.
- **F5 the contract lint** (owed since session 12): web fixtures and acceptance JSON validated against the exported
  OpenAPI schema; a state word or field the API does not send fails.

## Phase 1: M0 to 100 % (`m0-gap.md` §5 and §11; the order is the lock's)
1. Land #593 (E4b, PASS r1): update, one posting run, land. Then Q1 (local head 3c898fbdf, READY, unpushed): push,
   review round on #566, posting run, land. One at a time, nothing else merging.
2. **Train A:** Q2, E3, E6 (unpushed), E2 (judge its 3 render_f1 drops against main first), A2, A3, #557 (W6, PASS r3;
   keep its Projects-list version, not the showing branch's), #591 (W9, FIX r1, CI red): each reviewed against main,
   merged into the train, one verify, one review round on the train PR, one posting run, land.
3. **Measure:** G1's script layer (`scripts.walk.run`) on main after Train A. Read which checks still fail before
   building anything more.
4. **Train B:** Q3 (#544), E5 (#549), A4 (#545), W3 (#547) and what step 3 shows (unowned today: 5 of Edison's 9 true
   conflicts not raised, walk issue #336, 3 Edison structural sheets with no PDF page, #322/#327).
5. G1 (script layer, then `/real-set-walk`) on main; fix wave; G1 PASS twice; then, and only then, "walk now".
Cut or defer (`m0-gap.md` §2): S1, E8, Q0, T2 (#572), I2, A6, #575-#584; S15-FC only if free. Close the nine issues
whose tickets landed (#523, #525, #527, #529, #530, #531, #540, #542, #543).

## Phase 2: M1's plan adjusted (documents only, after M0's walk or in parallel by one docs PR)
Land `m1-plan-delta.md` as amendments to `docs/plans/M1.md`: the 21 contract amendments (A1-A21: C4 with every
type's fields, the chain in the engine, one placed-view function, C19 storeys and View Placements, anchors with
sheet/view/box, the re-read rule for Questions and Proposals, a step's Questions endpoint, one state enum from the
generated types, the Rule Set pin), the new tickets (M1-00 contract freeze, M1-49 whole-chain test written red,
M1-32a the Step 3 data path, M1-11c reads and a Question's life), the six splits, and waves 0-7 with wave 0 the
contract freeze. Ask the owner O1-O7 (`m1-plan-delta.md` §5) one at a time. Write `docs/design/m1-screens.md`'s
outline (three M1 screens shipped without one).

## Finish line (checked by its command; evidence where it says)
1. F1-F5 merged; measured: CI wall p50 under 10 min, verify p90 under 10 min (`scripts/factory/measures.py`).
2. M0's finish line met: G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
3. M1.md amended and merged; the owner's O1-O7 recorded.
4. `docs/handoff/session-18-prompt.md` merged, opening with session 17's measures table.
Budget: ask the owner (recommend 12 hours: `m0-gap.md` estimates 13-16 h for M0 at today's speed; Phase 0 should
pay for itself within Train A). If M0 cannot pass G1 twice in the budget, say so at the half-way mark with the
measured gap, not at the end.

## Lessons from session 16 (binding)
- **No ticket starts before its contract has fields:** types, schemas and example JSON, committed and on main.
  Writers guessed field names for K0 in session 16, and every seam broke at integration.
- **A reader is not READY until it has read a real set locally** and its acceptance has a placed-view fixture
  (paper box on a model-space sheet). R2 was READY and read 0 Edison columns.
- **A slice is not done until the whole chain runs on a synthetic set over HTTP** (read → confirm → model → measure →
  BOQ): 16 defects passed every gate and failed in the browser.
- **A cloud builder silent at half its budget is replaced then,** on a fresh branch, and one is named "of record".
- **Merge nothing under a running verify;** verify the train's final head once.
- **`review run` refuses a head whose CI is red** but still spends the lenses: check the checks first.
- **One push per call; never a loop:** the guard judges each push against its own leak stamp.
- **Demo data is not product:** levels typed by hand, Questions set aside by hand and re-branded rows proved nothing.
  The owner's milestone walk runs on main, seeded by the product's own seed.
- **The founders' demo profiles** are a seed patch at `.private/work/session-16/founders-seed.patch`; landing it needs
  an acceptance amendment (`test_seed_platform.py` and t129 pin M0's people).

## Laws that do not change
CLAUDE.md's Law section in full: account A; launches only through `scripts.factory.launch`; time from `date -u`;
Monitor on a log, never pgrep; no "walk now" without a passing G1 on main; secrets never printed; nothing from real
drawings in git, an issue, a PR or a cloud prompt (session 16's public tunnel was the owner's explicit, one-off call);
OCE is AGPL; cad2data's converters are never run; the repo is public; statuses only through post-status; explicit
paths; no force push, history rewrite or recursive delete.
