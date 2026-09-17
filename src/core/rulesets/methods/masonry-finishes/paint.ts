// L-MEA-03's paint: the face a paint covers, gross less the openings the schedule deducted.
//
// The algebra is the face algebra's, stated once beside this file (`./face`), and this file states
// what is particular to a paint: the pair it is in force under, and the kind it measures. A paint has
// no thickness and no mix — it is selected by the face and the floor alone (L-MEA-06) — so it is its
// own kind and its own rule rather than a variety of the plaster beside it (L-MEA-04).
import type { MethodPair } from "../../editions/content";
import { faceMethodOf } from "./face";
import type { FormulaMethod } from "../law";

/** The pair this method is in force under: an edition cites it, the registry maps it. */
export const PAINT_FACE_METHOD: MethodPair = Object.freeze({ ruleId: "finish.surface.paint", version: "1" });

/** `finish.surface.paint@1`: the paint of one surface (R-TO-032, L-MEA-03). */
export const PAINT_FACE_FORMULA: FormulaMethod = faceMethodOf(PAINT_FACE_METHOD, "finish.paint");
