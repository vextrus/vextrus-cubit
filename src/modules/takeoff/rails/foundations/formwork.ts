// L-FRM-03's foundation formwork, keyed (footing | pile_cap × rcc.formwork): the SIDE faces a spread
// foundation is cast against, and nothing else (I-337).
//
// It is a CLASS READER of a kind another area already measures: `rcc.formwork` is a beam's kind and a
// cap's alike (L-MEA-04's `bears`), and a rail is selected per KIND (L-MEA-08) — so this is composed
// with the frame's readers into the one rail the frame's roster line holds (`composeRails`), and never
// keyed as a second `rcc.formwork`.
//
// Two rules, chosen by the plan the foundation's CONCRETE is measured over (`planOf`, I-334): a
// rectangle is formed along `2 × (L + B)` of the very sides its concrete binds, and any other plan
// along the boundary of its own ring. So a cap's concrete and its formwork can never disagree about
// what its plan is, and a chamfered PC2 is never formed along its schedule's rectangle — 7.7 m where
// the ring runs 6.96, which is over (L-QTY-04).
//
// Never a soffit and never a top: neither rule declares a variable a third face could be bound
// through. It computes nothing and converts nothing: every reading is carried in the unit it was
// written in, and the carrying is the gate's (L-MEA-08, B-17).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation } from "@/core/offers/contract";
import { DEPTH, FOUNDATION_DEPTH_UNSTATED, FOUNDATION_PLAN_UNSTATED, PRISM_POLY, PRISM_RECT, SPREAD, countOf, dimensionOf, planOf, resolve, type Read } from "./read";

/** The rules this reader offers under. An offer names a rule and never a version (L-MEA-08). */
export const FOUNDATION_FORMWORK_RECT_RULE_ID = "rcc.foundation.formwork_rect";
export const FOUNDATION_FORMWORK_POLY_RULE_ID = "rcc.foundation.formwork_poly";

/** The one kind this reader measures — the contact area concrete is cast against (L-FRM-03). */
const RCC_FORMWORK: Kind = "rcc.formwork";

/** The variables the two rules declare, by the names their templates spell them under. */
const COUNT = "count";
const L = "L";
const B = "B";
const P = "P";
const D = "D";

/**
 * One spread foundation's side formwork: its plan's boundary, its depth, and whichever of the two the
 * drawing and the schedules did not state.
 */
function formworkOffer(read: Read): Offer {
  const { row, placement, calibration } = read;
  const bindings: Record<string, Measure> = {};
  const omitted: OmittedComponent[] = [];
  const plan = planOf(read);

  // The rule is the plan's, exactly as the concrete's is: a polygon is formed along its own ring and
  // a rectangle along its sides. A polygon whose boundary nobody read, and a plan nobody stated at
  // all, keep the row and name what is missing (L-QTY-02).
  const poly = plan.shape === "poly";
  if (plan.shape === "rect") {
    bindings[L] = plan.length;
    bindings[B] = plan.breadth;
  } else if (plan.shape === "poly") {
    if (plan.perimeter === null) omitted.push({ variable: P, code: FOUNDATION_PLAN_UNSTATED });
    else bindings[P] = plan.perimeter;
  } else {
    omitted.push({ variable: L, code: FOUNDATION_PLAN_UNSTATED }, { variable: B, code: FOUNDATION_PLAN_UNSTATED });
  }

  const depth = dimensionOf(read, DEPTH);
  if (depth === undefined) omitted.push({ variable: D, code: FOUNDATION_DEPTH_UNSTATED });
  else bindings[D] = depth;

  return {
    ruleId: poly ? FOUNDATION_FORMWORK_POLY_RULE_ID : FOUNDATION_FORMWORK_RECT_RULE_ID,
    kind: RCC_FORMWORK,
    class: row.elementType as ElementType,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: poly ? PRISM_POLY : PRISM_RECT, basis: row.standing, calibration },
    bindings: { [COUNT]: countOf(read), ...bindings },
    // Nothing selects a formwork item here: the member is the line's own class, which code already
    // knows (L-BD-04's sub-items, item-descriptions' deliberate absence), and a grade is concrete's.
    selectors: {},
    // A foundation's sides deduct through nothing at this leaf: a tie beam framing into one is the
    // beam's junction to net (L-MEA-09's owner), and a candidate in a channel the method does not
    // declare is a contract violation rather than a threshold question (L-MEA-08).
    deductions: [],
    omitted,
    // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
    coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/**
 * The foundation-formwork reader: every footing and pile cap of the batch, offered as the sides its
 * own plan makes of it. A pile is not formed — it is bored and cast against the ground — so it is no
 * class of this reader (R-TO-032, AM-06 §2).
 *
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing, so what it
 * answers is a function of what it was given and of nothing else.
 */
export const foundationFormworkRail: Rail = (input: RailInput) => {
  const offers: Offer[] = [];
  const observations: RailObservation[] = [];
  for (const row of input.objects.filter((one) => SPREAD.includes(one.elementType as ElementType))) {
    const resolution = resolve(row, input.setup, RCC_FORMWORK);
    if (!resolution.ok) {
      observations.push(resolution.observation);
      continue;
    }
    offers.push(formworkOffer(resolution.read));
  }
  return { offers, observations };
};
