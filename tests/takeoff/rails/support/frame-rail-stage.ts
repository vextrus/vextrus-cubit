/**
 * The mechanics the FRAME area's beam, tie-beam and lintel rails, their methods and the kind they
 * measure are graded on (R-TO-032, L-MEA-08, L-MEA-09, L-FRM-02/03, L-QTY-02/06).
 *
 * Mechanics only — nothing here judges the product. It sits beside `column-rail-stage`, which builds
 * the same register row, member-type variant, level standing and rail input for the column rail, and
 * adds what a FRAME rail needs beyond a column's: the `runs` and `lintels` of the read-only setup,
 * the six rule ids, the second kind, and the fixture readings a criterion reconciles against.
 *
 * WHY THE FOUR SHARED BUILDERS ARE SPELLED HERE RATHER THAN IMPORTED. `column-rail-stage` reaches
 * the live-database harness through the gate's stage, and this tree computes its test LANES from the
 * import graph (`scripts/lib/pg-suites.mjs`): a file that imports it is collected by the database
 * lane, whatever it does. The frame rails are PURE functions, and the test contract runs their cases
 * in the unit lane, so the pure half of this stage must reach no database — the four builders are
 * the same shapes, spelled once here for the lane that must open no cluster. The database half of
 * this acceptance lives in `rcc6-stage`, which is where a live campaign belongs.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one this increment's goal, its interfaces,
 * its test contract or its acceptance criteria publish. What this file DECLARES — the module homes,
 * the setup shape and the call shapes — is the public test contract the held-out set is measured
 * against too (B-12): a Builder who reads only the spec and this file can pass every case.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { goldenRows } from "../../../golden/support/golden-fixture";
import { REPO_ROOT, productModule } from "../../../server/support/wire";

export { REPO_ROOT, goldenRows, productModule };

/* ------------------------------------------------------------------ the homes the spec names */

/** The area's rails, whole: the six per-class rails and the two compositions (interfaces). */
export const FRAME_RAIL_MODULE = "src/modules/takeoff/rails/frame/index.ts";

/** The area's roster file, which the barrel enumerates into `RAILS` (interfaces, AM-11). */
export const FRAME_ROSTER_MODULE = "src/modules/takeoff/rails/frame.ts";

/** The roster the measure job runs (interfaces). */
export const RAILS_MODULE = "src/modules/takeoff/rails/index.ts";

/** The catalogue's homes the new kind enters (AC-1, interfaces). */
export const KINDS_MODULE = "src/core/catalogue/kinds.ts";
export const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";
export const MAPS_MODULE = "src/core/catalogue/maps.ts";
export const BEARS_MODULE = "src/core/catalogue/bears.ts";
export const KIND_LAW_MODULE = "src/core/catalogue/kind-law.ts";

/** The method registry, the shard the six methods are recorded in, and their module home (AC-2). */
export const METHODS_REGISTRY_MODULE = "src/core/rulesets/methods/registry.ts";
export const FRAME_SHARD = "src/core/rulesets/methods/frame/frame.methods.json";
export const FRAME_METHOD_DIR = "src/core/rulesets/methods/frame/";

/** The toolchain stage that verifies a shard's digest (AC-2, test contract). */
export const METHOD_HASHES_SCRIPT = "scripts/method-hashes.mjs";

/** The seed whose platform edition is re-minted (AC-2). */
export const SEED_MODULE = "src/core/rulesets/seed/index.ts";

/** The closed refusal register the rail's codes join (interfaces). */
export const ERRORS_MODULE = "src/core/errors.ts";

/** The exact-decimal canon a band, a sum and a carried reading are figured in (B-07). */
export const UNITS_MODULE = "src/core/units/canon.ts";

/** The partition's placement law, whose prefix table this leaf widens (AC-3, interfaces). */
export const PLACEMENT_LAW_MODULE = "src/modules/takeoff/partition/placement/law.ts";

/** The rail↔gate contract, which gains `RailSetup.runs` and `RailSetup.lintels` (interfaces). */
export const OFFERS_CONTRACT_MODULE = "src/core/offers/contract.ts";

/** The inputs the fixture was authored from (test contract). */
export const INPUTS_FIXTURE = join("fixtures", "rcc6", "inputs.json");

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The two kinds the frame area measures, in the order the catalogue states them (AC-1). */
export const RCC_CONCRETE = "rcc.concrete";
export const RCC_FORMWORK = "rcc.formwork";
export const FRAME_KINDS: readonly string[] = Object.freeze([RCC_CONCRETE, RCC_FORMWORK]);

/** The classes this leaf measures, beside the column it composes with (goal). */
export const COLUMN_CLASS = "column";
export const BEAM_CLASS = "beam";
export const TIE_BEAM_CLASS = "tie_beam";
export const LINTEL_CLASS = "lintel";

/** The six rules the frame rails offer under, with no version anywhere on an offer (goal, AC-2). */
export const BEAM_CONCRETE_RULE_ID = "rcc.beam.concrete";
export const BEAM_FORMWORK_RULE_ID = "rcc.beam.formwork";
export const TIE_BEAM_CONCRETE_RULE_ID = "rcc.tie_beam.concrete";
export const TIE_BEAM_FORMWORK_RULE_ID = "rcc.tie_beam.formwork";
export const LINTEL_CONCRETE_RULE_ID = "rcc.lintel.concrete";
export const LINTEL_FORMWORK_RULE_ID = "rcc.lintel.formwork";

/** The rule the column rail offers under, which `frameConcreteRail` keeps as its first member. */
export const COLUMN_CONCRETE_RULE_ID = "rcc.column.concrete";

/** The version the re-minted edition puts each of them in force at (AC-2, AC-5). */
export const FRAME_VERSION = "1";

/** One (rule id, version), as the registry is asked for a method by (L-MEA-01). */
export type MethodPairShape = { ruleId: string; version: string };

/** The six pairs this leaf records, each with the kind and class it measures (AC-2). */
export const FRAME_PAIRS: readonly { pair: MethodPairShape; kind: string; class: string }[] = Object.freeze([
  { pair: { ruleId: BEAM_CONCRETE_RULE_ID, version: FRAME_VERSION }, kind: RCC_CONCRETE, class: BEAM_CLASS },
  { pair: { ruleId: BEAM_FORMWORK_RULE_ID, version: FRAME_VERSION }, kind: RCC_FORMWORK, class: BEAM_CLASS },
  { pair: { ruleId: TIE_BEAM_CONCRETE_RULE_ID, version: FRAME_VERSION }, kind: RCC_CONCRETE, class: TIE_BEAM_CLASS },
  { pair: { ruleId: TIE_BEAM_FORMWORK_RULE_ID, version: FRAME_VERSION }, kind: RCC_FORMWORK, class: TIE_BEAM_CLASS },
  { pair: { ruleId: LINTEL_CONCRETE_RULE_ID, version: FRAME_VERSION }, kind: RCC_CONCRETE, class: LINTEL_CLASS },
  { pair: { ruleId: LINTEL_FORMWORK_RULE_ID, version: FRAME_VERSION }, kind: RCC_FORMWORK, class: LINTEL_CLASS },
]);

/** The three codes a frame rail reports rather than guesses under (AC-4, interfaces). */
export const RUN_UNREAD = "RUN_UNREAD";
export const SLAB_THICKNESS_UNSTATED = "SLAB_THICKNESS_UNSTATED";
export const LINTEL_SOURCE_ABSENT = "LINTEL_SOURCE_ABSENT";

/** The dimensions this leaf's methods stand in (AC-1, AC-2). */
export const VOLUME = "VOLUME";
export const AREA = "AREA";
export const LENGTH = "LENGTH";
export const COUNT_DIMENSION = "COUNT";

/** The canonical unit of AREA, and the unit a count is read in (AC-1, AC-4). */
export const SQUARE_METRES = "m2";
export const PIECES = "pcs";

/** The unit a run, a side and a section are read in (AC-3, AC-4). */
export const MILLIMETRES = "mm";

/** The geometry a beam, tie beam or lintel instance is offered as (AC-4, interfaces). */
export const PRISM_RECT = "PRISM_RECT";

/** L-QTY-02's two coverages this leaf publishes under (AC-4). */
export const COMPLETE = "COMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The bases L-QTY-01 orders by recourse that this leaf's readings carry (AC-3, AC-4, AC-8). */
export const MEASURED = "MEASURED";
export const TRANSCRIBED = "TRANSCRIBED";
export const DERIVED = "DERIVED";

/** The standing a level's storey height stands in where a reading was authored (L-MEA-07). */
export const AGREED = "AGREED";

/** The engine a vector drawing is read by (L-CAD-01). */
export const VECTOR = "VECTOR";

/** L-QTY-06's band: three per cent under a competent manual takeoff, and never a unit over. */
export const UNDER_TOLERANCE = "0.97";

/** How the golden spells the two frame classes and the two kinds (test contract). */
export const GOLDEN_BEAM = "BEAM";
export const GOLDEN_TIE_BEAM = "TIE_BEAM";
export const GOLDEN_CONCRETE = "RCC_CONCRETE";
export const GOLDEN_FORMWORK = "FORMWORK";

/** The label a line whose register object stands on no level is grouped under (test contract). */
export const FOUNDATION_LABEL = "FDN";

/* ------------------------------------------------------------------ the shapes a rail answers in */

/** One reading, as an offer carries one (`Measure`). */
export type MeasureShape = { value: string; unit: string; basis: string; source: string; calibration?: string };

/** One declared variable a PARTIAL_DECLARED offer leaves out, with the code it is omitted under. */
export type OmittedShape = { variable: string; code: string };

/** One offer, as a frame rail hands one to the gate (`Offer`). */
export type OfferShape = {
  ruleId: string;
  kind: string;
  class: string;
  register: { setRevisionId: string; objectKey: string };
  drawing: { drawingId: string; viewKey: string };
  engine: string;
  geometry: { type: string; basis: string; calibration: string };
  bindings: Record<string, MeasureShape>;
  selectors: Record<string, MeasureShape>;
  deductions: readonly { channel: string; measure: MeasureShape }[];
  omitted: readonly OmittedShape[];
  coverage: string;
};

/** One observation a rail reports beside its offers (`RailObservation`). */
export type RailObservationShape = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> };

/** What a rail answers with (`RailBatch`). */
export type RailBatchShape = { offers: readonly OfferShape[]; observations: readonly RailObservationShape[] };

/** One placement of the read-only setup, keyed by its placement key (`RailSetup.placements`). */
export type PlacementSetup = { drawingId: string; ingestId: string; viewKey: string; memberFamily: string | null; engine: string; sourceEntity: string };

/** One member-type variant of a family, as the schedules registry recorded it (`RailSetup`). */
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

/** How one level's storey height stands in the setup (L-MEA-07). */
export type HeightSetup = { standing: string; value: string | null; unit: string | null; basis: string | null; sourceKey: string | null };

/** One level of the setup's stack (`RailSetup.levels`). */
export type LevelSetup = { levelId: string; label: string; ordinal: number; height: HeightSetup };

/** One reading of the read-only setup (interfaces: `ReadingSetup`). */
export type ReadingSetup = { value: string; unit: string; basis: string; source: string };

/** One placement's run: the clear axis between its supports, and the slab each side adjoins. */
export type RunSetup = { clear: ReadingSetup | null; sides: readonly [ReadingSetup | null, ReadingSetup | null] };

/** One placement's lintel, as an opening schedule states one (interfaces: `LintelSetup`). */
export type LintelSetup = { count: ReadingSetup; b: ReadingSetup; D: ReadingSetup; w: ReadingSetup; bearing: ReadingSetup };

/** The read-only setup a frame rail is handed beside the register's rows (interfaces: `RailSetup`). */
export type RailSetupShape = {
  placements: Record<string, PlacementSetup>;
  memberTypes: Record<string, Record<string, readonly VariantSetup[]>>;
  levels: readonly LevelSetup[];
  calibrations: Record<string, Record<string, string>>;
  grades: Record<string, MeasureShape>;
  runs: Record<string, RunSetup>;
  lintels: Record<string, LintelSetup>;
};

/** What a rail is asked (`RailInput`, widened by this leaf with `runs` and `lintels`). */
export type FrameRailInputShape = { campaignId: string; setRevisionId: string; kind: string; objects: readonly Record<string, unknown>[]; setup: RailSetupShape };

/** A rail: a pure function of what it was handed (L-MEA-08). */
export type FrameRailShape = (input: FrameRailInputShape) => RailBatchShape;

/** The door the six rails and the two compositions are published from (interfaces). */
export type FrameRailDoor = {
  frameConcreteRail: FrameRailShape;
  frameFormworkRail: FrameRailShape;
  beamConcreteRail: FrameRailShape;
  beamFormworkRail: FrameRailShape;
  tieBeamConcreteRail: FrameRailShape;
  tieBeamFormworkRail: FrameRailShape;
  lintelConcreteRail: FrameRailShape;
  lintelFormworkRail: FrameRailShape;
  FRAME_RULE_IDS: Readonly<Record<string, string>>;
  FRAME_RAIL_CODES: readonly string[];
};

/** The method the registry maps a pair to (AC-2). */
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

/* ------------------------------------------------------------------ loading the doors */

/** The frame rails, with the names their home publishes asserted before any of them is driven. */
export async function frameRailDoor(): Promise<FrameRailDoor> {
  const door = await productModule<Record<string, unknown>>(FRAME_RAIL_MODULE);
  for (const name of [
    "frameConcreteRail",
    "frameFormworkRail",
    "beamConcreteRail",
    "beamFormworkRail",
    "tieBeamConcreteRail",
    "tieBeamFormworkRail",
    "lintelConcreteRail",
    "lintelFormworkRail",
  ]) {
    expect(typeof door[name], `${FRAME_RAIL_MODULE} publishes \`${name}\` — one of the pure rails this increment lands (interfaces)`).toBe("function");
  }
  expect(Array.isArray(door["FRAME_RAIL_CODES"]), `${FRAME_RAIL_MODULE} publishes \`FRAME_RAIL_CODES\` as a list — the area's closed code roster (interfaces)`).toBe(true);
  return door as unknown as FrameRailDoor;
}

/** The area's roster, keyed by kind, as `RAILS` enumerates it (interfaces, AM-11). */
export async function frameRoster(): Promise<Record<string, FrameRailShape>> {
  const door = await productModule<Record<string, unknown>>(FRAME_ROSTER_MODULE);
  const roster = door["FRAME_RAILS"];
  expect(roster !== null && typeof roster === "object", `${FRAME_ROSTER_MODULE} publishes \`FRAME_RAILS\` — the area's roster (interfaces)`).toBe(true);
  return roster as Record<string, FrameRailShape>;
}

/** The rail roster the measure job runs, as a map of kind to rail (interfaces). */
export async function railsRoster(): Promise<Record<string, FrameRailShape>> {
  const door = await productModule<Record<string, unknown>>(RAILS_MODULE);
  const rails = door["RAILS"];
  expect(rails !== null && typeof rails === "object", `${RAILS_MODULE} publishes \`RAILS\` — the roster the measure job runs (interfaces)`).toBe(true);
  return rails as Record<string, FrameRailShape>;
}

/** The method registry, as a criterion enumerates and resolves through it (L-MEA-01). */
export async function methodsRegistry(): Promise<{ enumerateMethods: () => readonly MethodPairShape[]; implementationOf: (pair: MethodPairShape) => unknown }> {
  return productModule<{ enumerateMethods: () => readonly MethodPairShape[]; implementationOf: (pair: MethodPairShape) => unknown }>(METHODS_REGISTRY_MODULE);
}

/** One of this leaf's formula methods, read from the registry by its pair (AC-2). */
export async function frameMethod(pair: MethodPairShape): Promise<FormulaMethodShape> {
  const registry = await methodsRegistry();
  const implementation = registry.implementationOf(pair);
  expect(
    implementation,
    `the registry maps ${pair.ruleId}@${pair.version} to an implementation — an edition cites the pair and the gate resolves it through the registry (AC-2)`,
  ).toBeTruthy();
  return implementation as unknown as FormulaMethodShape;
}

/** The canon, as a case adds and compares exact decimals through (B-07). */
export type Decimal = { add: (other: Decimal) => Decimal; mul: (other: Decimal) => Decimal; lte: (other: Decimal) => boolean; lt: (other: Decimal) => boolean; eq: (other: Decimal) => boolean; toString: () => string };

export async function canon(): Promise<{ exact: (value: string | number) => Decimal; CANONICAL_UNIT: Record<string, string> }> {
  return productModule<{ exact: (value: string | number) => Decimal; CANONICAL_UNIT: Record<string, string> }>(UNITS_MODULE);
}

/* ------------------------------------------------------------------ the setup, as a loader answers it */

/** The surrogate revision a hand-built input's rows stand on — a rail never asks a store for it. */
export const SET_REVISION = "11111111-1111-4111-8111-111111111111";

/** The surrogate drawing, ingest, view and level one hand-built case reads (AC-4, AC-7, AC-8). */
export const DRAWING_ID = "22222222-2222-4222-8222-222222222222";
export const INGEST_ID = "33333333-3333-4333-8333-333333333333";
export const VIEW_KEY = "PLAN:S-102:t:4";
export const LEVEL_ID = "44444444-4444-4444-8444-444444444444";
export const CALIBRATION_KEY = "cal-1";
export const SECTION_SOURCE = "S-102:e:7";
export const HEIGHT_SOURCE = "S-105:e:3";

/** The source entity a run stands on — the pair of edge lines the axis was read between (AC-4). */
export const RUN_SOURCE = "S-102:e:41";

/** The two sources the two side readings stand on, so a case can prove `t` carried its OWN one. */
export const SIDE_A_SOURCE = "S-102:e:51";
export const SIDE_B_SOURCE = "S-102:e:52";

/** The schedule the five readings of a lintel are transcribed from (AC-8). */
export const LINTEL_SOURCE = "S-125:e:9";

/** One member-type variant, with the section a schedule stated and the cells it was read from. */
export function variant(options: {
  variantKey?: string;
  width: number | null;
  depth: number | null;
  unit?: string | null;
  sectionText?: string;
  sourceKeys?: readonly string[];
  bandFrom?: string | null;
  bandTo?: string | null;
}): VariantSetup {
  return {
    variantKey: options.variantKey ?? "B1",
    bandFrom: options.bandFrom ?? null,
    bandTo: options.bandTo ?? null,
    sectionText: options.sectionText ?? `${String(options.width)}x${String(options.depth)}`,
    sectionWidth: options.width,
    sectionDepth: options.depth,
    sectionUnit: options.unit === undefined ? MILLIMETRES : options.unit,
    sourceKeys: options.sourceKeys ?? [SECTION_SOURCE],
  };
}

/** One level of the setup whose height stands AGREED at a reading (L-MEA-07). */
export function levelStanding(options: { levelId?: string; label?: string; ordinal?: number; value?: string; unit?: string; basis?: string; sourceKey?: string }): LevelSetup {
  return {
    levelId: options.levelId ?? LEVEL_ID,
    label: options.label ?? "1F",
    ordinal: options.ordinal ?? 1,
    height: { standing: AGREED, value: options.value ?? "3", unit: options.unit ?? "M", basis: options.basis ?? TRANSCRIBED, sourceKey: options.sourceKey ?? HEIGHT_SOURCE },
  };
}

/** One register object row, as the store holds one — what a rail is handed to read (L-REG-01). */
export function registerRow(options: {
  placementKey: string;
  elementType: string;
  mark: string;
  levelId?: string | null;
  setRevisionId?: string;
  viewKey?: string;
  standing?: string;
}): Record<string, unknown> {
  // The instance key's own grammar: a placement key followed by one level segment (L-REG-04); a
  // member standing in the FOUNDATION slot has no level of its own, and its key says so.
  const levelId = options.levelId === undefined ? LEVEL_ID : options.levelId;
  const objectKey = levelId === null ? `${options.placementKey}@FOUNDATION` : `${options.placementKey}@${levelId}`;
  return {
    tenantId: "00000000-0000-4000-8000-000000000001",
    setRevisionId: options.setRevisionId ?? SET_REVISION,
    objectKey,
    projectId: "00000000-0000-4000-8000-000000000002",
    discipline: "STRUCTURAL",
    elementType: options.elementType,
    mark: options.mark,
    viewKey: options.viewKey ?? VIEW_KEY,
    placementKey: options.placementKey,
    levelId,
    levelSlot: levelId === null ? "FOUNDATION" : null,
    levelLabel: null,
    standing: options.standing ?? MEASURED,
    semantic: `semantic:${objectKey}`,
    registeredAt: new Date(0),
  };
}

/** One placement of the setup, as the loader answers one (interfaces: `RailSetup.placements`). */
export function placementSetup(options: { placementKey: string; memberFamily: string | null; viewKey?: string; drawingId?: string; ingestId?: string }): PlacementSetup {
  return {
    drawingId: options.drawingId ?? DRAWING_ID,
    ingestId: options.ingestId ?? INGEST_ID,
    viewKey: options.viewKey ?? VIEW_KEY,
    memberFamily: options.memberFamily,
    engine: VECTOR,
    sourceEntity: options.placementKey,
  };
}

/** The affirmed calibration of the (ingest, view) a hand-built case reads in (AC-4). */
export function affirmedCalibration(viewKey: string = VIEW_KEY): Record<string, Record<string, string>> {
  return { [INGEST_ID]: { [viewKey]: CALIBRATION_KEY } };
}

/** One reading of the setup, spelled once so a case names only what it changes. */
export function setupReading(value: string, options: { unit?: string; basis?: string; source?: string } = {}): ReadingSetup {
  return { value, unit: options.unit ?? MILLIMETRES, basis: options.basis ?? MEASURED, source: options.source ?? RUN_SOURCE };
}

/**
 * One placement's run: the clear axis and the slab thickness each side adjoins, each as the drawing
 * states it or `null` where it states none (test contract: `run(...)`).
 */
export function run(options: { clear: string | null; sides: readonly [string | null, string | null]; unit?: string; source?: string; basis?: string }): RunSetup {
  const unit = options.unit ?? MILLIMETRES;
  const sideSources = [SIDE_A_SOURCE, SIDE_B_SOURCE];
  const sides = options.sides.map((side, at) => (side === null ? null : setupReading(side, { unit, source: sideSources[at] })));
  return {
    clear: options.clear === null ? null : setupReading(options.clear, { unit, source: options.source ?? RUN_SOURCE, basis: options.basis }),
    sides: [sides[0] ?? null, sides[1] ?? null],
  };
}

/**
 * One placement's lintel, as an opening schedule states one: five readings TRANSCRIBED from the
 * schedule, each carrying its own cell (test contract: `lintel(...)`).
 */
export function lintel(options: { count: string; b: string; D: string; w: string; bearing: string; unit?: string }): LintelSetup {
  const unit = options.unit ?? MILLIMETRES;
  const cell = (name: string, value: string, itsUnit: string): ReadingSetup => ({ value, unit: itsUnit, basis: TRANSCRIBED, source: `${LINTEL_SOURCE}:${name}` });
  return {
    count: cell("count", options.count, PIECES),
    b: cell("b", options.b, unit),
    D: cell("D", options.D, unit),
    w: cell("w", options.w, unit),
    bearing: cell("bearing", options.bearing, unit),
  };
}

/** What one hand-built frame rail input is made of, so a case names only what it changes. */
export type FrameRailInputDraft = {
  campaignId?: string;
  setRevisionId?: string;
  kind?: string;
  objects: readonly Record<string, unknown>[];
  placements: Record<string, PlacementSetup>;
  memberTypes?: Record<string, Record<string, readonly VariantSetup[]>>;
  levels?: readonly LevelSetup[];
  calibrations?: Record<string, Record<string, string>>;
  grades?: Record<string, MeasureShape>;
  runs?: Record<string, RunSetup>;
  lintels?: Record<string, LintelSetup>;
};

/** One rail input, whole — the column rail's input widened with the two frame seams (interfaces). */
export function frameRailInput(draft: FrameRailInputDraft): FrameRailInputShape {
  return {
    campaignId: draft.campaignId ?? "00000000-0000-4000-8000-0000000000c1",
    setRevisionId: draft.setRevisionId ?? SET_REVISION,
    kind: draft.kind ?? RCC_CONCRETE,
    objects: draft.objects,
    setup: {
      placements: draft.placements,
      memberTypes: draft.memberTypes ?? {},
      levels: draft.levels ?? [levelStanding({})],
      calibrations: draft.calibrations ?? affirmedCalibration(),
      grades: draft.grades ?? {},
      runs: draft.runs ?? {},
      lintels: draft.lintels ?? {},
    },
  };
}

/** Every key named `version`, anywhere in an offer — an offer states a rule, never a version (AC-4). */
export function versionKeysIn(value: unknown, path = "offer"): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, at) => versionKeysIn(item, `${path}[${String(at)}]`));
  return Object.entries(value as Record<string, unknown>).flatMap(([key, held]) => (key === "version" ? [`${path}.${key}`] : versionKeysIn(held, `${path}.${key}`)));
}

/* ------------------------------------------------------------------ the fixture, read as data */

/** F-RCC6's inputs, as the file states them (test contract: read as data, never typed). */
type Inputs = {
  beams: { mark: string; span_m: number; levels: string[]; measured: { clear_m: Record<string, string>; faces: Record<string, { slab_t_mm: string[]; clear_m: string }[]> } }[];
  tie_beams: { mark: string; span_m: number }[];
};

function inputs(): Inputs {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, INPUTS_FIXTURE), "utf8")) as Inputs;
  expect(Array.isArray(parsed.beams), `${INPUTS_FIXTURE} states the beams F-RCC6 was authored from`).toBe(true);
  expect(Array.isArray(parsed.tie_beams), `${INPUTS_FIXTURE} states the tie beams F-RCC6 was authored from`).toBe(true);
  return parsed;
}

/** The clear run the fixture states for each (beam mark, level), in metres, as written (AC-3). */
export function inputsClearByMarkAndLevel(): Map<string, Map<string, string>> {
  return new Map(inputs().beams.map((beam) => [beam.mark, new Map(Object.entries(beam.measured.clear_m))]));
}

/**
 * The slab thicknesses the fixture states adjoining each (beam mark, level): one entry per distinct
 * pair of sides, with the clear run measured under that pair (AC-3).
 */
export function inputsFacesByMarkAndLevel(): Map<string, Map<string, { slabThicknessMm: readonly string[]; clearMetres: string }[]>> {
  return new Map(
    inputs().beams.map((beam) => [
      beam.mark,
      new Map(Object.entries(beam.measured.faces).map(([level, faces]) => [level, faces.map((face) => ({ slabThicknessMm: face.slab_t_mm, clearMetres: face.clear_m }))])),
    ]),
  );
}

/** The grid-to-grid span the fixture states for each beam and tie-beam mark, in metres (AC-3, AC-7). */
export function inputsSpanByMark(): Map<string, string> {
  const parsed = inputs();
  return new Map([...parsed.beams, ...parsed.tie_beams].map((member) => [member.mark, String(member.span_m)]));
}

/** The levels the fixture states each beam mark stands at (AC-3, AC-5). */
export function inputsBeamLevels(): Map<string, readonly string[]> {
  return new Map(inputs().beams.map((beam) => [beam.mark, beam.levels]));
}

/** The tie-beam marks the fixture states (AC-3). */
export function inputsTieBeamMarks(): readonly string[] {
  return inputs().tie_beams.map((beam) => beam.mark);
}

/**
 * The golden's frame rows by level (test contract: `goldenFrameByLevel`). The fixture spells a class
 * and a kind in its own screaming-snake vocabulary, and the criteria name that spelling, so a row is
 * matched on the pair it is asked for and the roster of levels is the fixture's own (B-19).
 */
export function goldenFrameByLevel(className: string, kind: string): Map<string, string> {
  const rows = goldenRows("rcc6").filter((row) => row.class === className && row.kind === kind);
  expect(rows.length, `fixtures/rcc6/takeoff.golden.json records ${className} × ${kind} rows — the yardstick this criterion reconciles against`).toBeGreaterThan(0);
  return new Map(rows.map((row) => [row.level, row.quantity]));
}
