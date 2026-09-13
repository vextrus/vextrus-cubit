// R-TO-032's lintel concrete: `V = count × b × D × (w + 2·bearing)`.
//
// A lintel's run is its opening's own width plus the bearing it takes on the wall at each end — the
// two readings an opening schedule states, never a length inferred from the wall the opening sits in.
// Its section is the schedule's too, so every reading here is TRANSCRIBED by its rail from one cell.
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const LINTEL_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.lintel.concrete", version: "1" });

/** The five variables the formula names, in the order its template spells them (R-TO-032). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "w", dimension: "LENGTH" as const }),
  Object.freeze({ name: "bearing", dimension: "LENGTH" as const }),
]);

/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03). */
const TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("b"), V("D"), plus(V("w"), times(K("2"), V("bearing")))) });

/** The template and the evaluator, printed and evaluated from that one tree (B-17). */
const FORMULA = formulaFrom(TREE, LINTEL_CONCRETE_METHOD.ruleId);

/** `rcc.lintel.concrete@1`: the concrete a lintel holds over its opening and its two bearings. */
export const LINTEL_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: LINTEL_CONCRETE_METHOD.ruleId,
  version: LINTEL_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
