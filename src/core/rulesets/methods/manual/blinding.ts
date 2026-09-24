// L-FRM-04's blinding, measured by hand: the plain cement concrete under a traced outline.
//
// L-FRM-04 prices blinding as `count × (L + 2p) × (B + 2p) × t`, "deferred for polygon plans": the
// machine projects a rectangular member's plan by the edition's `p`, and it cannot offset a polygon.
// A person tracing the blinding's scope traces an OUTLINE — the member's own, or a drawn blinding
// outline that follows it — so nothing is projected and the deferral is not reached (s-measure
// I-388). The algebra is the traced plate's (`./traced-plate`): the ring, less the openings the
// edition's threshold deducted, less the members standing through it, through the thickness the
// condition states or the drawing's note says. This file states what is particular to blinding: the
// pair it is in force under, and the kind it measures.
//
// `pcc.blinding_rect@1` is not reused, and cannot be: it reads `L` and `B` off a rectangle, binds a
// projection a traced outline has already drawn, and declares no channel a cut-out could come off
// through (`../foundations/blinding.ts`).
import type { MethodPair } from "../../editions/content";
import type { FormulaMethod } from "../law";
import { tracedPlateMethodOf } from "./traced-plate";

/** The pair this method is in force under: an edition cites it, the registry maps it (L-MEA-01). */
export const MANUAL_BLINDING_METHOD: MethodPair = Object.freeze({ ruleId: "pcc.blinding.area", version: "1" });

/** `pcc.blinding.area@1`: the blinding under a traced outline (L-FRM-04 as I-388 reads it). */
export const MANUAL_BLINDING_FORMULA: FormulaMethod = tracedPlateMethodOf(MANUAL_BLINDING_METHOD, "pcc.blinding");
