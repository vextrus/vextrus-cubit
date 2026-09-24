// The traced plate's algebra, said once: `V = count × (A − openings − junctions) × t`.
//
// A hand measurement of a plate — the blinding a slab is laid on, and whatever else a person traces
// as one ring and lays through one thickness — is an OUTLINE, not a member's plan projected by the
// edition: the ring the QS traced is the area, and nothing here offsets it (s-measure I-388). What
// comes off it comes off through the gate, by channel, never as a sum an offer carries (L-MEA-08):
// - `openings` is what the edition's strictly-greater threshold DEDUCTED of the cut-outs the QS
//   traced as openings (L-MEA-02's partition, which L-MEA-09 applies to a slab's openings);
// - `junctions` is every vertical member's plan standing through the ring, deducted whole in the
//   `junction` channel, because L-MEA-09 puts the threshold on the openings alone (I-389).
//
// `threshold` is declared and bound and is deliberately NOT in the tree: L-MEA-02 has "the threshold
// in force" land in the line's variables so a reader can see the rule that kept what was kept, and a
// figure that moved when the threshold moved would be a figure the threshold had been subtracted
// from. It is the OPENING channel's; the junction channel states none.
//
// The tree stands here and each method beside this file states its own pair and kind, as the face
// algebra does for plaster and paint (`../masonry-finishes/face.ts`): a second spelling of the same
// net-plate sentence would be a second home for it, and the two would part the day it moved (B-17).
import type { Kind } from "@/core/catalogue/kinds";
import { THRESHOLD_VARIABLE } from "@/core/offers/law";
import type { MethodPair } from "../../editions/content";
import { formulaFrom, minus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The variables the traced plate names, each in the dimension its reading is taken in. */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });
const AREA: MethodVariable = Object.freeze({ name: "A", dimension: "AREA" as const });
const OPENINGS: MethodVariable = Object.freeze({ name: "openings", dimension: "AREA" as const });
const JUNCTIONS: MethodVariable = Object.freeze({ name: "junctions", dimension: "AREA" as const });
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });
const THRESHOLD: MethodVariable = Object.freeze({ name: THRESHOLD_VARIABLE, dimension: "AREA" as const });

/** `V = count × (A − openings − junctions) × t` — the traced ring, net, through its thickness. */
export const TRACED_PLATE_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V(COUNT.name), minus(minus(V(AREA.name), V(OPENINGS.name)), V(JUNCTIONS.name)), V(THICKNESS.name)),
});

/**
 * One traced-plate method: the tree above, in force under this pair and measuring this kind. The kind
 * is the only thing that differs between two plates of one ring, and it is what the offer names.
 */
export function tracedPlateMethodOf(pair: MethodPair, kind: Kind): FormulaMethod {
  const parts = formulaFrom(TRACED_PLATE_TREE, pair.ruleId);
  return Object.freeze({
    role: "formula",
    ruleId: pair.ruleId,
    version: pair.version,
    kind,
    dimension: "VOLUME",
    variables: Object.freeze([COUNT, AREA, OPENINGS, JUNCTIONS, THICKNESS, THRESHOLD]),
    // The openings a person traced are partitioned against the edition's threshold; the members a
    // ring runs past are deducted whole. Two channels, because they are two rules (L-MEA-09).
    deductionChannels: Object.freeze(["opening" as const, "junction" as const]),
    tree: TRACED_PLATE_TREE,
    template: parts.template,
    evaluate: parts.evaluate,
    attempt: parts.attempt,
  });
}
