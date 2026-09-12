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
  // EMPTY, and that is the point: "a budget is a CEILING TO LOWER, never a target: the redesign that
  // brings a screen under §9.3's own cap takes its entry away in the same commit."
  //
  // SIX entries stood here and all six were ONE SCREEN — S-Drawings, seen from two journeys:
  // j-010-timeline-done, j-010-jobs-tray-open, j-010-sheets-fanned-out and j-010-sheets-uploaded at
  // 3 168 px, j-010-discipline-confirmed at 2 764, and j-000/disciplines-confirmed at 2 674, which
  // main's own note called "the same debt seen from J-000 … it goes away with it". This is where it
  // goes away.
  //
  // The screen was a column that grew with its data: five helper sentences, a job strip that kept
  // every step of the session, an offered strip that stacked every group there was, and a sheet card
  // whose height was the length of its cited list. v22 U2's rebuild caps all four (Design Direction
  // 00 §3.4, §8's "Drawings (1.8)"), so the screen keeps §9.3's own cap — twice the viewport — like
  // every other screen in the product.
});

/** The recorded height for a checkpoint, or `null` where §9.3's cap stands unaltered. */
export const heightBudgetFor = (checkpoint: string): number | null => SCREEN_HEIGHT_BUDGET[checkpoint] ?? null;
