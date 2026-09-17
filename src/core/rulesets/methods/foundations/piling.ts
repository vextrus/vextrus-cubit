// R-TO-032's piles: "piles (count × length)" — two work items of one member, and so two methods.
//
// A bill pays for the piles installed by the number and for the boring by the running metre, and the
// two are different quantities of different dimensions: one is a COUNT and the other a LENGTH
// (L-MEA-04). Neither is derived from the other here — the count is what the register counted, and
// the length is what the pile schedule states (AM-06 §2: "pile length comes from the pile schedule").
import type { MethodPair } from "../../editions/content";
import { formulaFrom, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The pairs these methods are in force under: an edition cites them, the registry maps them. */
export const PILE_COUNT_METHOD: MethodPair = Object.freeze({ ruleId: "piling.bored.count", version: "1" });
export const PILE_LENGTH_METHOD: MethodPair = Object.freeze({ ruleId: "piling.bored.length", version: "1" });

const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });
const PILE_LENGTH: MethodVariable = Object.freeze({ name: "length", dimension: "LENGTH" as const });

/**
 * `N = count` — a bored pile is counted, never measured.
 *
 * The formula is one variable on purpose: a count is a READING of the register's own rows, and the
 * line prints the sentence "N = count" so a reader sees that the figure is the members counted and
 * nothing else was folded into it (L-QTY-03, L-MEA-08).
 */
const PILE_COUNT_TREE: Statement = Object.freeze({ result: "N", expr: V("count") });

/** `L = count × length` — the bored length below cut-off, for the piles of this row (AM-06 §2). */
const PILE_LENGTH_TREE: Statement = Object.freeze({ result: "L", expr: times(V("count"), V("length")) });

const PILE_COUNT_FORMULA_PARTS = formulaFrom(PILE_COUNT_TREE, PILE_COUNT_METHOD.ruleId);
const PILE_LENGTH_FORMULA_PARTS = formulaFrom(PILE_LENGTH_TREE, PILE_LENGTH_METHOD.ruleId);

/** `piling.bored.count@1`: the piles installed, counted (R-TO-032). */
export const PILE_COUNT_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: PILE_COUNT_METHOD.ruleId,
  version: PILE_COUNT_METHOD.version,
  kind: "piling.bored",
  dimension: "COUNT",
  variables: Object.freeze([COUNT]),
  deductionChannels: Object.freeze([]),
  tree: PILE_COUNT_TREE,
  template: PILE_COUNT_FORMULA_PARTS.template,
  evaluate: PILE_COUNT_FORMULA_PARTS.evaluate,
  attempt: PILE_COUNT_FORMULA_PARTS.attempt,
});

/** `piling.bored.length@1`: the length bored for those piles (R-TO-032, AM-06 §2). */
export const PILE_LENGTH_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: PILE_LENGTH_METHOD.ruleId,
  version: PILE_LENGTH_METHOD.version,
  kind: "piling.boring",
  dimension: "LENGTH",
  variables: Object.freeze([COUNT, PILE_LENGTH]),
  deductionChannels: Object.freeze([]),
  tree: PILE_LENGTH_TREE,
  template: PILE_LENGTH_FORMULA_PARTS.template,
  evaluate: PILE_LENGTH_FORMULA_PARTS.evaluate,
  attempt: PILE_LENGTH_FORMULA_PARTS.attempt,
});
