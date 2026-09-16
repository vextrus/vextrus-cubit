// L-FRM-02's prisms, as the foundation algebra's concrete: what a footing, a pile cap or a pile
// holds, from the plan it occupies and the depth it runs through.
//
// Three methods, because a foundation's plan is read three ways and each is a different sentence a
// reader audits: a rectangle a schedule states (`count × L × B × D`), a polygon a reader measured
// (`count × A × D`, L-FRM-02's PRISM_POLY over the shoelace area), and a circle a pile schedule
// states by its diameter (`count × π × d × d × length ÷ 4`). A single method taking whichever
// readings it was handed would print a formula that does not say what was measured (L-QTY-03).
//
// Each is data and one tree. The variables are declared with the dimension each stands in, and the
// tree is evaluated over bindings the gate has already carried into the canonical unit of that
// dimension: a method that converted anything would be a second home for the canon (B-17, L-FRM-06).
//
// A count is a dimension of the canon like any other (`pcs`), so it is a declared variable rather
// than a multiplier a rail folded into a length: "there is no field where a computed value could
// land" (L-MEA-08), and a reader auditing the line sees how many members the figure is of.
import type { MethodPair } from "../../editions/content";
import { K, formulaFrom, over, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pairs these methods are in force under: an edition cites them, the registry maps them. */
export const FOUNDATION_PRISM_RECT_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.foundation.prism_rect", version: "1" });
export const FOUNDATION_PRISM_POLY_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.foundation.prism_poly", version: "1" });
export const PILE_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.pile.concrete", version: "1" });

/** The variables these formulas name, each in the dimension its reading is taken in (L-FRM-02). */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const BREADTH: MethodVariable = Object.freeze({ name: "B", dimension: "LENGTH" as const });
const DEPTH: MethodVariable = Object.freeze({ name: "D", dimension: "LENGTH" as const });
const AREA: MethodVariable = Object.freeze({ name: "A", dimension: "AREA" as const });
const DIAMETER: MethodVariable = Object.freeze({ name: "d", dimension: "LENGTH" as const });
const PILE_LENGTH: MethodVariable = Object.freeze({ name: "length", dimension: "LENGTH" as const });

/**
 * π, as the law's own constant rather than a machine's: twenty-one significant digits, which is more
 * than the canon's forty-digit arithmetic loses over a pile and far more than any drawing states.
 *
 * It is a CONSTANT of the tree and not a variable, because nobody reads it off a drawing — the
 * printed formula says `× 3.14159…`, which is what a person auditing a circular section checks
 * (L-QTY-03, B-07).
 */
const PI = "3.14159265358979323846";

/** `V = count × L × B × D` — the rectangular prism a spread foundation is (L-FRM-02). */
const PRISM_RECT_TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("L"), V("B"), V("D")) });

/**
 * `V = count × A × D` — L-FRM-02's PRISM_POLY: the shoelace area of the plan, times the depth it
 * runs through. The deductible openings the clause names are a deduction channel this leaf declares
 * none of: a foundation plan with an opening in it arrives with the reader that reads one (scope).
 */
const PRISM_POLY_TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), V("A"), V("D")) });

/**
 * `V = count × π × d × d × length ÷ 4` — a circular pile's shaft, written as the quarter of π d²
 * rather than as a radius: a schedule states a DIAMETER, and a formula naming a radius would print a
 * reading nobody took (L-QTY-03). `d × d` for the same reason — the tree has no power node, and a
 * squared sign is not a character a bill's pinned font covers (L-FMT-02).
 */
const PILE_CONCRETE_TREE: Statement = Object.freeze({
  result: "V",
  expr: over(times(V("count"), K(PI), V("d"), V("d"), V("length")), K("4")),
});

const PRISM_RECT_FORMULA = formulaFrom(PRISM_RECT_TREE, FOUNDATION_PRISM_RECT_METHOD.ruleId);
const PRISM_POLY_FORMULA = formulaFrom(PRISM_POLY_TREE, FOUNDATION_PRISM_POLY_METHOD.ruleId);
const PILE_CONCRETE_FORMULA_PARTS = formulaFrom(PILE_CONCRETE_TREE, PILE_CONCRETE_METHOD.ruleId);

/** `rcc.foundation.prism_rect@1`: the concrete of a rectangular-plan foundation (L-FRM-02). */
export const FOUNDATION_PRISM_RECT_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: FOUNDATION_PRISM_RECT_METHOD.ruleId,
  version: FOUNDATION_PRISM_RECT_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, LENGTH, BREADTH, DEPTH]),
  // A foundation deducts through nothing: it is cast against the ground, and the junction it shares
  // with the column above it is the column's to net (L-MEA-09's owner, scope).
  deductionChannels: Object.freeze([]),
  tree: PRISM_RECT_TREE,
  template: PRISM_RECT_FORMULA.template,
  evaluate: PRISM_RECT_FORMULA.evaluate,
  attempt: PRISM_RECT_FORMULA.attempt,
});

/** `rcc.foundation.prism_poly@1`: the concrete of a polygon-plan foundation (L-FRM-02). */
export const FOUNDATION_PRISM_POLY_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: FOUNDATION_PRISM_POLY_METHOD.ruleId,
  version: FOUNDATION_PRISM_POLY_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, AREA, DEPTH]),
  deductionChannels: Object.freeze([]),
  tree: PRISM_POLY_TREE,
  template: PRISM_POLY_FORMULA.template,
  evaluate: PRISM_POLY_FORMULA.evaluate,
  attempt: PRISM_POLY_FORMULA.attempt,
});

/** `rcc.pile.concrete@1`: the concrete of one bored pile's shaft (R-TO-032, AM-06 §2). */
export const PILE_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: PILE_CONCRETE_METHOD.ruleId,
  version: PILE_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, DIAMETER, PILE_LENGTH]),
  deductionChannels: Object.freeze([]),
  tree: PILE_CONCRETE_TREE,
  template: PILE_CONCRETE_FORMULA_PARTS.template,
  evaluate: PILE_CONCRETE_FORMULA_PARTS.evaluate,
  attempt: PILE_CONCRETE_FORMULA_PARTS.attempt,
});
