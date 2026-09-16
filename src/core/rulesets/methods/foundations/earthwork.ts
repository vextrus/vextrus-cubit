// L-FRM-04's rectangular pit: `count × (L + 2a) × (B + 2a) × (depth + dx)`, with the working
// allowance `a` and the depth extra `dx` from the edition.
//
// The clause's `depth` is the depth of the hole rather than the depth of the member in it: the pit
// runs from the existing ground level down past the blinding the foundation sits on, so it is
// `(egl − top) + D + t` — the drop from the ground to the top of the foundation, the foundation's own
// depth, and the blinding beneath it — and `dx` is added to that. Each of the six is a reading the
// rail was handed; nothing here is a default (L-MEA-06).
//
// The tree is written the way the printed form re-reads: a flat sum of four would print without
// brackets and re-read left-folded, which is a DIFFERENT tree computing the same figure and exactly
// the silent drift the expression tree exists to close (L-QTY-03, B-17).
import type { MethodPair } from "../../editions/content";
import { K, formulaFrom, minus, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const EXCAVATION_METHOD: MethodPair = Object.freeze({ ruleId: "earthwork.pit_rect", version: "1" });

/** The nine variables the formula names, each in the dimension its reading is taken in (L-FRM-04). */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const BREADTH: MethodVariable = Object.freeze({ name: "B", dimension: "LENGTH" as const });
const ALLOWANCE: MethodVariable = Object.freeze({ name: "a", dimension: "LENGTH" as const });
const DEPTH_EXTRA: MethodVariable = Object.freeze({ name: "dx", dimension: "LENGTH" as const });
const GROUND_LEVEL: MethodVariable = Object.freeze({ name: "egl", dimension: "LENGTH" as const });
const FOUNDING_LEVEL: MethodVariable = Object.freeze({ name: "top", dimension: "LENGTH" as const });
const DEPTH: MethodVariable = Object.freeze({ name: "D", dimension: "LENGTH" as const });
const BLINDING: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });

/** `V = count × (L + 2 × a) × (B + 2 × a) × (egl − top + D + t + dx)` (L-FRM-04). */
const PIT_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(
    V("count"),
    plus(V("L"), times(K("2"), V("a"))),
    plus(V("B"), times(K("2"), V("a"))),
    plus(plus(plus(minus(V("egl"), V("top")), V("D")), V("t")), V("dx")),
  ),
});

const PIT_FORMULA = formulaFrom(PIT_TREE, EXCAVATION_METHOD.ruleId);

/** `earthwork.pit_rect@1`: the pit a rectangular-plan foundation is cast in (L-FRM-04). */
export const EXCAVATION_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: EXCAVATION_METHOD.ruleId,
  version: EXCAVATION_METHOD.version,
  kind: "earthwork.excavation",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, LENGTH, BREADTH, ALLOWANCE, DEPTH_EXTRA, GROUND_LEVEL, FOUNDING_LEVEL, DEPTH, BLINDING]),
  // A pit deducts through nothing: what stands in the hole is measured as what it is, and the
  // earthwork item is the hole (L-FRM-04).
  deductionChannels: Object.freeze([]),
  tree: PIT_TREE,
  template: PIT_FORMULA.template,
  evaluate: PIT_FORMULA.evaluate,
  attempt: PIT_FORMULA.attempt,
});
