// L-MEA-09 and L-FRM-02/03, as formulas: what one storey of a shear wall is measured by.
//
// "Vertical members measure floor-to-floor through the joint, band-aware" — so a wall's concrete is
// its plan run through its thickness over the storey height the level stands at, once per level, and
// the joint at each floor belongs to the wall rather than to the slab that runs into it (L-MEA-09's
// precedence: column / shear wall over beam over slab).
//
// Its formwork is the two faces the run presents, less what is not shuttered: the face another
// member is cast against (`A_contact`) and the beam ends that die into the wall (`A_ends`). Both
// arrive as the reader stated them — a method derives nothing (L-MEA-08).
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, minus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The count of members one offer is for, as a declared variable rather than a folded multiplier. */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });

/** The run, the section and the storey the run stands through. */
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });
const HEIGHT: MethodVariable = Object.freeze({ name: "H", dimension: "LENGTH" as const });

/** The two faces of the run that are not shuttered, as the reader stated them. */
const CONTACT: MethodVariable = Object.freeze({ name: "A_contact", dimension: "AREA" as const });
const ENDS: MethodVariable = Object.freeze({ name: "A_ends", dimension: "AREA" as const });

export const WALL_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.wall.concrete", version: "1" });

const WALL_CONCRETE_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V(COUNT.name), V(LENGTH.name), V(THICKNESS.name), V(HEIGHT.name)),
});

const WALL_CONCRETE = formulaFrom(WALL_CONCRETE_TREE, WALL_CONCRETE_METHOD.ruleId);

/** `rcc.wall.concrete@1`: one storey of a shear wall, floor to floor through the joint (L-MEA-09). */
export const WALL_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: WALL_CONCRETE_METHOD.ruleId,
  version: WALL_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, LENGTH, THICKNESS, HEIGHT]),
  // No channel: a wall's own openings are the door and window schedule's, and the channel they
  // deduct through arrives with the leaf that reads them (L-MEA-02: the schedule is the authority).
  deductionChannels: Object.freeze([]),
  tree: WALL_CONCRETE_TREE,
  template: WALL_CONCRETE.template,
  evaluate: WALL_CONCRETE.evaluate,
  attempt: WALL_CONCRETE.attempt,
});

export const WALL_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.wall.formwork", version: "1" });

const WALL_FORMWORK_TREE: Statement = Object.freeze({
  result: "F",
  expr: times(V(COUNT.name), minus(minus(times(K("2"), V(LENGTH.name), V(HEIGHT.name)), V(CONTACT.name)), V(ENDS.name))),
});

const WALL_FORMWORK = formulaFrom(WALL_FORMWORK_TREE, WALL_FORMWORK_METHOD.ruleId);

/** `rcc.wall.formwork@1`: both faces of the storey's run, less the faces nobody shutters. */
export const WALL_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: WALL_FORMWORK_METHOD.ruleId,
  version: WALL_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, LENGTH, HEIGHT, CONTACT, ENDS]),
  deductionChannels: Object.freeze([]),
  tree: WALL_FORMWORK_TREE,
  template: WALL_FORMWORK.template,
  evaluate: WALL_FORMWORK.evaluate,
  attempt: WALL_FORMWORK.attempt,
});
