// L-FRM-03's beam formwork, under L-MEA-09's ownership: the contact area a beam owns along its clear
// run — `A = count × ((D − t_left) + (D − t_right) + b) × clear`.
//
// Two sides and a soffit, and no top: "the top never counted" (L-FRM-03), because the top of a beam
// is cast against the slab that runs through over it. Each side is taken SEPARATELY rather than
// twice the thicker one: an edge beam is open on one side and buried in a slab on the other, and the
// two faces of one beam are different heights whenever the slabs it adjoins are.
import type { MethodPair } from "../../editions/content";
import { formulaFrom, minus, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const BEAM_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.beam.formwork", version: "1" });

/** The six variables the formula names, in the order its template spells them (L-FRM-03). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "t_left", dimension: "LENGTH" as const }),
  Object.freeze({ name: "t_right", dimension: "LENGTH" as const }),
  Object.freeze({ name: "clear", dimension: "LENGTH" as const }),
]);

/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, L-FRM-03). */
const TREE: Statement = Object.freeze({
  result: "A",
  expr: times(V("count"), plus(minus(V("D"), V("t_left")), minus(V("D"), V("t_right")), V("b")), V("clear")),
});

/** The template and the evaluator, printed and evaluated from that one tree (B-17). */
const FORMULA = formulaFrom(TREE, BEAM_FORMWORK_METHOD.ruleId);

/** `rcc.beam.formwork@1`: the two sides and the soffit a beam is cast against, over its clear run. */
export const BEAM_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: BEAM_FORMWORK_METHOD.ruleId,
  version: BEAM_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
