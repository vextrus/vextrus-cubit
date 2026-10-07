# Session 17: land M1's first slice, then finish M0's carry-over to G1 PASS

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g` (keep 40 GB free; session 16
   ran at 30-37 GB and the governor refused local launches under 30 GB).
2. Stop every idle background session: `claude agents --json`, then `claude stop <id>` for each; check with
   `claude agents --json | grep -c pid` that they are gone (in session 16 three stopped sessions kept their pids and
   held the six local slots).
3. `unset FORCE_COLOR PY_COLORS CLICOLOR_FORCE`, then `scripts/factory/orchestrator.sh`, and say:
   "Read docs/handoff/session-17-prompt.md and run it."

---

You are the orchestrator of session 17. **Land the `s16-m1` train (M1's first slice) on main, then take M0's
carry-over to G1 PASS twice on main.** Ask the owner for the budget first (recommend 6 hours: the train's posting
run and four engine landings each hold the real-drawing lock for 35-60 minutes).

## Where session 16 left it (read `.private/work/session-16/STATE.md` for exact heads)
- **The train** `s16-m1` holds all twelve slice tickets (K0 of record is `s16-k0b`; `s16-k0` was abandoned). Its PR
  #601 is open and NOT READY: the train's local verify was restarted at 14:13Z on its head f19897d12 (session 16 ran
  out of time); no integrated review, design gate or posting run yet. Start there: verify, READY, review round 1.
- **Ticket reviews:** W3 #595 PASS r2; L #598 PASS r2; W2 #596 and W1 #597 ended round 2 on one finding scored 50 each,
  filed after the cap as #599 and #600. K0b, R1, R2, M, T1, T2, RT and B were merged at the freeze without their own
  PR review: they were covered only by the train's integrated round. Each ticket PR stays open against main until the
  train lands; close them as "landed in the train" then.
- **The showing** ran on the train head served locally: `.private/work/session-16/showing.md` (three runs; the measured half could not be shown: Step 1, the allowance BOQ, the grid read 24 of 24 and Market Prices
  were shown; Steps 3 and 6, the 3D view and the measured BOQ were not).
- **Readers on Edison** (local, against one hand count; a working measure, not an Answer Key, never scored):
  grid 24 of 24 lines on the three column plans, one frame across 16 plan views; columns 15 of 15 after R2's fix
  round (it read 0 before: the view box was paper, not model space, and the acceptance fixture hid it).

## What is broken or unmeasured (lead with these)
0. **The showing's blockers, in the order that unblocks the measured half:**
   a. **Questions from a replaced read are never withdrawn,** and they gate every row of the step (Enter: "has an open
      Question") while the Questions tab shows none. On the demo, 262 Questions from two empty reads block Steps 4 and 6.
   b. **No ticket built a storey reader:** Step 3 (`GET takeoff/storeys`) is empty, so columns have no heights. The slice
      plan assumed storeys as Proposals of step "storeys" but no family or service writes them. A plan gap: ticket it first.
   c. **The column reader on the served stack** shows each column twice per band, misses one mark, and took a shear-wall
      label as a size; band names show as codes ("floor_1..top"). Locally it read 15 of 15: compare the job's views with
      the local script's (`.private/work/S16-R2edison/run.py`).
   d. **The Gross Floor Area box** shows the stored m² figure in the sft box after entry (W3).
   e. The orchestrator's own fix at the freeze (frame read: views placed by their stored anchors; a family reads only its
      step's plan views; 037ae0ed2) is reviewed only in the train's round: review it there.
1. **Storeys from M0 break the columns:** two column-plan views both claim the ground storey (duplicate candidates
   with conflicting sizes), and "1st to top" yields only floor_1 and top, so floors 2-7 get no columns (10 of 40).
   Step 3 must bind "top" and expand the range; the boundary-storey answer ("excludes_storey") must take effect.
2. **Questions over the bar:** shear walls raise one `engine.column.mark_not_read` each: 12 on the structural
   Discipline from walls alone (the owner's bar: at most 3 per Discipline). Group them, or give walls their family.
3. **3 of 57 Edison structural sheets match no PDF page** (the three column plans), so they never agree and are
   confirmed one by one. Not investigated.
4. **The slice's deviations from M1.md, recorded in session 16:** the API base is M0's `/api/projects/{project_id}/`
   (not `/api/p/{code}/`); Measurement Lines carry Billing-Unit quantities converted once in `measurement` (M1.md puts
   the conversion in `boq`). Settle both with an ADR or move them back.
5. **The acceptance writers guessed K0's field names** (C4 names types, not fields): the train fixed them in
   `.private/work/session-16/contracts.md`'s seams section. Copy the seams into `docs/plans/M1.md` C4/C7/C11.
6. G1 on main is still failing (session 15's baseline); no reading fix landed in session 16.

## Finish line
1. The train lands on main through its gates (integrated review PASS, design gate on the head the lander leaves,
   one posting run accepted, merge_ready).
2. Item 0 above (a-e) fixed with tests, the storey reader (0b) ticketed and built first: the slice's measured half
   (Steps 3, 4 and 6 confirm; columns in 3D; the measured BOQ by ratio) runs on Edison by keyboard. Then items 1-2.
   Each through review and the lock. This is M1's next slice; anything cut from it is said in the PR's `## Cut`.
3. M0's carry-over (session 16's brief, "M0 carried in from session 15", unchanged: #593 first, then Q1, Q2, E3,
   A2, A3, E2, E6, S1, #557, #591, #572, S15-FC) landed in the brief's order, lock permitting.
4. G1 PASS twice on main, then "walk now" to the owner.
5. `docs/handoff/session-18-prompt.md` merged.

## Lessons from session 16 (binding)
- **A launched cloud builder can go silent for its whole budget.** K0 pushed nothing in 46 minutes; a second builder
  on a fresh branch finished first, and two different K0s then existed. Check each cloud branch at its budget's
  half; launch the replacement then, and name one "of record" at once.
- **Acceptance fixtures that pass `view=None` hide placement bugs:** every family's acceptance must include a view
  placed on a sheet (paper box on a model-space sheet). Make it a check.
- **Run every engine reader on a real set before its PR,** not after: R2 was READY and read nothing on Edison.
- **Library-count tests conflict across every ticket that adds a Library module:** each ticket rewrote the same
  exact-dict asserts. Change those tests to filter to their own modules (RT's `synced()` did), once, on main.
- **One push per call, and no loop:** the guard judges each push alone, against a leak stamp made before it.
- **`review run` refuses a head whose CI is red** but still spends the lenses: check the PR's checks first.
- **Verify the train after the last merge, not during it:** merging under a running verify voids it.
