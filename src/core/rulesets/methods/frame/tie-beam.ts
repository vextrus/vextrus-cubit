// L-MEA-09's tie/grade beam, as two formulas: the concrete it holds and the formwork it is cast
// against.
//
// A tie beam adjoins no slab — it stands under the building, between the footings or caps it spans
// — so nothing is taken off its depth: `b × D × clear`, clear between the faces of the members
// supporting its ends, which the precedence gives to the footing or the cap (L-MEA-09).
//
// Its formwork is the two sides and the soffit, `(2·D + b) × clear`, the top never counted
// (L-FRM-03). The tie beam's SIDES and SOFFIT as separate bill components are the BNBC yardstick's,
// not this one's: here the three faces are one contact area.
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pairs these methods are in force under: an edition cites them, and the registry maps them. */
export const TIE_BEAM_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.tie_beam.concrete", version: "1" });
export const TIE_BEAM_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.tie_beam.formwork", version: "1" });

/** The four readings a tie beam is measured from, in the order its templates name them. */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "clear", dimension: "LENGTH" as const }),
]);

/** `V = count × b × D × clear` — the whole section, over the run clear of its supports. */
const CONCRETE_TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("b"), V("D"), V("clear")) });

/** `A = count × (2 × D + b) × clear` — two sides and a soffit. */
const FORMWORK_TREE: Statement = Object.freeze({
  result: "A",
  expr: times(V("count"), plus(times(K("2"), V("D")), V("b")), V("clear")),
});

const CONCRETE_FORMULA = formulaFrom(CONCRETE_TREE, TIE_BEAM_CONCRETE_METHOD.ruleId);
const FORMWORK_FORMULA = formulaFrom(FORMWORK_TREE, TIE_BEAM_FORMWORK_METHOD.ruleId);

/** `rcc.tie_beam.concrete@1`: the concrete of one tie or grade beam over its clear run (L-MEA-09). */
export const TIE_BEAM_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: TIE_BEAM_CONCRETE_METHOD.ruleId,
  version: TIE_BEAM_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: CONCRETE_TREE,
  template: CONCRETE_FORMULA.template,
  evaluate: CONCRETE_FORMULA.evaluate,
  attempt: CONCRETE_FORMULA.attempt,
});

/** `rcc.tie_beam.formwork@1`: the contact area of its two sides and its soffit (L-FRM-03). */
export const TIE_BEAM_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: TIE_BEAM_FORMWORK_METHOD.ruleId,
  version: TIE_BEAM_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: FORMWORK_TREE,
  template: FORMWORK_FORMULA.template,
  evaluate: FORMWORK_FORMULA.evaluate,
  attempt: FORMWORK_FORMULA.attempt,
});
