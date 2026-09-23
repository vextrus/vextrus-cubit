// L-FRM-03's foundation formwork: the contact area a footing or a pile cap is cast against — its SIDE
// faces, and nothing else.
//
// Two methods, because the clause states the figure two ways and a line prints the sentence it was
// measured by (L-QTY-03): "Foundation `count × 2(L+B) × depth`" over a rectangle, and "Polygonal
// foundation/cap: side faces only, `perimeter × depth`" over any other plan. They are the formwork
// twins of `./concrete.ts`'s two prisms — a rectangle a schedule states or a ring corroborates, and a
// polygon a reader measured — and the rail chooses between them by the one plan both kinds read, so a
// cap's concrete and its formwork never disagree about what its plan is (I-334, I-337, B-17).
//
// SIDES ONLY. A foundation is cast on the ground, or on the blinding laid over it, so there is no
// soffit to form; and its top is never counted — L-FRM-03 says so of a tapered beam and of a cap
// alike. Neither method declares a variable a soffit or a top could be bound through: a face the tree
// cannot name is a face no rail can bill.
//
// It stands in its own file, not beside the prisms, on purpose: `./concrete.ts` is in the closure of
// three standing pairs, and a new sentence written into it would be an edit of all three
// (`scripts/method-hashes.mjs`). A new file is a new closure, and the standing pairs keep their bytes.
import type { MethodPair } from "../../editions/content";
import { K, formulaFrom, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pairs these methods are in force under: an edition cites them, the registry maps them. */
export const FOUNDATION_FORMWORK_RECT_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.foundation.formwork_rect", version: "1" });
export const FOUNDATION_FORMWORK_POLY_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.foundation.formwork_poly", version: "1" });

/** The variables these formulas name, each in the dimension its reading is taken in (L-FRM-03). */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const BREADTH: MethodVariable = Object.freeze({ name: "B", dimension: "LENGTH" as const });
const PERIMETER: MethodVariable = Object.freeze({ name: "P", dimension: "LENGTH" as const });
const DEPTH: MethodVariable = Object.freeze({ name: "D", dimension: "LENGTH" as const });

/** `A = count × 2 × (L + B) × D` — the four sides of a rectangular foundation (L-FRM-03). */
const FORMWORK_RECT_TREE: Statement = Object.freeze({ result: "A", expr: times(V("count"), K("2"), plus(V("L"), V("B")), V("D")) });

/**
 * `A = count × P × D` — the side faces of a foundation of any other plan: the length of its own
 * boundary, times the depth it runs through (L-FRM-03). `P` is the ring's, read off the drawing; a
 * schedule's rectangle is never it — F-RCC6-BNBC's chamfered PC2 runs 6.96 m of boundary where its
 * schedule's 2100 × 1750 would say 7.7, and that difference is over (L-QTY-04).
 */
const FORMWORK_POLY_TREE: Statement = Object.freeze({ result: "A", expr: times(V("count"), V("P"), V("D")) });

const FORMWORK_RECT_FORMULA = formulaFrom(FORMWORK_RECT_TREE, FOUNDATION_FORMWORK_RECT_METHOD.ruleId);
const FORMWORK_POLY_FORMULA = formulaFrom(FORMWORK_POLY_TREE, FOUNDATION_FORMWORK_POLY_METHOD.ruleId);

/** `rcc.foundation.formwork_rect@1`: the side formwork of a rectangular-plan foundation (L-FRM-03). */
export const FOUNDATION_FORMWORK_RECT_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: FOUNDATION_FORMWORK_RECT_METHOD.ruleId,
  version: FOUNDATION_FORMWORK_RECT_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, LENGTH, BREADTH, DEPTH]),
  // A foundation's sides deduct through nothing at this leaf: the member standing on it meets its TOP,
  // which is never formed, and a tie beam framing into a side is the beam's junction to net
  // (L-MEA-09's owner, scope).
  deductionChannels: Object.freeze([]),
  tree: FORMWORK_RECT_TREE,
  template: FORMWORK_RECT_FORMULA.template,
  evaluate: FORMWORK_RECT_FORMULA.evaluate,
  attempt: FORMWORK_RECT_FORMULA.attempt,
});

/** `rcc.foundation.formwork_poly@1`: the side formwork of a polygon-plan foundation (L-FRM-03). */
export const FOUNDATION_FORMWORK_POLY_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: FOUNDATION_FORMWORK_POLY_METHOD.ruleId,
  version: FOUNDATION_FORMWORK_POLY_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, PERIMETER, DEPTH]),
  deductionChannels: Object.freeze([]),
  tree: FORMWORK_POLY_TREE,
  template: FORMWORK_POLY_FORMULA.template,
  evaluate: FORMWORK_POLY_FORMULA.evaluate,
  attempt: FORMWORK_POLY_FORMULA.attempt,
});
