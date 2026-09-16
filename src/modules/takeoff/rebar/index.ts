// R-TO-032's rail: reinforcement, keyed (member × rcc.rebar) — the vertical slice that ends in one
// bill line per member and a bill of bars behind it.
//
// A rail "is a pure function returning `{ offers, observations }`" (L-MEA-08): everything this file
// reads arrives in its argument, so it reaches no store and no clock and the same input twice
// answers deep-equal batches. The bars themselves are `./bars`'s — this file turns one member's
// synthesised rows into the line the gate publishes, and reports what it could not read.
//
// ONE line per (object, kind). A member's `rcc.rebar` line binds `net` and `lap` in kilograms, with
// the confinement steel beside them as `ties`; the per-diameter detail is NOT on the line, because
// L-QTY-03 gives one line one figure — the detail is the stored bar rows, read back through
// `bbsOf` (riskNotes (1), L-REG-04).
import type { Kind } from "@/core/catalogue/kinds";
import type { Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation } from "@/core/offers/contract";
import type { QuantityBasis } from "@/core/offers/law";
import { CANONICAL_UNIT } from "@/core/units/canon";
import { massesOf, readMembers, REBAR_RULE_ID, RCC_REBAR, type MemberRead } from "./bars";

export { barRowKeyOf, barRowsOf, readMembers, REBAR_RULE_ID, type BarRow } from "./bars";
export { bbsOf, writeBarRows, type BbsDocument, type BarRowScope, type BbsScope } from "./store";

/**
 * The geometry a member's reinforcement is read off. A bar is a SET of points on the member's plan —
 * a count of bars at a section, not a prism and not an area — which is L-FRM-01's `POINT_SET`
 * exactly, and it carries the register row's own standing like every other geometry (L-QTY-01).
 */
const POINT_SET = "POINT_SET";

/** The grade a reinforcement line is selected by, where a note stated one (L-QTY-03, AM-03(h)). */
const FY = "fy";

/** The one offer a read member stands to be measured by (L-MEA-08's offer, whole). */
function offerOf(read: MemberRead): Offer {
  const basis = read.row.standing;
  const masses = massesOf(read);
  const source = `${read.row.objectKey}#bars`;
  // The lap's own basis is how the LAP was known: a drawing that states `LAP 50d` was transcribed,
  // and one that states nothing leaves the edition's Class B clause — citable, therefore DERIVED and
  // never defaulted (L-MEA-06). The net is derived from the schedule's bar group either way.
  const lapBasis: QuantityBasis = read.applied.lapMultiplier === null ? "DERIVED" : read.applied.basis;
  const omitted: OmittedComponent[] = read.unstated.map((one) => ({ variable: one.variable, code: one.code }));
  const missing = new Set(omitted.map((one) => one.variable));
  const bindings: Record<string, Measure> = {};
  const bind = (variable: string, value: string, bound: QuantityBasis): void => {
    if (!missing.has(variable)) bindings[variable] = { value, unit: CANONICAL_UNIT.MASS, basis: bound, source, calibration: read.calibration };
  };
  bind("net", masses.net, "DERIVED");
  bind("lap", masses.lap, lapBasis);
  bind("ties", masses.ties, "DERIVED");

  const fy = read.setup.detailing.fy;
  return {
    ruleId: REBAR_RULE_ID,
    kind: RCC_REBAR,
    class: read.class,
    register: { setRevisionId: read.row.setRevisionId, objectKey: read.row.objectKey },
    drawing: { drawingId: read.placement.drawingId, viewKey: read.placement.viewKey },
    engine: read.placement.engine,
    geometry: { type: POINT_SET, basis, calibration: read.calibration },
    bindings,
    selectors: fy === null ? {} : { [FY]: fy },
    // Nothing is deducted from a bar: a bar is measured as the bar it is, and a junction's steel
    // belongs to whichever member the schedule detailed it under (L-MEA-09, AM-02).
    deductions: [],
    omitted,
    // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
    coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/**
 * The reinforcement rail: every member of the batch whose schedule states bars, offered as one MASS
 * line — and an observation for every member whose schedule nobody has read.
 *
 * The order of the offers is the order of the rows it was handed: a rail sorts nothing, so what it
 * answers is a function of what it was given and of nothing else.
 */
export const rebarRail: Rail = (input: RailInput) => {
  const read = readMembers(input);
  const offers: Offer[] = read.reads.map((one) => offerOf(one));
  const observations: readonly RailObservation[] = read.observations;
  return { offers, observations: [...observations] };
};

/** The kind this leaf measures, re-exported so the area roster names it once (L-MEA-08, B-17). */
export const REBAR_KIND: Kind = RCC_REBAR;
