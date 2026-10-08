# Session 18: finish Phase 0's leftovers, then take M0 to 100 %

## Session 17's measures (`scripts/factory/measures.py`, 7 Oct 19:22Z to 8 Oct 05:55Z)
| measure | value | target |
|---|---|---|
| prs_merged | 7 | |
| merge_p50_min | 152 | |
| rounds_per_pr | 1.86 | |
| rdlock_min | 0 (wrong: posting runs ran; the lock-span reader found none) | |
| verify_p50_min | 16.5 | |
| verify_p90_min | 19.6 | 10 |
| ci_wall_p50_min | 18.8 | 10 |

Missed or wrong:
- **verify p90 19.6 min against 10: missed.** F2 (verify parallel) landed mid-session; contention between worktrees
  (lesson d) and the skipped toolchain tests (lesson c) still cost re-runs.
- **CI wall p50 18.8 min against 10: missed.** F1 (#607, CI parallel) measured 6.4 min on its own CI run.
  F1 (#607) was open at close, in its last fix round (round 3, false-statement exception: holes in the
  serial-marker lint).
- **rdlock_min reads 0, which is false:** #593's posting runs held the lock. A measures defect: fix the lock-span
  reader in `scripts/factory/measures.py` before trusting the number (a fix under 60 min, inside the freeze).
- `crosspr_max_min` (target 5) is not in the table: F3 did not land, so it is unmeasured.
- No earlier session's table exists to compare against; session 18's is the first comparison.

## What is broken (read first)
- **M0's G1 was never measured in session 17, and nothing has ever passed G1.** The last script-layer walk
  (dddce3f8, session 15) failed 13 of 16 checks. Main's current product code is unmeasured.
- **About 5 hours were lost while the orchestrator waited on an owner question** (8 Oct, from ~00:20Z): the
  governor refused local launches on a stale 2.6 GB swap, the orchestrator asked the owner to reset it, and then
  waited instead of working on cloud tickets, reviews and the trains. No half-way gap was flagged. Lesson (a).
- **Q1 (#566) did not land,** so Train A never started: E6 and Q3 wait on it; E3 and Q2 wait on a train with #613.
  Q1 measured: Questions of kind per Discipline at 3 or fewer, but all Questions per Discipline still above 3 (the
  rest are check and conflict Questions, owned by Q2 and Q3).
- **Four cloud builders went silent** after a `launch say` fix message (F1, F3, A3, W9). Lesson (f).
- **Phase 0 is not finished:** of F1-F7, F2 (#605), F4 (#608), F5 (#606) and F7 (#611) landed; #614 fixed #585.
  F1 (#607) was open at close in its last fix round. F6b (#615) stopped after round 2: reviewers kept finding gates
  inside its lax folders (`docs/` holds JSON schemas that strict gates load; `web/` holds session and CSRF
  transport), so **the owner's 75 bar is not in code yet.** F3 never reached a PR after its amendment. #612 holds
  F5's cut.
- **Q1 (#566) used all three review rounds and did not land.** Round 3 found seven holes with one root: a grouped
  kind Question stores its membership and words, and a sheet's file moving between Disciplines (and back) leaves
  them stale.
- **E2 (#613) did not land:** in its last fix round (fix-regression: frames drawn in inches) at close.

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g` (keep 40 GB free). If swap
   used is over 2 GB, reset it (the governor refuses local launches above 2 GB).
2. Stop every idle background session: `claude agents --json`, then `claude stop <id>` for each, and check with
   `claude agents --json | grep -c pid`.
3. `unset FORCE_COLOR PY_COLORS CLICOLOR_FORCE` (still wise, though #614 strips them inside the checks), then
   `scripts/factory/orchestrator.sh`, and say: "Read docs/handoff/session-18-prompt.md and run it."

---

You are the orchestrator of session 18. **Finish Phase 0's leftovers, then take M0 to 100 %: its finish line met
and G1 PASS twice on main's current product code. No M1 building.**

## The owner's rulings of session 17 (verbatim from its STATE.md; they stand)
- Q1 ruleset "require up to date": turn off (owner flips it; guard forbids ruleset changes).
- Q2 review bar 75 (50 on strict paths), file rest as issues, refute a sample: yes -> F6.
- Q3 freeze factory features until G1 PASS twice (F1-F6 excepted, fixes <60 min): yes.
- Q4 real-drawing posting on train heads only, batched: yes.
- 19:28Z owner: "unticked myself of 'Require branches to be up to date before merging'".
- M1 O1-O7 (owner, 7 Oct 2026 ~19:35Z), all the recommendations: O1 harvest #601/showing-fixes after M0 G1; O2 M0
  walk before any M1 wave; O3 typed levels as fallback marked "typed"; O4 propose top floor + one Question per
  Building; O5 shear walls -> one grouped Question per Discipline; O6 column height to soffit with default slab
  thickness, derived, re-measured Step 8; O7 keep s16 demo labelled unreviewed.

The up-to-date ruling is recorded in ADR 0025's Amended section; the lander lands a PR as it stands (#611).

## Phase 0 leftovers (first ~1.5 hours; in parallel with Phase 1's first steps)
- **F1 CI parallel (#607):** in its last fix round at close (round 3, false-statement exception). Finish its
  round, land, then read CI wall p50 over the next landings. Target under 10 min.
- **F3 crosspr cache (branch `s17-f3b`):** the cache keeps only green baselines; the kept-red test was withdrawn by
  the amendment 8ff741ee8. Its cloud builder went silent: relaunch it (local if a slot is free, else cloud on a
  fresh branch), PR citing #609. Target under 5 min.
- **F6b review bar: a fresh PR from `s17-f6b`** (#615 stopped after round 2). Carry the owner's Q2 bar (75; 50 on
  strict paths) with lax narrowed to: web view components (`*.tsx` under `web/src`, except `web/src/api/**`,
  `web/src/routes/**` and anything auth or session) and `docs/**/*.md` (never `.json`). Everything else is strict.
  Its acceptance (`scripts/tests/acceptance/ts17f6`) becomes lesson (e)'s check.
- **The measures' lock-span reader** (rdlock_min 0): a fix under 60 min.
- Lessons (c) and (d) have issues: #616 (local verify runs `needs_toolchain` tests for engine paths) and #617
  (a port and a test database per worktree). Both are fixes under 60 min, inside the freeze.

## Phase 1: M0 to 100 % (`.private/work/session-16/close/m0-gap.md` §5; the order is the lock's)
Session 17 landed E4b (#593). It stopped at step 3 below.
1. **Q1: rebuild the grouped kind Question on the re-read rule,** as a fresh PR from `s15-q1` (#566 used all three
   rounds). Membership and words are recomputed on read, never stored (M1 plan's re-read rule for Questions), so a
   sheet's file moving between Disciplines, and back, cannot leave them stale. Pin round 3's seven holes as
   acceptance first. Then land it alone: one posting run, land.
2. **Train A** (build the train branch as soon as Q1 lands; every ticket reviewed alone against main, merged into
   the train, one verify of the train's head, one review round on the train PR, one posting run, land):
   - **Q2 + Q3:** the stack on `s15-q3` (Q3 built on `s15-q2`; BLOCKED at 94bac901 only on #585, since fixed, the
     ts14f2 guard test and Q2's crosspr with #613). Re-verify after Q1 lands.
   - **E2 (#613):** in its last fix round at close (fix-regression: frames drawn in inches); an earlier fix broke two
     toolchain acceptance tests in CI (lesson c). Its posting run needs an accepted reason for its 3 render_f1
     drops (model-space sheets not isolated).
   - **E3 (`s13-w318`):** BLOCKED at a706025c only on crosspr against #613; the train settles it.
   - **E6 (`s13-w332`):** BLOCKED at 3a77220a only on Q1's grouped kind Question. The ruling: Q1 lands first; then
     an `acceptance-writer` re-pins w332's test by acceptance amendment (`scripts.factory.amend`) to find the
     grouped Question holding the sheet.
   - **A2 (`s15-a2`):** BLOCKED on a cloud web-test timeout; re-run locally or relaunch.
   - **A3 (`s13-w323`) and W9 (`s15-w9`, with #591's r1 fixes):** cloud builders silent; relaunch on fresh branches.
   - **W6 (#557, PASS r3):** keep its Projects-list version.
3. **Measure:** G1's script layer (`scripts.walk.run`) on Train A's head (it does not count for `ready`). Read which
   checks still fail before building more.
4. **Train B:** E5 (#549), A4 (#545), W3 (#547), and what step 3 shows (unowned: true conflicts not raised, walk
   issue #336, structural sheets with no PDF page, #322/#327).
5. **G1 twice** (script layer, then `/real-set-walk`) on main; a fix wave between; `scripts.walk.ready origin/main`
   exit 0; then, and only then, "walk now".
Cut or defer as in session 17 (`m0-gap.md` §2): S1, E8, Q0, T2 (#572), I2, A6, #575-#584; #601 and the showing
fixes wait for M0's G1 (O1).

## Finish line (checked by its command; evidence where it says)
1. F1, F3 and F6 merged; CI wall p50 under 10 min, verify p90 under 10 min, crosspr max under 5 min, rdlock_min
   read correctly (`scripts/factory/measures.py`).
2. M0's finish line met: G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
3. `docs/handoff/session-19-prompt.md` merged, opening with session 18's measures table.
Budget: ask the owner (recommend **12 hours**: `m0-gap.md` puts M0 at 13-16 h from E4b, and session 17 used little
of it on product). At the half-way mark, say the measured gap to G1 twice, before any owner question.

## Lessons from session 17 (binding)
- **(a) Never block on an owner question for anything the session can work around.** Ask, then keep working on
  what does not need the answer (cloud tickets, reviews, trains). Flag the half-way gap before asking. Session 17
  waited ~5 h on a swap reset.
- **(b) A forced colour in the caller's shell broke parsers of child output** (#585, fixed by #614): a check that
  reads a child's output strips `FORCE_COLOR`, `PY_COLORS` and `CLICOLOR_FORCE`.
- **(c) Local verify skips `needs_toolchain` tests,** so engine PRs went READY and failed CI's toolchain job (E2,
  #613). Run them locally for `engine/**` changes until verify does.
- **(d) Concurrent verifies in different worktrees collide** on the vitest browser port and the test database's
  name. Stagger them, or give each worktree its own, until the factory fix lands.
- **(e) Enumerating the dangerous side of a list never converges** (F6: three rounds, three misses). List the safe
  side: strict by default, a short allowlist.
- **(f) Cloud builders went silent after a `launch say` fix message,** twice (F1, F3, A3, W9). Replace a silent
  builder at half its budget, on a fresh branch, not after a second message.
- **(g) The lander must not update branches** now the ruleset does not require it (#611 done): `land update` only
  when a branch truly needs main.
- **(h) `publish` refuses BLOCKED heads,** so crosspr-only conflicts between open branches (E3 vs #613, Q2 vs
  #613) can be settled only in a train: build trains early, as soon as their first member lands.
Session 16's lessons (`docs/handoff/session-17-prompt.md`) still bind.

## Effort and models
CLAUDE.md's "Effort and models" in full: orchestrator Opus 5.5 `medium`; `acceptance-writer`, the depth lens,
`qs-critic`, `drawing-analyst`, the `ux-critic` walk and hard builders Opus 5.5 `high`; ordinary builders Sonnet 5.5
`medium`; set model and effort in every launch.

## Laws that do not change
CLAUDE.md's Law section in full: account A; launches only through `scripts.factory.launch`; time from `date -u`;
Monitor on a log, never pgrep; no "walk now" without a passing G1 on main; secrets never printed; nothing from real
drawings in git, an issue, a PR or a cloud prompt; OCE is AGPL; cad2data's converters are never run; the repo is
public; statuses only through post-status; explicit paths; no force push, history rewrite or recursive delete.
