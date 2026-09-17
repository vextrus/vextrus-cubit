// What a bar WEIGHS, and what only checks it (AM-03(b), L-BD-02).
//
// The verified kg/m table BILLS. `d²/162` is an informational check column beside it, held to a
// quarter of a per cent — a figure a reader can reconcile against, never a figure a bill is taken
// from. The two are separate functions here for that reason: `massOf` cannot reach the formula, and
// `kgPerMetreCheckOf` publishes nothing.
//
// Wastage and binding wire appear EXACTLY ONCE in this tree, in `resourceSummaryOf`, and never touch
// a billed quantity (AM-03(a)): L-BD-02's "net from the drawings, no bulking, shrinkage or waste
// allowance" governs the bill, and a resource summary is what a store-keeper orders against.

import type { MethodPair } from "../../editions/content";
import { exact } from "@/core/units/canon";
import { formulaFrom, plus, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";
import { kgPerMetreOf, type DetailingEdition } from "./detailing-bnbc2020-bd";

/** The pair this method is in force under: an edition cites it, and the registry maps it (L-MEA-01). */
export const REBAR_MASS_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.rebar.mass", version: "1" });

/** How far the check column may stand from the table before the two disagree (AM-03(b)). */
export const KG_PER_METRE_TOLERANCE = "0.0025";

/** The divisor of the nominal-mass check, `d²/162` (L-BD-02). */
const CHECK_DIVISOR = "162";

/** Millimetres to the metre — the length a kg/m rate is stated over. */
const MM_PER_METRE = "1000";

/** One kilogram-per-tonne divided out, where a resource allowance is stated per tonne. */
const KG_PER_TONNE = "1000";

/** What a caller asks for a mass: the length that BILLS, the bar, how many of it, and the edition. */
export type MassProbe = {
  readonly billableMm: string;
  readonly diameterMm: number;
  readonly bars: string;
  readonly edition: DetailingEdition;
};

/**
 * The mass a billable length of bar comes to, in kilograms: length in metres × bars × the table's
 * rate. Exact and unrounded — a figure is rounded once, where it is PRINTED (L-QTY-05), and a sum of
 * figures each rounded first is a sum that disagrees with the rows it was taken from.
 */
export function massOf(probe: MassProbe): string {
  return exact(probe.billableMm).div(exact(MM_PER_METRE)).mul(exact(probe.bars)).mul(exact(kgPerMetreOf(probe.edition, probe.diameterMm))).toString();
}

/** What the check column says about one diameter: the two rates, their gap, and whether it stands. */
export type KgPerMetreCheck = {
  readonly table: string;
  readonly formula: string;
  readonly deviation: string;
  readonly withinTolerance: boolean;
};

/**
 * The INFORMATIONAL check (AM-03(b)): the table's rate beside `d²/162`, and the relative gap between
 * them. Nothing bills off this — it is printed so a reader can reconcile the table with the nominal
 * mass the code states, and a gap beyond a quarter of a per cent is a table worth looking at.
 */
export function kgPerMetreCheckOf(edition: DetailingEdition, diameterMm: number): KgPerMetreCheck {
  const table = exact(kgPerMetreOf(edition, diameterMm));
  const formula = exact(diameterMm).mul(exact(diameterMm)).div(exact(CHECK_DIVISOR));
  const deviation = formula.sub(table).div(table).abs();
  return { table: table.toString(), formula: formula.toString(), deviation: deviation.toString(), withinTolerance: deviation.lte(exact(KG_PER_METRE_TOLERANCE)) };
}

/** As much of a bill of bars as a resource summary reads: what each row weighs, net and lapped. */
export type BilledRows = { readonly rows: readonly { readonly kg: string }[] };

/** What a store-keeper orders against: the billed steel, the two allowances, and their sum. */
export type ResourceSummary = {
  readonly billedKg: string;
  readonly wastageKg: string;
  readonly bindingWireKg: string;
  readonly resourceKg: string;
};

/**
 * The ONE consumer of `wastageFraction` and `bindingWireKgPerTonne` (AM-03(a)).
 *
 * The billed figure is the bill's, untouched; the wastage and the binding wire are added BESIDE it
 * and the sum is a resource figure, which is a different question from what the client pays for.
 * A-RESOURCE-PDF and rate analysis read this; no quantity line ever does.
 */
export function resourceSummaryOf(bbs: BilledRows, edition: DetailingEdition): ResourceSummary {
  let billed = exact(0);
  for (const row of bbs.rows) billed = billed.add(exact(row.kg));
  const wastage = billed.mul(exact(edition.wastageFraction));
  const bindingWire = billed.div(exact(KG_PER_TONNE)).mul(exact(edition.bindingWireKgPerTonne));
  return { billedKg: billed.toString(), wastageKg: wastage.toString(), bindingWireKg: bindingWire.toString(), resourceKg: billed.add(wastage).add(bindingWire).toString() };
}

/**
 * The three components the formula names: the steel net of laps, the laps beside it (AM-03(a)), and
 * the confinement steel — the ties and the links.
 *
 * Ties are their own component rather than part of the net because the length a tie zone runs is a
 * typical detail that a drawing very often does not state, and a component nobody read must be
 * DECLARED missing on the line rather than folded silently into another figure (L-QTY-02). A
 * component can only be declared missing if the method names it: the gate refuses an offer that
 * omits a variable the method never declared, so `ties` is a variable here even where it is omitted.
 */
const VARIABLES: readonly MethodVariable[] = Object.freeze([
  Object.freeze({ name: "net", dimension: "MASS" as const }),
  Object.freeze({ name: "lap", dimension: "MASS" as const }),
  Object.freeze({ name: "ties", dimension: "MASS" as const }),
]);

/** The one tree the rendered formula and the figure are BOTH taken from (L-QTY-03, AM-03(a)). */
const TREE: Statement = Object.freeze({ result: "M", expr: plus(plus(V("net"), V("lap")), V("ties")) });

/** The template and the evaluator, printed and evaluated from that one tree (B-17). */
const FORMULA = formulaFrom(TREE, REBAR_MASS_METHOD.ruleId);

/**
 * `rcc.rebar.mass@1`: a member's reinforcement, net and lapped, as one MASS.
 *
 * The lap is a TERM of the sum rather than a factor on the net, because L-BD-02 makes it "a
 * first-class, separately attributable component" — net-of-laps and gross-of-laps are both showable
 * off one line, and a percentage would make neither recoverable.
 */
export const REBAR_MASS_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: REBAR_MASS_METHOD.ruleId,
  version: REBAR_MASS_METHOD.version,
  kind: "rcc.rebar",
  dimension: "MASS",
  variables: VARIABLES,
  // No channel: a bar is measured as the bar it is, and there is nothing a deduction would take
  // out of it — a junction's steel belongs to whichever member the schedule detailed it under.
  deductionChannels: Object.freeze([]),
  tree: TREE,
  template: FORMULA.template,
  evaluate: FORMULA.evaluate,
  attempt: FORMULA.attempt,
});
