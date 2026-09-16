/**
 * The mechanics the slab, shear-wall and stair rails, their twelve formula methods and the lines they
 * publish are graded on (R-TO-032, L-MEA-09/AM-02, AM-06 §3/§4, L-FRM-02/03, L-MEA-02/03, L-QTY-04/06).
 *
 * Mechanics only — nothing here judges the product. The database, the accounts, the pinned set
 * revision, the campaign and its edition all come from the stages the register, the sets and the gate
 * already run on (`../../gate/support/gate-stage`): one invariant, one home (B-17, ARCH-02). What this
 * file adds is what THESE rails need beyond a campaign — the plan readings `RailSetup.plans` carries,
 * the register rows they are keyed to, the two fixtures' transcriptions, and the reads a criterion
 * checks the published lines with.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not written
 * yet fails as an assertion naming it rather than as a collection death that reads as a defect in the
 * acceptance. Every type of a not-yet-written surface is a loose local shape, so this file typechecks
 * against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one this increment's goal, its interfaces,
 * its test contract or its acceptance criteria publish. What this file DECLARES — the module homes,
 * the reading shapes and the call shapes — is the public test contract the held-out set is measured
 * against too (C-04): a Builder who reads only this file and the spec can pass every case.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it from
 * the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { goldenRows as goldenRowsOf } from "../../../golden/support/golden-fixture";
import {
  COLUMN_C1,
  MEASURED,
  QUANTITY_LINES_TABLE,
  RAIL_OBSERVATIONS_TABLE,
  REPO_ROOT,
  VECTOR,
  closeStage,
  field,
  gateSeam,
  methodsRegistry,
  productModule,
  refusals,
  registerSeam,
  rowsOfCampaign,
  stageCampaign,
  storeRows,
  type GateSeam,
  type MethodPairShape,
  type MethodsRegistry,
  type RegisterScope,
  type StagedCampaign,
  type StoreRow,
  type VerdictShape,
} from "../../gate/support/gate-stage";

export {
  MEASURED,
  QUANTITY_LINES_TABLE,
  RAIL_OBSERVATIONS_TABLE,
  REPO_ROOT,
  VECTOR,
  closeStage,
  field,
  gateSeam,
  methodsRegistry,
  productModule,
  refusals,
  rowsOfCampaign,
  storeRows,
};
export type { GateSeam, MethodPairShape, MethodsRegistry, RegisterScope, StagedCampaign, StoreRow, VerdictShape };

export { DEFAULT_GOLDEN_FIXTURE, goldenDocument, goldenRows, type GoldenRow } from "../../../golden/support/golden-fixture";

/* ------------------------------------------------------------------ the homes the spec names */

/** The two rails, their rule ids and their closed code roster (interfaces). */
export const SLAB_WALL_STAIR_RAIL_MODULE = "src/modules/takeoff/rails/slab-wall-stair/index.ts";

/** The SLABS area's roster, the composition law, and the barrel that composes every area's. */
export const SLABS_RAILS_MODULE = "src/modules/takeoff/rails/slabs.ts";
export const RAILS_MODULE = "src/modules/takeoff/rails/index.ts";
export const RAILS_LAW_MODULE = "src/modules/takeoff/rails/law.ts";

/** The rail↔gate contract, which gains `PlanReadingSetup`, `RailSetup.plans` and `PLAN_MEMBERS`. */
export const OFFERS_CONTRACT_MODULE = "src/core/offers/contract.ts";

/** The gate half this leaf lands: the channel→variable map the gate binds a deducted sum through. */
export const GATE_DEDUCTIONS_MODULE = "src/core/gate/deductions.ts";

/** The measure setup that ships `plans` as an empty seam until the plan reader lands (interfaces). */
export const MEASURE_SETUP_MODULE = "src/modules/takeoff/measure/setup.ts";

/** This area's refusal shard and its method shard (interfaces, AC-8). */
export const SLABS_ERRORS_MODULE = "src/core/errors/slabs.ts";
export const SLABS_METHODS_MODULE = "src/core/rulesets/methods/registry/slabs.ts";

/** The unit canon — the one home a band, a sum and a carried reading are figured in (B-07, B-17). */
export const UNITS_MODULE = "src/core/units/canon.ts";

/** The two fixtures a band is taken over (test contract: declared fixtures). */
export const BNBC_MODEL = join("fixtures", "rcc6-bnbc", "model.json");
export const RCC6_INPUTS = join("fixtures", "rcc6", "inputs.json");

/** The fixture ids `goldenRows` reads a golden takeoff under (AM-01). */
export const BNBC_FIXTURE = "rcc6-bnbc";
export const RCC6_FIXTURE = "rcc6";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The two kinds these rails answer (goal, interfaces). */
export const RCC_CONCRETE = "rcc.concrete";
export const RCC_FORMWORK = "rcc.formwork";

/** The three classes they measure (goal). */
export const SLAB = "slab";
export const SHEAR_WALL = "shear_wall";
export const STAIR = "stair";

/** The twelve rules, exactly as `SLAB_WALL_STAIR_RULE_IDS` spells them (interfaces). */
export const RULE = Object.freeze({
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

/** Every rule version this leaf puts in force — "every rule version is 1" (interfaces). */
export const RULE_VERSION = "1";

/** The twelve pairs a campaign's edition must cite for these rules to resolve (interfaces). */
export const SLAB_WALL_STAIR_PAIRS: readonly MethodPairShape[] = Object.freeze(
  Object.values(RULE).map((ruleId) => Object.freeze({ ruleId, version: RULE_VERSION })),
) as readonly MethodPairShape[];

/** The five plan members `PLAN_MEMBERS` names (interfaces). */
export const SLAB_PANEL = "SLAB_PANEL";
export const SLAB_DROP = "SLAB_DROP";
export const STAIR_FLIGHT = "STAIR_FLIGHT";
export const STAIR_LANDING = "STAIR_LANDING";
export const WALL_RUN = "WALL_RUN";

/** How a junction stands under L-QTY-04: read, bounded only, or unbounded (interfaces). */
export const RESOLVED = "RESOLVED";
export const BOUNDED = "BOUNDED";
export const UNBOUNDED = "UNBOUNDED";

/** The states a SLAB_PANEL reading states about itself (interfaces, L-MEA-03, L-FRM-03). */
export const CLOSED = "CLOSED";
export const OPEN = "OPEN";
export const FRAMED = "FRAMED";
export const GROUND = "GROUND";

/** The shapes a stair reading states (interfaces, goal). */
export const STRAIGHT = "STRAIGHT";
export const COMPLEX = "COMPLEX";
export const RECT = "RECT";

/** The geometries the twelve methods stand in (L-FRM-01/02). */
export const AREA_THICK = "AREA_THICK";
export const PRISM_RECT = "PRISM_RECT";
export const TAPER_LINEAR = "TAPER_LINEAR";

/** The codes this leaf names by hand (interfaces, AC-5, AC-6, AC-8). */
export const JUNCTION_DEFERRED = "JUNCTION_DEFERRED";
export const JUNCTION_UNBOUNDED = "JUNCTION_UNBOUNDED";
export const COMPLEX_STAIR_GEOMETRY = "COMPLEX_STAIR_GEOMETRY";
export const PLAN_READING_ABSENT = "PLAN_READING_ABSENT";
export const OUTLINE_NOT_CLOSED = "OUTLINE_NOT_CLOSED";
export const SECTION_BAND_UNCOVERED = "SECTION_BAND_UNCOVERED";
export const VIEW_SCALE_UNAFFIRMED = "VIEW_SCALE_UNAFFIRMED";
export const OFFER_NOT_TO_CONTRACT = "OFFER_NOT_TO_CONTRACT";

/** The five codes `src/core/errors/slabs.ts` registers (interfaces, AC-8). */
export const SLABS_SHARD_CODES: readonly string[] = Object.freeze([
  JUNCTION_DEFERRED,
  JUNCTION_UNBOUNDED,
  COMPLEX_STAIR_GEOMETRY,
  PLAN_READING_ABSENT,
  OUTLINE_NOT_CLOSED,
]);

/** The one deduction channel a slab partitions, and the variable the gate binds its sum into. */
export const OPENING_CHANNEL = "opening";
export const OPENINGS_VARIABLE = "openings";

/** The two sides the gate's partition records a candidate on (L-MEA-02). */
export const DEDUCTED = "deducted";
export const KEPT = "kept";

/** L-QTY-01's bases these readings and the gate's own binding carry (test contract). */
export const TRANSCRIBED = "TRANSCRIBED";
export const DERIVED = "DERIVED";

/** L-MEA-07's standing a storey height stands at when every current reading agrees. */
export const AGREED = "AGREED";

/** L-MEA-07's standing a level nobody read a height for stands at. */
export const NONE = "NONE";

/** L-QTY-02's coverage a fully measured row publishes under. */
export const COMPLETE = "COMPLETE";

/** L-QTY-06's band: three per cent under a competent manual takeoff, and never a unit over. */
export const UNDER_TOLERANCE = "0.97";

/* ------------------------------------------------------------------ the shapes the rails answer in */

/** One reading, as the setup and an offer carry one (`Measure`, `ReadingSetup`). */
export type MeasureShape = { value: string; unit: string; basis: string; source: string; calibration?: string };

/** How a junction stands, with the reading it stands at where it stands at one (interfaces). */
export type JunctionReadingShape = { reading: MeasureShape; standing: "RESOLVED" | "BOUNDED" } | { reading: null; standing: "UNBOUNDED" };

/** The five plan readings `RailSetup.plans` carries, keyed by placement key (interfaces). */
export type PlanReadingShape =
  | {
      member: typeof SLAB_PANEL;
      outline: string;
      bearing: string;
      area: MeasureShape;
      members: JunctionReadingShape;
      beamSoffit: JunctionReadingShape;
      freeEdge: MeasureShape;
      thickness: MeasureShape;
      thickness2: MeasureShape | null;
      openings: readonly MeasureShape[];
    }
  | { member: typeof SLAB_DROP; length: MeasureShape; breadth: MeasureShape; height: MeasureShape }
  | { member: typeof STAIR_FLIGHT; shape: string; sloped: MeasureShape; width: MeasureShape; waist: MeasureShape; going: MeasureShape; rise: MeasureShape; risers: MeasureShape }
  | { member: typeof STAIR_LANDING; shape: string; area: MeasureShape; thickness: MeasureShape }
  | { member: typeof WALL_RUN; length: MeasureShape; thickness: MeasureShape; contact: MeasureShape; ends: MeasureShape };

/** One deduction candidate a rail offers (`DeductionCandidate`). */
export type DeductionCandidateShape = { channel: string; measure: MeasureShape };

/** One offer, as these rails hand one to the gate (`Offer`). */
export type OfferShape = {
  ruleId: string;
  kind: string;
  class: string;
  register: { setRevisionId: string; objectKey: string };
  drawing: { drawingId: string; viewKey: string };
  engine: string;
  geometry: { type: string; basis: string; calibration?: string };
  bindings: Record<string, MeasureShape>;
  selectors: Record<string, MeasureShape>;
  deductions: readonly DeductionCandidateShape[];
  omitted: readonly { variable: string; code: string }[];
  coverage: string;
};

/** One observation a rail reports beside its offers (`RailObservation`). */
export type RailObservationShape = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> };

/** What a rail answers with (`RailBatch`). */
export type RailBatchShape = { offers: readonly OfferShape[]; observations: readonly RailObservationShape[] };

/** One placement of the read-only setup, keyed by its placement key (`PlacementSetup`). */
export type PlacementSetup = { drawingId: string; ingestId: string; viewKey: string; memberFamily: string | null; engine: string; sourceEntity: string };

/** One member-type variant of a family, as the schedules registry recorded it (`MemberVariantSetup`). */
export type VariantSetup = {
  variantKey: string;
  bandFrom: string | null;
  bandTo: string | null;
  sectionText: string;
  sectionWidth: number | null;
  sectionDepth: number | null;
  sectionUnit: string | null;
  sourceKeys: readonly string[];
};

/** How one level's storey height stands in the setup (`StoreyHeightSetup`). */
export type HeightSetup = { standing: string; value: string | null; unit: string | null; basis: string | null; sourceKey: string | null };

/** One level of the setup's stack (`LevelSetup`). */
export type LevelSetup = { levelId: string; label: string; ordinal: number; height: HeightSetup };

/** The read-only setup a rail is handed, widened by this leaf with `plans` (interfaces: `RailSetup`). */
export type RailSetupShape = {
  placements: Record<string, PlacementSetup>;
  memberTypes: Record<string, Record<string, readonly VariantSetup[]>>;
  levels: readonly LevelSetup[];
  calibrations: Record<string, Record<string, string>>;
  grades: Record<string, MeasureShape>;
  /** The plan readings this leaf's rails measure from, by placement key (interfaces). */
  plans: Record<string, PlanReadingShape>;
  /** The adjacent area's seams, carried because one setup serves every rail (L-MEA-08). */
  runs: Record<string, unknown>;
  lintels: Record<string, unknown>;
};

/** What a rail is asked (`RailInput`). */
export type RailInputShape = { campaignId: string; setRevisionId: string; kind: string; objects: readonly Record<string, unknown>[]; setup: RailSetupShape };

/** A rail: a pure function of what it was handed (L-MEA-08). */
export type RailShape = (input: RailInputShape) => RailBatchShape;

/** The rails' door, as this acceptance drives it (interfaces). */
export type SlabWallStairDoor = {
  slabWallStairConcreteRail: RailShape;
  slabWallStairFormworkRail: RailShape;
  SLAB_WALL_STAIR_RULE_IDS: Readonly<Record<string, string>>;
  SLAB_WALL_STAIR_RAIL_CODES: readonly string[];
};

/** One implementation the registry maps a pair to (`MethodImplementation`). */
export type FormulaMethodShape = {
  role: string;
  ruleId: string;
  version: string;
  kind: string;
  dimension: string;
  variables: readonly { name: string; dimension: string }[];
  deductionChannels: readonly string[];
  template: string;
  evaluate: (bindings: Record<string, unknown>) => string;
};

/** An exact decimal, as the canon answers one — arbitrary precision from the drawing to the page. */
export type Exact = {
  add: (other: Exact | string | number) => Exact;
  sub: (other: Exact | string | number) => Exact;
  mul: (other: Exact | string | number) => Exact;
  div: (other: Exact | string | number) => Exact;
  eq: (other: Exact | string | number) => boolean;
  lte: (other: Exact | string | number) => boolean;
  toString: () => string;
};

/** The unit canon, as this acceptance asks it what a reading is worth (B-17). */
export type Canon = {
  exact: (value: string | number) => Exact;
  convert: (value: string, from: string, to: string) => { ok: boolean; value?: string; code?: string };
  CANONICAL_UNIT: Readonly<Record<string, string>>;
};

/* ------------------------------------------------------------------ loading the doors */

/** The unit canon. */
export async function canon(): Promise<Canon> {
  return productModule<Canon>(UNITS_MODULE);
}

/** The two rails, with the four names their home publishes asserted before they are driven. */
export async function slabWallStairDoor(): Promise<SlabWallStairDoor> {
  const door = await productModule<Record<string, unknown>>(SLAB_WALL_STAIR_RAIL_MODULE);
  for (const rail of ["slabWallStairConcreteRail", "slabWallStairFormworkRail"]) {
    expect(typeof door[rail], `${SLAB_WALL_STAIR_RAIL_MODULE} publishes \`${rail}\` — a pure rail this increment lands (interfaces)`).toBe("function");
  }
  expect(
    door["SLAB_WALL_STAIR_RULE_IDS"] !== null && typeof door["SLAB_WALL_STAIR_RULE_IDS"] === "object",
    `${SLAB_WALL_STAIR_RAIL_MODULE} publishes \`SLAB_WALL_STAIR_RULE_IDS\` — the twelve rules, in one home (interfaces)`,
  ).toBe(true);
  expect(
    Array.isArray(door["SLAB_WALL_STAIR_RAIL_CODES"]),
    `${SLAB_WALL_STAIR_RAIL_MODULE} publishes \`SLAB_WALL_STAIR_RAIL_CODES\` as a list — the rail-local closed code roster (interfaces)`,
  ).toBe(true);
  return door as unknown as SlabWallStairDoor;
}

/** The kind→rail roster the measure job runs, composed by the barrel (interfaces). */
export async function railsRoster(): Promise<Record<string, RailShape>> {
  const door = await productModule<Record<string, unknown>>(RAILS_MODULE);
  const rails = door["RAILS"];
  expect(rails !== null && typeof rails === "object", `${RAILS_MODULE} publishes \`RAILS\` — the roster the measure job runs (interfaces)`).toBe(true);
  return rails as Record<string, RailShape>;
}

/** The barrel's two composition doors (interfaces: `enumerateRails`, `composeRails`). */
export type RailsLaw = {
  enumerateRails: (areas: readonly Record<string, RailShape>[]) => Record<string, RailShape>;
  composeRails: (rails: readonly RailShape[]) => RailShape;
};

export async function railsLaw(): Promise<RailsLaw> {
  const door = await productModule<Record<string, unknown>>(RAILS_LAW_MODULE);
  for (const call of ["enumerateRails", "composeRails"]) {
    expect(typeof door[call], `${RAILS_LAW_MODULE} publishes \`${call}\` — how two areas answering one kind are composed (interfaces)`).toBe("function");
  }
  return door as unknown as RailsLaw;
}

/** This area's rail roster, as its own file declares it (interfaces: `SLABS_RAILS`). */
export async function slabsRails(): Promise<Record<string, RailShape>> {
  const door = await productModule<Record<string, unknown>>(SLABS_RAILS_MODULE);
  const roster = door["SLABS_RAILS"];
  expect(roster !== null && typeof roster === "object", `${SLABS_RAILS_MODULE} publishes \`SLABS_RAILS\` — this area's kinds and rails (interfaces)`).toBe(true);
  return roster as Record<string, RailShape>;
}

/** The contract's plan-member roster, read from its one home (interfaces: `PLAN_MEMBERS`). */
export async function planMembers(): Promise<readonly string[]> {
  const door = await productModule<Record<string, unknown>>(OFFERS_CONTRACT_MODULE);
  expect(Array.isArray(door["PLAN_MEMBERS"]), `${OFFERS_CONTRACT_MODULE} publishes \`PLAN_MEMBERS\` as a list — the reading vocabulary this leaf ships (interfaces)`).toBe(true);
  return door["PLAN_MEMBERS"] as readonly string[];
}

/** The gate's channel→variable map (interfaces: `CHANNEL_VARIABLE`). */
export async function channelVariable(): Promise<Readonly<Record<string, string>>> {
  const door = await productModule<Record<string, unknown>>(GATE_DEDUCTIONS_MODULE);
  const map = door["CHANNEL_VARIABLE"];
  expect(
    map !== null && typeof map === "object",
    `${GATE_DEDUCTIONS_MODULE} publishes \`CHANNEL_VARIABLE\` — which declared variable each channel's deducted sum is bound into (interfaces)`,
  ).toBe(true);
  return map as Readonly<Record<string, string>>;
}

/** This area's refusal shard, read from its one home (interfaces: `SLABS_REFUSALS`). */
export async function slabsRefusals(): Promise<Readonly<Record<string, { code: string; severity: string; surface: string }>>> {
  const door = await productModule<Record<string, unknown>>(SLABS_ERRORS_MODULE);
  const group = door["SLABS_REFUSALS"];
  expect(group !== null && typeof group === "object", `${SLABS_ERRORS_MODULE} publishes \`SLABS_REFUSALS\` — this area's registered refusals (interfaces)`).toBe(true);
  return group as Readonly<Record<string, { code: string; severity: string; surface: string }>>;
}

/** One of this leaf's twelve methods, read from the registry by its pair (interfaces). */
export async function methodOf(ruleId: string): Promise<FormulaMethodShape> {
  const registry = await methodsRegistry();
  const implementation = registry.implementationOf({ ruleId, version: RULE_VERSION });
  expect(
    implementation,
    `the registry maps ${ruleId}@${RULE_VERSION} to an implementation — an edition cites the pair and the gate resolves it through the registry (interfaces)`,
  ).toBeTruthy();
  return implementation as unknown as FormulaMethodShape;
}

/* ------------------------------------------------------------------ building the readings */

/** The source entity a hand-built plan reading provenances to. */
export const PLAN_SOURCE = "S-201:e:7";

/** The schedule cell a section is read from, and the sheet a storey height is read from. */
export const SECTION_SOURCE = "S-202:e:11";
export const HEIGHT_SOURCE = "S-205:e:3";

/** One reading of the setup, spelled once so a case names only what it changes. */
export function reading(value: string, unit: string, options: { basis?: string; source?: string } = {}): MeasureShape {
  return { value, unit, basis: options.basis ?? MEASURED, source: options.source ?? PLAN_SOURCE };
}

/** A junction the reader read outright — the figure is the reading (L-QTY-04). */
export function resolved(value: string, unit: string, options: { basis?: string; source?: string } = {}): JunctionReadingShape {
  return { reading: reading(value, unit, options), standing: RESOLVED };
}

/** A junction the reading could only BOUND — deducted at its bound, and the figure then under. */
export function bounded(value: string, unit: string, options: { basis?: string; source?: string } = {}): JunctionReadingShape {
  return { reading: reading(value, unit, options), standing: BOUNDED };
}

/** A junction with no bound at all — a hard block, never a disclosure (L-QTY-04). */
export function unbounded(): JunctionReadingShape {
  return { reading: null, standing: UNBOUNDED };
}

/** One SLAB_PANEL reading, with only what a case changes named beside it. */
export function slabPanel(o: {
  outline?: string;
  bearing?: string;
  area: MeasureShape;
  members?: JunctionReadingShape;
  beamSoffit?: JunctionReadingShape;
  freeEdge: MeasureShape;
  thickness: MeasureShape;
  thickness2?: MeasureShape | null;
  openings?: readonly MeasureShape[];
}): PlanReadingShape {
  return {
    member: SLAB_PANEL,
    outline: o.outline ?? CLOSED,
    bearing: o.bearing ?? FRAMED,
    area: o.area,
    members: o.members ?? resolved("0", "m2"),
    beamSoffit: o.beamSoffit ?? resolved("0", "m2"),
    freeEdge: o.freeEdge,
    thickness: o.thickness,
    thickness2: o.thickness2 ?? null,
    openings: o.openings ?? [],
  };
}

/** One SLAB_DROP reading — the drop walls a sunken panel carries. */
export function slabDrop(o: { length: MeasureShape; breadth: MeasureShape; height: MeasureShape }): PlanReadingShape {
  return { member: SLAB_DROP, length: o.length, breadth: o.breadth, height: o.height };
}

/** One STAIR_FLIGHT reading. */
export function stairFlight(o: {
  shape?: string;
  sloped: MeasureShape;
  width: MeasureShape;
  waist: MeasureShape;
  going: MeasureShape;
  rise: MeasureShape;
  risers: MeasureShape;
}): PlanReadingShape {
  return { member: STAIR_FLIGHT, shape: o.shape ?? STRAIGHT, sloped: o.sloped, width: o.width, waist: o.waist, going: o.going, rise: o.rise, risers: o.risers };
}

/** One STAIR_LANDING reading. */
export function stairLanding(o: { shape?: string; area: MeasureShape; thickness: MeasureShape }): PlanReadingShape {
  return { member: STAIR_LANDING, shape: o.shape ?? RECT, area: o.area, thickness: o.thickness };
}

/** One WALL_RUN reading. */
export function wallRun(o: { length: MeasureShape; thickness: MeasureShape; contact: MeasureShape; ends: MeasureShape }): PlanReadingShape {
  return { member: WALL_RUN, length: o.length, thickness: o.thickness, contact: o.contact, ends: o.ends };
}

/** One member-type variant, with the section a schedule stated over the band it heads. */
export function variant(o: {
  variantKey: string;
  width: number | null;
  depth?: number | null;
  unit?: string | null;
  bandFrom?: string | null;
  bandTo?: string | null;
  sourceKeys?: readonly string[];
}): VariantSetup {
  return {
    variantKey: o.variantKey,
    bandFrom: o.bandFrom ?? null,
    bandTo: o.bandTo ?? null,
    sectionText: `${String(o.width)}x${String(o.depth ?? o.width)}`,
    sectionWidth: o.width,
    sectionDepth: o.depth === undefined ? o.width : o.depth,
    sectionUnit: o.unit === undefined ? "mm" : o.unit,
    sourceKeys: o.sourceKeys ?? [SECTION_SOURCE],
  };
}

/* ------------------------------------------------------------------ staging a campaign */

/** One level a case names: its label, where it physically stands, and the storey height in force. */
export type StagedLevel = { label: string; ordinal: number; height: string | null; unit?: string };

/** One register object a case staged, with the key the register minted for it (L-REG-04). */
export type PlanObject = { objectKey: string; placementKey: string; levelId: string; levelLabel: string; row: Record<string, unknown> };

/** Everything a criterion of this increment is driven against. */
export type SlabWallStairCampaign = StagedCampaign & {
  /** The levels this case named, in the order it named them. */
  stack: readonly StagedLevel[];
  /** The surrogate level id each named label stands under. */
  levelIds: Readonly<Record<string, string>>;
  /** Every plan object registered on this campaign, in registration order. */
  objects: PlanObject[];
};

/** One plan reading a case or a fixture states, with the register row it is to be keyed to. */
export type PlanDraft = { placementKey: string; elementType: string; mark: string; level: string; reading: PlanReadingShape };

/**
 * A campaign whose pinned edition cites this leaf's twelve pairs, over the levels a case names.
 *
 * The stack is carried in the SETUP rather than authored by acts, exactly as the column rail's own
 * stage carries it: a rail reads `setup.levels` and nothing else, and a case that needs a level BELOW
 * the ground floor (AC-3's B1) cannot be expressed by a stage whose first level already stands at
 * ordinal 0. The standing, the value, the unit and the source are the level model's own vocabulary
 * (L-MEA-07), so what a rail is handed here is what `railSetupOf` hands it in production.
 */
export async function stageSlabWallStairCampaign(
  label: string,
  levels: readonly StagedLevel[],
  options: { methods?: readonly MethodPairShape[] } = {},
): Promise<SlabWallStairCampaign> {
  const staged = await stageCampaign(label, { methods: options.methods ?? SLAB_WALL_STAIR_PAIRS, objects: 0 });
  const levelIds: Record<string, string> = {};
  for (const level of levels) levelIds[level.label] = surrogateUuid(`${staged.campaignId}:level:${level.label}`);
  return { ...staged, stack: levels, levelIds, objects: [] };
}

/**
 * Every plan draft, registered on the staged campaign through the register's own door (L-REG-01).
 *
 * A draft's `placementKey` is the case's OWN name for the sighting: it is what the sighting's position
 * is derived from, so two drafts that name themselves differently can never quantise onto one lattice
 * point and be refused DUPLICATE_IDENTITY. What comes back is the key the REGISTER minted, which is
 * what `setup.plans` is keyed by — a test never mints a key of its own (L-REG-04).
 */
export async function registerPlanObjects(staged: SlabWallStairCampaign, drafts: readonly PlanDraft[]): Promise<{ objects: PlanObject[]; plans: Record<string, PlanReadingShape> }> {
  const register = await registerSeam();
  const keys: { draft: PlanDraft; objectKey: string }[] = [];

  for (const draft of drafts) {
    const levelId = staged.levelIds[draft.level];
    expect(levelId, `the case named the level ${draft.level} when it staged its campaign — a row stands on a level the stack holds`).toBeTruthy();
    const at = lattice(draft.placementKey);
    const answer = await register.registerSighting(staged.registerScope, {
      ...COLUMN_C1,
      elementType: draft.elementType,
      label: draft.placementKey,
      mark: draft.mark,
      x: at.x,
      y: at.y,
      level: { levelId: String(levelId) },
    });
    expect(field(answer, "registered", "registered"), `the ${draft.elementType} sighting ${draft.placementKey} registered: ${JSON.stringify(answer)}`).toBe(true);
    keys.push({ draft, objectKey: String(field(answer, "objectKey", "object_key")) });
  }

  const rows = (await register.registerObjectsOf(staged.registerScope)) as unknown as Record<string, unknown>[];
  const byKey = new Map(rows.map((row) => [String(row["objectKey"]), row]));
  const objects: PlanObject[] = [];
  const plans: Record<string, PlanReadingShape> = {};
  for (const { draft, objectKey } of keys) {
    const row = byKey.get(objectKey);
    expect(row, `the register holds the row it answered for ${draft.placementKey}`).toBeTruthy();
    const held = row as Record<string, unknown>;
    const object: PlanObject = {
      objectKey,
      placementKey: String(held["placementKey"]),
      levelId: String(staged.levelIds[draft.level]),
      levelLabel: draft.level,
      row: held,
    };
    objects.push(object);
    staged.objects.push(object);
    plans[object.placementKey] = draft.reading;
  }
  return { objects, plans };
}

/** One plan draft, registered — the singular form of `registerPlanObjects`. */
export async function registerPlanObject(staged: SlabWallStairCampaign, draft: PlanDraft): Promise<PlanObject> {
  const { objects } = await registerPlanObjects(staged, [draft]);
  return objects[0] as PlanObject;
}

/** A position on the register's own lattice, derived from a case's name for the sighting. */
function lattice(name: string): { x: number; y: number } {
  const digest = createHash("sha256").update(name).digest();
  return { x: 1000 + digest.readUInt32BE(0) / 1000, y: 250 + digest.readUInt32BE(4) / 1000 };
}

/** A stable surrogate uuid for a name — a level id is a surrogate and says nothing else (L-REG-02). */
export function surrogateUuid(name: string): string {
  const hex = createHash("sha256").update(name).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** The one drawing, ingest record and calibration every staged case reads its plans under. */
export const DRAWING_ID = "5b1e2c70-8f31-4a62-9d04-0c2f11110001";
export const INGEST_ID = "5b1e2c70-8f31-4a62-9d04-0c2f11110002";
export const CALIBRATION_KEY = "cal-slab-wall-stair";

/**
 * The read-only setup the staged rows are measured against: one placement per registered row, the
 * plan readings a case states, the level stack it named, and one affirmed calibration for the view
 * the placements were read in.
 */
export function setupWith(
  staged: SlabWallStairCampaign,
  o: {
    plans: Record<string, PlanReadingShape>;
    memberTypes?: Record<string, Record<string, readonly VariantSetup[]>>;
    levels?: readonly StagedLevel[];
    affirmed?: boolean;
    placements?: Record<string, PlacementSetup>;
  },
): RailSetupShape {
  const placements: Record<string, PlacementSetup> = {};
  const views: Record<string, string> = {};
  for (const object of staged.objects) {
    const viewKey = String(object.row["viewKey"]);
    placements[object.placementKey] = {
      drawingId: DRAWING_ID,
      ingestId: INGEST_ID,
      viewKey,
      memberFamily: String(object.row["mark"]),
      engine: VECTOR,
      sourceEntity: object.placementKey,
    };
    views[viewKey] = CALIBRATION_KEY;
  }
  return {
    placements: o.placements ?? placements,
    memberTypes: o.memberTypes ?? {},
    levels: (o.levels ?? staged.stack).map((level) => levelSetup(level, staged.levelIds[level.label] ?? surrogateUuid(level.label))),
    calibrations: o.affirmed === false ? {} : { [INGEST_ID]: views },
    grades: {},
    plans: o.plans,
    runs: {},
    lintels: {},
  };
}

/** One level of the setup — AGREED at the height a case stated, standing at NONE where it stated none. */
export function levelSetup(level: StagedLevel, levelId: string): LevelSetup {
  return {
    levelId,
    label: level.label,
    ordinal: level.ordinal,
    height:
      level.height === null
        ? { standing: NONE, value: null, unit: null, basis: null, sourceKey: null }
        : { standing: AGREED, value: level.height, unit: level.unit ?? "m", basis: TRANSCRIBED, sourceKey: `${HEIGHT_SOURCE}:${level.label}` },
  };
}

/** One rail input over a staged campaign's own rows (interfaces: `RailInput`). */
export function railInput(staged: SlabWallStairCampaign, kind: string, setup: RailSetupShape, objects?: readonly Record<string, unknown>[]): RailInputShape {
  return {
    campaignId: staged.campaignId,
    setRevisionId: staged.setRevisionId,
    kind,
    objects: objects ?? staged.objects.map((object) => object.row),
    setup,
  };
}

/* ------------------------------------------------------------------ reading what the gate published */

/** Every quantity line of one kind this campaign published. */
export function linesOf(staged: SlabWallStairCampaign, kind: string): StoreRow[] {
  return rowsOfCampaign(QUANTITY_LINES_TABLE, staged.tenantId, staged.campaignId).filter((row) => String(field(row, "kind", "kind")) === kind);
}

/** The lines one register object carries of one kind — at most one, by the store's own natural key. */
export function linesFor(staged: SlabWallStairCampaign, kind: string, objectKey: string): StoreRow[] {
  return linesOf(staged, kind).filter((row) => String(field(row, "objectKey", "object_key")) === objectKey);
}

/** The one line a criterion expects for an object, asserted to be exactly one. */
export function oneLine(staged: SlabWallStairCampaign, kind: string, objectKey: string, what: string): StoreRow {
  const found = linesFor(staged, kind, objectKey);
  expect(found.length, `${what} — the campaign holds ${found.length} ${kind} lines for ${objectKey}: ${JSON.stringify(found.map((row) => field(row, "ruleId", "rule_id")))}`).toBe(1);
  return found[0] as StoreRow;
}

/** One line's column under either spelling, as text. */
export function said(row: StoreRow, camel: string, snake: string): string {
  return String(field(row, camel, snake));
}

/** One line's json column under either spelling. */
export function carried<T>(row: StoreRow, camel: string, snake: string): T {
  return field(row, camel, snake) as T;
}

/** Every rail observation this campaign recorded. */
export function observationsOf(staged: SlabWallStairCampaign): StoreRow[] {
  return rowsOfCampaign(RAIL_OBSERVATIONS_TABLE, staged.tenantId, staged.campaignId);
}

/* ------------------------------------------------------------------ exact decimal arithmetic */

/** An exact sum of decimal figures, through the canon — never through a binary float. */
export function sumOf(values: readonly string[], units: Canon): string {
  let total: Exact = units.exact("0");
  for (const value of values) total = total.add(units.exact(value));
  return total.toString();
}

/** Move a decimal figure by `places` powers of ten, exactly (a unit change is never a float divide). */
export function shift(value: string, places: number): string {
  const negative = value.startsWith("-");
  const bare = negative ? value.slice(1) : value;
  const dot = bare.indexOf(".");
  const digits = dot < 0 ? bare : bare.slice(0, dot) + bare.slice(dot + 1);
  let point = (dot < 0 ? bare.length : dot) + places;
  let whole = digits;
  while (point <= 0) {
    whole = `0${whole}`;
    point += 1;
  }
  while (point > whole.length) whole = `${whole}0`;
  return `${negative ? "-" : ""}${`${whole.slice(0, point)}.${whole.slice(point)}`.replace(/\.$/u, "")}`;
}

/** A figure a fixture wrote in millimetres, as an exact decimal number of metres. */
export function asMetres(millimetres: string): string {
  return shift(millimetres, -3);
}

/** A figure a fixture wrote in square millimetres, as an exact decimal number of square metres. */
export function asSquareMetres(squareMillimetres: string): string {
  return shift(squareMillimetres, -6);
}

/* ------------------------------------------------------------------ F-RCC6-BNBC */

/** A fixture's own text, read from the checkout. */
function fixtureJson<T>(relative: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as T;
}

/** One member of F-RCC6-BNBC's authored model, as its own facts are written. */
type BnbcMember = {
  id: string;
  class: string;
  mark: string;
  level: string;
  geom: string;
  poly?: readonly (readonly string[])[];
  holes?: readonly { kind: string; area: string; outside?: boolean }[];
  t?: string;
  t2?: string;
  slope?: string;
  area?: string;
  col_deduct?: string;
  beam_soffit?: string;
  free_edge?: string;
  sunken?: boolean;
  on_ground?: boolean;
  length?: string;
  beam_ends?: readonly string[];
  sloped?: string;
  width?: string;
  waist?: string;
  tread?: string;
  rise_total?: string;
  risers?: number;
};

export type BnbcModel = { levels: Readonly<Record<string, string>>; members: readonly BnbcMember[] };

/** F-RCC6-BNBC's authored model, whole. */
export function bnbcModel(): BnbcModel {
  const model = fixtureJson<BnbcModel>(BNBC_MODEL);
  expect(Array.isArray(model.members), `${BNBC_MODEL} states the members the fixture was authored from`).toBe(true);
  return model;
}

/** The elevation label the model files its foundation level under. */
export const BNBC_FOUNDATION_ELEVATION = "PCTOP";

/**
 * The stack F-RCC6-BNBC is authored over, each level's storey height DERIVED from the elevations the
 * model states: a storey height is the rise to the level physically above, so the stack is read off
 * `levels` in elevation order rather than transcribed as a table of numbers (L-MEA-07, B-19). The
 * level the members call FDN stands at the pile-cap top, which is what the model calls `PCTOP`.
 */
export function bnbcStack(units: Canon): StagedLevel[] {
  const model = bnbcModel();
  const named = Object.entries(model.levels)
    .map(([label, elevation]) => ({ label, elevation }))
    .sort((left, right) => Number(left.elevation) - Number(right.elevation));
  const stack: StagedLevel[] = [];
  for (let at = 0; at < named.length - 1; at += 1) {
    const here = named[at] as { label: string; elevation: string };
    const above = named[at + 1] as { label: string; elevation: string };
    stack.push({
      label: here.label === BNBC_FOUNDATION_ELEVATION ? "FDN" : here.label,
      ordinal: at,
      height: asMetres(units.exact(above.elevation).sub(units.exact(here.elevation)).toString()),
    });
  }
  return stack;
}

/** The perimeter of a closed plan polygon, in millimetres — exact on an axis-aligned edge. */
export function perimeterMm(poly: readonly (readonly string[])[], units: Canon): string {
  let total: Exact = units.exact("0");
  for (let at = 0; at < poly.length; at += 1) {
    const here = poly[at] as readonly string[];
    const next = poly[(at + 1) % poly.length] as readonly string[];
    const dx = units.exact(String(next[0])).sub(units.exact(String(here[0])));
    const dy = units.exact(String(next[1])).sub(units.exact(String(here[1])));
    const straight = dx.eq(0) ? dy : dy.eq(0) ? dx : null;
    total = total.add(straight === null ? units.exact(Math.hypot(Number(dx.toString()), Number(dy.toString())).toFixed(9)) : units.exact(straight.toString().replace("-", "")));
  }
  return total.toString();
}

/**
 * F-RCC6-BNBC's SLAB, SHEAR_WALL and STAIR members at the levels named, TRANSCRIBED into plan readings
 * from each member's OWN facts, exactly as AC-7 spells the transcription. Millimetres are carried as
 * the model wrote them (`mm`); an area written in square millimetres is carried as an exact number of
 * square metres. A sunken panel yields a second draft — its drop walls, keyed `<id>#drop`.
 */
export function bnbcPlans(levels: readonly string[], units: Canon): PlanDraft[] {
  const wanted = new Set(levels);
  const drafts: PlanDraft[] = [];

  for (const member of bnbcModel().members) {
    if (!wanted.has(member.level)) continue;
    const at = { basis: TRANSCRIBED, source: `${BNBC_MODEL}#${member.id}` };
    const scaled = (squareMillimetres: string): string => units.exact(asSquareMetres(squareMillimetres)).mul(units.exact(member.slope ?? "1")).toString();

    if (member.class === "SLAB") {
      drafts.push({
        placementKey: member.id,
        elementType: SLAB,
        mark: member.mark,
        level: member.level,
        reading: slabPanel({
          bearing: member.on_ground === true ? GROUND : FRAMED,
          area: reading(scaled(String(member.area)), "m2", at),
          members: resolved(scaled(String(member.col_deduct)), "m2", at),
          beamSoffit: resolved(scaled(String(member.beam_soffit)), "m2", at),
          freeEdge: reading(asMetres(String(member.free_edge)), "m", at),
          thickness: reading(String(member.t), "mm", at),
          thickness2: member.t2 === undefined ? null : reading(member.t2, "mm", at),
          openings: (member.holes ?? []).filter((hole) => hole.outside !== true).map((hole) => reading(asSquareMetres(hole.area), "m2", at)),
        }),
      });
      if (member.sunken === true && member.poly !== undefined) {
        drafts.push({
          placementKey: `${member.id}#drop`,
          elementType: SLAB,
          mark: member.mark,
          level: member.level,
          reading: slabDrop({
            length: reading(asMetres(perimeterMm(member.poly, units)), "m", at),
            breadth: reading(BNBC_DROP_BREADTH_MM, "mm", at),
            height: reading(units.exact(BNBC_DROP_DEPTH_MM).sub(units.exact(String(member.t))).toString(), "mm", at),
          }),
        });
      }
      continue;
    }

    if (member.class === "SHEAR_WALL") {
      drafts.push({
        placementKey: member.id,
        elementType: SHEAR_WALL,
        mark: member.mark,
        level: member.level,
        reading: wallRun({
          length: reading(asMetres(String(member.length)), "m", at),
          thickness: reading(String(member.t), "mm", at),
          contact: reading("0", "m2", at),
          ends: reading(sumOf((member.beam_ends ?? []).map(asSquareMetres), units), "m2", at),
        }),
      });
      continue;
    }

    if (member.class === "STAIR") {
      drafts.push(
        member.geom === "FLIGHT"
          ? {
              placementKey: member.id,
              elementType: STAIR,
              mark: member.mark,
              level: member.level,
              reading: stairFlight({
                sloped: reading(asMetres(String(member.sloped)), "m", at),
                width: reading(asMetres(String(member.width)), "m", at),
                waist: reading(String(member.waist), "mm", at),
                going: reading(String(member.tread), "mm", at),
                rise: reading(asMetres(String(member.rise_total)), "m", at),
                risers: reading(String(member.risers), "pcs", at),
              }),
            }
          : {
              placementKey: member.id,
              elementType: STAIR,
              mark: member.mark,
              level: member.level,
              reading: stairLanding({ area: reading(asSquareMetres(String(member.area)), "m2", at), thickness: reading(String(member.t), "mm", at) }),
            },
      );
    }
  }
  return drafts;
}

/** The drop a sunken panel is set down by, and the wall that carries it down (AC-7's transcription). */
export const BNBC_DROP_DEPTH_MM = "300";
export const BNBC_DROP_BREADTH_MM = "125";

/* ------------------------------------------------------------------ F-RCC6 v1.1 */

/** One entry of F-RCC6's own inputs, as the fixture writes a slab. */
type Rcc6Slab = {
  level: string;
  thickness_mm: number;
  measured: { plate_m2: string; columns_m2: string; openings_m2: string; beam_soffit_m2: string; free_edge_m: string };
};

type Rcc6Inputs = { levels: readonly { name: string; storey_height_m: number }[]; slab: readonly Rcc6Slab[]; openings: Readonly<Record<string, readonly number[]>> };

/** F-RCC6 v1.1's own inputs, whole. */
export function rcc6Inputs(): Rcc6Inputs {
  const inputs = fixtureJson<Rcc6Inputs>(RCC6_INPUTS);
  expect(Array.isArray(inputs.slab), `${RCC6_INPUTS} states the slab plate F-RCC6 was authored over`).toBe(true);
  return inputs;
}

/**
 * F-RCC6's slab openings at one level, read from the `openings` RECTANGLES the fixture states.
 *
 * Each rectangle is `[x, y, width, height]` in millimetres. Which of them pierces which level is the
 * fixture's own naming: a rectangle NAMED after a level of the stack belongs to that level alone, and
 * a rectangle named after no level is a shaft piercing every level that no rectangle of its own names.
 */
export function rcc6OpeningsAt(level: string, units: Canon): { name: string; areaM2: string }[] {
  const inputs = rcc6Inputs();
  const stack = new Set(inputs.levels.map((held) => held.name.toUpperCase()));
  const areaOf = (rectangle: readonly number[]): string =>
    units.exact(asMetres(String(rectangle[2]))).mul(units.exact(asMetres(String(rectangle[3])))).toString();

  const named = Object.entries(inputs.openings).filter(([name]) => name.toUpperCase() === level.toUpperCase());
  const chosen = named.length > 0 ? named : Object.entries(inputs.openings).filter(([name]) => !stack.has(name.toUpperCase()));
  return chosen.map(([name, rectangle]) => ({ name, areaM2: areaOf(rectangle) }));
}

/** F-RCC6's `slab[]`, TRANSCRIBED into SLAB_PANEL readings exactly as AC-8 spells it. */
export function rcc6SlabPlans(units: Canon): PlanDraft[] {
  return rcc6Inputs().slab.map((slab) => {
    const at = { basis: TRANSCRIBED, source: `${RCC6_INPUTS}#slab:${slab.level}` };
    return {
      placementKey: `RCC6-SLAB@${slab.level}`,
      elementType: SLAB,
      mark: "S1",
      level: slab.level,
      reading: slabPanel({
        bearing: FRAMED,
        area: reading(slab.measured.plate_m2, "m2", at),
        members: resolved(slab.measured.columns_m2, "m2", at),
        beamSoffit: resolved(slab.measured.beam_soffit_m2, "m2", at),
        freeEdge: reading(slab.measured.free_edge_m, "m", at),
        thickness: reading(String(slab.thickness_mm), "mm", at),
        openings: rcc6OpeningsAt(slab.level, units).map((opening) => reading(opening.areaM2, "m2", at)),
      }),
    };
  });
}

/** The stack F-RCC6's slabs stand on — its own levels, with the storey height the fixture states. */
export function rcc6Stack(): StagedLevel[] {
  return rcc6Inputs().levels.map((level, ordinal) => ({ label: level.name, ordinal, height: String(level.storey_height_m) }));
}

/* ------------------------------------------------------------------ the golden band */

/** How a golden takeoff spells a product class: upper case, with the dot as an underscore. */
export function fixtureSpelling(value: string): string {
  return value.toUpperCase().replace(/\./gu, "_");
}

/**
 * How a golden takeoff spells one of the two kinds these rails answer.
 *
 * The goldens name a concrete row RCC_CONCRETE and a formed-face row FORMWORK — the second is NOT the
 * product's `rcc.formwork` shouted, so the pairing is stated here rather than derived from the product
 * spelling (AC-7: "kind RCC_CONCRETE ↔ rcc.concrete, FORMWORK ↔ rcc.formwork").
 */
export const GOLDEN_KIND: Readonly<Record<string, string>> = Object.freeze({ [RCC_CONCRETE]: "RCC_CONCRETE", [RCC_FORMWORK]: "FORMWORK" });

/** Every golden row of one fixture at one (class, kind, level), over all of its components. */
export function goldenRowsAt(fixtureId: string, klass: string, kind: string, level: string): { quantity: string; component?: string }[] {
  const wanted = { class: fixtureSpelling(klass), kind: GOLDEN_KIND[kind] ?? fixtureSpelling(kind) };
  return goldenRowsOf(fixtureId).filter((row) => row.class === wanted.class && row.kind === wanted.kind && row.level === level);
}

/** The exact sum of a fixture's golden quantities at one (class, kind, level) — G (L-QTY-06). */
export function goldenSum(fixtureId: string, klass: string, kind: string, level: string, units: Canon): string {
  return sumOf(goldenRowsAt(fixtureId, klass, kind, level).map((row) => row.quantity), units);
}

/**
 * How finely G may be compared with at all, on EITHER side.
 *
 * A golden row is PUBLISHED rounded — `65.979`, never the exact figure the authored model computed —
 * so the takeoff L-QTY-06 names as the yardstick and the string the fixture stores differ by up to
 * half a unit in each row's own last printed place, in whichever direction that row's print rounded.
 * The band is therefore taken against the record plus and minus its own typography: a delta smaller
 * than the transcript's half-unit cannot be distinguished from the transcript's rounding, so it is not
 * over-measurement (arbitration on this file). Anything beyond it still is, and B-07 forbids the other
 * cure — the product's figures are never rounded to the golden's precision to make this pass. The
 * allowance is derived from the golden strings ALONE, never from the product's figures (L-QTY-06, "an
 * input may never be derived from the figure it is compared against"), and accumulates one half-unit
 * per contributing golden row, so a golden republished at more decimals tightens it by itself (B-19).
 */
export function goldenPrintingAllowance(fixtureId: string, klass: string, kind: string, level: string, units: Canon): string {
  return sumOf(
    goldenRowsAt(fixtureId, klass, kind, level).map((row) => {
      const dot = row.quantity.indexOf(".");
      return shift("5", -((dot < 0 ? 0 : row.quantity.length - dot - 1) + 1));
    }),
    units,
  );
}

/**
 * Is an exact published sum inside L-QTY-06's band around a golden figure?
 *
 * `0.97 × G − allowance ≤ S ≤ G + allowance`: three per cent under the golden's exact row sum, and
 * never over it, each side widened by the golden's own printed half-unit and by nothing else. A sum
 * above that ceiling is over-measurement and a hard block (L-QTY-04) — no missed deduction, unbanded
 * storey or gross face lives inside half a unit of the last printed place.
 */
export function insideBand(sum: string, golden: string, allowance: string, units: Canon): boolean {
  const published = units.exact(sum);
  const owed = units.exact(golden);
  const slack = units.exact(allowance);
  return owed.mul(units.exact(UNDER_TOLERANCE)).sub(slack).lte(published) && published.lte(owed.add(slack));
}
