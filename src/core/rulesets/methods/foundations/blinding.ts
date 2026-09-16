// L-FRM-04's blinding: `count × (L + 2p) × (B + 2p) × t` — the plain cement concrete a foundation is
// cast on, projecting past its plan by `p` on every side and laid `t` thick.
//
// Both `p` and `t` come from the edition unless the site states its own, which is the rail's to bind;
// this file states the algebra and nothing else. "Deferred for polygon plans" is the clause's own
// second sentence, and a deferral is the rail's answer rather than a formula with a hole in it: the
// method declares `L` and `B`, and a plan that states neither leaves them omitted (L-QTY-02).
import type { MethodPair } from "../../editions/content";
import { K, formulaFrom, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const BLINDING_METHOD: MethodPair = Object.freeze({ ruleId: "pcc.blinding_rect", version: "1" });

/** The five variables the formula names, each in the dimension its reading is taken in (L-FRM-04). */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const BREADTH: MethodVariable = Object.freeze({ name: "B", dimension: "LENGTH" as const });
const PROJECTION: MethodVariable = Object.freeze({ name: "p", dimension: "LENGTH" as const });
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });

/** `V = count × (L + 2 × p) × (B + 2 × p) × t` (L-FRM-04). */
const BLINDING_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V("count"), plus(V("L"), times(K("2"), V("p"))), plus(V("B"), times(K("2"), V("p"))), V("t")),
});

const BLINDING_FORMULA_PARTS = formulaFrom(BLINDING_TREE, BLINDING_METHOD.ruleId);

/** `pcc.blinding_rect@1`: the blinding under a rectangular-plan foundation (L-FRM-04). */
export const BLINDING_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: BLINDING_METHOD.ruleId,
  version: BLINDING_METHOD.version,
  kind: "pcc.blinding",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, LENGTH, BREADTH, PROJECTION, THICKNESS]),
  deductionChannels: Object.freeze([]),
  tree: BLINDING_TREE,
  template: BLINDING_FORMULA_PARTS.template,
  evaluate: BLINDING_FORMULA_PARTS.evaluate,
  attempt: BLINDING_FORMULA_PARTS.attempt,
});
