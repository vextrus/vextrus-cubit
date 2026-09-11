// SEAM-REGISTER's refusals (L-REG-01, L-REG-03): a second measured sighting of one physical scope
// inside a revision, and a cell that carries no numeric reading to convert.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type RegisterRefusalCode =
  | "DUPLICATE_IDENTITY"
  | "READING_NOT_NUMERIC";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const REGISTER_REFUSALS: RefusalGroup<RegisterRefusalCode> = Object.freeze({
  // L-REG-03's double-count guard: "a second measured sighting of the same physical scope inside one
  // drawing-set revision is refused at the door (`DUPLICATE_IDENTITY`) and kept as unpriceable
  // evidence". Nothing is lost by the refusal, so the sentence says where the sighting went.
  DUPLICATE_IDENTITY: Object.freeze({
    code: "DUPLICATE_IDENTITY",
    message: "This physical scope is already registered in this drawing-set revision, so measuring it again would count it twice; the sighting was kept as evidence instead.",
    remedy: "Open the registered object to compare the two sightings, or measure the scope this drawing shows that is not yet registered.",
    severity: "warning",
    surface: "inline",
  }),
  // L-REG-01: "a convert of no input is no output, never a zero". A cell that said "N/A", or said
  // nothing at all, carries no reading to a canonical unit — and a zero written down in its place is
  // a quantity somebody would measure with. The refusal is answered beside the cell that said it.
  READING_NOT_NUMERIC: Object.freeze({
    code: "READING_NOT_NUMERIC",
    message: "This cell does not state a number, so there is no reading to record against the attribute.",
    remedy: "Type the value the drawing states for this attribute, or leave the attribute unread.",
    severity: "error",
    surface: "inline",
  }),
});
