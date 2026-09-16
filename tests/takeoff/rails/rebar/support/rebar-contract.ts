/**
 * The REBAR shard's public test contract: the module homes, the vocabulary, the shapes and the
 * hand-built rail input every case of this leaf is driven with (R-TO-032, L-FRM-05, AM-01, AM-03,
 * L-BD-02, L-REG-04, L-QTY-02/06).
 *
 * Mechanics only — nothing here judges the product. It opens no database and imports nothing that
 * does, so a PURE case (a rail is a pure function, L-MEA-08) stays in the unit lane; the live
 * campaign the notes and band criteria need is staged beside it in `./rebar-stage.ts`, which
 * re-exports everything here so a caller reads one door.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one this increment's goal, its interfaces,
 * its test contract or its acceptance criteria publish. What this file DECLARES is the public
 * contract the held-out set is measured against too (C-04): a Builder who reads only this file and
 * the spec can pass every case.
 */
import { expect } from "vitest";
import { REPO_ROOT, productModule } from "../../../../server/support/wire";

export { REPO_ROOT, productModule };
export { bbsGoldenDocument, bbsGoldenPath, goldenDocument, goldenRows, type BbsGoldenDocument, type BbsGoldenRow, type GoldenRow } from "../../../../golden/support/golden-fixture";

/* ------------------------------------------------------------------ the homes the spec names */

/** The five method files of the shard, and the shard that records their pairs (interfaces). */
export const REBAR_METHOD_DIR = "src/core/rulesets/methods/rebar";
export const REBAR_SHARD = "src/core/rulesets/methods/rebar/rebar.methods.json";
export const DETAILING_MODULE = "src/core/rulesets/methods/rebar/detailing-bnbc2020-bd.ts";
export const BS8666_MODULE = "src/core/rulesets/methods/rebar/bs8666.ts";
export const STOCK_MODULE = "src/core/rulesets/methods/rebar/stock.ts";
export const SYNTHESIS_MODULE = "src/core/rulesets/methods/rebar/synthesis.ts";
export const MASS_MODULE = "src/core/rulesets/methods/rebar/mass.ts";

/** The registry shard that maps the five pairs, and the barrel every pair is enumerated at. */
export const REBAR_REGISTRY_MODULE = "src/core/rulesets/methods/registry/rebar.ts";
export const METHODS_REGISTRY_MODULE = "src/core/rulesets/methods/registry.ts";

/** The toolchain stage that verifies a shard's digest (AC-1, test contract). */
export const METHOD_HASHES_SCRIPT = "scripts/method-hashes.mjs";

/** The rail itself, the area roster it is published through, and the barrel the job runs. */
export const REBAR_RAIL_MODULE = "src/modules/takeoff/rebar/index.ts";
export const REBAR_ROSTER_MODULE = "src/modules/takeoff/rails/rebar.ts";
export const RAILS_BARREL_MODULE = "src/modules/takeoff/rails/index.ts";

/** The area's refusals and the closed taxonomy they join (interfaces). */
export const REBAR_ERRORS_MODULE = "src/core/errors/rebar.ts";
export const ERRORS_MODULE = "src/core/errors.ts";

/** The catalogue: the kinds, what bears them, and the tables the emitter commits (AC-1). */
export const KINDS_MODULE = "src/core/catalogue/kinds.ts";
export const BEARS_MODULE = "src/core/catalogue/bears.ts";
export const CATALOGUE_DIR = "db/catalogue";

/** The seed rule set, re-minted so a pin puts this leaf's methods in force (AC-1). */
export const SEED_MODULE = "src/core/rulesets/seed/index.ts";

/** The area's own schema file, and the seam every increment's tables are assembled in (AC-1). */
export const SCHEMA_REBAR_MODULE = "src/core/db/schema-rebar.ts";
export const SCHEMA_SEAM_MODULE = "src/core/db/schema.ts";
export const DB_SCHEMA_REBAR_MODULE = "db/schema/rebar.ts";

/** The rail↔gate contract, the setup loader and the job that writes the bar rows (interfaces). */
export const OFFERS_CONTRACT_MODULE = "src/core/offers/contract.ts";
export const MEASURE_SETUP_MODULE = "src/modules/takeoff/measure/setup.ts";
export const MEASURE_JOB_MODULE = "src/modules/takeoff/measure/job.ts";

/** The ONE door the campaign's applied detailing values are read at (inc-303, goal). */
export const NOTES_MODULE = "src/modules/takeoff/notes/index.ts";

/** The exact-decimal canon every figure of this leaf is added up in (B-07). */
export const CANON_MODULE = "src/core/units/canon.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The kind this leaf lands, and what the catalogue says it is measured in (AC-1, interfaces). */
export const RCC_REBAR = "rcc.rebar";
export const MASS = "MASS";
export const KILOGRAMS = "kg";
export const REBAR_PRECISION = 3;

/** The ten classes that bear the kind (AC-1). */
export const REBAR_CLASSES: readonly string[] = Object.freeze([
  "column",
  "beam",
  "tie_beam",
  "slab",
  "footing",
  "pile_cap",
  "pile",
  "shear_wall",
  "stair",
  "lintel",
]);

/** The two classes whose schedule this leaf reads, and the class every band case measures. */
export const COLUMN_CLASS = "column";
export const SHEAR_WALL_CLASS = "shear_wall";

/** One method pair, as the registry keys one (`MethodPair`). */
export type MethodPairShape = { ruleId: string; version: string };

/** The five pairs of the shard, exactly as `rebar.methods.json` records them (interfaces). */
export const DETAILING_EDITION_PAIR: MethodPairShape = Object.freeze({ ruleId: "detailing.BNBC2020_BD", version: "2026.07" });
export const CUTTING_LENGTH_PAIR: MethodPairShape = Object.freeze({ ruleId: "rcc.rebar.cutting_length", version: "1" });
export const STOCK_PAIR: MethodPairShape = Object.freeze({ ruleId: "rcc.rebar.stock", version: "1" });
export const SYNTHESIS_PAIR: MethodPairShape = Object.freeze({ ruleId: "rcc.rebar.synthesis", version: "1" });
export const MASS_PAIR: MethodPairShape = Object.freeze({ ruleId: "rcc.rebar.mass", version: "1" });
export const REBAR_PAIRS: readonly MethodPairShape[] = Object.freeze([DETAILING_EDITION_PAIR, CUTTING_LENGTH_PAIR, STOCK_PAIR, SYNTHESIS_PAIR, MASS_PAIR]);

/** The names the registry shard publishes its five pairs under (interfaces). */
export const PAIR_CONSTANTS: Readonly<Record<string, MethodPairShape>> = Object.freeze({
  DETAILING_EDITION_METHOD: DETAILING_EDITION_PAIR,
  CUTTING_LENGTH_METHOD: CUTTING_LENGTH_PAIR,
  STOCK_METHOD: STOCK_PAIR,
  SYNTHESIS_METHOD: SYNTHESIS_PAIR,
  MASS_METHOD: MASS_PAIR,
});

/** The two roles L-MEA-01 gives a method, and the law every pair of this shard stands under. */
export const RESOLVER_ROLE = "resolver";
export const FORMULA_ROLE = "formula";
export const REBAR_LAW = "L-FRM-05";

/** The edition the detailing pair resolves (interfaces: `DetailingEdition.identity`). */
export const EDITION_NAME = "BNBC2020_BD";
export const EDITION_VERSION = "2026.07";

/** The four codes this leaf names (interfaces: `RebarRefusalCode`), and the one it borrows. */
export const DETAILING_ROW_NOT_IN_EDITION = "DETAILING_ROW_NOT_IN_EDITION";
export const REBAR_SCHEDULE_UNREAD = "REBAR_SCHEDULE_UNREAD";
export const REBAR_TIE_ZONE_UNSTATED = "REBAR_TIE_ZONE_UNSTATED";
export const REBAR_STOREY_RUN_UNSTATED = "REBAR_STOREY_RUN_UNSTATED";
export const NOTE_READING_CONTESTED = "NOTE_READING_CONTESTED";
export const REBAR_CODES: readonly string[] = Object.freeze([DETAILING_ROW_NOT_IN_EDITION, REBAR_SCHEDULE_UNREAD, REBAR_TIE_ZONE_UNSTATED, REBAR_STOREY_RUN_UNSTATED]);

/** The store the bar rows stand in, and the key it holds them under (interfaces, AC-1). */
export const BAR_ROWS_TABLE = "bar_rows";
export const BAR_ROWS_KEY = "bar_rows_key";
export const BAR_ROWS_KEY_COLUMNS: readonly string[] = Object.freeze(["tenant_id", "campaign_id", "bar_key"]);

/** The privileges the app role holds on the bar rows, and nothing else (AC-1). */
export const BAR_ROWS_PRIVILEGES: readonly string[] = Object.freeze(["DELETE", "INSERT", "SELECT"]);

/** The fixture this leaf is proved exact over, and the id it is read under (AM-01). */
export const BNBC_FIXTURE = "F-RCC6-BNBC";
export const BNBC_FIXTURE_ID = "rcc6-bnbc";
export const BNBC_MODEL = "fixtures/rcc6-bnbc/model.json";

/** How the golden spells the class and the kind this leaf's band is read at (test contract). */
export const GOLDEN_COLUMN = "COLUMN";
export const GOLDEN_REBAR = "REBAR";

/** The two components a rebar cell is published in beside each other, never netted (AM-03(a)). */
export const NET = "NET";
export const LAP = "LAP";

/** The roles a synthesised bar stands in (interfaces: `BarSpec.role`). */
export const MAIN = "MAIN";
export const TIE = "TIE";
export const STIRRUP = "STIRRUP";
export const DISTRIBUTION = "DISTRIBUTION";

/** The shape codes BS 8666 is read through here (interfaces: `SHAPE_CODES`). */
export const SHAPE_CODES: readonly string[] = Object.freeze(["00", "11", "21", "51", "SP", "CT", "CRK"]);

/** The stock bar every cutting list is cut from, and the one rounded surface (L-FRM-05, AM-01). */
export const STOCK_BAR_MM = "12000";
export const ROUNDING_MM = 25;

/** L-QTY-01's bases a rebar reading carries (AC-7), and L-QTY-02's two coverages (AC-8). */
export const DERIVED = "DERIVED";
export const TRANSCRIBED = "TRANSCRIBED";
export const COMPLETE = "COMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** L-QTY-06's band: three per cent under a competent manual takeoff, and never a unit over. */
export const UNDER_TOLERANCE = "0.97";

/** The five kinds the notes law reads, as a campaign's applied values are keyed by them (inc-303). */
export const FY = "FY";
export const FC = "FC";
export const LAP_NOTE = "LAP";
export const HOOK = "HOOK";
export const HOOK_MIN = "HOOK_MIN";

/* ------------------------------------------------------------------ the shapes the shard answers in */

/** One reading, as an offer carries one (`Measure`). */
export type MeasureShape = { value: string; unit: string; basis: string; source: string; calibration?: string };

/** One declared variable a PARTIAL_DECLARED offer leaves out, with the code it is omitted under. */
export type OmittedShape = { variable: string; code: string };

/** One offer, as this rail hands one to the gate (`Offer`). */
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
  deductions: readonly { channel: string; measure: MeasureShape }[];
  omitted: readonly OmittedShape[];
  coverage: string;
};

/** One observation a rail reports beside its offers (`RailObservation`). */
export type RailObservationShape = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> };

/** What a rail answers with (`RailBatch`). */
export type RailBatchShape = { offers: readonly OfferShape[]; observations: readonly RailObservationShape[] };

/** One row of the stored bill of bar rows (interfaces: `BarRow`). */
export type BarRowShape = {
  barKey: string;
  objectKey: string;
  class: string;
  level: string | null;
  mark: string;
  barMark: string;
  role: string;
  diameterMm: number;
  shape: string;
  dimsMm: Record<string, string>;
  cuttingRawMm: string;
  cuttingRoundedMm: string;
  cuttingIsAdditiveMm: string;
  piecesPerBar: number;
  lapMm: string;
  lapsPerBar: number;
  barsPerUnit: number;
  parentCount: string;
  bars: string;
  kgPerMetre: string;
  kgNet: string;
  kgLap: string;
  kg: string;
  sourceKeys: string[];
  detailingSourceKeys: string[];
  editionDigest: string;
  semantic: string;
};

/** The document the one door answers a campaign's bill of bars in (interfaces: `BbsDocument`). */
export type BbsDocumentShape = {
  campaignId: string;
  stockMm: string;
  roundingMm: number;
  rows: BarRowShape[];
  perDiameterKg: Record<string, string>;
  perMarkKg: Record<string, string>;
  cuttingStock: Record<string, { stockBars: number; pieces: number; offcutMm: string; method: string }>;
  grandTotalKg: string;
};

/** What a note states about detailing, as the setup carries it (interfaces: `DetailingSetup`). */
export type DetailingSetupShape = {
  fy: MeasureShape | null;
  fc: MeasureShape | null;
  lapMultiplier: number | null;
  hookExtension: { multiplier: number | null; minimumMm: number | null } | null;
  suspended: readonly string[];
  sourceKeys: readonly string[];
};

/** One reinforcement zone a schedule states for a variant (interfaces: `RebarZoneSetup`). */
export type RebarZoneSetupShape = {
  zone: string;
  bars: readonly { n: number; diameterMm: number }[] | null;
  spacing: number | null;
  spacingUnit: string | null;
  spacingBar: number | null;
  sourceKeys: readonly string[];
};

/** One member-type variant of a family, as the schedules registry recorded it (`RailSetup`). */
export type VariantSetupShape = {
  variantKey: string;
  bandFrom: string | null;
  bandTo: string | null;
  sectionText: string;
  sectionWidth: number | null;
  sectionDepth: number | null;
  sectionUnit: string | null;
  sourceKeys: readonly string[];
  dimensions: Record<string, unknown>;
  rebar: readonly RebarZoneSetupShape[];
};

/** One placement of the read-only setup, keyed by its placement key (`RailSetup.placements`). */
export type PlacementSetupShape = { drawingId: string; ingestId: string; viewKey: string; memberFamily: string | null; engine: string; sourceEntity: string; outline: unknown };

/** How one level's storey height stands in the setup (L-MEA-07). */
export type HeightSetupShape = { standing: string; value: string | null; unit: string | null; basis: string | null; sourceKey: string | null };

/** One level of the setup's stack (`RailSetup.levels`). */
export type LevelSetupShape = { levelId: string; label: string; ordinal: number; height: HeightSetupShape };

/** The read-only setup a rail is handed beside the register's rows (`RailSetup`, widened here). */
export type RailSetupShape = {
  placements: Record<string, PlacementSetupShape>;
  memberTypes: Record<string, Record<string, readonly VariantSetupShape[]>>;
  levels: readonly LevelSetupShape[];
  calibrations: Record<string, Record<string, string>>;
  grades: Record<string, MeasureShape>;
  runs: Record<string, unknown>;
  lintels: Record<string, unknown>;
  walls: Record<string, unknown>;
  surfaces: Record<string, unknown>;
  siteFacts: Record<string, unknown>;
  edition: { digest: string; parameters: Record<string, { value: string; unit: string }> };
  detailing: DetailingSetupShape;
};

/** What a rail is asked (`RailInput`). */
export type RailInputShape = { campaignId: string; setRevisionId: string; kind: string; objects: readonly Record<string, unknown>[]; setup: RailSetupShape };

/** A rail: a pure function of what it was handed (L-MEA-08). */
export type RailShape = (input: RailInputShape) => RailBatchShape;

/* ------------------------------------------------------------------ loading the doors */

/** The method registry, as this leaf's pairs are enumerated and resolved through it (AC-1). */
export async function methodsRegistry(): Promise<{
  enumerateMethods: () => readonly MethodPairShape[];
  implementationOf: (pair: MethodPairShape) => unknown;
  methodKey: (pair: MethodPairShape) => string;
}> {
  const door = await productModule<Record<string, unknown>>(METHODS_REGISTRY_MODULE);
  for (const call of ["enumerateMethods", "implementationOf", "methodKey"]) {
    expect(typeof door[call], `${METHODS_REGISTRY_MODULE} publishes \`${call}\` — the registry every pair is read through (L-MEA-01)`).toBe("function");
  }
  return door as unknown as { enumerateMethods: () => readonly MethodPairShape[]; implementationOf: (pair: MethodPairShape) => unknown; methodKey: (pair: MethodPairShape) => string };
}

/** The detailing edition, resolved through the pair that carries it (AC-2, interfaces). */
export async function detailingEdition(): Promise<Record<string, unknown>> {
  const door = await productModule<Record<string, unknown>>(DETAILING_MODULE);
  const method = door["DETAILING_BNBC2020_BD"] as { resolve?: () => Record<string, unknown> } | undefined;
  expect(typeof method?.resolve, `${DETAILING_MODULE} publishes \`DETAILING_BNBC2020_BD\` with a \`resolve()\` — the edition is a resolver-role method (interfaces)`).toBe("function");
  return (method as { resolve: () => Record<string, unknown> }).resolve();
}

/** The eight lookups the detailing module answers an edition's rows through (interfaces). */
export type DetailingLookups = {
  ldMultiplierOf: (edition: unknown, probe: Record<string, unknown>) => { ok: boolean; multiplier?: number; code?: string };
  developmentLengthOf: (edition: unknown, probe: Record<string, unknown>) => { ok: boolean; mm?: number; code?: string };
  lapLengthOf: (edition: unknown, probe: Record<string, unknown>) => number;
  hookExtensionOf: (edition: unknown, probe: { angle: number; diameterMm: number }) => number;
  coverOf: (edition: unknown, elementType: string) => number;
  tieSpacingOf: (edition: unknown, probe: { longitudinalMm: number; tieMm: number; leastDimensionMm: number }) => number;
  kgPerMetreOf: (edition: unknown, diameterMm: number) => string;
  bendRadiusOf: (edition: unknown, diameterMm: number) => number;
};

/** The detailing module's lookups, whole — each asserted to be a function before it is asked. */
export async function detailingLookups(): Promise<DetailingLookups> {
  const door = await productModule<Record<string, unknown>>(DETAILING_MODULE);
  const wanted = ["ldMultiplierOf", "developmentLengthOf", "lapLengthOf", "hookExtensionOf", "coverOf", "tieSpacingOf", "kgPerMetreOf", "bendRadiusOf"];
  for (const call of wanted) expect(typeof door[call], `${DETAILING_MODULE} publishes \`${call}\` (interfaces)`).toBe("function");
  return door as unknown as DetailingLookups;
}

/** The BS 8666 module: the shapes, the generic form and the three lengths it answers (AC-3). */
export async function bs8666Door(): Promise<Record<string, unknown>> {
  const door = await productModule<Record<string, unknown>>(BS8666_MODULE);
  for (const call of ["genericCuttingLength", "cuttingLengthOf", "roundedCuttingLengthOf", "isAdditiveLengthOf"]) {
    expect(typeof door[call], `${BS8666_MODULE} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  for (const roster of ["SHAPE_CODES", "SHAPES"]) {
    expect(door[roster] === undefined, `${BS8666_MODULE} publishes \`${roster}\` — the shapes are data, not a table typed into a test (interfaces)`).toBe(false);
  }
  return door;
}

/** The mass module: what bills, what only checks, and the one place an allowance appears (AC-5). */
export async function massDoor(): Promise<Record<string, unknown>> {
  const door = await productModule<Record<string, unknown>>(MASS_MODULE);
  for (const call of ["massOf", "kgPerMetreCheckOf", "resourceSummaryOf"]) {
    expect(typeof door[call], `${MASS_MODULE} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  return door;
}

/** The rail's door, with the names its home publishes asserted before it is driven (interfaces). */
export async function rebarRailDoor(): Promise<Record<string, unknown>> {
  const door = await productModule<Record<string, unknown>>(REBAR_RAIL_MODULE);
  for (const call of ["rebarRail", "barRowsOf", "barRowKeyOf", "writeBarRows", "bbsOf"]) {
    expect(typeof door[call], `${REBAR_RAIL_MODULE} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  return door;
}

/** The rail roster the measure job runs, as a map of kind to rail (interfaces). */
export async function railsRoster(): Promise<Record<string, RailShape>> {
  const door = await productModule<Record<string, unknown>>(RAILS_BARREL_MODULE);
  const rails = door["RAILS"];
  expect(rails !== null && typeof rails === "object", `${RAILS_BARREL_MODULE} publishes \`RAILS\` — the roster the measure job runs (interfaces)`).toBe(true);
  return rails as Record<string, RailShape>;
}

/** The closed refusal register, as the barrel assembles it (AC-1). */
export async function refusalRegister(): Promise<Record<string, { code?: string; message?: string; remedy?: string; severity?: string; surface?: string } | undefined>> {
  const door = await productModule<Record<string, unknown>>(ERRORS_MODULE);
  const register = door["REFUSALS"];
  expect(register !== null && typeof register === "object", `${ERRORS_MODULE} publishes \`REFUSALS\` — the one closed taxonomy (Q-07)`).toBe(true);
  return register as Record<string, { code?: string; message?: string; remedy?: string; severity?: string; surface?: string } | undefined>;
}

/** The exact-decimal canon, as every figure of this leaf is summed in it (B-07). */
export async function canon(): Promise<{ exact: (value: string | number) => DecimalLike }> {
  const door = await productModule<{ exact: (value: string | number) => DecimalLike }>(CANON_MODULE);
  expect(typeof door.exact, `${CANON_MODULE} publishes \`exact\` — the one decimal a figure is added up in (B-07)`).toBe("function");
  return door;
}

/** As much of the canon's decimal as this acceptance asks of it. */
export type DecimalLike = {
  add: (other: DecimalLike) => DecimalLike;
  sub: (other: DecimalLike) => DecimalLike;
  mul: (other: DecimalLike) => DecimalLike;
  div: (other: DecimalLike) => DecimalLike;
  abs: () => DecimalLike;
  lte: (other: DecimalLike) => boolean;
  lt: (other: DecimalLike) => boolean;
  eq: (other: DecimalLike) => boolean;
  toFixed: (places: number) => string;
  toString: () => string;
};

/* ------------------------------------------------------------------ the hand-built rail input */

/** The surrogate revision, drawing, ingest, view and calibration a hand-built case reads. */
export const SET_REVISION = "11111111-1111-4111-8111-111111111111";
export const DRAWING_ID = "22222222-2222-4222-8222-222222222222";
export const INGEST_ID = "33333333-3333-4333-8333-333333333333";
export const VIEW_KEY = "PLAN:S-102:t:4";
export const CALIBRATION_KEY = "cal-1";
export const CAMPAIGN_ID = "44444444-4444-4444-8444-444444444444";
export const EDITION_DIGEST = "0".repeat(64);

/** One reading of the setup or an offer, spelled once so a case names only what it changes. */
export function reading(value: string, unit: string, options: { basis?: string; source?: string; calibration?: string } = {}): MeasureShape {
  const made: MeasureShape = { value, unit, basis: options.basis ?? TRANSCRIBED, source: options.source ?? `${BNBC_MODEL}#notes` };
  return options.calibration === undefined ? made : { ...made, calibration: options.calibration };
}

/** What a campaign applies where no note was read at all — every half unread (interfaces). */
export function detailingUnread(): DetailingSetupShape {
  return { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: [], sourceKeys: [] };
}

/** One reinforcement zone of a variant, as a schedule states one (interfaces). */
export function zone(draft: Partial<RebarZoneSetupShape> & { zone: string }): RebarZoneSetupShape {
  return {
    zone: draft.zone,
    bars: draft.bars ?? null,
    spacing: draft.spacing ?? null,
    spacingUnit: draft.spacingUnit ?? null,
    spacingBar: draft.spacingBar ?? null,
    sourceKeys: draft.sourceKeys ?? [`${BNBC_MODEL}#${draft.zone}`],
  };
}

/** One member-type variant, with the section a schedule stated and the zones beneath it. */
export function variant(options: {
  variantKey: string;
  width?: number | null;
  depth?: number | null;
  unit?: string | null;
  sectionText?: string;
  sourceKeys?: readonly string[];
  bandFrom?: string | null;
  bandTo?: string | null;
  rebar?: readonly RebarZoneSetupShape[];
}): VariantSetupShape {
  return {
    variantKey: options.variantKey,
    bandFrom: options.bandFrom ?? null,
    bandTo: options.bandTo ?? null,
    sectionText: options.sectionText ?? `${String(options.width)}x${String(options.depth)}`,
    sectionWidth: options.width ?? null,
    sectionDepth: options.depth ?? null,
    sectionUnit: options.unit === undefined ? "mm" : options.unit,
    sourceKeys: options.sourceKeys ?? [`${BNBC_MODEL}#section`],
    dimensions: {},
    rebar: options.rebar ?? [],
  };
}

/** One placement of the setup, as the partition stored one. */
export function placement(options: { placementKey: string; memberFamily: string | null; viewKey?: string; drawingId?: string; ingestId?: string }): PlacementSetupShape {
  return {
    drawingId: options.drawingId ?? DRAWING_ID,
    ingestId: options.ingestId ?? INGEST_ID,
    viewKey: options.viewKey ?? VIEW_KEY,
    memberFamily: options.memberFamily,
    engine: "VECTOR",
    sourceEntity: options.placementKey,
    outline: null,
  };
}

/** One level of the setup whose height stands AGREED at a transcribed reading (L-MEA-07). */
export function levelStanding(options: { levelId: string; label: string; ordinal: number; value: string; unit?: string; sourceKey?: string }): LevelSetupShape {
  return {
    levelId: options.levelId,
    label: options.label,
    ordinal: options.ordinal,
    height: { standing: "AGREED", value: options.value, unit: options.unit ?? "mm", basis: TRANSCRIBED, sourceKey: options.sourceKey ?? `${BNBC_MODEL}#storeys` },
  };
}

/** One register object row, as the store holds one — what a rail is handed to read (L-REG-01). */
export function registerRow(options: {
  placementKey: string;
  levelId?: string | null;
  levelSlot?: string | null;
  levelLabel?: string | null;
  viewKey?: string;
  mark?: string;
  elementType?: string;
  setRevisionId?: string;
}): Record<string, unknown> {
  const levelSegment = options.levelId ?? options.levelSlot ?? "UNRESOLVED";
  const objectKey = `${options.placementKey}@${levelSegment}`;
  return {
    tenantId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    setRevisionId: options.setRevisionId ?? SET_REVISION,
    objectKey,
    discipline: "STRUCTURAL",
    elementType: options.elementType ?? COLUMN_CLASS,
    mark: options.mark ?? "C1",
    viewKey: options.viewKey ?? VIEW_KEY,
    placementKey: options.placementKey,
    levelId: options.levelId ?? null,
    levelSlot: options.levelSlot ?? null,
    levelLabel: options.levelLabel ?? null,
    standing: "MEASURED",
    semantic: `semantic:${objectKey}`,
    registeredAt: new Date(0),
  };
}

/** What one hand-built rail input is made of, so a case names only what it changes. */
export type RailInputDraft = {
  campaignId?: string;
  setRevisionId?: string;
  kind?: string;
  objects: readonly Record<string, unknown>[];
  placements: Record<string, PlacementSetupShape>;
  memberTypes?: Record<string, readonly VariantSetupShape[]>;
  levels?: readonly LevelSetupShape[];
  calibrations?: Record<string, Record<string, string>>;
  detailing?: DetailingSetupShape;
  editionDigest?: string;
};

/** One rail input, whole — every seam of the setup assembled, empty where nothing was read. */
export function railInput(draft: RailInputDraft): RailInputShape {
  const views: Record<string, string> = {};
  for (const one of Object.values(draft.placements)) views[one.viewKey] = CALIBRATION_KEY;
  return {
    campaignId: draft.campaignId ?? CAMPAIGN_ID,
    setRevisionId: draft.setRevisionId ?? SET_REVISION,
    kind: draft.kind ?? RCC_REBAR,
    objects: draft.objects,
    setup: {
      placements: draft.placements,
      memberTypes: { [INGEST_ID]: draft.memberTypes ?? {} },
      levels: draft.levels ?? [],
      calibrations: draft.calibrations ?? { [INGEST_ID]: views },
      grades: {},
      runs: {},
      lintels: {},
      walls: {},
      surfaces: {},
      siteFacts: {},
      edition: { digest: draft.editionDigest ?? EDITION_DIGEST, parameters: {} },
      detailing: draft.detailing ?? detailingUnread(),
    },
  };
}
