/**
 * The mechanics the column-concrete rail, its method and the line it publishes are graded on
 * (R-TO-031, L-MEA-08, L-FRM-01/02, L-QTY-01/02/03/06).
 *
 * Mechanics only — nothing here judges the product. The database, the accounts, the ingested corpus,
 * the partition run, the level stack, the pinned revision and the campaign all come from the stages
 * the register, the sets, the placement partition and the gate already run on
 * (`../../gate/support/gate-stage`, `../../partition/support/placement-stage`): one invariant, one
 * home (B-17, ARCH-02). What this file adds is what a RAIL needs beyond a campaign — the read-only
 * setup a rail is handed (placements, member-type variants, level heights, affirmed calibrations,
 * grades), the register rows it reads, and the reads a criterion checks the published lines with.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one this increment's goal, its interfaces,
 * its test contract or its acceptance criteria publish. What this file DECLARES — the module homes,
 * the setup shape and the call shapes — is the public test contract the held-out set is measured
 * against too (B-12): a Builder who reads only this file and the spec can pass every case.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import {
  COLUMN_C1,
  MEASURED,
  QUANTITY_LINES_TABLE,
  QUEUE_ITEMS_TABLE,
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
  unitsSeam,
  type GateSeam,
  type MethodPairShape,
  type MethodsRegistry,
  type RegisterScope,
  type StagedCampaign,
  type StoreRow,
  type VerdictShape,
} from "../../gate/support/gate-stage";

export {
  COLUMN_C1,
  MEASURED,
  QUANTITY_LINES_TABLE,
  QUEUE_ITEMS_TABLE,
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
  stageCampaign,
  storeRows,
  unitsSeam,
};
export type { GateSeam, MethodPairShape, MethodsRegistry, RegisterScope, StagedCampaign, StoreRow, VerdictShape };

/* ------------------------------------------------------------------ the homes the spec names */

/** The rail itself (interfaces): the pure function, its rule id and its closed code roster. */
export const COLUMN_RAIL_MODULE = "src/modules/takeoff/rails/columns/index.ts";

/** The roster the measure job runs, which this leaf's rail joins under its kind (interfaces). */
export const RAILS_MODULE = "src/modules/takeoff/rails/index.ts";

/** The rail↔gate contract, which gains `RailInput.setup` and the offer's `omitted` (interfaces). */
export const OFFERS_CONTRACT_MODULE = "src/core/offers/contract.ts";

/** The formula method and the shard that records it (AC-6). */
export const COLUMN_METHOD_MODULE = "src/core/rulesets/methods/columns/concrete.ts";
export const COLUMN_SHARD = "src/core/rulesets/methods/columns/columns.methods.json";

/** The toolchain stage that verifies a shard's digest (AC-6, test contract). */
export const METHOD_HASHES_SCRIPT = "scripts/method-hashes.mjs";

/** The measure job the vertical slice is driven through, and the loader it builds a setup with. */
export const MEASURE_JOB_MODULE = "src/modules/takeoff/measure/job.ts";

/** The closed refusal register the rail's codes join (interfaces). */
export const ERRORS_MODULE = "src/core/errors.ts";

/** The golden F-RCC6 takeoff, and the inputs the fixture was authored from (test contract). */
export const GOLDEN_FIXTURE = join("fixtures", "rcc6", "takeoff.golden.json");
export const INPUTS_FIXTURE = join("fixtures", "rcc6", "inputs.json");

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The rule this rail offers under, with no version anywhere on the offer (goal, AC-1). */
export const COLUMN_CONCRETE_RULE_ID = "rcc.column.concrete";

/** The version the edition puts in force, and the pair the shard records (AC-2, AC-6). */
export const COLUMN_CONCRETE_VERSION = "1";
export const COLUMN_CONCRETE_PAIR: MethodPairShape = Object.freeze({ ruleId: COLUMN_CONCRETE_RULE_ID, version: COLUMN_CONCRETE_VERSION });

/** The one (class × kind) this rail is keyed on (goal). */
export const COLUMN_CLASS = "column";
export const RCC_CONCRETE = "rcc.concrete";

/** The geometry a column instance is offered as, and the dimension its method stands in (AC-1, AC-6). */
export const PRISM_RECT = "PRISM_RECT";
export const VOLUME = "VOLUME";

/** L-QTY-02's two coverages this leaf publishes under (AC-1, AC-4). */
export const COMPLETE = "COMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The bases L-QTY-01 orders by recourse that this leaf's readings carry (AC-1, AC-3). */
export const TRANSCRIBED = "TRANSCRIBED";
export const DEFAULTED = "DEFAULTED";

/** The codes this leaf names by hand (AC-4, AC-5, interfaces). */
export const STOREY_HEIGHT_UNSTATED = "STOREY_HEIGHT_UNSTATED";
export const VIEW_SCALE_UNAFFIRMED = "VIEW_SCALE_UNAFFIRMED";
export const OFFER_NOT_TO_CONTRACT = "OFFER_NOT_TO_CONTRACT";

/** The three standings a level's storey height stands in (`STOREY_HEIGHT_STANDINGS`, L-MEA-07). */
export const AGREED = "AGREED";
export const NONE = "NONE";

/** The template the method declares and the line renders from (AC-6, L-QTY-03). */
export const COLUMN_TEMPLATE = "V = count × L × B × H";

/** The four variables the method declares, in the order its template names them (AC-6). */
export const COUNT = "count";
export const LENGTH_VARIABLE = "L";
export const BREADTH_VARIABLE = "B";
export const HEIGHT_VARIABLE = "H";

/** The unit a count is read in — the canon's canonical unit of the COUNT dimension (AC-1). */
export const PIECES = "pcs";

/* ------------------------------------------------------------------ the shapes the rail answers in */

/** One reading, as an offer carries one (`Measure`). */
export type MeasureShape = { value: string; unit: string; basis: string; source: string; calibration?: string };

/** One declared variable a PARTIAL_DECLARED offer leaves out, with the code it is omitted under. */
export type OmittedShape = { variable: string; code: string };

/** One offer, as this rail hands one to the gate (`Offer`, AC-1). */
export type ColumnOfferShape = {
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
export type RailBatchShape = { offers: readonly ColumnOfferShape[]; observations: readonly RailObservationShape[] };

/** One placement of the read-only setup, keyed by its placement key (interfaces: `RailSetup`). */
export type PlacementSetup = {
  drawingId: string;
  ingestId: string;
  viewKey: string;
  memberFamily: string | null;
  engine: string;
  sourceEntity: string;
};

/** One member-type variant of a family, as the schedules registry recorded it (interfaces). */
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

/**
 * How one level's storey height stands in the setup: the standing, and the reading it stands at
 * where it stands at one — value, unit, basis and source key, each null under SUSPENDED and NONE
 * (L-MEA-07: a height whose readings disagree, or that nobody read, has no height).
 */
export type HeightSetup = {
  standing: string;
  value: string | null;
  unit: string | null;
  basis: string | null;
  sourceKey: string | null;
};

/** One level of the setup's stack (interfaces: `RailSetup.levels`). */
export type LevelSetup = { levelId: string; label: string; ordinal: number; height: HeightSetup };

/** The read-only setup a rail is handed beside the register's rows (interfaces: `RailSetup`). */
export type RailSetupShape = {
  placements: Record<string, PlacementSetup>;
  memberTypes: Record<string, Record<string, readonly VariantSetup[]>>;
  levels: readonly LevelSetup[];
  /** The affirmed calibration reference of each (ingestId, viewKey) — absent where none is affirmed. */
  calibrations: Record<string, Record<string, string>>;
  /** The concrete grade stated for a drawing, where a reader stated one (scope: a seam, empty here). */
  grades: Record<string, MeasureShape>;
};

/** What a rail is asked (`RailInput`, widened by this leaf with `setup`). */
export type RailInputShape = {
  campaignId: string;
  setRevisionId: string;
  kind: string;
  objects: readonly Record<string, unknown>[];
  setup: RailSetupShape;
};

/** A rail: a pure function of what it was handed (L-MEA-08). */
export type RailShape = (input: RailInputShape) => RailBatchShape;

/** The rail's door, as this acceptance drives it (interfaces). */
export type ColumnRailDoor = {
  columnConcreteRail: RailShape;
  COLUMN_CONCRETE_RULE_ID: string;
  COLUMN_RAIL_CODES: readonly string[];
};

/** The method the registry maps this leaf's pair to (AC-6). */
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

/** The column rail, with the three names its home publishes asserted before it is driven. */
export async function columnRailDoor(): Promise<ColumnRailDoor> {
  const door = await productModule<Record<string, unknown>>(COLUMN_RAIL_MODULE);
  expect(typeof door["columnConcreteRail"], `${COLUMN_RAIL_MODULE} publishes \`columnConcreteRail\` — the pure rail this increment lands (interfaces)`).toBe("function");
  expect(String(door["COLUMN_CONCRETE_RULE_ID"]), `${COLUMN_RAIL_MODULE} publishes \`COLUMN_CONCRETE_RULE_ID\` (interfaces)`).toBe(COLUMN_CONCRETE_RULE_ID);
  expect(Array.isArray(door["COLUMN_RAIL_CODES"]), `${COLUMN_RAIL_MODULE} publishes \`COLUMN_RAIL_CODES\` as a list — the rail-local closed code roster (interfaces)`).toBe(true);
  return door as unknown as ColumnRailDoor;
}

/** The rail roster the measure job runs, as a map of kind to rail (interfaces). */
export async function railsRoster(): Promise<Record<string, RailShape>> {
  const door = await productModule<Record<string, unknown>>(RAILS_MODULE);
  const rails = door["RAILS"];
  expect(rails !== null && typeof rails === "object", `${RAILS_MODULE} publishes \`RAILS\` — the roster the measure job runs (interfaces)`).toBe(true);
  return rails as Record<string, RailShape>;
}

/** The formula method this leaf lands, read from the registry by its pair (AC-6). */
export async function columnConcreteMethod(): Promise<FormulaMethodShape> {
  const registry = await methodsRegistry();
  const implementation = registry.implementationOf(COLUMN_CONCRETE_PAIR);
  expect(
    implementation,
    `the registry maps ${COLUMN_CONCRETE_RULE_ID}@${COLUMN_CONCRETE_VERSION} to an implementation — an edition cites the pair and the gate resolves it through the registry (AC-6)`,
  ).toBeTruthy();
  return implementation as unknown as FormulaMethodShape;
}

/** The rail↔gate contract's rosters, as the widened gate closes over them (AC-3, AC-4). */
export async function offersContract(): Promise<{ QUANTITY_BASES: readonly string[]; COVERAGES: readonly string[]; GEOMETRY_TYPES: readonly string[] }> {
  const door = await productModule<Record<string, unknown>>(OFFERS_CONTRACT_MODULE);
  for (const roster of ["QUANTITY_BASES", "COVERAGES", "GEOMETRY_TYPES"]) {
    expect(Array.isArray(door[roster]), `${OFFERS_CONTRACT_MODULE} publishes \`${roster}\` as a list (interfaces)`).toBe(true);
  }
  return door as unknown as { QUANTITY_BASES: readonly string[]; COVERAGES: readonly string[]; GEOMETRY_TYPES: readonly string[] };
}

/* ------------------------------------------------------------------ the setup, as a loader answers it */

/** One reading of the setup, spelled once so a case names only what it changes. */
export function reading(value: string, unit: string, options: { basis?: string; source?: string; calibration?: string } = {}): MeasureShape {
  const whole: MeasureShape = { value, unit, basis: options.basis ?? MEASURED, source: options.source ?? "S-101:e:1" };
  return options.calibration === undefined ? whole : { ...whole, calibration: options.calibration };
}

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
    variantKey: options.variantKey ?? "C1",
    bandFrom: options.bandFrom ?? null,
    bandTo: options.bandTo ?? null,
    sectionText: options.sectionText ?? `${String(options.width)}x${String(options.depth)}`,
    sectionWidth: options.width,
    sectionDepth: options.depth,
    sectionUnit: options.unit === undefined ? "mm" : options.unit,
    sourceKeys: options.sourceKeys ?? ["S-102:e:7"],
  };
}

/** One level of the setup whose height stands AGREED at a reading. */
export function levelStanding(options: { levelId: string; label: string; ordinal: number; value: string; unit: string; basis?: string; sourceKey: string }): LevelSetup {
  return {
    levelId: options.levelId,
    label: options.label,
    ordinal: options.ordinal,
    height: { standing: AGREED, value: options.value, unit: options.unit, basis: options.basis ?? TRANSCRIBED, sourceKey: options.sourceKey },
  };
}

/** One level nobody has read a storey height for at all (L-MEA-07's NONE, AC-4). */
export function levelUnread(options: { levelId: string; label: string; ordinal: number }): LevelSetup {
  return { ...options, height: { standing: NONE, value: null, unit: null, basis: null, sourceKey: null } };
}

/** One register object row, as the store holds one — what a rail is handed to read (L-REG-01). */
export function registerRow(options: {
  setRevisionId: string;
  projectId?: string;
  tenantId?: string;
  placementKey: string;
  levelId: string;
  viewKey: string;
  mark?: string;
  elementType?: string;
}): Record<string, unknown> {
  // The instance key's own grammar: a placement key followed by one level segment (L-REG-04).
  const objectKey = `${options.placementKey}@${options.levelId}`;
  return {
    tenantId: options.tenantId ?? "00000000-0000-4000-8000-000000000001",
    setRevisionId: options.setRevisionId,
    objectKey,
    projectId: options.projectId ?? "00000000-0000-4000-8000-000000000002",
    discipline: "STRUCTURAL",
    elementType: options.elementType ?? COLUMN_CLASS,
    mark: options.mark ?? "C1",
    viewKey: options.viewKey,
    placementKey: options.placementKey,
    levelId: options.levelId,
    levelSlot: null,
    levelLabel: null,
    standing: MEASURED,
    semantic: `semantic:${objectKey}`,
    registeredAt: new Date(0),
  };
}

/** What one hand-built rail input is made of, so a case names only what it changes. */
export type RailInputDraft = {
  campaignId?: string;
  setRevisionId?: string;
  objects: readonly Record<string, unknown>[];
  placements: Record<string, PlacementSetup>;
  memberTypes?: Record<string, Record<string, readonly VariantSetup[]>>;
  levels: readonly LevelSetup[];
  calibrations?: Record<string, Record<string, string>>;
  grades?: Record<string, MeasureShape>;
};

/** One rail input, whole (interfaces: `RailInput` with its read-only `setup`). */
export function railInput(draft: RailInputDraft): RailInputShape {
  return {
    campaignId: draft.campaignId ?? "00000000-0000-4000-8000-0000000000c1",
    setRevisionId: draft.setRevisionId ?? SET_REVISION,
    kind: RCC_CONCRETE,
    objects: draft.objects,
    setup: {
      placements: draft.placements,
      memberTypes: draft.memberTypes ?? {},
      levels: draft.levels,
      calibrations: draft.calibrations ?? {},
      grades: draft.grades ?? {},
    },
  };
}

/** The surrogate revision a hand-built input's rows stand on — a rail never asks a store for it. */
export const SET_REVISION = "11111111-1111-4111-8111-111111111111";

/** The surrogate drawing, ingest, view, level and placement one hand-built case reads (AC-1). */
export const DRAWING_ID = "22222222-2222-4222-8222-222222222222";
export const INGEST_ID = "33333333-3333-4333-8333-333333333333";
export const VIEW_KEY = "PLAN:S-102:t:4";
export const LEVEL_ID = "44444444-4444-4444-8444-444444444444";
export const PLACEMENT_KEY = "PLACEMENT:S-102:C1:1000:2000";
export const MEMBER_FAMILY = "C1";
export const CALIBRATION_KEY = "cal-1";
export const SECTION_SOURCE = "S-102:e:7";
export const HEIGHT_SOURCE = "S-105:e:3";

/* ------------------------------------------------------------------ the golden fixture */

/** One row of the golden takeoff, as F-RCC6 records one. */
export type GoldenRow = { class: string; kind: string; level: string; quantity: string; unit: string };

/** Every row of the golden takeoff (test contract: fixtures/rcc6/takeoff.golden.json). */
export function goldenRows(): GoldenRow[] {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, GOLDEN_FIXTURE), "utf8")) as { rows: GoldenRow[] };
  expect(Array.isArray(parsed.rows), `${GOLDEN_FIXTURE} records the rows a competent manual takeoff produced`).toBe(true);
  return parsed.rows;
}

/**
 * The golden's column-concrete rows by level. The fixture spells a class and a kind in its own
 * screaming-snake vocabulary, so a row is matched by carrying the product's spelling through the
 * same transliteration rather than by a table of pairs typed here (B-19).
 */
export function goldenColumnConcreteByLevel(): Map<string, string> {
  const wanted = { class: fixtureSpelling(COLUMN_CLASS), kind: fixtureSpelling(RCC_CONCRETE) };
  const rows = goldenRows().filter((row) => row.class === wanted.class && row.kind === wanted.kind);
  expect(rows.length, `${GOLDEN_FIXTURE} records column concrete rows (it records ${goldenRows().length} rows in all)`).toBeGreaterThan(0);
  return new Map(rows.map((row) => [row.level, row.quantity]));
}

/** How the golden spells a product class or kind: upper case, with the dot as an underscore. */
export function fixtureSpelling(value: string): string {
  return value.toUpperCase().replace(/\./gu, "_");
}

/** The levels the fixture's inputs state, with the storey height each was authored at. */
export function fixtureLevels(): { label: string; heightMetres: string }[] {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, INPUTS_FIXTURE), "utf8")) as { levels: { name: string; storey_height_m: number }[] };
  expect(Array.isArray(parsed.levels), `${INPUTS_FIXTURE} states the level stack F-RCC6 was authored over`).toBe(true);
  return parsed.levels.map((level) => ({ label: level.name, heightMetres: String(level.storey_height_m) }));
}

/* ------------------------------------------------------------------ reading what the gate published */

/** Every quantity line of one campaign that this rail's rule published. */
export function columnLinesOf(tenantId: string, campaignId: string): StoreRow[] {
  return rowsOfCampaign(QUANTITY_LINES_TABLE, tenantId, campaignId).filter(
    (row) => String(field(row, "ruleId", "rule_id")) === COLUMN_CONCRETE_RULE_ID && String(field(row, "class", "class")) === COLUMN_CLASS,
  );
}

/** One line's column under either spelling, as text. */
export function said(row: StoreRow, camel: string, snake: string): string {
  return String(field(row, camel, snake));
}

/**
 * A campaign whose pinned edition cites this leaf's method, with `objects` COLUMN INSTANCE rows
 * registered on its revision through the register's own door — the rows a rail reads (L-REG-01).
 *
 * The class is the catalogue's own spelling, because the rail selects the rows of its class and the
 * gate closes a line's class over the same roster (`ELEMENT_TYPES`).
 */
export type ColumnCampaign = StagedCampaign & { rows: Record<string, unknown>[] };

export async function stageColumnCampaign(label: string, options: { objects?: number } = {}): Promise<ColumnCampaign> {
  const staged = await stageCampaign(label, { methods: [COLUMN_CONCRETE_PAIR], objects: 0 });
  const register = await registerSeam();
  const wanted = options.objects ?? 1;
  for (let at = 0; at < wanted; at += 1) {
    const answer = await register.registerSighting(staged.registerScope, {
      ...COLUMN_C1,
      elementType: COLUMN_CLASS,
      label: `${label}-column-${at}`,
      mark: `C${at + 1}`,
      x: 1000 + at * 100,
      level: { levelId: LEVEL_ID },
    });
    expect(field(answer, "registered", "registered"), `the column sighting ${label}-column-${at} registered: ${JSON.stringify(answer)}`).toBe(true);
  }
  const rows = (await register.registerObjectsOf(staged.registerScope)) as unknown as Record<string, unknown>[];
  expect(rows.length, `the staged campaign ${label} carries the column rows the rail reads`).toBe(wanted);
  return { ...staged, rows };
}

/**
 * The setup that describes the staged rows: one placement per row, one member-type variant for the
 * family, one level standing AGREED at a transcribed height, and one affirmed calibration for the
 * (ingest, view) the placements were read in.
 */
export function setupForRows(rows: readonly Record<string, unknown>[], options: { affirmed?: boolean; height?: HeightSetup } = {}): RailSetupShape {
  const placements: Record<string, PlacementSetup> = {};
  for (const row of rows) {
    placements[String(row["placementKey"])] = {
      drawingId: DRAWING_ID,
      ingestId: INGEST_ID,
      viewKey: String(row["viewKey"]),
      memberFamily: MEMBER_FAMILY,
      engine: VECTOR,
      sourceEntity: String(row["placementKey"]),
    };
  }
  const views: Record<string, string> = {};
  for (const placement of Object.values(placements)) views[placement.viewKey] = CALIBRATION_KEY;

  return {
    placements,
    memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [variant({ variantKey: MEMBER_FAMILY, width: 300, depth: 450, sourceKeys: [SECTION_SOURCE] })] } },
    levels: [
      options.height === undefined
        ? levelStanding({ levelId: LEVEL_ID, label: "L1", ordinal: 1, value: "3", unit: "M", sourceKey: HEIGHT_SOURCE })
        : { levelId: LEVEL_ID, label: "L1", ordinal: 1, height: options.height },
    ],
    calibrations: options.affirmed === false ? {} : { [INGEST_ID]: views },
    grades: {},
  };
}
