// L-MEA-09's beam, as a pair of rails: the concrete a beam holds and the formwork it is cast
// against, both over the RUN the partition read — "clear between support faces and below the slab
// soffit", never the grid-to-grid span.
//
// "Each junction volume and each contact face has exactly one owning member, in the precedence pile
// › pile cap › column / shear wall › beam › slab." A beam therefore deducts nothing: what it does
// not own is the column's or the slab's to measure, so the junction leaves this rail's figures
// through the run it was given, not through a deduction channel (L-MEA-09).
//
// Both rails are pure functions of what they were handed (L-MEA-08): the run, the sides and the
// section all arrive in the setup, and what neither could read is REPORTED by name rather than
// guessed — an unread run is no beam, and an unstated slab thickness is a component kept with no
// quantity and enumerated on the row (L-QTY-01/02).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { Measure, Offer, Rail, RailInput, RailObservation, RailSetup, ReadingSetup, RegisterObjectRow, RunSetup } from "@/core/offers/contract";
import { exact } from "@/core/units/canon";
import { CANONICAL_UNIT } from "@/core/units/canon";
import { measureOf, observe, ONE, PRISM_RECT, readMember, rowsOfClass, selectorsOf, type MemberRead } from "./member";

/** The one class these rails measure — a rail is selected per quantity kind and class (L-MEA-08). */
const BEAM: ElementType = "beam";
const RCC_CONCRETE: Kind = "rcc.concrete";
const RCC_FORMWORK: Kind = "rcc.formwork";

/** The rules they offer under. An offer names a rule and never a version (L-MEA-08). */
export const BEAM_CONCRETE_RULE_ID = "rcc.beam.concrete";
export const BEAM_FORMWORK_RULE_ID = "rcc.beam.formwork";

/** The variables the two methods declare, by the names their templates spell them under. */
const COUNT = "count";
const WIDTH = "b";
const DEPTH = "D";
const THICKNESS = "t";
const THICKNESS_LEFT = "t_left";
const THICKNESS_RIGHT = "t_right";
const CLEAR = "clear";

/**
 * The thicker of the two slabs a beam adjoins — "the thicker adjoining slab governing `t`"
 * (L-MEA-09). It is a SELECTION between two readings, never arithmetic: the answer is one of the two
 * readings, whole, carrying its own source, so a reader auditing the line goes back to the face the
 * figure was taken from.
 *
 * Two readings written in different units cannot be told apart without converting one, and a rail
 * converts nothing (B-17): that is a thickness this rail cannot state, and it says so.
 */
function thickerOf(sides: RunSetup["sides"]): ReadingSetup | null {
  const [left, right] = sides;
  if (left === null || right === null || left.unit !== right.unit) return null;
  return exact(right.value).gt(exact(left.value)) ? right : left;
}

/** What one beam row is offered from, once its run has been found beside its member reading. */
type BeamRead = { readonly member: MemberRead; readonly run: RunSetup };

/** The four readings both beam rules share, in the order their templates spell them. */
function sharedBindings(read: BeamRead): Record<string, Measure> {
  const { row, placement, calibration, section } = read.member;
  return {
    // An expanded object's geometry on a level not drawn carries DERIVED, and one read off the
    // drawing carries MEASURED: the register row's own standing IS that distinction (L-QTY-01).
    [COUNT]: { value: ONE, unit: CANONICAL_UNIT.COUNT, basis: row.standing, source: placement.sourceEntity, calibration },
    [WIDTH]: section.width,
    [DEPTH]: section.depth,
    [CLEAR]: measureOf(read.run.clear as ReadingSetup, calibration),
  };
}

/** One offer, once its own rule's bindings and omissions have been decided. */
function offerOf(
  read: BeamRead,
  setup: RailSetup,
  ruleId: string,
  kind: Kind,
  bindings: Record<string, Measure>,
  omitted: readonly { readonly variable: string; readonly code: "SLAB_THICKNESS_UNSTATED" }[],
): Offer {
  const { row, placement, calibration } = read.member;
  return {
    ruleId,
    kind,
    class: BEAM,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: PRISM_RECT, basis: row.standing, calibration },
    bindings,
    selectors: selectorsOf(placement, setup),
    // A beam nets nothing: the junction it does not own is the other member's (L-MEA-09).
    deductions: [],
    omitted: [...omitted],
    // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
    coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/**
 * Every beam row of the batch, read against the setup: the ones that can be offered, and the ones
 * reported instead. Shared by the two rails, because what a beam IS does not change with the kind
 * measured of it — only what is measured of it does (B-17).
 */
function readBeams(input: RailInput, kind: Kind): { readonly reads: readonly BeamRead[]; readonly observations: readonly RailObservation[] } {
  const reads: BeamRead[] = [];
  const observations: RailObservation[] = [];
  for (const row of rowsOfClass(input.objects, BEAM)) {
    const member = readMember(row, input.setup);
    if (!member.ok) {
      observations.push(observe(BEAM, kind, member.code, row, member.sourceEntity));
      continue;
    }
    // A beam whose run was never read is not measured at all — a figure is never guessed from a grid
    // (L-MEA-09). The reader is sent to the placement: the axis and its supports are what to look at.
    const run = input.setup.runs[row.placementKey];
    if (run === undefined || run.clear === null) {
      observations.push(observe(BEAM, kind, "RUN_UNREAD", row, member.read.placement.sourceEntity));
      continue;
    }
    reads.push({ member: member.read, run });
  }
  return { reads, observations };
}

/** One omission, as the row declares it (L-QTY-02). */
const unstated = (variable: string): { readonly variable: string; readonly code: "SLAB_THICKNESS_UNSTATED" } => ({ variable, code: "SLAB_THICKNESS_UNSTATED" });

/**
 * `rcc.beam.concrete`: the concrete one beam holds below the thicker adjoining soffit, over its
 * clear run — `count × b × (D − t) × clear`.
 */
export const beamConcreteRail: Rail = (input: RailInput) => {
  const { reads, observations } = readBeams(input, RCC_CONCRETE);
  const offers = reads.map((read) => {
    const bindings = sharedBindings(read);
    const thicker = thickerOf(read.run.sides);
    // A thickness nobody stated is never a zero and never the other side's: the row is kept, the
    // variable is unbound, and the omission is enumerated on the row by name (L-QTY-01/02).
    if (thicker !== null) bindings[THICKNESS] = measureOf(thicker);
    return offerOf(read, input.setup, BEAM_CONCRETE_RULE_ID, RCC_CONCRETE, bindings, thicker === null ? [unstated(THICKNESS)] : []);
  });
  return { offers, observations };
};

/**
 * `rcc.beam.formwork`: the two sides and the soffit one beam is cast against, over the same clear
 * run — `count × ((D − t_left) + (D − t_right) + b) × clear`. Each side is bound as the side it is:
 * an edge beam's open side is the 0 the drawing implies, not a repetition of the other.
 */
export const beamFormworkRail: Rail = (input: RailInput) => {
  const { reads, observations } = readBeams(input, RCC_FORMWORK);
  const offers = reads.map((read) => {
    const bindings = sharedBindings(read);
    const omitted: { readonly variable: string; readonly code: "SLAB_THICKNESS_UNSTATED" }[] = [];
    for (const [at, variable] of [THICKNESS_LEFT, THICKNESS_RIGHT].entries()) {
      const side = read.run.sides[at] ?? null;
      if (side === null) omitted.push(unstated(variable));
      else bindings[variable] = measureOf(side);
    }
    return offerOf(read, input.setup, BEAM_FORMWORK_RULE_ID, RCC_FORMWORK, bindings, omitted);
  });
  return { offers, observations };
};
