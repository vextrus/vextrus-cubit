// R-TO-032's slabs, shear walls and stairs: the two rails that measure them, for concrete and for
// the formwork they are cast against (L-MEA-09/AM-02, AM-06 §3/§4, L-FRM-02/03).
//
// A rail "is a pure function returning `{ offers, observations }`" (L-MEA-08): everything these read
// arrives in their argument, so they reach no store and no clock and the same input twice answers
// deep-equal batches. They compute nothing — "there is no field where a computed value could land" —
// and convert nothing: every reading is carried in the unit it was written in, and the carrying into
// canonical units is the gate's, through the one canon (B-17, L-FRM-06). The deducted sum of the
// `opening` channel is not bound here at all: the threshold is the edition's and the partition is
// the gate's, so the rail hands candidates and the gate binds what it partitioned (L-MEA-02).
//
// One offer per (register row, kind). The register's rows ARE the expansion — an instance key is a
// placement key followed by one level segment (L-REG-04) — so a level is not iterated here: the row
// names the level it stands on, and a wall binds that level's own storey height.
//
// What the rails could not read is REPORTED rather than offered. L-MEA-08 reserves the refused arm
// for contract violations and sends a non-offer to the residue as evidence: a placement nothing was
// sighted from, a view nobody affirmed a scale for, a plan nobody read, an outline that does not
// close (L-MEA-03), a stair that is neither a straight flight nor a rectangular landing (AM-06 §3),
// a wall on a level no schedule band covers (L-FRM-02), and a junction nothing bounds at all — which
// L-QTY-04 makes a hard block, because an over-measured figure is never a disclosure.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RefusalCode } from "@/core/errors";
import type {
  DeductionCandidate,
  GeometryType,
  JunctionReading,
  Measure,
  Offer,
  OmittedComponent,
  PlacementSetup,
  PlanReadingSetup,
  Rail,
  RailInput,
  RailObservation,
  RailSetup,
  RegisterObjectRow,
} from "@/core/offers/contract";
import { heightOf, variantCovering } from "@/core/offers/contract";
import { CANONICAL_UNIT } from "@/core/units/canon";

/** The twelve rules these rails offer under. An offer names a rule and never a version (L-MEA-08). */
export const SLAB_WALL_STAIR_RULE_IDS = Object.freeze({
  slabConcrete: "rcc.slab.concrete",
  slabTaperConcrete: "rcc.slab.taper.concrete",
  slabFormwork: "rcc.slab.formwork",
  slabEdgeFormwork: "rcc.slab.edge-formwork",
  dropConcrete: "rcc.slab.drop.concrete",
  dropFormwork: "rcc.slab.drop.formwork",
  wallConcrete: "rcc.wall.concrete",
  wallFormwork: "rcc.wall.formwork",
  flightConcrete: "rcc.stair.flight.concrete",
  flightFormwork: "rcc.stair.flight.formwork",
  landingConcrete: "rcc.stair.landing.concrete",
  landingFormwork: "rcc.stair.landing.formwork",
});

/**
 * The rail-local closed code roster: every reason these rails report a row they did not offer, and
 * the one they report beside a row they DID offer under a bound rather than a reading. Each is a
 * registered refusal too — the same taxonomy serves a machine's refusals and a reader's evidence
 * (R-SPINE-062, L-MEA-08).
 */
export const SLAB_WALL_STAIR_RAIL_CODES = [
  "JUNCTION_DEFERRED",
  "JUNCTION_UNBOUNDED",
  "COMPLEX_STAIR_GEOMETRY",
  "PLAN_READING_ABSENT",
  "OUTLINE_NOT_CLOSED",
  "SECTION_BAND_UNCOVERED",
  "VIEW_SCALE_UNAFFIRMED",
] as const satisfies readonly RefusalCode[];

/** One code of the roster above. */
export type SlabWallStairRailCode = (typeof SLAB_WALL_STAIR_RAIL_CODES)[number];

/** The three classes these rails measure — a rail is selected per quantity kind (L-MEA-08). */
const MEASURED_CLASSES: readonly ElementType[] = Object.freeze(["slab", "shear_wall", "stair"]);

const RCC_CONCRETE: Kind = "rcc.concrete";
const RCC_FORMWORK: Kind = "rcc.formwork";

/** The one deduction channel a plate partitions: its scheduled openings (L-MEA-02). */
const OPENING = "opening" as const;

/** The item-selecting attribute a line is priced by, where a reader stated one (L-QTY-03). */
const GRADE = "grade";

/** One register row is one member: a rail states what it counted, never a total it derived. */
const ONE = "1";

/** What one offer under one rule states: the rule, the geometry it stands in, and its bindings. */
type Measurement = {
  readonly ruleId: string;
  readonly geometry: GeometryType;
  readonly bindings: Record<string, Measure>;
  readonly deductions: readonly DeductionCandidate[];
  readonly omitted: readonly OmittedComponent[];
  readonly selectors: Readonly<Record<string, Measure>>;
};

/** What a read row answers with: the measurement to offer, or the code it is reported under. */
type Read =
  | { readonly ok: true; readonly measurement: Measurement; readonly observed: readonly SlabWallStairRailCode[] }
  | { readonly ok: false; readonly code: SlabWallStairRailCode };

/** Every row of the batch these rails measure: the members of their own three classes (L-MEA-08). */
function measuredRows(objects: readonly RegisterObjectRow[]): readonly RegisterObjectRow[] {
  return objects.filter((row) => MEASURED_CLASSES.includes(row.elementType as ElementType));
}

/**
 * One observation about a row, under this rail's own closed roster (L-MEA-08).
 *
 * L-MEA-08 gives an observation an "optional object and source entity", and each is the one thing
 * the code is about: the object is the register row, and the source entity is what a reader has to
 * go and look at. Nothing else is carried — what the row IS is the register's to answer through the
 * object key, and a copy of it here would be a second home for it (B-17).
 */
function observe(code: SlabWallStairRailCode, klass: ElementType, kind: Kind, row: RegisterObjectRow, sourceEntity: string): RailObservation {
  return { class: klass, kind, code, objectKey: row.objectKey, sourceEntity };
}

/** The count of members this row stands for, as a reading with the row's own standing (L-QTY-01). */
function countOf(row: RegisterObjectRow, placement: PlacementSetup, calibration: string): Measure {
  return { value: ONE, unit: CANONICAL_UNIT.COUNT, basis: row.standing, source: placement.sourceEntity, calibration };
}

/**
 * How a junction the reading could only BOUND is taken (L-QTY-04).
 *
 * RESOLVED and BOUNDED both carry a reading, and both are deducted in full: at a bound the published
 * figure is then UNDER, which is a lawful disclosure and is reported `JUNCTION_DEFERRED`. UNBOUNDED
 * carries nothing at all — there is no bound to deduct at, so a figure would read OVER, and
 * "over-measurement → hard block, never a disclosure".
 */
type Junction = { readonly ok: true; readonly reading: Measure; readonly deferred: boolean } | { readonly ok: false };

function junction(held: JunctionReading): Junction {
  return held.standing === "UNBOUNDED" ? { ok: false } : { ok: true, reading: held.reading, deferred: held.standing === "BOUNDED" };
}

/** Every opening the reading states, handed to the gate as a candidate — the rail partitions none. */
function openingCandidates(openings: readonly Measure[]): DeductionCandidate[] {
  return openings.map((measure) => ({ channel: OPENING, measure }));
}

/**
 * The thickness one wall run is cast at: the section of the schedule variant that covers the row's
 * level where the schedules registered the family, and the reading's own thickness where they did
 * not (L-FRM-02: "a banded vertical prices each band's own section"; a level no band covers defers).
 */
type WallThickness = { readonly ok: true; readonly reading: Measure } | { readonly ok: false; readonly code: SlabWallStairRailCode };

function wallThickness(plan: Extract<PlanReadingSetup, { member: "WALL_RUN" }>, row: RegisterObjectRow, placement: PlacementSetup, setup: RailSetup): WallThickness {
  const family = placement.memberFamily;
  const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
  if (variants === undefined || variants.length === 0) return { ok: true, reading: plan.thickness };

  const level = setup.levels.find((one) => one.levelId === row.levelId);
  const variant = variantCovering(variants, level, setup.levels);
  if (variant === undefined) return { ok: false, code: "SECTION_BAND_UNCOVERED" };

  // A variant that states no section, or states one without the unit it was written in, is no
  // section a rail can carry into metres — and a rail never guesses one, so the reading the plan
  // itself states stands instead (L-QTY-01: the weaker reading, never an invented one).
  const source = variant.sourceKeys[0];
  if (variant.sectionWidth === null || variant.sectionUnit === null || source === undefined) return { ok: true, reading: plan.thickness };
  return { ok: true, reading: { value: String(variant.sectionWidth), unit: variant.sectionUnit, basis: "TRANSCRIBED", source } };
}

/** What a plate measures for concrete: the plate through one thickness, or through two (L-FRM-02). */
function slabConcreteOf(plan: Extract<PlanReadingSetup, { member: "SLAB_PANEL" }>, count: Measure): Read {
  const members = junction(plan.members);
  if (!members.ok) return { ok: false, code: "JUNCTION_UNBOUNDED" };

  const tapers = plan.thickness2 !== null && plan.thickness2.value !== plan.thickness.value;
  const shared = { count, A: plan.area, A_members: members.reading };
  return {
    ok: true,
    measurement: {
      ruleId: tapers ? SLAB_WALL_STAIR_RULE_IDS.slabTaperConcrete : SLAB_WALL_STAIR_RULE_IDS.slabConcrete,
      geometry: "AREA_THICK",
      bindings: tapers ? { ...shared, t1: plan.thickness, t2: plan.thickness2 as Measure } : { ...shared, t: plan.thickness },
      deductions: openingCandidates(plan.openings),
      omitted: [],
      selectors: {},
    },
    observed: members.deferred ? ["JUNCTION_DEFERRED"] : [],
  };
}

/**
 * What a plate measures for formwork: its soffit net of the members and the beam soffits it stands
 * over, plus its free edges — or, where the GROUND bears it, those edges alone (L-FRM-03).
 */
function slabFormworkOf(plan: Extract<PlanReadingSetup, { member: "SLAB_PANEL" }>, count: Measure): Read {
  if (plan.bearing === "GROUND") {
    return {
      ok: true,
      measurement: {
        ruleId: SLAB_WALL_STAIR_RULE_IDS.slabEdgeFormwork,
        geometry: "AREA_THICK",
        bindings: { count, L_edge: plan.freeEdge, t: plan.thickness },
        // The soffit is borne by the ground and formed by nobody, so there is no soffit area to
        // partition an opening out of: an opening in a slab on grade takes off no formwork at all.
        deductions: [],
        omitted: [],
        selectors: {},
      },
      observed: [],
    };
  }

  const members = junction(plan.members);
  const beams = junction(plan.beamSoffit);
  if (!members.ok || !beams.ok) return { ok: false, code: "JUNCTION_UNBOUNDED" };

  return {
    ok: true,
    measurement: {
      ruleId: SLAB_WALL_STAIR_RULE_IDS.slabFormwork,
      geometry: "AREA_THICK",
      bindings: { count, A: plan.area, A_members: members.reading, A_beams: beams.reading, L_edge: plan.freeEdge, t: plan.thickness },
      deductions: openingCandidates(plan.openings),
      omitted: [],
      selectors: {},
    },
    observed: members.deferred || beams.deferred ? ["JUNCTION_DEFERRED"] : [],
  };
}

/** What one row measures, for one kind — or the code it is reported under instead. */
function readOf(plan: PlanReadingSetup, kind: Kind, row: RegisterObjectRow, placement: PlacementSetup, calibration: string, setup: RailSetup): Read {
  const count = countOf(row, placement, calibration);
  const concrete = kind === RCC_CONCRETE;

  switch (plan.member) {
    case "SLAB_PANEL": {
      // L-MEA-03: "a surface that is not a closed outline defers with a reason — never bounding-boxed".
      if (plan.outline !== "CLOSED") return { ok: false, code: "OUTLINE_NOT_CLOSED" };
      return concrete ? slabConcreteOf(plan, count) : slabFormworkOf(plan, count);
    }

    case "SLAB_DROP":
      return {
        ok: true,
        measurement: concrete
          ? {
              ruleId: SLAB_WALL_STAIR_RULE_IDS.dropConcrete,
              geometry: "PRISM_RECT",
              bindings: { count, L: plan.length, B: plan.breadth, H: plan.height },
              deductions: [],
              omitted: [],
              selectors: {},
            }
          : {
              ruleId: SLAB_WALL_STAIR_RULE_IDS.dropFormwork,
              geometry: "PRISM_RECT",
              bindings: { count, L: plan.length, H: plan.height },
              deductions: [],
              omitted: [],
              selectors: {},
            },
        observed: [],
      };

    case "STAIR_FLIGHT": {
      // AM-06 §3 measures a STRAIGHT flight; anything else is left for a person (L-MEA-03).
      if (plan.shape !== "STRAIGHT") return { ok: false, code: "COMPLEX_STAIR_GEOMETRY" };
      return {
        ok: true,
        measurement: concrete
          ? {
              ruleId: SLAB_WALL_STAIR_RULE_IDS.flightConcrete,
              geometry: "TAPER_LINEAR",
              bindings: { count, S: plan.sloped, W: plan.width, w: plan.waist, G: plan.going, R: plan.rise },
              deductions: [],
              omitted: [],
              // How many steps the flight has selects nothing and measures nothing — the figure is
              // the flight's whole rise — but a reader auditing the line reads it (L-QTY-03).
              selectors: { risers: plan.risers },
            }
          : {
              ruleId: SLAB_WALL_STAIR_RULE_IDS.flightFormwork,
              geometry: "TAPER_LINEAR",
              bindings: { count, S: plan.sloped, W: plan.width, w: plan.waist, R: plan.rise },
              deductions: [],
              omitted: [],
              selectors: { risers: plan.risers },
            },
        observed: [],
      };
    }

    case "STAIR_LANDING": {
      if (plan.shape !== "RECT") return { ok: false, code: "COMPLEX_STAIR_GEOMETRY" };
      return {
        ok: true,
        measurement: concrete
          ? {
              ruleId: SLAB_WALL_STAIR_RULE_IDS.landingConcrete,
              geometry: "AREA_THICK",
              bindings: { count, A: plan.area, t: plan.thickness },
              deductions: [],
              omitted: [],
              selectors: {},
            }
          : {
              ruleId: SLAB_WALL_STAIR_RULE_IDS.landingFormwork,
              geometry: "AREA_THICK",
              bindings: { count, A: plan.area },
              deductions: [],
              omitted: [],
              selectors: {},
            },
        observed: [],
      };
    }

    case "WALL_RUN": {
      const thickness = wallThickness(plan, row, placement, setup);
      if (!thickness.ok) return { ok: false, code: thickness.code };

      // L-MEA-09: a vertical measures floor-to-floor through the joint, so the figure turns on the
      // storey height the row's own level stands at. A level with no height keeps the row and
      // declares H omitted rather than measuring over a number nobody read (L-QTY-02, L-MEA-07).
      const height = heightOf(setup.levels.find((one) => one.levelId === row.levelId));
      const bindings: Record<string, Measure> = concrete
        ? { count, L: plan.length, t: thickness.reading }
        : { count, L: plan.length, A_contact: plan.contact, A_ends: plan.ends };
      const omitted: OmittedComponent[] = [];
      if (height.ok) bindings["H"] = height.reading;
      else omitted.push({ variable: "H", code: height.code });

      return {
        ok: true,
        measurement: {
          ruleId: concrete ? SLAB_WALL_STAIR_RULE_IDS.wallConcrete : SLAB_WALL_STAIR_RULE_IDS.wallFormwork,
          geometry: "PRISM_RECT",
          bindings,
          deductions: [],
          omitted,
          selectors: {},
        },
        observed: [],
      };
    }
  }
}

/** One measurement, as the offer L-MEA-08 spells — whole, and with nothing computed on it. */
function offerOf(measurement: Measurement, kind: Kind, row: RegisterObjectRow, placement: PlacementSetup, calibration: string, setup: RailSetup): Offer {
  const grade = setup.grades[placement.drawingId];
  return {
    ruleId: measurement.ruleId,
    kind,
    class: row.elementType as ElementType,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    // An expanded object's geometry on a level not drawn carries DERIVED, and one read off the
    // drawing carries MEASURED: the register row's own standing IS that distinction, and the rail
    // carries it rather than re-deciding it (L-QTY-01, L-REG-03).
    geometry: { type: measurement.geometry, basis: row.standing, calibration },
    bindings: measurement.bindings,
    selectors: grade === undefined ? measurement.selectors : { ...measurement.selectors, [GRADE]: grade },
    deductions: measurement.deductions,
    omitted: measurement.omitted,
    // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
    coverage: measurement.omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/**
 * One rail of this area, for one kind: every slab, shear-wall and stair row of the batch, measured
 * from the plan the reader read of it.
 *
 * The questions are asked in the order a reader would ask them, and the first that has no answer is
 * the one reported: there is no point asking what shape a stair is when nobody read a plan of it.
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing, so what it
 * answers is a function of what it was given and of nothing else.
 */
function railFor(kind: Kind): Rail {
  return (input: RailInput) => {
    const setup = input.setup;
    const offers: Offer[] = [];
    const observations: RailObservation[] = [];

    for (const row of measuredRows(input.objects)) {
      const klass = row.elementType as ElementType;
      const placement = setup.placements[row.placementKey];
      if (placement === undefined) {
        // The setup is read off the same partition the register was expanded from, so a row whose
        // placement it does not hold names a sighting nothing can be traced to: there is no drawing,
        // no view and no engine to offer it under, and the row reaches the residue as evidence.
        observations.push(observe("PLAN_READING_ABSENT", klass, kind, row, row.placementKey));
        continue;
      }

      // A rail cannot mint a calibration reference it does not hold, and a line always carries "a
      // non-empty set of affirmed calibration references" (L-QTY-03): a view nobody has affirmed a
      // scale for is reported against THE VIEW — what a reader has to go and affirm.
      const calibration = setup.calibrations[placement.ingestId]?.[placement.viewKey];
      if (calibration === undefined || calibration.length === 0) {
        observations.push(observe("VIEW_SCALE_UNAFFIRMED", klass, kind, row, placement.viewKey));
        continue;
      }

      const plan = setup.plans[row.placementKey];
      if (plan === undefined) {
        observations.push(observe("PLAN_READING_ABSENT", klass, kind, row, placement.sourceEntity));
        continue;
      }

      const read = readOf(plan, kind, row, placement, calibration, setup);
      if (!read.ok) {
        observations.push(observe(read.code, klass, kind, row, placement.sourceEntity));
        continue;
      }

      offers.push(offerOf(read.measurement, kind, row, placement, calibration, setup));
      for (const code of read.observed) observations.push(observe(code, klass, kind, row, placement.sourceEntity));
    }

    return { offers, observations };
  };
}

/** The concrete this area measures: plates, drops, wall storeys, flights and landings (R-TO-032). */
export const slabWallStairConcreteRail: Rail = railFor(RCC_CONCRETE);

/** The formwork the same members are cast against: soffits, edges, faces, risers and strings. */
export const slabWallStairFormworkRail: Rail = railFor(RCC_FORMWORK);
