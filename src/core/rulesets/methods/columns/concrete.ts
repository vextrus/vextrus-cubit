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
import type { MethodPair } from "../../editions/content";
import { formulaFrom, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const COLUMN_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.column.concrete", version: "1" });

/** The four variables the formula names, in the order its template spells them (L-FRM-02). */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "L", dimension: "LENGTH" as const }),
  Object.freeze({ name: "B", dimension: "LENGTH" as const }),
  Object.freeze({ name: "H", dimension: "LENGTH" as const }),
]);


/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, L-FRM-02). */
const TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("L"), V("B"), V("H")) });

/** The template and the evaluator, printed and evaluated from that one tree — never from a string
 * kept beside it, which is the copy that parts (B-17). */
const FORMULA = formulaFrom(TREE, COLUMN_CONCRETE_METHOD.ruleId);

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
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
