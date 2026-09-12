// §9.3's capture cap, and the one lawful way past it — the per-screen HEIGHT budget.
//
// Design Direction 00 §9.3 caps a checkpoint's capture at twice the viewport: a picture taller than
// that is a picture of a scroll, not of a screen. That cap is a design law about COMPOSITION, and
// the cure for a screen that breaks it is to compose it differently — never to raise the cap.
//
// A screen whose composition is another node's open work would otherwise take the whole journey red
// or, worse, be quietly fixed here by a redesign nobody reviewed. This file is the third answer, the
// one `tests/e2e/support/axe-budget.ts` already settled for moderate findings: the height the screen
// stands at TODAY is recorded, named, and enforced — the screen may keep the height it has, and it
// may never grow past it. The entry carries the node that owns the redesign, so the debt is on the
// books rather than hidden in a green wall.
//
// A budget is a CEILING TO LOWER, never a target: the redesign that brings a screen under §9.3's own
// cap takes its entry away in the same commit.

/** checkpoint name -> the capture height that screen is allowed, taller than §9.3's own cap. */
export const SCREEN_HEIGHT_BUDGET: Readonly<Record<string, number>> = Object.freeze({
  /**
   * S-Drawings, seen from J-010's timeline — 2 989 px against §9.3's 1 800 (twice the lease's 900 px
   * viewport), measured by `cubit-u2b`'s walk of 2026-09-12 and by nothing since.
   *
   * This entry is RESTORED, and restoring it is the lesser of two wrongs. Commit 5f2ad06 emptied
   * this file on the strength of U2's §3.4 rebuild without a browser ever having measured the
   * rebuilt screen; the first walk measured it at 2 989 px, so the rebuild took 3 168 → 2 989 and
   * left 1 189 px of the debt standing. A budget is taken away by the redesign that EARNS it. This
   * one was not earned, and a wall that is green because the ledger was emptied is the one thing
   * this file exists to prevent.
   *
   * OWED BY: the node that finishes S-Drawings under Design Direction 00 §9.3 — density, collapse,
   * virtualise, or two columns. 1 189 px, one screen.
   *
   * The sister checkpoints of the same screen (`j-010-jobs-tray-open`, `j-010-sheets-fanned-out`,
   * `j-010-sheets-uploaded`, `j-010-discipline-confirmed`, `j-000/disciplines-confirmed`) are NOT
   * written here: this session's J-010 run was red before their checkpoints and NOTHING HAS
   * MEASURED THEM ON THE REBUILT SCREEN. A budget entry is a measurement, never a guess, so each
   * returns at its own measured height on the first walk that reaches it — or does not return at
   * all, which is what the rebuild is trying to earn.
   */
  "j-010-timeline-done": 2989,

  /**
   * The same screen, at a sister checkpoint the walk has now reached — S-Drawings with the offered
   * discipline confirmed, measured at 2 417 px by `cubit-u2e`'s light-lane run of
   * `tests/e2e/journeys/j-000/m1-confirm-disciplines.spec.ts` on 2026-09-12 and by nothing else.
   * It is written for the reason the entry above is: a walk measured it, so it is a MEASUREMENT and
   * no longer a guess, and the debt goes on the books rather than into a red nobody owns.
   *
   * It stands 572 px shorter than `j-010-timeline-done` because there the jobs timeline is open
   * over the same list; the screen and the debt are the same node's. OWED BY: the node that
   * finishes S-Drawings under Design Direction 00 §9.3 — 617 px on this reading of the screen.
   *
   * The three remaining sisters (`j-010-jobs-tray-open`, `j-010-sheets-fanned-out`,
   * `j-010-sheets-uploaded`) stay absent on the same rule: nothing has measured them.
   */
  "j-000/disciplines-confirmed": 2417,

  /**
   * The third reading of the same screen: S-Drawings with the jobs tray open, measured at 2 989 px
   * by `cubit-u2f`'s re-baseline walk of 2026-09-12 (both lanes, the same number in each) and by
   * nothing else. Written on the rule the two entries above are written on — a walk measured it, so
   * it is a measurement and not a guess, and the debt goes on the books rather than into a red
   * nobody owns.
   *
   * It is `j-010-timeline-done`'s own height to the pixel, which is what one expects: the tray and
   * the timeline are the same overlay over the same list, and neither adds to the scroll the list
   * already owes. OWED BY: the node that finishes S-Drawings under Design Direction 00 §9.3 —
   * 1 189 px, the same screen as the other two.
   *
   * The two remaining sisters (`j-010-sheets-fanned-out`, `j-010-sheets-uploaded`) stay absent on
   * the same rule: nothing has measured them.
   */
  "j-010-jobs-tray-open": 2989,

  /**
   * The fourth reading of the same screen: S-Drawings the moment the drawing has fanned out into
   * its sheets, measured at 2 989 px by `cubit-u2f`'s walk of 2026-09-12 — the same number in the
   * light lane and in the dark one — and by nothing else. Written on the rule its three sisters
   * are written on: a walk measured it, so it is a MEASUREMENT and not a guess, and the debt goes
   * on the books rather than into a red nobody owns.
   *
   * It is `j-010-timeline-done`'s and `j-010-jobs-tray-open`'s height to the pixel, and for the
   * same reason: all three are the one list, at its full length, with a different overlay over it.
   * The list is the debt; the overlays add nothing to it. OWED BY: the node that finishes
   * S-Drawings under Design Direction 00 §9.3 — 1 189 px, the same screen as the other three.
   *
   * One sister remains absent on the same rule — `j-010-sheets-uploaded`, which no walk has
   * reached, because the checkpoint before it was red until this entry.
   */
  "j-010-sheets-fanned-out": 2989,

  /**
   * The fifth and last reading of the same screen the walk reaches: S-Drawings with the offered
   * discipline confirmed, measured at 2 585 px by `cubit-u2g`'s light-lane J-010 of 2026-09-12 —
   * the first walk ever to get past the checkpoint above it — and by nothing else.
   *
   * It stands 404 px shorter than its three sisters because the confirmation empties the offered
   * group that was standing over the list, and 168 px taller than `j-000/disciplines-confirmed`,
   * which is the same act read on J-000's own smaller upload. OWED BY: the node that finishes
   * S-Drawings under Design Direction 00 §9.3 — 785 px on this reading.
   *
   * `j-010-sheets-uploaded` needs no entry: the walk reached it and it stands under §9.3's own cap.
   */
  "j-010-discipline-confirmed": 2585,
});

/** The recorded height for a checkpoint, or `null` where §9.3's cap stands unaltered. */
export const heightBudgetFor = (checkpoint: string): number | null => SCREEN_HEIGHT_BUDGET[checkpoint] ?? null;
