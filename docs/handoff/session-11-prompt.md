# Session 11: re-score main after #212, land scored loop 2, the owner's M0 walk, then the loops toward the 80% bar

## Starting the session (the owner)
1. No custody re-run is owed at the start (session 10's run: 16/16 on main da619179). One is owed whenever
   `tools/scorer/`, `scripts/real_drawings/` or `scripts/owner/post-status` changes on main (#212 changes
   `scripts/real_drawings/diff.py`: **one is owed after #214 merges**). Run it in a WSL terminal, not the `!` prompt
   (sudo needs a terminal): `cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/keys-custody.sh`.
2. Then: `claude --model claude-opus-5-5 --effort medium`, check `/status`, and say: "Read
   docs/handoff/session-11-prompt.md and run it."

---

You are the orchestrator of session 11, at **medium** effort. Read first, in this order and no more: this brief;
`.private/work/session-10/STATE.md` (the last 40 lines); each PR's report named below when you act on it. **8 hours**
from your first launch; no new launches after 7 h. Write `.private/work/session-11/STATE.md` first. Session 10's
operating files still hold (copy `.private/work/session-10/{common.md,writer-common.md,land.sh,premerge.sh,
premerge-tc.sh,rulings.md}`, paths fixed; `real-drawings.lock` is a symlink to session 09's: keep one shared lock).

## What session 10 learned (use it)
- **The scorer reads the product job's export since 21d (#210), and that export had no paper:** main scored 0 sheets
  ("paper unknown") until #212. A posting run's diff never compared paper, so 21d's runs showed nothing. After a
  change to what the check reads, **score main before trusting any number.**
- **Local venvs:** `uv sync --locked` and plain `uv run` put back ezdxf's pure wheel, and 11 toolchain tests fail for
  that reason alone. After a sync: `uv pip install --no-deps --reinstall
  ~/.cache/vextrus-real-drawings/wheels/ezdxf-1.4.4-cp314-cp314-linux_x86_64.whl`, then always `uv run --no-sync`.
- **A merge of main must take an acceptance file whole from one side** (`tools.lint.acceptance` refuses a merge whose
  resolution combines both: #186 had to be replaced by #208). Merge with `--no-commit`, `git checkout origin/main --
  <file>` for any acceptance file both sides changed, commit, then re-apply the branch's change in an `acceptance:`
  commit. Check before pushing: `python3 -m tools.lint.acceptance origin/main HEAD`.
- **Every takeoff/drawings/engine PR needs a real-drawing posting run on its final head** (~20 min), and every merge
  makes the next PR's head new: land them one at a time. A scored run started and then killed keeps running as `vxrun`;
  wait for it (`pgrep -u vxrun bwrap`) before the next run.
- **Real-drawing text in git (session 10, a scored loop's test literals, pushed to the public repo for ~25 min):** the
  owner ruled "Leave it". Before pushing any engine branch, scan its new literals and messages against the cached
  exports (`.private/work/session-10/loop-tbnotes/review/lits.py`, run with the toolchain's Python 3.14); the guard's
  check is #211 (debt).
- The cloud launcher refused twice ("cloned at revision main, not the ticket's branch"): local `claude --bg` worked.
- `claude --bg --resume <id>` on a finished session starts a copy; prefer a fresh `-n` session with the brief.

## 1. First
| Order | PR | What | State | Next |
|---|---|---|---|---|
| 1 | #214 | #212: the job's export keeps each sheet's paper (`t212` 37690cd5) | review 1 PASS; real-drawings posted (clean); **CI `toolchain` red**: the two t212 acceptance tests that read through the job fail on CI with `FileNotFoundError: /opt/vextrus/acadsharp-dump` (CI's image has the dumper elsewhere; the harness finds it by `VEXTRUS_ACADSHARP_DUMP`, `engine/harness.py`) | `acceptance-writer` amends `vextrus/takeoff/tests/acceptance/t212/test_sheet_paper.py` to find the dumper as the other job-path toolchain tests do (an `acceptance:` commit; a test-infrastructure fix, not a change of what it pins: still ask the owner if the classifier refuses), push, re-post (new head), land; custody re-run (owner); then **re-score main `--fresh`** |
| 2 | #213 | scored loop 2: title-block and notes views (`loop-tbnotes2` 458a3e8d) | review 1 FIX → round 1 → re-check (1 test-only 50) → round 2 done (test only, verified red with its mutant; not re-reviewed by an agent); views 68/15/17 vs 3f53ea99, nothing else | merge main, score it (after #214 + custody), judge views by the score, `--accept`, land |
| 3 | t160 | #160 one paper scale (round 2, the last; `t160` a39aceae, pushed) | render_f1 1 gained / 58 lost / 123 changed; views 1056/906; **not scored** (the score was killed for #208's run) | score it after #214; render_f1 losses are not accepted (session 09's ruling): if the score gains, put the trade to the owner; else carry |

## 2. The owner's M0 walk
`.private/work/session-10/walk-steps.md`. Everything the 15 steps need is on main since #209/#210; the owner chose
"Walk after #209 lands"; no failures reported by session 10's close. Ask for the step-numbered failures; turn each
into a ticket (acceptance first).

## 3. The scored loops and the 80% bar
Main's last good score (session 09, harness path, corrected keys): Edison sheets 38/217, views 332/739; Sample 8/67,
197/417; #201 (merged) scored Edison views 418, sheets 44. The bar: Edison ≥ 174/217 sheets, ≥ 592/739 views; Sample
≥ 54/67, ≥ 334/417. The biggest failing class (score of loop 1's head): views missing, title block 57 and notes 61
sheets (loop 2 targets these), then section 56, plan 46, schedule 34, detail 33. Then: storeys (ask the owner to place
Edison's 6 sheets / 33 storeys and Sample's 1 / 1 by sheet number), subjects after a vocabulary ruling.

## 4. Not started (from session 09's list)
#167 Step 1 words bundle, #182 seed through the job (absorbs #150, #204), #202 (m0-screens §5/§6.9 Ctrl Z), #206
(set-aside chip), plus session 10's #203 walk mays (`.private/work/session-10/156/gate/walk-r3.md`, file them) and #211.

## 5. M1
Drafted, not published (`.private/work/session-08/m1-tickets/`). Ask "publish as planned?" after the M0 walk.

## The owner's rulings in session 10 (verbatim)
- #168's tests: "Amend them (Recommended)" (t19a/t21c's no-Discipline example file is `NOTES.dwg`).
- The walk: "Walk after #209 lands (Recommended)".
- The leaked titles: "Leave it".
- Custody re-run after 21d: done, 16/16.

## Orchestrator's rulings in session 10
#168: only "general note(s)" guesses General ("general" alone and "notes" alone guess nothing; replaces session 08's);
#203 round 3 past the cap (two walk musts + #205); #212: the paper is the sheet step's own, a paper gone to null diffs as
changed, an old kept step exports null.

## Merged in session 10
#200 (#163 pin), #208 (#161; replaced #186), #203 (#156, closes #205), #209 (#168), #201 (scored loop 1), #210 (21d).
Filed: #211 (guard: real text in pushes), #212 (paper).
