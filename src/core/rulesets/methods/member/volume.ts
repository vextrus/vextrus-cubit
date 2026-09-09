// L-MEA-08's member algebra, at its first formula: the volume of a rectangular member — section ×
// run, `V = b × d × L`.
//
// The method is data and one function. It declares the variables its template names and the
// dimension each stands in, and it evaluates over bindings the gate has already carried into the
// canonical unit of that dimension: a method that converted anything would be a second home for the
// canon (B-17, L-FRM-06). The arithmetic is the canon's exact decimal, so a figure is exact from the
// drawing to the page (B-07).
import { exact } from "../../../units/canon";
import type { MethodPair } from "../../editions/content";
import type { FormulaMethod, NormalisedBindings, MethodVariable } from "../registry";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const MEMBER_VOLUME_METHOD: MethodPair = Object.freeze({ ruleId: "member.volume", version: "1" });

/** The three lengths the formula names — a breadth, a depth and a run. */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "b", dimension: "LENGTH" as const }),
  Object.freeze({ name: "d", dimension: "LENGTH" as const }),
  Object.freeze({ name: "L", dimension: "LENGTH" as const }),
]);

/** The one template the value and the rendered formula are both taken from (L-QTY-03). */
const TEMPLATE = "V = b × d × L";

/**
 * The product of the three declared lengths, exactly, in cubic metres.
 *
 * A binding the method declared and the caller did not hand in is the caller's defect and not an
 * answer anyone is owed: the gate refuses such an offer `OFFER_NOT_TO_CONTRACT` before it reaches
 * here, so reaching here without one means the two disagree about the declaration (ARCH-03).
 */
function evaluate(bindings: NormalisedBindings): string {
  let product = exact("1");
  for (const variable of VARIABLES) {
    const bound = bindings[variable.name];
    if (bound === undefined) {
      throw new Error(`${MEMBER_VOLUME_METHOD.ruleId} declares ${variable.name} and was evaluated without it — a formula cannot state what it was not given (L-MEA-08)`);
    }
    product = product.mul(exact(bound.value));
  }
  return product.toString();
}

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
  template: TEMPLATE,
  evaluate,
});
