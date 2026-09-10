// DECLARE_NOT_IN_PROJECT_SCOPE (R-TO-052: the measurement boundary as an act with consequences),
// rendered as L-ACT-02's pair.
//
// The act says one thing: a person has decided that this kind, on this class and level, is not part
// of this PROJECT at all. It is the measurement axis of L-QTY-05's orthogonal pair, so its cause is
// that axis' own, `NOT_IN_PROJECT_SCOPE`, and it stands above a sheet read only in part while
// standing below any line the campaign published (risk note 2, the arm order).
//
// It sits under SET_BILL_BOUNDARY beside the hold: both are the same LEAD-held decision about what
// this project's certificate speaks about, and L-ACT-03's permission enum is closed (risk note 1).
import { MEASUREMENT_IDLE, boundaryRendering, type BoundaryInput } from "../residue/boundary";
import type { ActRendering } from "./rendering";

/** The act this file renders, spelled once. */
const DECLARE_NOT_IN_PROJECT_SCOPE = "DECLARE_NOT_IN_PROJECT_SCOPE" as const;

/** The cause the measurement axis stands under when a person has declared a cell outside the project. */
const NOT_IN_PROJECT_SCOPE = "NOT_IN_PROJECT_SCOPE" as const;

/** The act's input: one campaign's cell, named by the three coordinates the residue keys on. */
export type DeclareNotInProjectScopeInput = BoundaryInput<typeof DECLARE_NOT_IN_PROJECT_SCOPE>;

export const declareNotInProjectScope: ActRendering<DeclareNotInProjectScopeInput> = boundaryRendering(
  DECLARE_NOT_IN_PROJECT_SCOPE,
  NOT_IN_PROJECT_SCOPE,
  MEASUREMENT_IDLE,
);
