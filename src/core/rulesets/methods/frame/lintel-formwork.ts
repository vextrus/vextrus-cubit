// L-FRM-03's beam formwork over a lintel: `A = count × (2·D + b) × (w + 2·bearing)`.
//
// A lintel is formed as a small beam — two sides and a soffit, the top never counted — over the same
// run its concrete is measured on: the opening the schedule states, plus a bearing at each end.
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const LINTEL_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.lintel.formwork", version: "1" });

/** The five variables the formula names, in the order its template spells them (L-FRM-03). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "w", dimension: "LENGTH" as const }),
  Object.freeze({ name: "bearing", dimension: "LENGTH" as const }),
]);

/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, L-FRM-03). */
const TREE: Statement = Object.freeze({
  result: "A",
  expr: times(V("count"), plus(times(K("2"), V("D")), V("b")), plus(V("w"), times(K("2"), V("bearing")))),
});

/** The template and the evaluator, printed and evaluated from that one tree (B-17). */
const FORMULA = formulaFrom(TREE, LINTEL_FORMWORK_METHOD.ruleId);

/** `rcc.lintel.formwork@1`: the two sides and the soffit a lintel is cast against. */
export const LINTEL_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: LINTEL_FORMWORK_METHOD.ruleId,
  version: LINTEL_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
