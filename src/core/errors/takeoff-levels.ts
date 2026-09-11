// The level stack's refusals (L-MEA-07, L-REG-03): an ordinal the floor-multiplier scheme has no row
// for, a storey height nobody stated, and two people who read one level and got two heights.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffLevelsRefusalCode =
  | "LEVEL_ORDINAL_UNMAPPED"
  | "STOREY_HEIGHT_UNSTATED"
  | "STOREY_HEIGHT_CONTESTED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_LEVELS_REFUSALS: RefusalGroup<TakeoffLevelsRefusalCode> = Object.freeze({
  // L-MEA-07: "the floor-multiplier scheme keys to the ordinal — a scheme with no row for an ordinal
  // throws `LEVEL_ORDINAL_UNMAPPED`". Nothing at that level can be priced until the scheme says what
  // its ordinal multiplies by, so the sentence points at the scheme rather than at the level.
  LEVEL_ORDINAL_UNMAPPED: Object.freeze({
    code: "LEVEL_ORDINAL_UNMAPPED",
    message: "The floor-multiplier scheme has no row for this level's ordinal, so nothing standing on it can be multiplied.",
    remedy: "Add a row for this ordinal to the workspace's floor-multiplier scheme, then derive again.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-07: a storey height nobody stated is unstated, never defaulted. Answered for a level no
  // reading stands on, and for an act that would record one on a basis nobody read it on.
  STOREY_HEIGHT_UNSTATED: Object.freeze({
    code: "STOREY_HEIGHT_UNSTATED",
    message: "Nobody has stated this level's storey height, and a height the system invented would be priced as though somebody had.",
    remedy: "Enter the storey height for this level, or transcribe it from the drawing that states it.",
    severity: "error",
    surface: "inline",
  }),
  // L-REG-03: "disagreement is declared, never resolved silently". Two people read the level and got
  // two heights, so it stands at none until one of them re-affirms.
  STOREY_HEIGHT_CONTESTED: Object.freeze({
    code: "STOREY_HEIGHT_CONTESTED",
    message: "This level's storey height has been read two different ways, so it stands at no height until the readings agree.",
    remedy: "Compare the competing readings and re-affirm the one that is right, which supersedes that reader's earlier figure.",
    severity: "error",
    surface: "inline",
  }),
});
