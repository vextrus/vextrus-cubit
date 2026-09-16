// What every foundation rail reads before it offers anything: the row's placement, the calibration
// its view stands on, the member type its mark normalises to, the plan it occupies, and the readings
// a site entered or the pinned edition states.
//
// It stands apart from the rails so the five of them read one statement of each: what "the plan of
// this foundation" is, and what "the working allowance" is, are single facts, and two rails asking
// them differently would be two answers to one question (B-17, ARCH-02).
//
// Nothing here computes and nothing converts: every reading is carried in the unit it was written in,
// and the carrying into canonical units is the gate's, through the one canon (L-MEA-08, B-17).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RefusalCode } from "@/core/errors";
import { variantCovering } from "@/core/offers/contract";
import type { Measure, MemberVariantSetup, PlacementSetup, RailObservation, RailSetup, RegisterObjectRow } from "@/core/offers/contract";
import type { SiteFact } from "@/core/site-facts/law";
import { CANONICAL_UNIT } from "@/core/units/canon";

/**
 * The rail-local closed code roster of this area: every reason a foundation rail reports a row it did
 * not offer whole. Each is a registered refusal too — the same taxonomy serves a machine's refusals
 * and a reader's evidence (R-SPINE-062, L-MEA-08).
 *
 * The first two are OBSERVATIONS and the rest are omissions on a kept row: a rail cannot mint a
 * calibration reference it does not hold and never invents a section, so a view nobody affirmed and a
 * mark nothing scheduled leave nothing to offer at all — while a reading a schedule simply does not
 * state keeps its row and names what is missing (L-QTY-02).
 */
export const FOUNDATIONS_RAIL_CODES = [
  "VIEW_SCALE_UNAFFIRMED",
  "MEMBER_TYPE_UNKNOWN",
  "PILE_LENGTH_UNSTATED",
  "PILE_DIAMETER_UNSTATED",
  "FOUNDATION_DEPTH_UNSTATED",
  "FOUNDATION_PLAN_UNSTATED",
  "FOUNDING_LEVEL_UNSTATED",
  "GROUND_LEVEL_UNSTATED",
  "EARTHWORK_PLAN_DEFERRED",
  "BLINDING_PLAN_DEFERRED",
] as const satisfies readonly RefusalCode[];

/** One code of the roster above. */
export type FoundationsRailCode = (typeof FOUNDATIONS_RAIL_CODES)[number];

/**
 * The roster's members by name, read off the roster itself rather than spelled a second time: one
 * code has one spelling in this area, and a rail that reports one names it from here (Q-07).
 */
export const [
  VIEW_SCALE_UNAFFIRMED,
  MEMBER_TYPE_UNKNOWN,
  PILE_LENGTH_UNSTATED,
  PILE_DIAMETER_UNSTATED,
  FOUNDATION_DEPTH_UNSTATED,
  FOUNDATION_PLAN_UNSTATED,
  FOUNDING_LEVEL_UNSTATED,
  GROUND_LEVEL_UNSTATED,
  EARTHWORK_PLAN_DEFERRED,
  BLINDING_PLAN_DEFERRED,
] = FOUNDATIONS_RAIL_CODES;

/** The three classes this area measures (R-TO-032). */
export const FOOTING: ElementType = "footing";
export const PILE_CAP: ElementType = "pile_cap";
export const PILE: ElementType = "pile";

/** The two spread foundations: the classes a pit is dug for and a blinding is laid under. */
export const SPREAD: readonly ElementType[] = Object.freeze([FOOTING, PILE_CAP]);

/** The geometries a foundation's plan is read as (L-FRM-01, L-FRM-02). */
export const PRISM_RECT = "PRISM_RECT";
export const PRISM_POLY = "PRISM_POLY";

/** One member is one member: a rail states what it counted, never a total it derived (L-MEA-08). */
const ONE = "1";

/** The item-selecting attribute a concrete line is priced by, where a reader stated one (L-QTY-03). */
export const GRADE = "grade";

/** The item-selecting attribute a piling line is priced by: a bore is priced by its diameter. */
export const DIAMETER = "diameter";

/** The names the schedules state a foundation's readings under, beyond its section (interfaces). */
export const DEPTH = "depth";
export const DIA = "dia";
export const LENGTH = "length";
export const TOP = "top";

/** The edition parameter each DERIVED reading of L-FRM-04 falls back to (L-MEA-01's roster). */
export const WORKING_ALLOWANCE_PARAMETER = "earthworkWorkingAllowance";
export const DEPTH_EXTRA_PARAMETER = "earthworkDepthExtra";
export const BLINDING_PROJECTION_PARAMETER = "blindingProjection";
export const BLINDING_THICKNESS_PARAMETER = "blindingThickness";

/** What a rail found for one row before it read anything off the drawing. */
export type Read = {
  readonly row: RegisterObjectRow;
  readonly placement: PlacementSetup;
  readonly calibration: string;
  readonly variant: MemberVariantSetup;
};

/** Either the row is readable, or it is an observation about why nothing can be offered for it. */
export type Resolution = { readonly ok: true; readonly read: Read } | { readonly ok: false; readonly observation: RailObservation };

/**
 * One observation about a row a rail did not offer for, under this area's closed roster (L-MEA-08).
 *
 * The object is the register row nothing was offered for and the source entity is what a reader has
 * to go and look at — the view whose scale nobody affirmed, the placement whose member type the
 * schedules do not cover. Nothing else is carried: what the row IS is the register's to answer
 * through the object key, and a copy of it here would be a second home for it (B-17).
 */
export function observe(elementClass: ElementType, kind: Kind, code: FoundationsRailCode, row: RegisterObjectRow, sourceEntity: string): RailObservation {
  return { class: elementClass, kind, code, objectKey: row.objectKey, sourceEntity };
}

/**
 * The placement, calibration and member type one row stands on — or the observation that says which
 * of the three was missing. Asked in the order a reader would ask it, exactly as the column rail asks
 * it, so a foundation and a column report the same absence the same way (B-17).
 */
export function resolve(row: RegisterObjectRow, setup: RailSetup, kind: Kind): Resolution {
  const elementClass = row.elementType as ElementType;
  const placement = setup.placements[row.placementKey];
  if (placement === undefined) {
    // The setup is read off the same partition the register was expanded from, so a row whose
    // placement it does not hold names a sighting nothing can be traced to: there is no drawing, no
    // view and no engine to offer it under, and the row reaches the residue as evidence.
    return { ok: false, observation: observe(elementClass, kind, "MEMBER_TYPE_UNKNOWN", row, row.placementKey) };
  }

  // A rail cannot mint a calibration reference it does not hold, and a line always carries "a
  // non-empty set of affirmed calibration references" (L-QTY-03): a view nobody has affirmed a scale
  // for is reported against THE VIEW — what a reader has to go and affirm. A reference the setup
  // spells as nothing is no affirmed reference either.
  const calibration = setup.calibrations[placement.ingestId]?.[placement.viewKey];
  if (calibration === undefined || calibration.length === 0) {
    return { ok: false, observation: observe(elementClass, kind, "VIEW_SCALE_UNAFFIRMED", row, placement.viewKey) };
  }

  const family = placement.memberFamily;
  const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
  if (variants === undefined || variants.length === 0) {
    return { ok: false, observation: observe(elementClass, kind, "MEMBER_TYPE_UNKNOWN", row, placement.sourceEntity) };
  }

  // A foundation stands in the FOUNDATION slot and on no level of the stack (L-REG-02), so the stack
  // bands nothing here: the family's own row is its section where it states exactly one, and a family
  // stating several is genuinely ambiguous off the stack (`variantCovering`, L-QTY-01: never a guess).
  const variant = variantCovering(variants, undefined, setup.levels);
  if (variant === undefined) {
    return { ok: false, observation: observe(elementClass, kind, "MEMBER_TYPE_UNKNOWN", row, placement.sourceEntity) };
  }

  return { ok: true, read: { row, placement, calibration, variant } };
}

/** The count of one member, provenanced to the entity it was counted off (L-QTY-03). */
export function countOf(read: Read): Measure {
  // An expanded object's geometry carries DERIVED and one read off the drawing carries MEASURED: the
  // register row's own standing IS that distinction, and the rail carries it rather than re-deciding
  // it (L-QTY-01, L-REG-03).
  return { value: ONE, unit: CANONICAL_UNIT.COUNT, basis: read.row.standing, source: read.placement.sourceEntity, calibration: read.calibration };
}

/**
 * The plan a foundation occupies, as the readings it is measured over — or the fact that the plan is
 * one this leaf does not measure over.
 *
 * A schedule's section is the plan where the schedule states one: a foundation's size column IS its
 * plan, transcribed at the cell it was read from (L-QTY-03). Where no schedule states one, the plan
 * is what a reader read off the drawing, and what that reading IS decides the algebra — a rectangle
 * is measured by its sides and a polygon by its shoelace area (L-FRM-02).
 */
export type Plan =
  | { readonly shape: "rect"; readonly length: Measure; readonly breadth: Measure }
  | { readonly shape: "poly"; readonly area: Measure }
  | { readonly shape: "none" };

/** The plan one read row states (L-FRM-02). */
export function planOf(read: Read): Plan {
  const section = sectionOf(read.variant);
  if (section !== null) return section;
  const outline = read.placement.outline;
  if (outline === null) return { shape: "none" };
  if (outline.type === PRISM_RECT && outline.length !== null && outline.breadth !== null) {
    return { shape: "rect", length: outline.length, breadth: outline.breadth };
  }
  if (outline.type === PRISM_POLY) return { shape: "poly", area: outline.area };
  // A frustum, a taper or any other read shape is a plan L-FRM-02 measures by another method than
  // the two this leaf lands: it is no plan HERE, and the rails say so by name (scope).
  return { shape: "none" };
}

/**
 * The section a variant states, as the two readings a rectangular plan is bound by — or nothing where
 * the schedule stated no section, or stated one without the unit it was written in, which is a size
 * nobody can carry into metres (L-REG-01).
 *
 * The source is the first schedule cell the variant was read from: a section is read at one cell, and
 * provenance is to the cell rather than to the row that collected it (L-QTY-03).
 */
function sectionOf(variant: MemberVariantSetup): Plan | null {
  const source = variant.sourceKeys[0];
  if (variant.sectionUnit === null || variant.sectionWidth === null || variant.sectionDepth === null || source === undefined) return null;
  const unit = variant.sectionUnit;
  const read = (value: number): Measure => ({ value: String(value), unit, basis: "TRANSCRIBED", source });
  return { shape: "rect", length: read(variant.sectionWidth), breadth: read(variant.sectionDepth) };
}

/** One dimension the family's schedule states beside its section, or nothing where it states none. */
export function dimensionOf(read: Read, name: string): Measure | undefined {
  return read.variant.dimensions[name];
}

/**
 * What a SITE fact stands at, or what the pinned edition states where nobody entered one (L-MEA-06).
 *
 * The order is the clause's: a fact somebody entered about THIS site governs, and where no one has,
 * the edition's own parameter is a citable clause — "a citable clause is DERIVED, not DEFAULTED". An
 * entered reading cites the act that entered it and a derived one cites the edition and the parameter
 * by name, so either way a reader can go back to what the figure stood on (L-QTY-01, L-QTY-03).
 */
export function enteredOrDerived(setup: RailSetup, fact: SiteFact, parameterKey: string): Measure | undefined {
  const entered = setup.siteFacts[fact];
  if (entered !== undefined) return { value: entered.value, unit: entered.unit, basis: "ENTERED", source: `act:${entered.actId}` };
  const stated = setup.edition.parameters[parameterKey];
  if (stated === undefined) return undefined;
  return { value: stated.value, unit: stated.unit, basis: "DERIVED", source: `edition:${setup.edition.digest}#${parameterKey}` };
}

/**
 * What a SITE fact stands at, and nothing else: the facts no clause of a rule set can state, because
 * they are facts about THIS ground. The existing ground level is one — "an absent fact is a named
 * deferral, never a default" (AM-06 §1, L-MEA-06).
 */
export function enteredOnly(setup: RailSetup, fact: SiteFact): Measure | undefined {
  const entered = setup.siteFacts[fact];
  return entered === undefined ? undefined : { value: entered.value, unit: entered.unit, basis: "ENTERED", source: `act:${entered.actId}` };
}
