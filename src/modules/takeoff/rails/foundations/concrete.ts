// R-TO-032's foundation concrete: what a footing, a pile cap and a pile hold, keyed
// (footing | pile_cap | pile × rcc.concrete).
//
// It is a CLASS READER of a kind another area already measures: `rcc.concrete` is a column's kind and
// a footing's alike (L-MEA-04's `bears`), and a rail is selected per KIND (L-MEA-08) — so this is
// composed with the column reader into the one rail the frame's roster line holds (`composeRails`),
// and never keyed as a second `rcc.concrete`.
//
// Three rules, because a foundation's plan is read three ways and the line prints the sentence it was
// measured by: a rectangle a schedule states, a polygon a reader measured, and a pile's circular
// shaft (L-FRM-02, L-QTY-03). The rule is chosen by what was READ, never by what would publish.
//
// It computes nothing and converts nothing: every reading is carried in the unit it was written in,
// and the carrying is the gate's (L-MEA-08, B-17).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { GeometryType, Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation, RailSetup } from "@/core/offers/contract";
import {
  DEPTH,
  DIA,
  DIAMETER,
  FOOTING,
  FOUNDATION_DEPTH_UNSTATED,
  FOUNDATION_PLAN_UNSTATED,
  GRADE,
  LENGTH,
  PILE,
  PILE_CAP,
  PILE_DIAMETER_UNSTATED,
  PILE_LENGTH_UNSTATED,
  PRISM_POLY,
  PRISM_RECT,
  countOf,
  dimensionOf,
  planOf,
  resolve,
  type Read,
} from "./read";

/** The rules this reader offers under. An offer names a rule and never a version (L-MEA-08). */
export const FOUNDATION_PRISM_RECT_RULE_ID = "rcc.foundation.prism_rect";
export const FOUNDATION_PRISM_POLY_RULE_ID = "rcc.foundation.prism_poly";
export const PILE_CONCRETE_RULE_ID = "rcc.pile.concrete";

/** The one kind this reader measures — concrete, cast in place, wherever it is cast (L-MEA-04). */
const RCC_CONCRETE: Kind = "rcc.concrete";

/** The three classes it measures it for (R-TO-032). */
const CLASSES: readonly ElementType[] = Object.freeze([FOOTING, PILE_CAP, PILE]);

/** The variables the three rules declare, by the names their templates spell them under. */
const COUNT = "count";
const L = "L";
const B = "B";
const A = "A";
const D = "D";
const DIAMETER_VARIABLE = "d";
const PILE_LENGTH = "length";

/**
 * A pile's shaft is a prism over a plan that is no rectangle — a circle — so it is offered under
 * L-FRM-01's PRISM_POLY like every other non-rectangular prism this leaf reads. What makes it a
 * circle rather than a polygon is the RULE its line names, `rcc.pile.concrete`, whose template prints
 * the π/4 · d² a reader audits (L-QTY-03).
 */
const PILE_GEOMETRY: GeometryType = PRISM_POLY;

/** One offer, assembled from what was read and from what was not (L-MEA-08's offer, whole). */
function offerOf(
  read: Read,
  stated: { ruleId: string; geometry: GeometryType; bindings: Record<string, Measure>; omitted: OmittedComponent[]; selectors: Record<string, Measure> },
): Offer {
  const { row, placement, calibration } = read;
  return {
    ruleId: stated.ruleId,
    kind: RCC_CONCRETE,
    class: row.elementType as ElementType,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: stated.geometry, basis: row.standing, calibration },
    bindings: { [COUNT]: countOf(read), ...stated.bindings },
    selectors: stated.selectors,
    // A foundation deducts through nothing at this leaf: the junction it shares with the member above
    // it is that member's to net (L-MEA-09's owner), and a candidate in a channel the method does not
    // declare is a contract violation rather than a threshold question (L-MEA-08).
    deductions: [],
    omitted: stated.omitted,
    // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
    coverage: stated.omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/** The grade a drawing's general notes stated, where a reader stated one (L-QTY-03). */
function gradeOf(read: Read, setup: RailSetup): Record<string, Measure> {
  const grade = setup.grades[read.placement.drawingId];
  return grade === undefined ? {} : { [GRADE]: grade };
}

/** One spread foundation: its plan, its depth, and whichever of the two the schedules did not state. */
function spreadOffer(read: Read, setup: RailSetup): Offer {
  const bindings: Record<string, Measure> = {};
  const omitted: OmittedComponent[] = [];
  const plan = planOf(read);
  // The rule is the plan's: a polygon is measured over its shoelace area and a rectangle over its
  // sides (L-FRM-02). A plan nobody stated is offered under the rectangular rule with its sides
  // declared missing — the row is kept and says which reading it wants (L-QTY-02).
  const poly = plan.shape === "poly";
  if (plan.shape === "rect") {
    bindings[L] = plan.length;
    bindings[B] = plan.breadth;
  } else if (plan.shape === "poly") {
    bindings[A] = plan.area;
  } else {
    omitted.push({ variable: L, code: FOUNDATION_PLAN_UNSTATED }, { variable: B, code: FOUNDATION_PLAN_UNSTATED });
  }

  const depth = dimensionOf(read, DEPTH);
  if (depth === undefined) omitted.push({ variable: D, code: FOUNDATION_DEPTH_UNSTATED });
  else bindings[D] = depth;

  return offerOf(read, {
    ruleId: poly ? FOUNDATION_PRISM_POLY_RULE_ID : FOUNDATION_PRISM_RECT_RULE_ID,
    geometry: poly ? PRISM_POLY : PRISM_RECT,
    bindings,
    omitted,
    selectors: gradeOf(read, setup),
  });
}

/** One pile's shaft: the diameter its schedule states and the length it was bored to (AM-06 §2). */
function pileOffer(read: Read, setup: RailSetup): Offer {
  const bindings: Record<string, Measure> = {};
  const omitted: OmittedComponent[] = [];

  const dia = dimensionOf(read, DIA);
  if (dia === undefined) omitted.push({ variable: DIAMETER_VARIABLE, code: PILE_DIAMETER_UNSTATED });
  else bindings[DIAMETER_VARIABLE] = dia;

  const length = dimensionOf(read, LENGTH);
  if (length === undefined) omitted.push({ variable: PILE_LENGTH, code: PILE_LENGTH_UNSTATED });
  else bindings[PILE_LENGTH] = length;

  return offerOf(read, {
    ruleId: PILE_CONCRETE_RULE_ID,
    geometry: PILE_GEOMETRY,
    bindings,
    omitted,
    // A pile's concrete is selected by its grade like any other, and by the bore it was cast in where
    // the schedule states one: two piles of one grade and different diameters are two items.
    selectors: { ...gradeOf(read, setup), ...(dia === undefined ? {} : { [DIAMETER]: dia }) },
  });
}

/**
 * The foundation-concrete reader: every footing, pile cap and pile of the batch, offered as the prism
 * its own plan makes of it.
 *
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing, so what it
 * answers is a function of what it was given and of nothing else.
 */
export const foundationConcreteRail: Rail = (input: RailInput) => {
  const setup = input.setup;
  const offers: Offer[] = [];
  const observations: RailObservation[] = [];

  for (const row of input.objects.filter((one) => CLASSES.includes(one.elementType as ElementType))) {
    const resolution = resolve(row, setup, RCC_CONCRETE);
    if (!resolution.ok) {
      observations.push(resolution.observation);
      continue;
    }
    offers.push(row.elementType === PILE ? pileOffer(resolution.read, setup) : spreadOffer(resolution.read, setup));
  }

  return { offers, observations };
};
