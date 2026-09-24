// L-MEA-09's junctions at the foot of the building, as the foundation algebra's own sentences: what a
// PILE CAP holds once the piles it stands on have taken what they own of it, and what the blinding
// under it holds once those piles have passed through (I-544, I-545, I-546).
//
// "Pile › pile cap": the pile is the first owner in L-MEA-09's precedence, and it owns its whole
// length from cut-off to toe — the pile rail bills `π/4 · d² · length` over exactly that. A pile is
// cut off ABOVE the cap's soffit, so its head stands inside the cap, and a cap measured as its full
// prism bills that head a second time. F-RCC6-BNBC cuts its 89 piles off at EL −1.829 under caps whose
// soffit stands at −1.9046 (the neck's 0.6096 below GF, plus the 1.295 depth): 75.6 mm of every head
// stands in a cap, 1.321 m³ billed twice (R0-0's refuter, CONFIRMED). Over-measurement is a hard
// block (L-QTY-04), so the cap's own sentence has to say what the piles own of it.
//
// A cap is a different sentence from a footing, so these are rules of their own and never a second
// version of `rcc.foundation.prism_rect`: a footing standing on no pile shares that rule, and a
// version in force for every offer under one rule id would ask a footing for a pile diameter and a
// head height it does not have (L-QTY-03: a formula says what was measured). The rail picks among
// them by what it READ — whether the plans hold piles under the cap, whether the drawing states a
// recess cast into it — exactly as it picks a polygon's rule over a rectangle's (I-334).
//
// It stands in its own file so that no standing pair's closure moves (`scripts/method-hashes.mjs`):
// `./concrete.ts`, `./blinding.ts` and `./formwork.ts` keep their bytes, and so do the seven pairs
// computed by them.
import type { MethodPair } from "../../editions/content";
import { K, PI, formulaFrom, minus, over, plus, times, V, type Expr, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pairs these methods are in force under: an edition cites them, the registry maps them. */
export const PILE_CAP_PRISM_RECT_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.pile_cap.prism_rect", version: "1" });
export const PILE_CAP_PRISM_POLY_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.pile_cap.prism_poly", version: "1" });
export const PILE_CAP_PRISM_RECT_RECESS_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.pile_cap.prism_rect_recess", version: "1" });
export const PILE_CAP_PRISM_POLY_RECESS_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.pile_cap.prism_poly_recess", version: "1" });
export const PILE_CAP_FORMWORK_RECT_RECESS_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.pile_cap.formwork_rect_recess", version: "1" });
export const PILE_CAP_FORMWORK_POLY_RECESS_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.pile_cap.formwork_poly_recess", version: "1" });
export const BLINDING_OVER_PILES_METHOD: MethodPair = Object.freeze({ ruleId: "pcc.blinding_rect_piled", version: "1" });

/** The variables these formulas name, each in the dimension its reading is taken in. */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const BREADTH: MethodVariable = Object.freeze({ name: "B", dimension: "LENGTH" as const });
const AREA: MethodVariable = Object.freeze({ name: "A", dimension: "AREA" as const });
const PERIMETER: MethodVariable = Object.freeze({ name: "P", dimension: "LENGTH" as const });
const DEPTH: MethodVariable = Object.freeze({ name: "D", dimension: "LENGTH" as const });
/** How many piles the cap stands on — a count of the register's own piles, read off the plans. */
const PILES: MethodVariable = Object.freeze({ name: "n", dimension: "COUNT" as const });
/** The diameter the pile schedule states for them — the SIZE is the schedule's (I-304). */
const PILE_DIAMETER: MethodVariable = Object.freeze({ name: "d", dimension: "LENGTH" as const });
/** How far each head stands above the cap's soffit: the length of pile the cap is cast around. */
const HEAD: MethodVariable = Object.freeze({ name: "e", dimension: "LENGTH" as const });
/** The recess cast into the cap: its two plan sides and how deep it runs below the cap's top. */
const RECESS_LENGTH: MethodVariable = Object.freeze({ name: "Lr", dimension: "LENGTH" as const });
const RECESS_BREADTH: MethodVariable = Object.freeze({ name: "Br", dimension: "LENGTH" as const });
const RECESS_DEPTH: MethodVariable = Object.freeze({ name: "Dr", dimension: "LENGTH" as const });
/** The blinding's projection past the plan and its thickness (L-FRM-04). */
const PROJECTION: MethodVariable = Object.freeze({ name: "p", dimension: "LENGTH" as const });
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });

/**
 * `n × π × d × d × e ÷ 4` — the heads the piles own inside the cap: n circles of the schedule's
 * diameter, each standing `e` above the soffit. Written as the quarter of π d², as the pile's own
 * shaft is (`rcc.pile.concrete`), so the head a cap gives up and the pile that owns it are measured in
 * one sentence of one diameter (B-17).
 */
const HEADS: Expr = over(times(V("n"), K(PI), V("d"), V("d"), V("e")), K("4"));

/** `Lr × Br × Dr` — the void a recess leaves in the cap (I-546). */
const RECESS: Expr = times(V("Lr"), V("Br"), V("Dr"));

/** `2 × (Lr + Br) × Dr` — the recess's four sides; its floor is the cap's own top surface, never formed. */
const RECESS_SIDES: Expr = times(K("2"), plus(V("Lr"), V("Br")), V("Dr"));

/** `V = count × (L × B × D − n × π × d × d × e ÷ 4)` — a rectangular cap, less its piles' heads. */
const CAP_RECT_TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), minus(times(V("L"), V("B"), V("D")), HEADS)) });

/** `V = count × (A × D − n × π × d × d × e ÷ 4)` — a cap of any other plan, less its piles' heads. */
const CAP_POLY_TREE: Statement = Object.freeze({ result: "V", expr: times(V("count"), minus(times(V("A"), V("D")), HEADS)) });

/** `V = count × (L × B × D − n × π × d × d × e ÷ 4 − Lr × Br × Dr)` — and less the recess cast into it. */
const CAP_RECT_RECESS_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V("count"), minus(minus(times(V("L"), V("B"), V("D")), HEADS), RECESS)),
});

/** `V = count × (A × D − n × π × d × d × e ÷ 4 − Lr × Br × Dr)` — the polygon's twin. */
const CAP_POLY_RECESS_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V("count"), minus(minus(times(V("A"), V("D")), HEADS), RECESS)),
});

/** `A = count × (2 × (L + B) × D + 2 × (Lr + Br) × Dr)` — the cap's four sides, and the recess's four. */
const FORMWORK_RECT_RECESS_TREE: Statement = Object.freeze({
  result: "A",
  expr: times(V("count"), plus(times(K("2"), plus(V("L"), V("B")), V("D")), RECESS_SIDES)),
});

/** `A = count × (P × D + 2 × (Lr + Br) × Dr)` — the polygon's own boundary, and the recess's four sides. */
const FORMWORK_POLY_RECESS_TREE: Statement = Object.freeze({
  result: "A",
  expr: times(V("count"), plus(times(V("P"), V("D")), RECESS_SIDES)),
});

/**
 * `V = count × ((L + 2 × p) × (B + 2 × p) − n × π × d × d ÷ 4) × t` — L-FRM-04's blinding, with the
 * sections of the piles that pass through it taken out (I-545). The piles are cut off above the
 * soffit, so every one of them runs through the blinding the cap is cast on.
 */
const BLINDING_OVER_PILES_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(
    V("count"),
    minus(times(plus(V("L"), times(K("2"), V("p"))), plus(V("B"), times(K("2"), V("p")))), over(times(V("n"), K(PI), V("d"), V("d")), K("4"))),
    V("t"),
  ),
});

/** One formula method off one tree: its template, its figure and its attempt all from that tree (B-17). */
function method(pair: MethodPair, kind: "rcc.concrete" | "rcc.formwork" | "pcc.blinding", dimension: "VOLUME" | "AREA", variables: readonly MethodVariable[], tree: Statement): FormulaMethod {
  const formula = formulaFrom(tree, pair.ruleId);
  return Object.freeze({
    role: "formula" as const,
    ruleId: pair.ruleId,
    version: pair.version,
    kind,
    dimension,
    variables: Object.freeze([...variables]),
    // What the piles own and what a recess leaves are VARIABLES of the sentence, bound from what the
    // drawing states, and never a deduction channel: a channel partitions openings against an
    // edition's threshold, and a junction L-MEA-09 assigns to its owner is taken whole, whatever its
    // size (I-545).
    deductionChannels: Object.freeze([]),
    tree,
    template: formula.template,
    evaluate: formula.evaluate,
    attempt: formula.attempt,
  });
}

/** `rcc.pile_cap.prism_rect@1`: a rectangular cap's concrete, net of its piles' heads (L-MEA-09). */
export const PILE_CAP_PRISM_RECT_FORMULA: FormulaMethod = method(
  PILE_CAP_PRISM_RECT_METHOD,
  "rcc.concrete",
  "VOLUME",
  [COUNT, LENGTH, BREADTH, DEPTH, PILES, PILE_DIAMETER, HEAD],
  CAP_RECT_TREE,
);

/** `rcc.pile_cap.prism_poly@1`: a polygon cap's concrete, net of its piles' heads (L-MEA-09). */
export const PILE_CAP_PRISM_POLY_FORMULA: FormulaMethod = method(PILE_CAP_PRISM_POLY_METHOD, "rcc.concrete", "VOLUME", [COUNT, AREA, DEPTH, PILES, PILE_DIAMETER, HEAD], CAP_POLY_TREE);

/** `rcc.pile_cap.prism_rect_recess@1`: and net of the recess cast into it (I-546). */
export const PILE_CAP_PRISM_RECT_RECESS_FORMULA: FormulaMethod = method(
  PILE_CAP_PRISM_RECT_RECESS_METHOD,
  "rcc.concrete",
  "VOLUME",
  [COUNT, LENGTH, BREADTH, DEPTH, PILES, PILE_DIAMETER, HEAD, RECESS_LENGTH, RECESS_BREADTH, RECESS_DEPTH],
  CAP_RECT_RECESS_TREE,
);

/** `rcc.pile_cap.prism_poly_recess@1`: the polygon's twin (I-546). */
export const PILE_CAP_PRISM_POLY_RECESS_FORMULA: FormulaMethod = method(
  PILE_CAP_PRISM_POLY_RECESS_METHOD,
  "rcc.concrete",
  "VOLUME",
  [COUNT, AREA, DEPTH, PILES, PILE_DIAMETER, HEAD, RECESS_LENGTH, RECESS_BREADTH, RECESS_DEPTH],
  CAP_POLY_RECESS_TREE,
);

/** `rcc.pile_cap.formwork_rect_recess@1`: a rectangular cap's sides and its recess's sides (L-FRM-03). */
export const PILE_CAP_FORMWORK_RECT_RECESS_FORMULA: FormulaMethod = method(
  PILE_CAP_FORMWORK_RECT_RECESS_METHOD,
  "rcc.formwork",
  "AREA",
  [COUNT, LENGTH, BREADTH, DEPTH, RECESS_LENGTH, RECESS_BREADTH, RECESS_DEPTH],
  FORMWORK_RECT_RECESS_TREE,
);

/** `rcc.pile_cap.formwork_poly_recess@1`: a polygon cap's own boundary and its recess's sides (L-FRM-03). */
export const PILE_CAP_FORMWORK_POLY_RECESS_FORMULA: FormulaMethod = method(
  PILE_CAP_FORMWORK_POLY_RECESS_METHOD,
  "rcc.formwork",
  "AREA",
  [COUNT, PERIMETER, DEPTH, RECESS_LENGTH, RECESS_BREADTH, RECESS_DEPTH],
  FORMWORK_POLY_RECESS_TREE,
);

/** `pcc.blinding_rect_piled@1`: the blinding under a rectangular cap, net of the piles through it (L-FRM-04, I-545). */
export const BLINDING_OVER_PILES_FORMULA: FormulaMethod = method(
  BLINDING_OVER_PILES_METHOD,
  "pcc.blinding",
  "VOLUME",
  [COUNT, LENGTH, BREADTH, PROJECTION, THICKNESS, PILES, PILE_DIAMETER],
  BLINDING_OVER_PILES_TREE,
);
