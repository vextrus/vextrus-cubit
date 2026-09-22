// L-FRM-02's prisms, as the column algebra's concrete: the concrete a run of identical columns holds
// over one level — `V = count × L × B × H` where the plan draws a rectangle, and
// `V = count × π × d × d × H ÷ 4` where it draws a circle.
//
// Two methods, because a column's section is read two ways and each is a different sentence a reader
// audits (L-QTY-03): a rectangle the schedule states by its two sides, and a circle the PLAN states
// by the `%%C450` note beside the mark while the schedule states the same 450 as a B × D cell. A
// single method that took whichever reading it was handed would print a formula that does not say
// what was measured — and a 450 circle is 78.5 % of a 450 square, which is the whole of the
// difference the band refuses.
//
// The bored pile (`../foundations/concrete.ts`, `rcc.pile.concrete@1`) is the precedent every choice
// here follows: `d × d` and not a power node, the DIGITS of π and not a glyph, and the quarter of
// π d² written as a division rather than a radius nobody read off a drawing.
//
// The methods are data and one function each. They declare the variables their templates name and the
// dimension each stands in, and each evaluates over bindings the gate has already carried into the
// canonical unit of that dimension: a method that converted anything would be a second home for the
// canon (B-17, L-FRM-06). The arithmetic is the canon's exact decimal, so a figure is exact from the
// drawing to the page (B-07).
//
// A count is a dimension of the canon like any other (`pcs`), so it is a declared variable rather
// than a multiplier the rail folded into a length: "there is no field where a computed value could
// land" (L-MEA-08), and a reader auditing the line sees how many members the figure is of.
import type { MethodPair } from "../../editions/content";
import { K, PI, formulaFrom, over, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const COLUMN_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.column.concrete", version: "1" });

/** The pair the circular section is in force under, beside it (L-MEA-01, L-FRM-02). */
export const COLUMN_CIRCULAR_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.column.circular.concrete", version: "1" });

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

/**
 * The three variables the circular formula names, in the order its template spells them.
 *
 * A DIAMETER and never a radius: a plan states `%%C450` and a schedule states 450, so a formula
 * naming a radius would print a reading nobody took (L-QTY-03). `H` is the same storey height the
 * rectangular method names — the section is what differs between the two, never the storey.
 */
const CIRCULAR_VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "count", dimension: "COUNT" as const }),
  Object.freeze({ name: "d", dimension: "LENGTH" as const }),
  Object.freeze({ name: "H", dimension: "LENGTH" as const }),
]);

/**
 * `V = count × π × d × d × H ÷ 4` — the quarter of π d², over the storey the column runs through.
 *
 * `d × d` rather than a power node, because the tree HAS no power node and a squared sign is not a
 * character a bill's pinned font covers (L-FMT-02). π by its digits rather than by its glyph,
 * because the printed formula is read back by `parse` in the drift proof and the tokenizer reads
 * only the signs, the decimals and a nameable — a glyph would be dropped on the way back and the
 * proof would compare the tree to a tree missing a factor. Both are the bored pile's own choices
 * (`rcc.pile.concrete@1`), and a second circular section measured a second way would be the drift.
 */
const CIRCULAR_TREE: Statement = Object.freeze({
  result: "V",
  expr: over(times(V("count"), K(PI), V("d"), V("d"), V("H")), K("4")),
});

/** The template and the evaluator, both printed and evaluated from that one tree (B-17). */
const CIRCULAR_FORMULA = formulaFrom(CIRCULAR_TREE, COLUMN_CIRCULAR_CONCRETE_METHOD.ruleId);

/**
 * `rcc.column.circular.concrete@1`: the concrete a circular column holds over one storey (L-FRM-02).
 *
 * It stands beside the rectangular method rather than inside it because a column's SHAPE is stated
 * by the plan (the note `C7 %%C450 PORCH COLUMN`) while its SIZE is stated by the schedule's B × D
 * cell, and those two are not in disagreement: b = d = 450 either way, and a B × D schedule has no
 * cell in which to say "circle". The reader that meets a diameter picks this pair; the line it
 * publishes then PRINTS the circle it measured, which is the whole point of two methods.
 */
export const COLUMN_CIRCULAR_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: COLUMN_CIRCULAR_CONCRETE_METHOD.ruleId,
  version: COLUMN_CIRCULAR_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: CIRCULAR_VARIABLES,
  // No channel, for the rectangular method's own reason: the member-end and embedded-duct channels a
  // column deducts through arrive with the leaf that reads them.
  deductionChannels: Object.freeze([]),
  tree: CIRCULAR_TREE,
  template: CIRCULAR_FORMULA.template,
  evaluate: CIRCULAR_FORMULA.evaluate,
  attempt: CIRCULAR_FORMULA.attempt,
});
