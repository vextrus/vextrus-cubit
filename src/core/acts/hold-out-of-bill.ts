// HOLD_OUT_OF_BILL (R-TO-052: the bill boundary as an act with consequences), rendered as L-ACT-02's
// pair.
//
// The act says one thing: a person has decided that this kind, on this class and level, is not part
// of THIS BILL. It is the bill axis of L-QTY-05's orthogonal pair, so it moves nothing on the
// measurement axis — a cell held out still reads as measured or unmeasured exactly as it did — and
// the cause it writes is the axis' own, `NOT_IN_THIS_BILL` (risk note 2).
//
// Published lines take precedence over it: a cell that later bears quantity reads IN_BILL and is
// marked contradicted, the row standing where it stood (I-192). A second identical hold moves
// nothing and the seam refuses it by name (L-ACT-01).
import { BILL_IDLE, boundaryRendering, type BoundaryInput } from "../residue/boundary";
import type { ActRendering } from "./rendering";

/** The act this file renders, spelled once. */
const HOLD_OUT_OF_BILL = "HOLD_OUT_OF_BILL" as const;

/** The cause the bill axis stands under when a person has held a cell out (L-QTY-05). */
const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL" as const;

/** The act's input: one campaign's cell, named by the three coordinates the residue keys on. */
export type HoldOutOfBillInput = BoundaryInput<typeof HOLD_OUT_OF_BILL>;

export const holdOutOfBill: ActRendering<HoldOutOfBillInput> = boundaryRendering(HOLD_OUT_OF_BILL, NOT_IN_THIS_BILL, BILL_IDLE);
