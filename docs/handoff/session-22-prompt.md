# Session 22: land Train B and Train C, then G1 on main twice

## Session 21's measures (`scripts/factory/measures.py`, 10 Oct 20:06Z to 11 Oct 16:20Z; a power cut 03:41Z-09:50Z, and an owner answer pending 12:43Z-16:13Z)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 2 | 0 | |
| merge_p50_min | 203.4 | unmeasured | |
| rounds_per_pr | 2.0 | unmeasured | |
| rdlock_min | 211.6 | 172.4 | |
| verify_p50_min | 18.7 | 32.0 | |
| verify_p90_min | 32.9 | 37.4 | 10 |
| ci_wall_p50_min | 11.0 | 9.4 | 10 |

Missed or wrong:
- **Train B did not land.** Its boundary-storey "third plan" re-ask (B2's convention plus the fix rounds) drew a new
  50-65 regression in each of five reviews (#648 rounds 1-3, #650 round 1); each fix changed what counts as "the same
  plan" (number, then view, then storey range). Train C is built and READY on it, so neither landed, and G1 was not run.
- **verify p90 33 min against 10: missed.** Verifies ran one at a time on purpose (a HOLD file); the time is the suite.
- **CI wall p50 11.0 min against 10: missed by a minute.**
- **Train A landed** (#641, da4b897a), and #645 (merge_ready and the pr leak scan read a PR of any size from git),
  without which no train could pass the merge gate.

## Where things stand (read first)
- **Train B: PR #650** (branch `s20-train-b`; #648 closed as superseded because the review tool records three rounds at
  most). Recorded: #650 round 1 FIX on 27066684 (two 50s, both from the last fix's new `retire_questions` call for
  boundary storey Questions). The owner's ruling (11 Oct): remove only that call, keep the range identity, file the
  old 40 (a no-longer-asked boundary Question is not withdrawn), and review once. The builder `pr648-train-b-fix3`
  (worktree `.claude/worktrees/S20-TRAIN-B`) was given that fix at session close: read its last commit on
  `s20-train-b` (local). Then: push, `review run 650 --round 2`, the design gate (no web change since b7b5fd98, whose
  words-only verdict passed items 1, 4, 10; re-check the head's diff first), the posting run with the reason
  "B3 three stale layouts; B2/B5 storeys, subject; B4/B5/B7 conflicts, continuations: members' rows" (the table has been
  identical on every head since 0ad6fbf1), and land **by hand** (`scripts.merge_ready 650`, then
  `gh pr merge 650 --merge --match-head-commit <sha>`): the lander cannot read a PR this large (#647).
  Then the owner's custody re-run (B4 changes `tools/scorer/`):
  `! cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/keys-custody.sh`.
- **Train C: branch `s21-train-c2` at 3c7e9386, READY, pushed, no PR.** Members: C1 (acts never wait on finding the
  set's Questions: find before the write lock, keep under it), C2 (stale-title fold into same_title; which_kind groups
  on the sorted top two kinds), C3 (a Plot page naming several sheets takes the one whose title it reads), C4 (a
  range's `top` resolves to the set's highest floor; W318 C8 amended). It must merge Train B's final head and verify
  again (its integrator was `s21-c2-merge-train-b` in `.claude/worktrees/S21-TRAIN-C`). Its real-drawing table on
  3c7e9386 is Train B's plus C3's: plot_matches 3 changed, render_f1 +3, checks 7 changed, nothing lost. Its body has
  a cut item (the real-drawing check) that is now done: remove it before merge_ready.
- **G1 was not run this session.** Each Train C member's measure (act p95 during a read, Questions per Discipline,
  Edison structural bulk share 48/57 projected, Sample S-15 storeys) is projected only; G1 on main measures them.

## Plan
1. Land Train B (above), then Train C (merge B, verify alone, PR, review, design gate, posting run, land by hand).
2. G1 on main: `uv run python -m scripts.walk.run <sha40>` then `/real-set-walk`; a second G1;
   `scripts.walk.ready origin/main` exit 0; then "walk now".
3. If time: #647 (lander reads git), #644 (verify races), #649 (suspected cross-test database leak).

## Finish line (checked by its command)
1. Train B and Train C merged (`gh pr view <n> --json state`).
2. M0's finish line: G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
3. `docs/handoff/session-23-prompt.md` merged, opening with session 22's measures table.
Budget: ask the owner (recommend **8 hours**).

## Binding from session 21 (`docs/knowledge/lessons.md`, Session 21)
- A large PR lands by hand until #647 lands; `merge_ready` and the pr leak scan already read it from git (#645).
- The review tool records rounds 1-3 only (3 with an exception); a fourth review the owner allows goes on a fresh PR.
- Builders cannot run `tools.leakscan range` (the guard refuses it in a worktree): the orchestrator scans their
  branches from the main checkout before pushing; a hit is redone on a fresh branch, never by a reset.
- Verify alone, one at a time (a HOLD file under `.private/work/<session>/` orders builders well).
- Every sha typed into a gate or a run comes from `git rev-parse`.

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full.
