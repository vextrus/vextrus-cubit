// L-FRM-03's beam formwork over a tie/grade beam: `A = count × (2·D + b) × clear` — "Beam
// `count × (2d + b) × L`, the top never counted".
//
// Both sides stand their full depth, because no slab is cast against either of them, and the soffit
// is the width: a tie beam is formed as a trough. The top is cast against nothing and is never
// counted, exactly as a floor beam's is not.
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const TIE_BEAM_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.tie_beam.formwork", version: "1" });

/** The four variables the formula names, in the order its template spells them (L-FRM-03). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "clear", dimension: "LENGTH" as const }),
]);

/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, L-FRM-03). */
const TREE: Statement = Object.freeze({ result: "A", expr: times(V("count"), plus(times(K("2"), V("D")), V("b")), V("clear")) });

/** The template and the evaluator, printed and evaluated from that one tree (B-17). */
const FORMULA = formulaFrom(TREE, TIE_BEAM_FORMWORK_METHOD.ruleId);

/** `rcc.tie_beam.formwork@1`: two full sides and a soffit, over the tie beam's clear run. */
export const TIE_BEAM_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: TIE_BEAM_FORMWORK_METHOD.ruleId,
  version: TIE_BEAM_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
