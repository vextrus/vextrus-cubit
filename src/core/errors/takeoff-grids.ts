// L-CAD-07's georeferencing refusal: what a layout plan is answered with when it offered no lawful
// bubble evidence to build a grid from.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffGridsRefusalCode =
  | "GRID_NO_BUBBLE_EVIDENCE";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_GRIDS_REFUSALS: RefusalGroup<TakeoffGridsRefusalCode> = Object.freeze({
  // L-CAD-07's answer where a layout plan offered no lawful bubble evidence — no family of round
  // rings enclosing bare labels with two distinct labels between them: the view georeferences as
  // deferred rather than as a grid guessed off gridlines and loose letters (L-QTY-04).
  GRID_NO_BUBBLE_EVIDENCE: Object.freeze({
    code: "GRID_NO_BUBBLE_EVIDENCE",
    message: "This layout plan shows no grid bubbles to read a grid from, so its grid is left unresolved rather than guessed.",
    remedy: "Draw the grid bubbles as circles around their letters and numbers, then ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
});
