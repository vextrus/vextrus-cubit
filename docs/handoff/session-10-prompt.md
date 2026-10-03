# Session 10: land M0's last open PRs, the owner's M0 walk, then the scored loops toward the 80% bar

## Starting the session (the owner)
1. No custody re-run is owed at the start (session 09's run: 16/16 on main f026c2be; every posting run since has passed).
   One is owed **after 21d merges** (it changes `scripts/real_drawings`).
2. Then: `claude --model claude-opus-5-5 --effort medium`, check `/status`, and say: "Read
   docs/handoff/session-10-prompt.md and run it."

---

You are the orchestrator of session 10, at **medium** effort. Read first, in this order and no more: this brief;
`.private/work/session-09/STATE.md` (the last 40 lines); each PR's report named below when you act on it. **8 hours**
from your first launch; no new launches after 7 h. Write `.private/work/session-10/STATE.md` first. Session 09's
operating files still hold (copy `.private/work/session-09/{common.md,common.cloud.md,writer-common.md,watch.sh,
land.sh,premerge-tc.sh}`, paths fixed).

## What session 09 learned (use it)
- **Strict up-to-date merging is serial.** Every merge makes the next PR re-run CI (python ~22 min, the limit is now 35,
  #194). Before a PR's turn, merge main into its worktree locally and run the suites there with the toolchain tests
  (`premerge-tc.sh`): every semantic clash this session (#166's 6.4 one-source rule, #158's accounting, #159's General
  default, #165's pending words) showed there first. Then push, post the gates, run `--accept-if-clean`/`--accept`, and
  `land.sh <PR>` (waits for checks, `merge_ready`, merges).
- **Acceptance amendments:** the owner approved, for session 09's queue, amending acceptance tests of one class only (a
  bulk confirm of one-source sheets becomes one-by-one, 6.4/#166). Any other acceptance change is the owner's to approve
  (the classifier refuses it otherwise): ask, one question, recommendation first.
- **Walk sign-in:** the owner approved a gate agent typing the local, session-generated demo password into the local
  sign-in form only ("Allow the demo password (Recommended)"). Say so in the walk's prompt, with those words.
- `pgrep -f "<pattern>"` matches its own waiter: write `[r]eal-drawings`. A posting run's SSH fetch can time out:
  retry it (the loops in STATE do).
- The scorer refuses a main export cached by a PR's run (#199): score main with `--fresh`.

## 1. First: land what is ready (in this order)
| Order | PR | Ticket | State | Next |
|---|---|---|---|---|
| 1 | #196 | #162 no phantoms | if not merged at session 09's close: reviewed, `--accept` posted ("5 covers proposed out…"), CI re-running after the #159-clash test fix | land |
| 2 | #201 | scored loop 1: view boxes | re-check 2 mergeable; scored under the corrected keys: Edison views 332 → 418 / 739, sheets 38 → 44; Sample views 197 → 203 | merge main, `--accept` (views 243 gained / 79 lost / 8 changed, judged by the score), land; then re-score main |
| 3 | #200 | #163 Next/Previous pin | light review PASS; design-gate posted at 33db463a (10; n/a rest) | merge main, re-post the gate, land |
| 4 | #186 | #161 same-number per Discipline | its own change passed words; it contains #159's old head | merge main (now has #193), a words-only `ux-critic` pass, the gate, real-drawings, land |
| 5 | #203 | #156 answer Questions on screen | **both fix rounds used**; the round's fixes hold (re-check 2). Blocked by: (100) `web/src/acceptance/t156/options.fixture.ts` lacks the `general` Discipline after #159 (an `acceptance-writer` commit: the contract options.node.test.ts names); design gate failed item 1 on two musts (drawing-list answers toast only "Qn answered."; an empty typed number is refused silently: exact words in `.private/work/session-09/156/gate/walk-r2.md`) | rule a narrow third round (the 2 musts + #205's General name), re-walk (reseed first), land |
| 6 | 21d | the job as the check's default | `t21d` 811869f4 (local), re-check 2: fixed + one 50 filed (#192); render_f1 19 lost / 28 changed judged f32 paper | **merge last**: open a PR, `--accept`, land; then the owner's custody re-run |

## 2. Builders running or ready at session 09's close
- **#160 one paper scale**: local `s9-160` (fix round 2, the last): a matched Plot page's paper for model-space sheets
  (#157 is on main); render_f1 losses not accepted. Read its NOTES/READY, re-check, real-drawings.
- **#168 Discipline from file names**: cloud on `t168s9` (main + acceptance 4ab17285). Review when READY.
- Not started: **#167** Step 1 words bundle (carry list `.private/work/session-08/167/carry.md`, plus session 09's
  inspector `decided_act` line and the quotes), **#182** seed through the job (absorbs #150 and #204; #157 is on main),
  **#205** (General in the web's Discipline tables), **#206** (set-aside chip; §6.7 amendments), **#202** (m0-screens
  §5/§6.9: Ctrl Z does not undo an answer, the session 09 ruling).

## 3. The owner's M0 walk
`.private/work/session-08/walk-steps.md` (15 steps). Put it to the owner once §1's rows 1–5 are merged (21d is not
needed for the walk). Before asking, update the steps' "needs #…" tags against main.

## 4. The scored loops and the 80% bar
Main's baseline under the corrected keys (session 09, `--fresh`): Edison sheets 38/217, views 332/739; Sample sheets
8/67, views 197/417. The bar: Edison ≥ 174/217 sheets and ≥ 592/739 views; Sample ≥ 54/67 and ≥ 334/417. After #201,
#196 and #160 merge, re-score main. Order unchanged: details' kind, phantoms (#196), one paper scale (#160), storeys
(the keys are corrected: Edison 6 sheets / 33 storeys and Sample 1 / 1 were left for the owner to place: ask for them
by sheet number), subjects after a vocabulary ruling. Sheets fail mostly on views missing or extra per sheet.

## 5. M1
Drafted, not published (`.private/work/session-08/m1-tickets/`). The owner's ruling (2 Oct): "M0 first in session 09
(Recommended)". Ask "publish as planned?" only after the M0 walk.

## The owner's rulings in session 09 (verbatim)
- Custody: "Run it now (Recommended)" (16/16).
- #184's 21c pin: "Amend it (Recommended)".
- The 6.4 class: "Yes, this class only (Recommended)".
- Walk sign-in: "Allow the demo password (Recommended)".

## Orchestrator's rulings in session 09 (binding on the tickets named)
#160 takes a matched Plot page's paper (render_f1 losses still not accepted); #157 had a narrow round 3 past the cap and
merged with its two 50s pinned as strict xfails (#197); #156's server undo refuses an answer's act (`answer_stays`;
m0-screens amendment #202) and a Question's tag is fixed for life (raised order); the demo seed's twin S-07 Question is
#204's, not #156's; #194 raised the python job's limit to 35 min.

## Merged in session 09
#194 (ci limit), #178 (22 Step 1 screen), #175 (#166), #183 (#165), #184 (#158, with the owner-approved 21c pin
amendment), #180 (#164), #193 (#159), #198 (#157). Filed: #189–#192, #195, #197, #199, #202, #204–#206.
