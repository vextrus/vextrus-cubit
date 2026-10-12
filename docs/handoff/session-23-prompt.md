# Session 23: G1 on main, then M0's remaining blockers (FL5, FL7, FL8 and the rest of walk 1)

## Session 22's measures (`scripts/factory/measures.py`, 11 Oct 17:38Z to 12 Oct 00:46Z)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 6 | 0 | |
| merge_p50_min | 77.8 | not measured | |
| rounds_per_pr | 1.67 | not measured | |
| rdlock_min | 196.6 | 80.8 | |
| verify_p50_min | 7.1 | 14.6 | |
| verify_p90_min | 13.6 | 17.5 | 10 |
| ci_wall_p50_min | 10.7 | 19.2 | 10 |

(The clock started 17:47:55Z: the first `stamp start --budget 8` read 8 minutes and was restarted at 7h50m; the owner's
budget was 8 hours from 17:38Z. rdlock regressed because nine real-drawing runs ran, two of them builders' own.)

Missed or wrong:
- **M0's finish line (G1 PASS twice) was not met; no second walk was run.** G1 walk 1 on 51507b85 (after Trains B
  and C) FAILED: the script layer passed all its checks but one, while the agent layer failed seven of the twelve milestone items, with seven blockers
  (FL5, FL7, FL8, FL9, FL10). With the owner's leave ("Also build blockers tonight") five blockers were diagnosed
  and built; FL9 landed; the rest did not land in time, so the second walk was cut (it would have failed).
- **The orchestrator repeated two session-21 mistakes:** `stamp start --budget 8` (8 minutes; now a check, #675), and
  an acceptance brief that named `gh pr view --json baseRefOid` (the lander then refused every PR; caught by review;
  now a check in ts22l647). It also put a real sheet title into an acceptance brief (FL7); the range leak scan caught
  it before any push.
- **verify p90 13.6 min against 10, CI wall p50 10.7 against 10: missed** (the #644 race cost three verifies).
- **FL5's long-title rule went round twice** (#676: each narrowing opened a new case). Stopped, not landed.

## Where things stand (read first)
- Landed: #650 (Train B), #653 (Train C), #655 (#647: the lander reads a PR's files from git; `scripts.land` works on
  large PRs again), #673 (engine/plot timing tests take the best of several runs), #675 (`stamp start` refuses a bare
  budget), #674 (FL9: a DWG's finishing step writes its views in a few statements under Step 1's write lock; the
  structural DWG's longest act wait 9,166 -> 848 ms on the Sample Project).
- **#681 (FL10, branch s22-fl10, head 8bed5691, Factory-State BLOCKED):** every Step 1 act and every answer records one
  event, views counted apart from sheets. Review 1 (on c1ab2ca4) FIX: answers that neither confirm nor exclude logged
  nothing (70/60), views counted as sheets (55); round 1's fix is 8bed5691 (unreviewed). BLOCKED only by crosspr:
  #680 conflicts in step1.py `_act`/`undo`. **Merge order (orchestrator's decision): #681 first**, then #680 merges
  main and records its correct act through #681's event path. Words gate on c1ab2ca4 PASS (1, 4, 10); the round's new
  `takeoff.step1.answered` words and the changed `excluded` words need the words gate again; mays to apply: "in
  Step 1" over "on Step 1", "assigned ... to Takeoff Steps", the Drawing List term, "took back" over "undid".
- **#680 (FL8, branch s22-fl8):** the Correct key E for a sheet's number and title; cut: storeys #677, Who did what
  #678, counting corrections #679. On 2946c5c8: design gate (words and code, no walk) FAILED (the form could open
  behind the Questions tab or a panel and trap the keys); review 1 FIX: E numbering an unnumbered sheet leaves its
  missing-number Question open so it cannot be confirmed (75), a correction's undo leaves the register Check's
  Questions stale (70), a Bangla title with a ZWJ is refused (50); below the bar 40/35/30 (words). The cloud builder
  (session_01XviUnRXVVNbEWu3cwNMWiU) was given all of it with a 00:40Z deadline: it had not pushed by 00:46Z, so #680 stands at 2946c5c8 with every finding open (the cloud session may push later: read origin/s22-fl8 first). Lands after #681.
- **#682 (FL7, branch s22-fl7c, head a145e492):** Structural site works route to Step 14 (the owner's ruling, 11 Oct:
  "Yes, route to Step 14"), the Coverage panel's Unaccounted list (m0-screens 6.11), m0-screens' routing table amended.
  CI red: tools/scorer/tests/acceptance/t24g/test_vocabulary.py pins the engine's subject words at 15 and the
  scorer's subject table to them; the new `site_works` subject makes 16. Needs: an acceptance amendment (writer,
  `scripts.factory.amend`), the scorer's table, then the owner's custody re-run after landing (tools/scorer/). Not
  reviewed (the review tool refused a red head); no design gate yet (web change: the Unaccounted list). The
  real-drawing run of the same routing code (1a93c609, local log under .private/work/rd/ee52e8f5-no-post-*): views 17
  changed, checks 11 changed, nothing lost or gained. The branches s22-fl7 and s22-fl7b hold real titles in tests:
  never push them; delete them locally.
- FL5 (#676, branch s22-fl5b): stopped after review 2 (two 60s). Two halves: (a) a one-line plan title of 13-16 words
  that states storeys (four real architectural sheets have this shape) — the rule must be designed from a cases
  table first (notes lines, callouts, ruled panes, tables); (b) architectural plans read floor to floor (§6.8) with
  the column rule keyed on column/shear-wall subjects — clean in review 1, can land alone. Findings:
  .private/work/s22/fl5-r2-findings.md; the builder's notes: .claude/worktrees/S22-FL5/.private/work/S22-FL5/NOTES-handoff.md.
- G1 walk 1's verdict and issues: .private/work/walks/51507b85.../verdict.json; issues #656-#670 (17 drafted,
  5 dedup comments on #314, #318, #320, #335, #337). Non-blocking FAILs: FL6 (#660, #661, #665), FL13 (#666, #667).
- Diagnoses (private): .private/work/s22/diag-503/, diag-fl5/, diag-fl7/, diag-fl8/, diag-fl10/.

## Plan
1. Land what is open, in this order: #681 (FL10: crosspr clears once #680 is rebased on it; verify, words gate on the
   round's words, review round 2, posting run, land); #680 (FL8: merge main after #681, record the correct act as an
   event, the design-gate fix and review 1's 75/70/50, the design gate again, ideally with a keyboard walk; review;
   land); #682 (FL7: the t24g acceptance amendment and the scorer's subject table, the design gate, review, the
   posting run with a judged reason per row, land, then the owner's custody re-run for tools/scorer/); FL5 (#676).
   Land them as each passes (the lander reads large PRs now: `uv run python -m scripts.land <PR>`).
2. G1 on main: `uv run python -m scripts.walk.run <sha40>` then the real-set-walk workflow; read its agent layer.
3. FL5 (a) by the cases table; FL5 (b) alone if (a) runs long.
4. If time: the FL6/FL13 issues; #680's storeys corrections (#677); the FL10 words mays.

## Finish line (checked by its command)
1. G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
2. `docs/handoff/session-24-prompt.md` merged, opening with session 23's measures table.
Budget: ask the owner (recommend **8 hours**).

## Binding from session 22 (`docs/knowledge/lessons.md`, Session 22)
- Run G1's agent layer on every walk: the script layer passed all but one check while the critics failed seven milestone items.
- After one regression from tuning a constant, the next fix round changes the shape (two sessions running).
- Briefs use invented example titles; scan briefs' examples as code.
- Before launching a builder on a branch a writer's worktree holds: `git switch --detach` there first.
- `stamp start --budget 8h` (a unit; a bare number is refused now).

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full.
