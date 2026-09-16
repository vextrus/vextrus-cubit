// L-FRM-04's pit and the blinding under it, keyed (footing | pile_cap × earthwork.excavation) and
// (footing | pile_cap × pcc.blinding).
//
// Two rails, because they are two kinds and a rail is selected per kind (L-MEA-08). They share this
// file because they share the clause: both widen a RECTANGULAR plan by a length the edition states or
// the site entered, and both defer where the plan is not a rectangle — "polygon/frustum pits defer",
// "deferred for polygon plans" (L-FRM-04).
//
// A deferral is a row KEPT with no quantity, never a row dropped: "COMPLETE, or PARTIAL_DECLARED with
// every omitted component enumerated on the row" (L-QTY-02). A cap whose pit this leaf cannot measure
// still stands in the bill as a cap whose pit is unmeasured, under its own name — which is what makes
// the omission a disclosure rather than a silence.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { GeometryType, Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation, RailSetup } from "@/core/offers/contract";
import type { RefusalCode } from "@/core/errors";
import {
  BLINDING_PROJECTION_PARAMETER,
  BLINDING_THICKNESS_PARAMETER,
  DEPTH,
  DEPTH_EXTRA_PARAMETER,
  PRISM_POLY,
  PRISM_RECT,
  SPREAD,
  TOP,
  WORKING_ALLOWANCE_PARAMETER,
  countOf,
  dimensionOf,
  enteredOnly,
  enteredOrDerived,
  planOf,
  resolve,
  type Plan,
  type Read,
} from "./read";

/** The rules these rails offer under. An offer names a rule and never a version (L-MEA-08). */
export const EXCAVATION_RULE_ID = "earthwork.pit_rect";
export const BLINDING_RULE_ID = "pcc.blinding_rect";

/** The two kinds, one rail each (L-MEA-08). */
const EARTHWORK_EXCAVATION: Kind = "earthwork.excavation";
const PCC_BLINDING: Kind = "pcc.blinding";

/** The variables the two rules declare, by the names their templates spell them under. */
const COUNT = "count";
const L = "L";
const B = "B";
const ALLOWANCE = "a";
const DEPTH_EXTRA = "dx";
const GROUND_LEVEL = "egl";
const FOUNDING_LEVEL = "top";
const D = "D";
const THICKNESS = "t";
const PROJECTION = "p";

/** One offer about one pit or one blinding (L-MEA-08's offer, whole). */
function offerOf(read: Read, kind: Kind, ruleId: string, geometry: GeometryType, bindings: Record<string, Measure>, omitted: OmittedComponent[]): Offer {
  const { row, placement, calibration } = read;
  return {
    ruleId,
    kind,
    class: row.elementType as ElementType,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: geometry, basis: row.standing, calibration },
    bindings: { [COUNT]: countOf(read), ...bindings },
    // Nothing selects an item here: a pit is priced by the ground it is dug in and a blinding by its
    // mix, and neither is read off a structural drawing — both arrive with the pricing seam (scope).
    selectors: {},
    deductions: [],
    omitted,
    coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/** The geometry the pit or the blinding of one plan is read off — the plan's own (L-FRM-01). */
function geometryOf(plan: Plan): GeometryType {
  return plan.shape === "poly" ? PRISM_POLY : PRISM_RECT;
}

/**
 * The two sides the pit or the blinding is widened from, or the code they are deferred under.
 *
 * L-FRM-04 states both over `L` and `B`, and a plan that is not a rectangle has neither: there is
 * nothing to add the working space to, and a figure taken over the shoelace area instead would be a
 * different rule than the one the line names (L-QTY-01: never a guess). A plan nobody stated at all
 * is the other absence, and says so by its own name.
 */
function sidesOf(plan: Plan, deferral: RefusalCode, bindings: Record<string, Measure>, omitted: OmittedComponent[]): void {
  if (plan.shape === "rect") {
    bindings[L] = plan.length;
    bindings[B] = plan.breadth;
    return;
  }
  const code: RefusalCode = plan.shape === "poly" ? deferral : "FOUNDATION_PLAN_UNSTATED";
  omitted.push({ variable: L, code }, { variable: B, code });
}

/**
 * One reading L-MEA-06 lets a site override and the edition otherwise states, bound or declared.
 *
 * Where neither an entry nor a citable clause states it there is no SITE fact at all, and earthwork is
 * unpriceable until one is entered — which is what `GROUND_LEVEL_UNSTATED` says in its second
 * sentence, and the recourse its remedy names (L-MEA-06, L-QTY-02).
 */
function bind(setup: RailSetup, variable: string, reading: Measure | undefined, bindings: Record<string, Measure>, omitted: OmittedComponent[], code: RefusalCode): void {
  if (reading === undefined) omitted.push({ variable, code });
  else bindings[variable] = reading;
}

/** Every spread foundation of the batch, resolved once for whichever of the two rails asked. */
function spreadOf(input: RailInput, kind: Kind, offerFor: (read: Read, setup: RailSetup) => Offer): { offers: Offer[]; observations: RailObservation[] } {
  const offers: Offer[] = [];
  const observations: RailObservation[] = [];
  for (const row of input.objects.filter((one) => SPREAD.includes(one.elementType as ElementType))) {
    const resolution = resolve(row, input.setup, kind);
    if (!resolution.ok) {
      observations.push(resolution.observation);
      continue;
    }
    offers.push(offerFor(resolution.read, input.setup));
  }
  return { offers, observations };
}

/**
 * The excavation rail: the pit one spread foundation is cast in (L-FRM-04).
 *
 * The depth of the hole is not the depth of the member in it: it runs from the existing ground level
 * down past the blinding the foundation sits on, so the drop `egl − top`, the foundation's own depth
 * `D` and the blinding's thickness `t` are all readings the offer carries, and the edition's depth
 * extra `dx` with them. The ground level is ENTERED and nothing else — no drawing carries it, and a
 * pit with none keeps its row (AM-06 §1).
 */
export const excavationRail: Rail = (input: RailInput) =>
  spreadOf(input, EARTHWORK_EXCAVATION, (read, setup) => {
    const bindings: Record<string, Measure> = {};
    const omitted: OmittedComponent[] = [];
    const plan = planOf(read);
    sidesOf(plan, "EARTHWORK_PLAN_DEFERRED", bindings, omitted);

    bind(setup, ALLOWANCE, enteredOrDerived(setup, "WORKING_ALLOWANCE", WORKING_ALLOWANCE_PARAMETER), bindings, omitted, "GROUND_LEVEL_UNSTATED");
    bind(setup, DEPTH_EXTRA, enteredOrDerived(setup, "DEPTH_EXTRA", DEPTH_EXTRA_PARAMETER), bindings, omitted, "GROUND_LEVEL_UNSTATED");
    bind(setup, THICKNESS, enteredOrDerived(setup, "BLINDING_THICKNESS", BLINDING_THICKNESS_PARAMETER), bindings, omitted, "GROUND_LEVEL_UNSTATED");
    bind(setup, GROUND_LEVEL, enteredOnly(setup, "GROUND_LEVEL"), bindings, omitted, "GROUND_LEVEL_UNSTATED");
    bind(setup, FOUNDING_LEVEL, dimensionOf(read, TOP), bindings, omitted, "FOUNDING_LEVEL_UNSTATED");
    bind(setup, D, dimensionOf(read, DEPTH), bindings, omitted, "FOUNDATION_DEPTH_UNSTATED");

    return offerOf(read, EARTHWORK_EXCAVATION, EXCAVATION_RULE_ID, geometryOf(plan), bindings, omitted);
  });

/**
 * The blinding rail: the plain cement concrete one spread foundation is cast on (L-FRM-04).
 *
 * It projects past the plan by `p` on every side and is laid `t` thick, both from the site where it
 * entered them and from the pinned edition otherwise — and it is deferred over a plan that is not a
 * rectangle, exactly as the pit above it is.
 */
export const blindingRail: Rail = (input: RailInput) =>
  spreadOf(input, PCC_BLINDING, (read, setup) => {
    const bindings: Record<string, Measure> = {};
    const omitted: OmittedComponent[] = [];
    const plan = planOf(read);
    sidesOf(plan, "BLINDING_PLAN_DEFERRED", bindings, omitted);

    bind(setup, PROJECTION, enteredOrDerived(setup, "BLINDING_PROJECTION", BLINDING_PROJECTION_PARAMETER), bindings, omitted, "GROUND_LEVEL_UNSTATED");
    bind(setup, THICKNESS, enteredOrDerived(setup, "BLINDING_THICKNESS", BLINDING_THICKNESS_PARAMETER), bindings, omitted, "GROUND_LEVEL_UNSTATED");

    return offerOf(read, PCC_BLINDING, BLINDING_RULE_ID, geometryOf(plan), bindings, omitted);
  });
