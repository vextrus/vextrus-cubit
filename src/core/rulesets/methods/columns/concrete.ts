// L-FRM-02's rectangular prism, as the column algebra's first formula: the concrete a run of
// identical columns holds over one level — `V = count × L × B × H`.
//
// The method is data and one function. It declares the variables its template names and the
// dimension each stands in, and it evaluates over bindings the gate has already carried into the
// canonical unit of that dimension: a method that converted anything would be a second home for the
// canon (B-17, L-FRM-06). The arithmetic is the canon's exact decimal, so a figure is exact from the
// drawing to the page (B-07).
//
// A count is a dimension of the canon like any other (`pcs`), so it is a declared variable rather
// than a multiplier the rail folded into a length: "there is no field where a computed value could
// land" (L-MEA-08), and a reader auditing the line sees how many members the figure is of.
import { exact } from "@/core/units/canon";
import type { MethodPair } from "../../editions/content";
import type { FormulaMethod, MethodVariable, NormalisedBindings } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const COLUMN_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.column.concrete", version: "1" });

/** The four variables the formula names, in the order its template spells them (L-FRM-02). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "L", dimension: "LENGTH" as const }),
  Object.freeze({ name: "B", dimension: "LENGTH" as const }),
  Object.freeze({ name: "H", dimension: "LENGTH" as const }),
]);

/** The one template the value and the rendered formula are both taken from (L-QTY-03). */
const TEMPLATE = "V = count × L × B × H";

/**
 * The product of the four declared variables, exactly, in cubic metres.
 *
 * A binding the method declared and the caller did not hand in is the caller's defect and not an
 * answer anyone is owed: the gate refuses such an offer `OFFER_NOT_TO_CONTRACT` before it reaches
 * here, and a PARTIAL_DECLARED offer is never evaluated at all — it publishes with no quantity
 * (L-QTY-02). So reaching here without one means the two disagree about the declaration (ARCH-03).
 */
function evaluate(bindings: NormalisedBindings): string {
  let product = exact("1");
  for (const variable of VARIABLES) {
    const bound = bindings[variable.name];
    if (bound === undefined) {
      throw new Error(`${COLUMN_CONCRETE_METHOD.ruleId} declares ${variable.name} and was evaluated without it — a formula cannot state what it was not given (L-MEA-08)`);
    }
    product = product.mul(exact(bound.value));
  }
  return product.toString();
}

/** `rcc.column.concrete@1`: the concrete a rectangular column holds over one storey (L-FRM-02). */
export const COLUMN_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: COLUMN_CONCRETE_METHOD.ruleId,
  version: COLUMN_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: VARIABLES,
  // No channel: the member-end and embedded-duct channels a column deducts through arrive with the
  // leaf that reads them, and a channel nothing can offer through is a channel declared for nothing.
  deductionChannels: Object.freeze([]),
  template: TEMPLATE,
  evaluate,
});
