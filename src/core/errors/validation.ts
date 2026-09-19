// The VALIDATION ledger's own refusals — R-TO-035's "validation observations recorded as data", and
// what the ledger refuses to record.
//
// An observation is evidence: it says a cell of the band matrix was graded against a competent
// manual takeoff, under instruments it names. A citation the ledger cannot read back is not evidence
// at all, so the one thing this area refuses is a PROVENANCE outside the closed set — where the
// yardstick came from is the whole standing of the row (L-QTY-06: "a number cannot reconcile with the
// source it was copied from").
//
// A refusal belongs to the area that answers it, so the file the ledger is written in is the file
// its code is registered in, and no two areas ever edit one list (AM-11).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type ValidationRefusalCode = "VALIDATION_PROVENANCE_UNKNOWN";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const VALIDATION_REFUSALS: RefusalGroup<ValidationRefusalCode> = Object.freeze({
  // L-QTY-06: the yardstick's own origin is part of the reconciliation, so a row that names an
  // origin the ledger does not admit is refused where it is made rather than stored unreadable.
  VALIDATION_PROVENANCE_UNKNOWN: Object.freeze({
    code: "VALIDATION_PROVENANCE_UNKNOWN",
    message: "The observation names a provenance the validation ledger does not admit.",
    remedy: "Cite one of HAND_FROM_RENDER, HAND_FROM_AUTHORED_SOURCE or INDEPENDENT_HUMAN_TAKEOFF.",
    severity: "error",
    surface: "inline",
  }),
});
