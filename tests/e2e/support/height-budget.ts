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
  // # U2 — S-Drawings' timeline composition is U2's redesign (the sheet fan-out stacks every job
  // card and every offered group down one column). Measured at 3168 px on 2026-09-12, viewport 900.
  "j-010-timeline-done": 3168,
});

/** The recorded height for a checkpoint, or `null` where §9.3's cap stands unaltered. */
export const heightBudgetFor = (checkpoint: string): number | null => SCREEN_HEIGHT_BUDGET[checkpoint] ?? null;
