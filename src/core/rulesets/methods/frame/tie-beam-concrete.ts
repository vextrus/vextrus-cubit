// L-MEA-09's tie/grade beam concrete: `V = count × b × D × clear`.
//
// A tie beam adjoins no slab — it ties the foundations together under the ground floor — so nothing
// is taken off its depth. Its run is still clear between the faces of the footings or pile caps it
// ends in, because those own the junction it stands in (pile › pile cap › column / shear wall › beam).
import type { MethodPair } from "../../editions/content";
import { formulaFrom, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const TIE_BEAM_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.tie_beam.concrete", version: "1" });

/** The four variables the formula names, in the order its template spells them (L-MEA-09). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "clear", dimension: "LENGTH" as const }),
]);

/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, L-MEA-09). */
const TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("b"), V("D"), V("clear")) });

/** The template and the evaluator, printed and evaluated from that one tree (B-17). */
const FORMULA = formulaFrom(TREE, TIE_BEAM_CONCRETE_METHOD.ruleId);

/** `rcc.tie_beam.concrete@1`: the concrete a tie beam holds clear between its supports. */
export const TIE_BEAM_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: TIE_BEAM_CONCRETE_METHOD.ruleId,
  version: TIE_BEAM_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
