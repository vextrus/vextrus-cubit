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
import type { ScheduleDimension } from "@/core/db";
import type { RefusalCode } from "@/core/errors";
import { actSourceOf, editionSourceOf } from "@/core/identity";
import { variantCovering } from "@/core/offers/contract";
import type { CapJunctionSetup, Measure, MemberVariantSetup, OmittedComponent, PlacementSetup, RailObservation, RailSetup, ReadingSetup, RegisterObjectRow } from "@/core/offers/contract";
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
  "EARTHWORK_PARAMETER_UNSTATED",
  "EARTHWORK_PLAN_DEFERRED",
  "BLINDING_PLAN_DEFERRED",
  // L-MEA-09's pile › pile cap (I-544..d): a cap whose piles' heads nothing places, a cap the
  // plans hold no pile under, a cap whose piles nobody could read at all, and a head height the drawing
  // could only bound — deducted at the bound, so the figure stands under and says so (L-QTY-04).
  "PILE_HEAD_UNSTATED",
  "CAP_HOLDS_NO_PILE",
  "CAP_PILES_UNREAD",
  "JUNCTION_DEFERRED",
  // I-546, I-598: a cap the set draws or names a recess in without stating it every way.
  "CAP_RECESS_UNSTATED",
] as const satisfies readonly RefusalCode[];

/** One code of the roster above. */
export type FoundationsRailCode = (typeof FOUNDATIONS_RAIL_CODES)[number];

/**
 * The roster's members by name, read off the roster itself rather than spelled a second time: one
 * code has one spelling in this area, and a rail that reports one names it from here (Q-07).
 *
 * Every position is named, in the roster's own order: a name skipped here shifts every name after it
 * onto its neighbour's code, and `EARTHWORK_PLAN_DEFERRED` once spelled `EARTHWORK_PARAMETER_UNSTATED`
 * that way — unread, so no figure moved, but a constant that says one code and holds another.
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
  EARTHWORK_PARAMETER_UNSTATED,
  EARTHWORK_PLAN_DEFERRED,
  BLINDING_PLAN_DEFERRED,
  PILE_HEAD_UNSTATED,
  CAP_HOLDS_NO_PILE,
  CAP_PILES_UNREAD,
  JUNCTION_DEFERRED,
  CAP_RECESS_UNSTATED,
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

/**
 * The names the schedules state a foundation's readings under, beyond its section (interfaces) —
 * NAMED as members of the store's closed roster rather than restated beside it, so the dimension
 * the schedule reader stores and the one a rail binds are one name (I-322, B-17).
 */
export const DEPTH = "depth" satisfies ScheduleDimension;
export const DIA = "dia" satisfies ScheduleDimension;
export const LENGTH = "length" satisfies ScheduleDimension;
export const TOP = "top" satisfies ScheduleDimension;

/** The edition parameter each DERIVED reading of L-FRM-04 falls back to (L-MEA-01's roster). */
export const WORKING_ALLOWANCE_PARAMETER = "earthworkWorkingAllowance";
export const DEPTH_EXTRA_PARAMETER = "earthworkDepthExtra";
export const BLINDING_PROJECTION_PARAMETER = "blindingProjection";
export const BLINDING_THICKNESS_PARAMETER = "blindingThickness";

/**
 * The same roster by the SITE fact each parameter stands in for — the one pairing, read by
 * `enteredOrDerived` for the rails and by the site-facts panel to say which facts the pinned edition
 * already states (I-327). The ground level and the water table are facts about THIS ground that no
 * clause of a rule set states, so they have no entry (Q-07).
 */
export const EDITION_PARAMETER_OF = Object.freeze({
  WORKING_ALLOWANCE: WORKING_ALLOWANCE_PARAMETER,
  DEPTH_EXTRA: DEPTH_EXTRA_PARAMETER,
  BLINDING_PROJECTION: BLINDING_PROJECTION_PARAMETER,
  BLINDING_THICKNESS: BLINDING_THICKNESS_PARAMETER,
} as const satisfies Partial<Record<SiteFact, string>>);

/** A site fact the pinned edition may state in place of an entry. */
export type DerivableSiteFact = keyof typeof EDITION_PARAMETER_OF;

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

  const variant = variantOfPlacement(placement, setup);
  if (variant === undefined) {
    return { ok: false, observation: observe(elementClass, kind, "MEMBER_TYPE_UNKNOWN", row, placement.sourceEntity) };
  }

  return { ok: true, read: { row, placement, calibration, variant } };
}

/**
 * The member type one foundation placement's family states — the row a rail reads its section and its
 * dimensions off — or nothing where the schedules type it by no row, or by several the stack cannot
 * tell apart. The ONE reading of it: a row's own rail and a pile cap asking the diameter of the piles
 * under it read one variant for one pile (B-17).
 *
 * A foundation stands in the FOUNDATION slot and on no level of the stack (L-REG-02), so the stack
 * bands nothing here: the family's own row is its section where it states exactly one, and a family
 * stating several is genuinely ambiguous off the stack (`variantCovering`, L-QTY-01: never a guess).
 */
export function variantOfPlacement(placement: PlacementSetup, setup: RailSetup): MemberVariantSetup | undefined {
  const family = placement.memberFamily;
  const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
  if (variants === undefined || variants.length === 0) return undefined;
  return variantCovering(variants, undefined, setup.levels);
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
 * THE PLAN STATES THE SHAPE, THE SCHEDULE THE SIZE (Interpretation I-334; I-304 for foundations).
 * Where the placement stage read the member's RING, the ring governs: a polygon is measured over its
 * own shoelace area, and a rectangle over its own two sides — never a bounding box, and never a
 * schedule's rectangle standing in for a plan the drawing drew otherwise. F-RCC6-BNBC's chamfered PC2
 * encloses 3.2625 m² where its schedule's 2100 × 1750 would say 3.675, and its PC1 turned 45° is
 * 2000 × 1000 where its box is 2121 × 2121 (L-FRM-02, L-QTY-04: an over-measured figure is never a
 * disclosure).
 *
 * The schedule's section CORROBORATES a rectangle, and where it does the figures bound are the
 * schedule's own print — the size the ring was drawn to, transcribed at the cell it was read from
 * (L-QTY-03). Where it does not, or where the schedule states none, the ring's own sides are bound,
 * as measured. Where no ring was read at all, a schedule's section is the plan, as it always was.
 *
 * A polygon carries the length of its own boundary beside its area where the reader of the ring read
 * one (I-337): what its sides are formed along (L-FRM-03), measured off the same ring on the same
 * calibration, and never a schedule's rectangle standing in for it. A rectangle needs none — its sides
 * ARE its boundary, and the formwork over it is `2 × (L + B)` of the very sides its concrete binds.
 */
export type Plan =
  | { readonly shape: "rect"; readonly length: Measure; readonly breadth: Measure }
  | { readonly shape: "poly"; readonly area: Measure; readonly perimeter: Measure | null }
  | { readonly shape: "none" };

/** The plan one read row states (L-FRM-02, I-334). */
export function planOf(read: Read): Plan {
  const section = sectionOf(read.variant);
  const outline = read.placement.outline;
  if (outline === null) return section ?? { shape: "none" };
  // A reading measured off a view stands on that view's affirmed calibration (L-QTY-03).
  const measured = (reading: Measure): Measure => ({ ...reading, calibration: read.calibration });
  if (outline.type === PRISM_POLY) return { shape: "poly", area: measured(outline.area), perimeter: outline.perimeter === undefined ? null : measured(outline.perimeter) };
  if (outline.type === PRISM_RECT && outline.length !== null && outline.breadth !== null) {
    if (section !== null && section.shape === "rect" && corroborates(section, outline.length, outline.breadth)) return section;
    return { shape: "rect", length: measured(outline.length), breadth: measured(outline.breadth) };
  }
  // A frustum, a taper or any other read shape is a plan L-FRM-02 measures by another method than
  // the two this leaf lands: it is no plan HERE, and the rails say so by name (scope).
  return { shape: "none" };
}

/**
 * Whether a schedule's section states the rectangle a ring was drawn as: the two sides, in either
 * order, each within half a unit of the place the schedule printed it to — `2000` is a figure in
 * [1999.5, 2000.5], and a side drawn inside that is the side the schedule describes. Asked only where
 * the two were written in one unit: a comparison across units would be a conversion, and a rail
 * converts nothing (L-MEA-08) — so there the ring's own sides stand.
 */
function corroborates(section: { readonly length: Measure; readonly breadth: Measure }, length: Measure, breadth: Measure): boolean {
  if (section.length.unit !== length.unit || section.breadth.unit !== breadth.unit) return false;
  const stated = [section.length.value, section.breadth.value].map(Number).sort((left, right) => right - left);
  const drawn = [length.value, breadth.value].map(Number).sort((left, right) => right - left);
  return stated.every((side, index) => Math.abs(side - (drawn[index] as number)) <= halfUnitOf(String(side)));
}

/** Half the unit of the last place a figure is printed to: `2000` → 0.5, `12.5` → 0.05. */
function halfUnitOf(printed: string): number {
  const places = printed.includes(".") ? (printed.split(".")[1] ?? "").length : 0;
  return 0.5 * 10 ** -places;
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
export function enteredOrDerived(setup: RailSetup, fact: DerivableSiteFact): Measure | undefined {
  const entered = setup.siteFacts[fact];
  if (entered !== undefined) return { value: entered.value, unit: entered.unit, basis: "ENTERED", source: actSourceOf(entered.actId) };
  const parameterKey = EDITION_PARAMETER_OF[fact];
  const stated = setup.edition.parameters[parameterKey];
  if (stated === undefined) return undefined;
  return { value: stated.value, unit: stated.unit, basis: "DERIVED", source: editionSourceOf(setup.edition.digest, parameterKey) };
}

/**
 * What a SITE fact stands at, and nothing else: the facts no clause of a rule set can state, because
 * they are facts about THIS ground. The existing ground level is one — "an absent fact is a named
 * deferral, never a default" (AM-06 §1, L-MEA-06).
 */
export function enteredOnly(setup: RailSetup, fact: SiteFact): Measure | undefined {
  const entered = setup.siteFacts[fact];
  return entered === undefined ? undefined : { value: entered.value, unit: entered.unit, basis: "ENTERED", source: actSourceOf(entered.actId) };
}

/**
 * What the setup states about one PILE CAP's junctions (L-MEA-09, I-544..d): its piles READ, with
 * what the drawing states about them, or UNREAD — nobody could say which piles it stands on.
 */
export type CapJunction = { readonly read: true; readonly junction: CapJunctionSetup } | { readonly read: false };

/** A pile cap whose piles nobody read — one answer, shared (B-17). */
const UNREAD: CapJunction = Object.freeze({ read: false as const });

/**
 * What the setup states about one row's junctions with the piles below it — null where the row is no
 * pile cap (a footing stands on the ground, and L-FRM-02's prism is its whole sentence).
 *
 * A pile cap with no entry is UNREAD, never a prism: a cap stands on piles by what it is, each of them
 * owns the head it cast into the cap, and a cap measured whole over heads nobody placed reads over
 * them (L-QTY-04) — whether the setup read no pile plan at all, could not lay the plans over one
 * another, or states no junctions whatever (I-547). It is asked in one place so the three kinds a
 * cap's junctions touch — its concrete, its blinding, its formwork — read one statement of them (B-17).
 */
export function capJunctionOf(read: Read, setup: RailSetup): CapJunction | null {
  if (read.row.elementType !== PILE_CAP) return null;
  const junction = setup.capJunctions?.[read.row.placementKey];
  return junction === undefined ? UNREAD : { read: true, junction };
}

/** A reading the partition read, as a binding: the value, the unit, the basis and the entity (L-QTY-03). */
function measureOf(reading: ReadingSetup): Measure {
  return { value: reading.value, unit: reading.unit, basis: reading.basis, source: reading.source };
}

/**
 * The diameter the piles a cap holds are scheduled at: each held pile's own member type, read by the
 * one reading the pile rail reads it by (`variantOfPlacement`, through `resolve`), and the one DIA they
 * all state. Nothing where any of them states none, or where two of them state different ones — two
 * diameters under one cap are two sentences the one `d` cannot say, and a figure over either would be
 * a guess (L-QTY-01).
 */
function heldDiameterOf(junction: CapJunctionSetup, setup: RailSetup): Measure | undefined {
  let held: Measure | undefined;
  for (const pile of junction.piles) {
    const placement = setup.placements[pile];
    const variant = placement === undefined ? undefined : variantOfPlacement(placement, setup);
    const dia = variant?.dimensions[DIA];
    if (dia === undefined) return undefined;
    if (held !== undefined && (held.value !== dia.value || held.unit !== dia.unit)) return undefined;
    held ??= dia;
  }
  return held;
}

/** What a cap's piles own of it, as the bindings and the omissions a rail offers them under. */
export type HeldPiles = {
  readonly bindings: Readonly<Record<string, Measure>>;
  readonly omitted: readonly OmittedComponent[];
  /** Whether the head height was only BOUNDED — deducted at its bound, the figure then under (L-QTY-04). */
  readonly deferred: boolean;
};

/** The variables the owned sentences name the piles by (`@/core/rulesets/methods/foundations/owned`). */
const PILES_HELD = "n";
const PILE_DIAMETER = "d";
const HEAD_HEIGHT = "e";

/**
 * The piles one cap stands on, as the owned sentences bind them (I-544, I-545): how many
 * (`n`, measured off the two plans on the cap view's calibration), the diameter they are scheduled at
 * (`d`) and — where the kind asks for it — how far their heads stand above the soffit (`e`).
 *
 * Every reading the drawing did not state is omitted by name and never bound as a zero:
 * - a cap whose piles nobody read omits every one of them, `CAP_PILES_UNREAD` — the prism is never
 *   the answer to a relation nobody read (I-547);
 * - no pile under the cap at all is the two plans disagreeing about it, `CAP_HOLDS_NO_PILE`;
 * - a diameter the held piles' schedule does not state as one is `PILE_DIAMETER_UNSTATED`;
 * - a head height nothing places is `PILE_HEAD_UNSTATED` — the figure would read over, so the row is
 *   kept with no figure rather than published over (L-QTY-04).
 * A head height the drawing only BOUNDS is bound at its bound, and the rail says the figure is under.
 */
export function heldPilesOf(read: Read, setup: RailSetup, cap: CapJunction, options: { readonly head: boolean }): HeldPiles {
  const wanted = options.head ? [PILE_DIAMETER, HEAD_HEIGHT] : [PILE_DIAMETER];
  if (!cap.read) return { bindings: {}, omitted: [PILES_HELD, ...wanted].map((variable) => ({ variable, code: CAP_PILES_UNREAD })), deferred: false };

  const junction = cap.junction;
  const bindings: Record<string, Measure> = { [PILES_HELD]: { ...measureOf(junction.count), calibration: read.calibration } };
  const omitted: OmittedComponent[] = [];

  if (junction.piles.length === 0) {
    for (const variable of wanted) omitted.push({ variable, code: CAP_HOLDS_NO_PILE });
    return { bindings, omitted, deferred: false };
  }

  const diameter = heldDiameterOf(junction, setup);
  if (diameter === undefined) omitted.push({ variable: PILE_DIAMETER, code: PILE_DIAMETER_UNSTATED });
  else bindings[PILE_DIAMETER] = diameter;

  if (!options.head) return { bindings, omitted, deferred: false };
  const head = junction.headHeight;
  if (head.standing === "UNBOUNDED") {
    omitted.push({ variable: HEAD_HEIGHT, code: PILE_HEAD_UNSTATED });
    return { bindings, omitted, deferred: false };
  }
  bindings[HEAD_HEIGHT] = measureOf(head.reading);
  return { bindings, omitted, deferred: head.standing === "BOUNDED" };
}

/** The variables the owned sentences name a recess by (I-546). */
const RECESS_LENGTH = "Lr";
const RECESS_BREADTH = "Br";
const RECESS_DEPTH = "Dr";

/** A recess as the recess sentences are offered it: the sides the set states, bound, and the rest omitted by name. */
export type HeldRecess = {
  readonly bindings: Readonly<Record<string, Measure>>;
  readonly omitted: readonly OmittedComponent[];
};

/**
 * The recess cast into a cap, as the recess sentences name it (I-546) — or nothing where the set
 * draws and names none, and the cap is its prism as it always was.
 *
 * A recess the set draws or names but states only some ways is offered under the recess sentence
 * still, with each side it lacks omitted under `CAP_RECESS_UNSTATED`: the row is kept with no figure
 * (L-QTY-02), and never published as the whole prism over a void nobody netted (L-QTY-04,
 * I-598).
 */
export function recessOf(cap: CapJunction | null): HeldRecess | null {
  const recess = cap !== null && cap.read ? cap.junction.recess : null;
  if (recess === null) return null;
  const bindings: Record<string, Measure> = {};
  const omitted: OmittedComponent[] = [];
  const sides: readonly (readonly [string, ReadingSetup | null])[] = [
    [RECESS_LENGTH, recess.length],
    [RECESS_BREADTH, recess.breadth],
    [RECESS_DEPTH, recess.depth],
  ];
  for (const [variable, reading] of sides) {
    if (reading === null) omitted.push({ variable, code: CAP_RECESS_UNSTATED });
    else bindings[variable] = measureOf(reading);
  }
  return { bindings, omitted };
}
