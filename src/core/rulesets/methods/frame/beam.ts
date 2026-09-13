// L-MEA-09's beam, as two formulas: the concrete a beam holds and the formwork it is cast against.
//
// "Beams measure clear between support faces and below the slab soffit: `b × (D − t_slab) × clear`,
// the thicker adjoining slab governing `t`." The junction at each end belongs to the member above it
// in the precedence — pile › pile cap › column / shear wall › beam › slab — so nothing is deducted
// here: the run handed in is already clear of what another member owns (L-MEA-09).
//
// Formwork is the same member read as contact area: the two sides below their own adjoining soffit
// and the soffit between them, `((D − t_left) + (D − t_right) + b) × clear`. Each side is its own
// reading because an edge beam is open on one side and buried under a slab on the other, and the top
// is never counted — the slab is cast on it (L-FRM-03).
//
// The method is data and one tree. It declares the variables its template names and evaluates over
// bindings the gate has already carried into the canonical unit of each dimension: a method that
// converted anything would be a second home for the canon (B-17, L-FRM-06).
import type { MethodPair } from "../../editions/content";
import { formulaFrom, minus, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pairs these methods are in force under: an edition cites them, and the registry maps them. */
export const BEAM_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.beam.concrete", version: "1" });
export const BEAM_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.beam.formwork", version: "1" });

/** A count is a dimension of the canon like any other, so it is declared rather than folded in. */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });

/** The section the schedule states, and the run the drawing was read for (L-MEA-09). */
const WIDTH: MethodVariable = Object.freeze({ name: "b", dimension: "LENGTH" as const });
const DEPTH: MethodVariable = Object.freeze({ name: "D", dimension: "LENGTH" as const });
const CLEAR: MethodVariable = Object.freeze({ name: "clear", dimension: "LENGTH" as const });

/** The thicker adjoining slab, for the concrete; and each side's own, for the contact area. */
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });
const LEFT: MethodVariable = Object.freeze({ name: "t_left", dimension: "LENGTH" as const });
const RIGHT: MethodVariable = Object.freeze({ name: "t_right", dimension: "LENGTH" as const });

/** `V = count × b × (D − t) × clear` — the beam's own depth, below the soffit the slab owns. */
const CONCRETE_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V("count"), V("b"), minus(V("D"), V("t")), V("clear")),
});

/** `A = count × ((D − t_left) + (D − t_right) + b) × clear` — two sides and a soffit, never the top. */
const FORMWORK_TREE: Statement = Object.freeze({
  result: "A",
  expr: times(V("count"), plus(minus(V("D"), V("t_left")), minus(V("D"), V("t_right")), V("b")), V("clear")),
});

const CONCRETE_FORMULA = formulaFrom(CONCRETE_TREE, BEAM_CONCRETE_METHOD.ruleId);
const FORMWORK_FORMULA = formulaFrom(FORMWORK_TREE, BEAM_FORMWORK_METHOD.ruleId);

/** `rcc.beam.concrete@1`: the concrete of one beam over its clear run (L-MEA-09). */
export const BEAM_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: BEAM_CONCRETE_METHOD.ruleId,
  version: BEAM_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, WIDTH, DEPTH, THICKNESS, CLEAR]),
  // A beam nets nothing: the junction it does not own is another member's, and a deduction channel
  // nothing can offer through is a channel declared for nothing (L-MEA-09, L-MEA-08).
  deductionChannels: Object.freeze([]),
  tree: CONCRETE_TREE,
  template: CONCRETE_FORMULA.template,
  evaluate: CONCRETE_FORMULA.evaluate,
  attempt: CONCRETE_FORMULA.attempt,
});

/** `rcc.beam.formwork@1`: the contact area of one beam's two sides and its soffit (L-FRM-03). */
export const BEAM_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: BEAM_FORMWORK_METHOD.ruleId,
  version: BEAM_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, WIDTH, DEPTH, LEFT, RIGHT, CLEAR]),
  deductionChannels: Object.freeze([]),
  tree: FORMWORK_TREE,
  template: FORMWORK_FORMULA.template,
  evaluate: FORMWORK_FORMULA.evaluate,
  attempt: FORMWORK_FORMULA.attempt,
});
