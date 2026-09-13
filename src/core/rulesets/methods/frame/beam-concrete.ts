// L-MEA-09's beam, as the frame algebra's first formula: the concrete a run of identical beams holds
// between the faces of the members supporting its ends — `V = count × b × (D − t) × clear`.
//
// The junction is OWNED rather than deducted: "each junction volume has exactly one owning member,
// in the precedence pile › pile cap › column / shear wall › beam › slab". A beam therefore measures
// clear of its supports and below the slab soffit, and the thicker adjoining slab governs `t` — a
// selection its rail makes between two stated readings, never arithmetic done here.
//
// The method is data and one function, evaluated over bindings the gate has already carried into the
// canonical unit of each variable's dimension (B-17, L-FRM-06). The arithmetic is the canon's exact
// decimal, so a figure is exact from the drawing to the page (B-07).
import type { MethodPair } from "../../editions/content";
import { formulaFrom, minus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const BEAM_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.beam.concrete", version: "1" });

/** The five variables the formula names, in the order its template spells them (L-MEA-09). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "t", dimension: "LENGTH" as const }),
  Object.freeze({ name: "clear", dimension: "LENGTH" as const }),
]);

/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, L-MEA-09). */
const TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("b"), minus(V("D"), V("t")), V("clear")) });

/** The template and the evaluator, printed and evaluated from that one tree (B-17). */
const FORMULA = formulaFrom(TREE, BEAM_CONCRETE_METHOD.ruleId);

/** `rcc.beam.concrete@1`: the concrete a beam holds below the soffit, clear of its supports. */
export const BEAM_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: BEAM_CONCRETE_METHOD.ruleId,
  version: BEAM_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: VARIABLES,
  // No channel: a beam nets nothing, because the junction it does not own is another member's to
  // measure, not a deduction from this one (L-MEA-09).
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
