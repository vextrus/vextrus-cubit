// L-QTY-05's residue causes and R-TO-052's boundary refusal: why a cell of the residue stands as it
// does, and what a declaration over an address the residue holds no cell at is answered with. The
// closed list of causes a PERSON may declare stands here too, beside the codes it is made of.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type ResidueRefusalCode =
  | "NOT_ESTABLISHED"
  | "INGESTION_TRUNCATED"
  | "NOT_IN_PROJECT_SCOPE"
  | "NO_BEARER_SIGHTED"
  | "KIND_NOT_YET_SEEDED"
  | "NOT_IN_THIS_BILL"
  | "CELL_NOT_IN_RESIDUE";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const RESIDUE_REFUSALS: RefusalGroup<ResidueRefusalCode> = Object.freeze({
  // L-QTY-05's six causes: why a cell of the residue stands as it does. They are registered here
  // with every other code because a cause is read exactly as a refusal is read — one home for the
  // words, one remedy per cause (X-3, R-SPINE-062) — and because the coverage grid's legend and its
  // inspector must say the same sentence about a cell that a certificate will (L-QTY-07, B-17).
  // Their severity is what paints a cell's temperature; the cause itself is carried by the mark and
  // by the accessible name, never by the colour (R-UI-060, s-coverage I-188).
  NOT_ESTABLISHED: Object.freeze({
    code: "NOT_ESTABLISHED",
    message: "No line has been published for this kind on this class and level, and nothing explains the absence.",
    remedy: "Measure this kind on this class and level, or declare it out of the project scope so the certificate can state why it is unmeasured.",
    severity: "warning",
    surface: "inline",
  }),
  INGESTION_TRUNCATED: Object.freeze({
    code: "INGESTION_TRUNCATED",
    message: "Every sighting of this cell stands on a sheet that was read only in part, so nothing can be measured from it.",
    remedy: "Upload the sheet again from its source file, then measure the campaign once it has been read whole.",
    severity: "error",
    surface: "inline",
  }),
  NOT_IN_PROJECT_SCOPE: Object.freeze({
    code: "NOT_IN_PROJECT_SCOPE",
    message: "A person declared this kind out of the project scope on this class and level.",
    remedy: "Measure this kind to bring it back: published lines take precedence, and the declaration is then shown as contradicted.",
    severity: "info",
    surface: "inline",
  }),
  NO_BEARER_SIGHTED: Object.freeze({
    code: "NO_BEARER_SIGHTED",
    message: "No class sighted in this campaign bears this kind, so the residue holds no cell for it.",
    remedy: "Pin a revision whose drawings show a class that bears this kind, then measure the campaign.",
    severity: "warning",
    surface: "inline",
  }),
  KIND_NOT_YET_SEEDED: Object.freeze({
    code: "KIND_NOT_YET_SEEDED",
    message: "This work item is in the catalogue, but no class has been recorded as bearing it.",
    remedy: "Record the class that bears this work item in the ruleset, then measure the campaign.",
    severity: "info",
    surface: "inline",
  }),
  NOT_IN_THIS_BILL: Object.freeze({
    code: "NOT_IN_THIS_BILL",
    message: "A person held this kind out of this bill on this class and level.",
    remedy: "Measure this kind to bring it back into the bill: published lines take precedence, and the hold is then shown as contradicted.",
    severity: "info",
    surface: "inline",
  }),
  // R-TO-052: a boundary act declares something about a CELL OF THE RESIDUE, and the residue is a
  // query — an address whose class no channel sighted, or whose level the project's stack does not
  // hold, names no cell at all. Writing a declaration over it would put a row in the store that no
  // reading ever shows anyone, so the act is refused by name and the remedy sends the person back to
  // the grid, where every address that exists is on screen (L-QTY-05, L-ACT-01).
  CELL_NOT_IN_RESIDUE: Object.freeze({
    code: "CELL_NOT_IN_RESIDUE",
    message: "This campaign's residue holds no cell at that address, so there is nothing to declare about it.",
    remedy: "Open the coverage grid and choose a cell it shows: a class this campaign sighted, on a level of the project's stack.",
    severity: "error",
    surface: "inline",
  }),
});

/**
 * The two causes a PERSON may declare a cell of the residue under — one per axis of L-QTY-05's
 * orthogonal pair. The machine's causes are read off the campaign and never written by anyone, so
 * they are not in this list: the store's CHECK is written from it, and a row under any other cause
 * is refused by the database as well as by the act (R-TO-052, L-ACT-01).
 *
 * It stands with the codes rather than with the table for the reason the two lists above do: the
 * seam is not a module's to import (SEAM-TENANT), and a roster its readers cannot reach is a roster
 * they would copy (B-17, Q-07).
 */
export const SCOPE_DECLARATION_CAUSES = ["NOT_IN_PROJECT_SCOPE", "NOT_IN_THIS_BILL"] as const satisfies readonly ResidueRefusalCode[];

/** One of the two. */
export type ScopeDeclarationCause = (typeof SCOPE_DECLARATION_CAUSES)[number];
