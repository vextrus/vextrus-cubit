// L-MEA-03's plaster: the face a plaster covers, gross less the openings the schedule deducted.
//
// The algebra is the face algebra's, stated once beside this file (`./face`), and this file states
// what is particular to a plaster: the pair it is in force under, and the kind it measures. The
// thickness and the mix that select the item are SELECTING facts carried onto the line by the rail —
// they are not in the formula, because a plaster's area does not depend on either (L-MEA-06).
import type { MethodPair } from "../../editions/content";
import { faceMethodOf } from "./face";
import type { FormulaMethod } from "../law";

/** The pair this method is in force under: an edition cites it, the registry maps it. */
export const PLASTER_FACE_METHOD: MethodPair = Object.freeze({ ruleId: "finish.surface.plaster", version: "1" });

/** `finish.surface.plaster@1`: the plaster of one surface (R-TO-032, L-MEA-03). */
export const PLASTER_FACE_FORMULA: FormulaMethod = faceMethodOf(PLASTER_FACE_METHOD, "finish.plaster");
