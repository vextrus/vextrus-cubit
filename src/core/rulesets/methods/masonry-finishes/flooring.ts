// L-MEA-03's floor finish: the floor a room's finish covers, gross less what the threshold deducted.
//
// A room's floor is a FACE of a space exactly as a plastered soffit is, so its algebra is the face
// algebra's, stated once in `./face` and reused here rather than spelled a second time (B-17): `gross`
// is the room's clear outline, and `openings` is the sum of what the edition's finish threshold
// DEDUCTED of the candidates the rail enumerates on the finish channel — the column pieces standing in
// the room, an opening cut through its slab — the retained ones listed on the line with the rule that
// retained them (L-MEA-02, L-MEA-03, I-542). This file states only what is particular to a floor
// finish: the pair it is in force under, and the kind it measures. What it is laid in (a tile, a
// mosaic, a stone) selects the item and is not in the formula, because the floor's area does not
// depend on it (L-MEA-06).
import type { MethodPair } from "../../editions/content";
import { faceMethodOf } from "./face";
import type { FormulaMethod } from "../law";

/** The pair this method is in force under: an edition cites it, the registry maps it. */
export const FLOORING_FACE_METHOD: MethodPair = Object.freeze({ ruleId: "finish.surface.flooring", version: "1" });

/** `finish.surface.flooring@1`: the floor finish of one room's floor (R-TO-036, L-MEA-03). */
export const FLOORING_FACE_FORMULA: FormulaMethod = faceMethodOf(FLOORING_FACE_METHOD, "finish.flooring");
