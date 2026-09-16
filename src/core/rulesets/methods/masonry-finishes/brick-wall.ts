// L-MEA-02's brickwork: what a brick wall holds, from the face it stands over and the nominal
// thickness the mason builds to.
//
// `V = (L × h − openings) × t` is the clause's own sentence, and the one tree the template is printed
// from and the figure computed by: the wall's face, net of the openings the schedule deducted, times
// the nominal thickness per level (R-TO-032's "brickwork by nominal thickness").
//
// `openings` is the sum of what the edition's threshold DEDUCTED, bound by the gate from the
// candidates the rail enumerated — a rail computes nothing (L-MEA-08). `threshold` is declared and
// bound and is deliberately NOT in the tree: L-MEA-02 has "the threshold in force" land in the line's
// variables so a reader can see the rule that retained what was retained, and a figure that moved
// when the threshold moved would be a figure the threshold had been subtracted from.
import { THRESHOLD_VARIABLE } from "@/core/offers/law";
import type { MethodPair } from "../../editions/content";
import { formulaFrom, minus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pair this method is in force under: an edition cites it, the registry maps it. */
export const BRICK_WALL_VOLUME_METHOD: MethodPair = Object.freeze({ ruleId: "masonry.brick_wall.volume", version: "1" });

/** The variables the formula names, each in the dimension its reading is taken in (L-MEA-02). */
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const HEIGHT: MethodVariable = Object.freeze({ name: "h", dimension: "LENGTH" as const });
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });
const OPENINGS: MethodVariable = Object.freeze({ name: "openings", dimension: "AREA" as const });
const THRESHOLD: MethodVariable = Object.freeze({ name: THRESHOLD_VARIABLE, dimension: "AREA" as const });

/** `V = (L × h − openings) × t` — the wall's face net of its deductions, by its nominal thickness. */
const BRICK_WALL_VOLUME_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(minus(times(V("L"), V("h")), V("openings")), V("t")),
});

const BRICK_WALL_VOLUME_PARTS = formulaFrom(BRICK_WALL_VOLUME_TREE, BRICK_WALL_VOLUME_METHOD.ruleId);

/** `masonry.brick_wall.volume@1`: the brickwork of one wall on one level (R-TO-032, L-MEA-02). */
export const BRICK_WALL_VOLUME_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: BRICK_WALL_VOLUME_METHOD.ruleId,
  version: BRICK_WALL_VOLUME_METHOD.version,
  kind: "masonry.brickwork",
  dimension: "VOLUME",
  variables: Object.freeze([LENGTH, HEIGHT, THICKNESS, OPENINGS, THRESHOLD]),
  // A wall deducts its scheduled openings, and through that channel alone: a finish has a threshold
  // of its own and therefore a channel of its own (L-MEA-01's threshold per channel).
  deductionChannels: Object.freeze(["opening" as const]),
  tree: BRICK_WALL_VOLUME_TREE,
  template: BRICK_WALL_VOLUME_PARTS.template,
  evaluate: BRICK_WALL_VOLUME_PARTS.evaluate,
  attempt: BRICK_WALL_VOLUME_PARTS.attempt,
});
