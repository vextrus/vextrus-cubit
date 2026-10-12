# Session 24: land FL5, FL7 and FL8, then G1 on main twice

## Session 23's measures (`scripts/factory/measures.py`, 12 Oct 06:52Z to 13:11Z)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 2 | 6 | |
| merge_p50_min | 295.3 | 77.8 | |
| rounds_per_pr | 2 | 1.67 | |
| rdlock_min | 146.6 | 196.6 | |
| verify_p50_min | 8.5 | 7.1 | |
| verify_p90_min | 10.7 | 13.6 | 10 |
| ci_wall_p50_min | 9.9 | 10.7 | 10 |

(The session ended at 6:18 of its 8 hours: by then FL5 and FL8 had reached the review cap, and a G1 walk with its
agent layer, about 80 minutes, would have failed on their items. rounds_per_pr counts merged PRs only; FL5, FL7
and FL8 took nine review rounds between them over six PRs.)

Missed or wrong:
- **M0's finish line (G1 PASS twice) was not met; G1 was not run on main this session.** The day went to landing
  M0-FL5, FL7, FL8 and FL10, and each of FL5, FL7 and FL8 went the full review cap. FL10 landed (#681); FL7
  landed (#687); FL5 (#686) stopped at the cap; FL8 (#680) stopped at the cap.
- **A question to the owner held the orchestrator for two hours** (asked at 3:05 of 8:00, answered at 5:08); two
  READY heads (FL8, FL5) waited unread meanwhile.
- **Rules built on word order and on undo chains took three review rounds each** (FL7: the tie between a building
  element and a site work, then the setback word; FL8: restoring a correction through a chain of undone ones).
  FL7 came right only when the shape changed (no tie; site works never a view's subject; setback only as a
  plot's). FL8 has not yet changed shape.
- **The real-drawing lock set the pace:** each run took 22-41 minutes, one at a time; four runs were cancelled
  because a fix round replaced their head.

## Where things stand (read first)
- **Final state at 14:52Z:** both went one round further. **#691 (FL8) at 1b76c0dc: review 2 FIX** (70, 60: round 1
  made the server's undo pass over a moved-on correction to the person's earlier act, but the web's Ctrl Z and the
  toast's Undo still word the result from the tab's own history, ignoring the reply; 35: correction_moved_on names
  no sheet; 35: the length limits are literals, not placeholders). **#692 (FL5) at 413f6764: review 2 FIX** (65: a
  ruled schedule's box counts as a drawing a 13-16 word footnote can title; 55: the "no short title at that
  drawing" guard uses a narrower rule than pairing's TITLE_GAP). Both rounds' findings come from round 1's change,
  so round 3 under `fix-regression` is open to each; it is the last. Neither has a real-drawings status; #692's
  builder read four DWGs directly on 413f6764 (Edison architecture: the 8 phantom views gone, the 4 long titles
  gained, 0 titles lost; three other DWGs' title lists identical to main's).
- **Update after the close (12 Oct, 13:15-14:52Z, the budget's last 95 minutes):** both stopped tickets went to
  their new shapes on fresh PRs. **#691 (FL8, branch s23-fl8c)**: Ctrl Z takes back only a sheet's latest standing
  correction; review 1 FIX (60: an undo goes through another person's answer; 55/45: a refused undo blocks the
  person's earlier acts for good; 50: undo does not give back the Plot match; 45: a re-read overwrites a
  correction); fix round 1 was with its builder at the session's end. **#692 (FL5, branch s23-fl5c)**: long lines
  decided last, after ruled tables and each title's own lines; review 1 FIX (65: any short rule makes a schedule
  "hold a drawing"; 60: a long remark beside a plan's title takes its drawing); fix round 1 (a long title must be
  centred on, and directly under or over, its drawing, as all four real long titles are) was with its builder.
  #680 and #686 are closed. Read `uv run python -m scripts.factory.state` for both heads first; neither has a
  real-drawings status yet. Issues filed: #689 (the Correct form's six mays), #690 (the Coverage panel's two
  excluded totals). The older bullets below describe #680 and #686 as they stood at the close.
- Landed: #681 (FL10: every Step 1 act and answer is one event). #687 (FL7: a Structural view proposes the Step of every building element its own title names, plus Step 14 for a site work; site works are never a view's subject; "setback" is site works only as a plot's; the Coverage panel's Unaccounted list, m0-screens 6.11; real-drawing run: 16 views and 10 checks changed, nothing lost or gained). It replaces #682 and #684 (closed with reasons). Owed: the owner's custody re-run of `tools/scorer/` (#687 changed `tools/scorer/score.py`: a 'site works' key phrase is read against a view's Step 14).
- **#680 (FL8, branch s22-fl8, head 9fb8e7d2): FIX at round 3, the cap.** Review 3's standing findings: a
  correction's undo restores the oldest correction's `before` even when that correction was undone (75), and
  so loses a number typed through the missing-number Question since (70); the Question's keep-open answer is
  restored from the first correction's snapshot (52, 50); a later standing correction landing on the same value
  is overwritten (50); below the bar: the form's maxLength cuts a pasted line silently (45), "One source,
  corrected" drops "Proposal" (30), limits as literals in the words (25), "title" in the toast (25), the event
  line names no sheet (20). Its design gate PASSED on cf2aa78f (walk) and the words passed on 9fb8e7d2. The
  ledger allows no fourth round: the shape change goes on a new branch and PR with a fresh review, as #687 did
  for FL7 under the owner's ruling (12 Oct). Shape: Ctrl Z takes back only a sheet's latest standing correction
  (refuse any other with words naming the route), so nothing restores through a chain; every reviewer's
  sequence pinned.
- **#686 (FL5, branch s23-fl5)**: head a94d133a, FIX at round 3, the cap. Standing: a lone 13-16 word remark naming a view kind in a sparse column of a ruled schedule is taken as a title and the schedule is lost (55); round 2's join test does not skip the title's own storeys line, so a long second line under a titled plan with a storeys line stands alone again (50). Review 2's and 1's fixed. Below the bar: a lone long callout inside a titled plan's grid removes the plan (40; a short one does the same on main), a long title lettered as two centred lines is split (35). Next shape: decide long lines after tables and a title's own block (its storeys line, its scale line) are known, so a schedule's cell and a title block's line are never candidates; a new branch and PR. The rule, from a cases table over all 285 real sheets
  (.private/work/s23/fl5-cases.md): a 13-16 word one-line title is a title when it passes the short-title gates,
  stands as a column of one, and no notes heading claims it; a long line joins a title only as its own second
  line (nearest above, nothing between, aligned). Posting run reason: 4 long-titled plans now titled; 8 lost
  are their phantom duplicates; 84 changed storeys_meaning only.
- **Open for the owner:** #687 narrows "setback" to "plot setback" (review 2's 30: a Structural sheet titled just
  "SETBACK ARRANGEMENT" leaves its untitled section unaccounted, where the 11 Oct ruling's words give Step 14).
- Issues: #685 (a flaky engine/plot timing test; failed #680's CI once).
- Mays from the design gates (filed as #689 and #690): FL8 D1 (a corrected value's provenance line), D2 (E on a grouped
  row names no copy), D3 (focus lost after undo moves a row), D4 (an empty Number's toast far from the field);
  FL7's "Excluded, by reason" total disagrees with the Coverage line (40).
- Housekeeping: local branches s22-fl7, s22-fl7b and s22-fl5b hold real titles or a leaking commit: never push
  them; delete them once their worktrees are free. Scratch worktrees: .private/work/s23/fl5-acc/throwaway,
  .claude/worktrees/S22-FL7C/.private/work/fl7c-*.

## Plan
1. Ask the owner for the custody re-run of `tools/scorer/` (#687), with the command.
2. FL8 (#680) and FL5 (#686) by their new shapes (above), each on a fresh branch and PR (each old PR's ledger is at
   the cap): acceptance amendment if the pins need it, a builder, review, gates; every reviewer's sequence pinned.
3. G1 on main: `uv run python -m scripts.walk.run <sha40>` then the real-set-walk workflow; read its agent layer.
   Twice, on main's current product code.
4. If time: the FL6/FL13 issues; #677 (storeys corrections); the mays above.

## Finish line (checked by its command)
1. G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
2. `docs/handoff/session-25-prompt.md` merged, opening with session 24's measures table.
Budget: ask the owner (recommend **8 hours**), before anything else, and ask nothing else that can wait: a question
holds the orchestrator's turn.

## Binding from session 23 (`docs/knowledge/lessons.md`, Session 23)
- Before asking the owner anything, give every running builder its next message.
- A recogniser rule that a review sent back once is designed from a cases table of the real sets first.
- Queue a posting run only for a head whose review passed; cancel a run whose head was replaced.
- The design gate names every item 1-11 once.

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full.
