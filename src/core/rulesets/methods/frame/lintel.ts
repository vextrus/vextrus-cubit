// L-MEA-09's lintel, as two formulas: the concrete over one scheduled opening, and the formwork it
// is cast against.
//
// A lintel is measured from the opening it spans and from nowhere else — the width the opening
// schedule states plus a bearing at each end, `w + 2·bearing` — so its run is the schedule's
// statement rather than a reading of the wall around it (R-TO-032, L-MEA-09). Its section is the
// schedule's too, which is why the rail that offers one reads the schedule and never the member
// types.
//
// The formwork is the two sides and the soffit, the top never counted (L-FRM-03). The sunshade term
// a BNBC lintel carries is the yardstick's, not this one's.
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pairs these methods are in force under: an edition cites them, and the registry maps them. */
export const LINTEL_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.lintel.concrete", version: "1" });
export const LINTEL_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.lintel.formwork", version: "1" });

/** The five readings a lintel is measured from, in the order its templates name them. */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "D", dimension: "LENGTH" as const }),
  Object.freeze({ name: "w", dimension: "LENGTH" as const }),
  Object.freeze({ name: "bearing", dimension: "LENGTH" as const }),
]);

/** The run of a lintel: the opening it spans, plus the bearing it takes at each end. */
const RUN = plus(V("w"), times(K("2"), V("bearing")));

/** `V = count × b × D × (w + 2 × bearing)`. */
const CONCRETE_TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("b"), V("D"), RUN) });

/** `A = count × (2 × D + b) × (w + 2 × bearing)` — two sides and a soffit. */
const FORMWORK_TREE: Statement = Object.freeze({
  result: "A",
  expr: times(V("count"), plus(times(K("2"), V("D")), V("b")), RUN),
});

const CONCRETE_FORMULA = formulaFrom(CONCRETE_TREE, LINTEL_CONCRETE_METHOD.ruleId);
const FORMWORK_FORMULA = formulaFrom(FORMWORK_TREE, LINTEL_FORMWORK_METHOD.ruleId);

/** `rcc.lintel.concrete@1`: the concrete of the lintels over one scheduled opening (L-MEA-09). */
export const LINTEL_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: LINTEL_CONCRETE_METHOD.ruleId,
  version: LINTEL_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: CONCRETE_TREE,
  template: CONCRETE_FORMULA.template,
  evaluate: CONCRETE_FORMULA.evaluate,
  attempt: CONCRETE_FORMULA.attempt,
});

/** `rcc.lintel.formwork@1`: the contact area of their two sides and their soffits (L-FRM-03). */
export const LINTEL_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: LINTEL_FORMWORK_METHOD.ruleId,
  version: LINTEL_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: VARIABLES,
  deductionChannels: Object.freeze([]),
  tree: FORMWORK_TREE,
  template: FORMWORK_FORMULA.template,
  evaluate: FORMWORK_FORMULA.evaluate,
  attempt: FORMWORK_FORMULA.attempt,
});
