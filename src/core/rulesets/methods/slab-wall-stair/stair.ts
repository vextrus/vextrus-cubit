// AM-06 §4, as formulas: what a straight flight and a rectangular landing are measured by.
//
// A flight is its waist — the sloped plate — plus the step triangles cast on top of it: each step is
// a right triangle of going × rise across the width, and the flight's steps together are
// `½ × G × R × W` where R is the flight's whole rise. Its formwork is the three faces a carpenter
// builds: the soffit under the sloped plate, the risers across the width, and the two strings down
// the sides of the waist.
//
// A landing is AREA_THICK and says so: its area through its thickness, its soffit its area. Anything
// that is neither a straight flight nor a rectangular landing is not measured here at all — the rail
// defers it `COMPLEX_STAIR_GEOMETRY` rather than approximating it by the nearest shape (L-MEA-03).
//
// A method converts nothing: every binding arrives in the canonical unit of its own dimension,
// carried there by the gate's one canon (B-17, L-FRM-06).
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The count of members one offer is for, as a declared variable rather than a folded multiplier. */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });

/** A flight, as the reader read it: the sloped run, the width, the waist, the going and the rise. */
const SLOPED: MethodVariable = Object.freeze({ name: "S", dimension: "LENGTH" as const });
const WIDTH: MethodVariable = Object.freeze({ name: "W", dimension: "LENGTH" as const });
const WAIST: MethodVariable = Object.freeze({ name: "w", dimension: "LENGTH" as const });
const GOING: MethodVariable = Object.freeze({ name: "G", dimension: "LENGTH" as const });
const RISE: MethodVariable = Object.freeze({ name: "R", dimension: "LENGTH" as const });

/** A rectangular landing, as the reader read it. */
const AREA: MethodVariable = Object.freeze({ name: "A", dimension: "AREA" as const });
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });

export const FLIGHT_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.stair.flight.concrete", version: "1" });

const FLIGHT_CONCRETE_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(
    V(COUNT.name),
    plus(times(V(SLOPED.name), V(WIDTH.name), V(WAIST.name)), times(K("0.5"), V(GOING.name), V(RISE.name), V(WIDTH.name))),
  ),
});

const FLIGHT_CONCRETE = formulaFrom(FLIGHT_CONCRETE_TREE, FLIGHT_CONCRETE_METHOD.ruleId);

/** `rcc.stair.flight.concrete@1`: the waist plus the step triangles (AM-06 §4). */
export const FLIGHT_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: FLIGHT_CONCRETE_METHOD.ruleId,
  version: FLIGHT_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, SLOPED, WIDTH, WAIST, GOING, RISE]),
  deductionChannels: Object.freeze([]),
  tree: FLIGHT_CONCRETE_TREE,
  template: FLIGHT_CONCRETE.template,
  evaluate: FLIGHT_CONCRETE.evaluate,
  attempt: FLIGHT_CONCRETE.attempt,
});

export const FLIGHT_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.stair.flight.formwork", version: "1" });

// The three terms are summed two at a time, left to right: a printed `a + b + c` re-reads as
// `(a + b) + c`, and the template has to read back as the tree it was printed from (L-QTY-03).
const FLIGHT_FORMWORK_TREE: Statement = Object.freeze({
  result: "F",
  expr: times(
    V(COUNT.name),
    plus(plus(times(V(SLOPED.name), V(WIDTH.name)), times(V(RISE.name), V(WIDTH.name))), times(K("2"), V(SLOPED.name), V(WAIST.name))),
  ),
});

const FLIGHT_FORMWORK = formulaFrom(FLIGHT_FORMWORK_TREE, FLIGHT_FORMWORK_METHOD.ruleId);

/** `rcc.stair.flight.formwork@1`: the soffit, the risers and the two strings (AM-06 §4). */
export const FLIGHT_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: FLIGHT_FORMWORK_METHOD.ruleId,
  version: FLIGHT_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, SLOPED, WIDTH, WAIST, RISE]),
  deductionChannels: Object.freeze([]),
  tree: FLIGHT_FORMWORK_TREE,
  template: FLIGHT_FORMWORK.template,
  evaluate: FLIGHT_FORMWORK.evaluate,
  attempt: FLIGHT_FORMWORK.attempt,
});

export const LANDING_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.stair.landing.concrete", version: "1" });

const LANDING_CONCRETE_TREE: Statement = Object.freeze({ result: "V", expr: times(V(COUNT.name), V(AREA.name), V(THICKNESS.name)) });

const LANDING_CONCRETE = formulaFrom(LANDING_CONCRETE_TREE, LANDING_CONCRETE_METHOD.ruleId);

/** `rcc.stair.landing.concrete@1`: a rectangular landing is AREA_THICK (R-TO-032, L-FRM-02). */
export const LANDING_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: LANDING_CONCRETE_METHOD.ruleId,
  version: LANDING_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, AREA, THICKNESS]),
  deductionChannels: Object.freeze([]),
  tree: LANDING_CONCRETE_TREE,
  template: LANDING_CONCRETE.template,
  evaluate: LANDING_CONCRETE.evaluate,
  attempt: LANDING_CONCRETE.attempt,
});

export const LANDING_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.stair.landing.formwork", version: "1" });

const LANDING_FORMWORK_TREE: Statement = Object.freeze({ result: "F", expr: times(V(COUNT.name), V(AREA.name)) });

const LANDING_FORMWORK = formulaFrom(LANDING_FORMWORK_TREE, LANDING_FORMWORK_METHOD.ruleId);

/** `rcc.stair.landing.formwork@1`: the landing's soffit, which is its own plan area. */
export const LANDING_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: LANDING_FORMWORK_METHOD.ruleId,
  version: LANDING_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, AREA]),
  deductionChannels: Object.freeze([]),
  tree: LANDING_FORMWORK_TREE,
  template: LANDING_FORMWORK.template,
  evaluate: LANDING_FORMWORK.evaluate,
  attempt: LANDING_FORMWORK.attempt,
});
