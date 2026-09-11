// L-MEA-08's member algebra, at its first formula: the volume of a rectangular member — section ×
// run, `V = b × d × L`.
//
// The method is data and one function. It declares the variables its template names and the
// dimension each stands in, and it evaluates over bindings the gate has already carried into the
// canonical unit of that dimension: a method that converted anything would be a second home for the
// canon (B-17, L-FRM-06). The arithmetic is the canon's exact decimal, so a figure is exact from the
// drawing to the page (B-07).
import type { MethodPair } from "../../editions/content";
import { formulaFrom, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const MEMBER_VOLUME_METHOD: MethodPair = Object.freeze({ ruleId: "member.volume", version: "1" });

/** The three lengths the formula names — a breadth, a depth and a run. */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "d", dimension: "LENGTH" as const }),
  Object.freeze({ name: "L", dimension: "LENGTH" as const }),
]);


/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, L-MEA-08). */
const TREE: Statement = Object.freeze({ result: "V", expr: times(V("b"), V("d"), V("L")) });

/** The template and the evaluator, printed and evaluated from that one tree — never from a string
 * kept beside it, which is the copy that parts (B-17). */
const FORMULA = formulaFrom(TREE, MEMBER_VOLUME_METHOD.ruleId);

/** `member.volume@1`: the concrete a rectangular member holds (L-MEA-04's `rcc.concrete`). */
export const MEMBER_VOLUME_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: MEMBER_VOLUME_METHOD.ruleId,
  version: MEMBER_VOLUME_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: VARIABLES,
  // No channel: a member's volume is deducted through nothing at this leaf — the opening channel
  // belongs to the face algebra, which is a later leaf's (L-MEA-08).
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
});
