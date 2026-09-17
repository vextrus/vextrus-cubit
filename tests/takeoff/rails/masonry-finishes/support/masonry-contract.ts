/**
 * The MASONRY shard's public test contract: the module homes, the vocabulary, the shapes and the
 * three hand-built scenarios every case of this leaf is driven with (R-TO-032, L-MEA-02, L-MEA-03,
 * L-MEA-06, L-QTY-02/04/06, AM-11).
 *
 * Mechanics only — nothing here judges the product. It opens no database and imports nothing that
 * does, so a PURE case (a rail is a pure function, L-MEA-08) stays in the unit lane; the live
 * campaign the band criterion needs is staged beside it in `./masonry-stage.ts`, which re-exports
 * everything here so a caller reads one door.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one this increment's goal, its interfaces,
 * its test contract or its acceptance criteria publish. What this file DECLARES is the public
 * contract the held-out set is measured against too (C-04): a Builder who reads only this file and
 * the spec can pass every case, in either lane.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { goldenRows as goldenRowsOf, type GoldenRow } from "../../../../golden/support/golden-fixture";
import { REPO_ROOT, productModule } from "../../../../server/support/wire";

export { REPO_ROOT, productModule };
export { goldenDocument, goldenRows, type GoldenRow } from "../../../../golden/support/golden-fixture";

/* ------------------------------------------------------------------ the homes the spec names */

/** The rails themselves: the three pure functions, their rule ids and their closed code roster. */
export const MASONRY_RAIL_MODULE = "src/modules/takeoff/rails/masonry-finishes/index.ts";

/** The area's roster and the barrel the measure job runs (AM-11, L-MEA-08). */
export const MASONRY_ROSTER_MODULE = "src/modules/takeoff/rails/masonry.ts";
export const RAILS_BARREL_MODULE = "src/modules/takeoff/rails/index.ts";

/** The area's method shard, the registry file that records it, and the registry barrel (AC-2). */
export const MASONRY_SHARD = "src/core/rulesets/methods/masonry-finishes/masonry-finishes.methods.json";
export const MASONRY_METHOD_AREA_MODULE = "src/core/rulesets/methods/registry/masonry.ts";
export const METHODS_REGISTRY_MODULE = "src/core/rulesets/methods/registry.ts";

/** The expression module the one tree is printed by — a method's template comes from nowhere else. */
export const EXPR_MODULE = "src/core/rulesets/methods/expr.ts";

/** The area's refusals and the barrel the closed taxonomy is read at (AC-4, Q-07). */
export const MASONRY_ERRORS_MODULE = "src/core/errors/masonry.ts";
export const ERRORS_MODULE = "src/core/errors.ts";

/** The catalogue, its law, its maps, the `bears` relation and the emitter (AC-1). */
export const KINDS_MODULE = "src/core/catalogue/kinds.ts";
export const CLASSES_MODULE = "src/core/catalogue/classes.ts";
export const KIND_LAW_MODULE = "src/core/catalogue/kind-law.ts";
export const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";
export const CATALOGUE_MAPS_MODULE = "src/core/catalogue/maps.ts";
export const BEARS_MODULE = "src/core/catalogue/bears.ts";
export const CATALOGUE_EMIT_MODULE = "src/core/catalogue/emit.ts";

/** Where the emitted catalogue tables are committed, and the drift stage over them (AC-1). */
export const CATALOGUE_DIR = "db/catalogue";
export const CATALOGUE_DRIFT_SCRIPT = "scripts/catalogue-drift.mjs";

/** The stage that keeps a shard's recorded digest honest (AC-2, test contract). */
export const METHOD_HASHES_SCRIPT = "scripts/method-hashes.mjs";

/** The discipline roster a kind's authoritative set is drawn from — never re-spelled here (B-17). */
export const SHEETS_LAW_MODULE = "src/core/sheets/law.ts";

/** The rail↔gate contract and the law file its closed vocabularies stand in (AC-7, interfaces). */
export const OFFERS_CONTRACT_MODULE = "src/core/offers/contract.ts";
export const OFFERS_LAW_MODULE = "src/core/offers/law.ts";

/** The gate — the sole writer of lines, and the door a channel's partition is asked at (SEAM-GATE). */
export const GATE_MODULE = "src/core/gate/index.ts";

/** The residue: the coverage grid and the certificate read one answer (AC-8, L-QTY-07). */
export const RESIDUE_MODULE = "src/core/residue/index.ts";

/** The unit canon — the one home a reading's canonical value is asked of (B-17). */
export const CANON_MODULE = "src/core/units/canon.ts";

/** The platform seed, re-minted so a pin puts this leaf's methods in force (AC-2). */
export const SEED_MODULE = "src/core/rulesets/seed/index.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The three kinds that join the closed catalogue (interfaces, riskNotes (3)). */
export const MASONRY_BRICKWORK = "masonry.brickwork";
export const FINISH_PLASTER = "finish.plaster";
export const FINISH_PAINT = "finish.paint";

/** The two classes that join the closed roster (interfaces). */
export const BRICK_WALL = "brick_wall";
export const SURFACE = "surface";

/** The three rule ids, as `src/modules/takeoff/rails/masonry-finishes/index.ts` publishes them. */
export const BRICK_WALL_VOLUME_RULE_ID = "masonry.brick_wall.volume";
export const PLASTER_RULE_ID = "finish.surface.plaster";
export const PAINT_RULE_ID = "finish.surface.paint";

/** The three kinds this area's roster keys, each by the rail the interfaces name (AC-7). */
export const MASONRY_ROSTER_LINES: Readonly<Record<string, string>> = Object.freeze({
  [MASONRY_BRICKWORK]: "brickworkRail",
  [FINISH_PLASTER]: "plasterRail",
  [FINISH_PAINT]: "paintRail",
});

/** Which rule id each kind is measured under (AC-3, AC-7). */
export const RULE_ID_OF: Readonly<Record<string, string>> = Object.freeze({
  [MASONRY_BRICKWORK]: BRICK_WALL_VOLUME_RULE_ID,
  [FINISH_PLASTER]: PLASTER_RULE_ID,
  [FINISH_PAINT]: PAINT_RULE_ID,
});

/** One (rule id, version) pair, as an edition cites one and the registry enumerates one. */
export type MethodPairShape = { ruleId: string; version: string };

/** The version every method of this shard lands at, and the three pairs it records (AC-2). */
export const MASONRY_VERSION = "1";
export const MASONRY_RULE_IDS: readonly string[] = Object.freeze([BRICK_WALL_VOLUME_RULE_ID, PLASTER_RULE_ID, PAINT_RULE_ID]);
export const MASONRY_PAIRS: readonly MethodPairShape[] = Object.freeze(MASONRY_RULE_IDS.map((ruleId) => Object.freeze({ ruleId, version: MASONRY_VERSION })));

/**
 * The identity the platform seed stands at (AC-2, interfaces) — re-baselined by each leaf that mints
 * a head beside it: an edition is immutable, so a later shard is cited by a NEW version and the seed
 * names that one (L-MEA-01, B-20). What the cases below grade is that this area's three pairs are
 * cited by the edition the seed names, whichever version that has become.
 */
export const SEED_EDITION_NAME = "IS1200_IN";
export const SEED_EDITION_VERSION = "2027.02";

/** The nine codes of the masonry shard, by name (AC-4, interfaces). */
export const OPENING_SCHEDULE_ABSENT = "OPENING_SCHEDULE_ABSENT";
export const OPENING_NOT_AREABLE = "OPENING_NOT_AREABLE";
export const OPENING_FLOOR_UNJUDGEABLE = "OPENING_FLOOR_UNJUDGEABLE";
export const SURFACE_NOT_CLOSED = "SURFACE_NOT_CLOSED";
export const WALL_LENGTH_UNSTATED = "WALL_LENGTH_UNSTATED";
export const WALL_HEIGHT_UNSTATED = "WALL_HEIGHT_UNSTATED";
export const WALL_THICKNESS_UNSTATED = "WALL_THICKNESS_UNSTATED";
export const FINISH_GROSS_UNSTATED = "FINISH_GROSS_UNSTATED";
export const FINISH_SELECTOR_UNSTATED = "FINISH_SELECTOR_UNSTATED";

/** The nine, as one roster — the codes `MASONRY_REFUSALS` registers (AC-4). */
export const MASONRY_SHARD_CODES: readonly string[] = Object.freeze([
  OPENING_SCHEDULE_ABSENT,
  OPENING_NOT_AREABLE,
  OPENING_FLOOR_UNJUDGEABLE,
  SURFACE_NOT_CLOSED,
  WALL_LENGTH_UNSTATED,
  WALL_HEIGHT_UNSTATED,
  WALL_THICKNESS_UNSTATED,
  FINISH_GROSS_UNSTATED,
  FINISH_SELECTOR_UNSTATED,
]);

/** The two codes every rail of this tree reports as OBSERVATIONS about a sighting (AC-4). */
export const VIEW_SCALE_UNAFFIRMED = "VIEW_SCALE_UNAFFIRMED";
export const MEMBER_TYPE_UNKNOWN = "MEMBER_TYPE_UNKNOWN";

/** The whole roster the rail door publishes: this shard's nine plus the two sighting codes (AC-4). */
export const MASONRY_RAIL_CODES_OWED: readonly string[] = Object.freeze([...MASONRY_SHARD_CODES, VIEW_SCALE_UNAFFIRMED, MEMBER_TYPE_UNKNOWN]);

/** Which code each unstated wall reading is omitted under (AC-4, interfaces). */
export const WALL_OMISSION: Readonly<Record<string, string>> = Object.freeze({
  L: WALL_LENGTH_UNSTATED,
  h: WALL_HEIGHT_UNSTATED,
  t: WALL_THICKNESS_UNSTATED,
});

/** The severity and surface every entry of this shard is registered at (AC-4). */
export const WARNING = "warning";
export const INLINE = "inline";

/** The two deduction channels the contract admits once this leaf lands (AC-7, interfaces). */
export const OPENING_CHANNEL = "opening";
export const FINISH_OPENING_CHANNEL = "finish_opening";
export const DEDUCTION_CHANNELS_OWED: readonly string[] = Object.freeze([OPENING_CHANNEL, FINISH_OPENING_CHANNEL]);

/** The edition parameter each channel is partitioned against (L-MEA-01's roster, interfaces). */
export const OPENING_THRESHOLD_PARAMETER = "openingDeductionMinM2";
export const FINISH_OPENING_THRESHOLD_PARAMETER = "finishOpeningDeductionMinM2";
export const CHANNEL_PARAMETER: Readonly<Record<string, string>> = Object.freeze({
  [OPENING_CHANNEL]: OPENING_THRESHOLD_PARAMETER,
  [FINISH_OPENING_CHANNEL]: FINISH_OPENING_THRESHOLD_PARAMETER,
});

/** The channel each kind deducts through (AC-2, AC-3, AC-7). */
export const CHANNEL_OF: Readonly<Record<string, string>> = Object.freeze({
  [MASONRY_BRICKWORK]: OPENING_CHANNEL,
  [FINISH_PLASTER]: FINISH_OPENING_CHANNEL,
  [FINISH_PAINT]: FINISH_OPENING_CHANNEL,
});

/** The variable the gate binds a channel's deducted sum into (riskNotes (2), interfaces). */
export const OPENINGS_VARIABLE = "openings";

/** The variable a rail binds DERIVED from the edition's threshold (L-MEA-02, interfaces). */
export const THRESHOLD_VARIABLE = "threshold";

/** L-QTY-02's two coverages this leaf publishes under. */
export const COMPLETE = "COMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The bases L-QTY-01 orders by recourse that this leaf's readings carry. */
export const MEASURED = "MEASURED";
export const TRANSCRIBED = "TRANSCRIBED";
export const DERIVED = "DERIVED";

/** The engine that read the drawing (L-QTY-03). */
export const VECTOR = "VECTOR";

/** The geometry each kind is read off (interfaces: a wall is an area × its nominal thickness). */
export const AREA_THICK = "AREA_THICK";
export const POLYGON = "POLYGON";
export const GEOMETRY_OF: Readonly<Record<string, string>> = Object.freeze({
  [MASONRY_BRICKWORK]: AREA_THICK,
  [FINISH_PLASTER]: POLYGON,
  [FINISH_PAINT]: POLYGON,
});

/** The dimensions a variable of these methods stands in (B-17: the canon's own roster). */
export const LENGTH = "LENGTH";
export const AREA = "AREA";
export const VOLUME = "VOLUME";

/** The units a staged reading is written in — the model's own, and the canon's own for a count. */
export const MILLIMETRE = "mm";
export const MILLIMETRE_SQUARED = "mm2";
export const PIECES = "pcs";

/** The units this leaf's SELECTING facts are carried in — free spellings, as `grade` already is. */
export const FACE_UNIT = "face";
export const FLOOR_UNIT = "floor";
export const MIX_UNIT = "mix";

/** How the golden spells this leaf's class and kind (test contract). */
export const GOLDEN_CLASS: Readonly<Record<string, string>> = Object.freeze({ [BRICK_WALL]: "BRICK_WALL" });
export const GOLDEN_KIND: Readonly<Record<string, string>> = Object.freeze({ [MASONRY_BRICKWORK]: "BRICKWORK" });

/** The fixtures this leaf is graded against (test contract). */
export const BNBC_FIXTURE = "rcc6-bnbc";
export const RCC6_FIXTURE = "rcc6";
export const BNBC_MODEL = "fixtures/rcc6-bnbc/model.json";

/** L-QTY-06's band: three per cent under a competent manual takeoff, and never a unit over. */
export const UNDER_TOLERANCE = "0.97";

/** The level stack every scenario and the BNBC campaign stand on (test contract). */
export const LEVEL_LABELS: readonly string[] = Object.freeze(["1F", "2F", "3F", "4F", "5F", "6F"]);

/* ------------------------------------------------------------------ the shapes the rails answer in */

/** One reading, as an offer carries one (`Measure`). */
export type MeasureShape = { value: string; unit: string; basis: string; source: string; calibration?: string };

/** One reading of the setup, as the partition read it (`ReadingSetup`). */
export type ReadingShape = { value: string; unit: string; basis: string; source: string };

/** One declared variable a PARTIAL_DECLARED offer leaves out, with the code it is omitted under. */
export type OmittedShape = { variable: string; code: string };

/** One thing that might be deducted, in the channel it would be deducted through (`DeductionCandidate`). */
export type DeductionShape = { channel: string; measure: MeasureShape };

/** One offer, as a rail hands one to the gate (`Offer`). */
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
  deductions: readonly DeductionShape[];
  omitted: readonly OmittedShape[];
  coverage: string;
};

/** One observation a rail reports beside its offers (`RailObservation`). */
export type RailObservationShape = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> };

/** What a rail answers with (`RailBatch`). */
export type RailBatchShape = { offers: readonly OfferShape[]; observations: readonly RailObservationShape[] };

/** A band as a schedule states it (`BandStatement`). */
export type BandShape = { from: string | null; to: string | null };

/** One scheduled opening, as the setup carries one (interfaces: `OpeningSetup`). */
export type OpeningSetupShape = {
  mark: string;
  area: ReadingShape | null;
  count: ReadingShape;
  floors: BandShape | null;
  source: string;
};

/** One wall's readings and its opening schedule (interfaces: `WallSetup`). */
export type WallSetupShape = {
  length: ReadingShape | null;
  height: ReadingShape | null;
  thickness: ReadingShape | null;
  openings: readonly OpeningSetupShape[] | null;
};

/** One surface's readings and its opening schedule (interfaces: `SurfaceSetup`). */
export type SurfaceSetupShape = {
  closed: boolean;
  gross: ReadingShape | null;
  face: ReadingShape;
  floor: ReadingShape;
  thickness: ReadingShape | null;
  mix: ReadingShape | null;
  openings: readonly OpeningSetupShape[] | null;
};

/** One placement of the read-only setup (`PlacementSetup`). */
export type PlacementSetupShape = {
  drawingId: string;
  ingestId: string;
  viewKey: string;
  memberFamily: string | null;
  engine: string;
  sourceEntity: string;
  outline: null;
};

/** One level of the stack a scheduled floor band is placed against (`LevelSetup`). */
export type LevelSetupShape = {
  levelId: string;
  label: string;
  ordinal: number;
  height: { standing: string; value: string | null; unit: string | null; basis: string | null; sourceKey: string | null };
};

/** The pinned edition a DERIVED reading is bound from (`EditionSetup`). */
export type EditionSetupShape = { digest: string; parameters: Record<string, { value: string; unit: string }> };

/** The read-only setup a rail is handed (`RailSetup`, widened by this leaf with two seams). */
export type RailSetupShape = {
  placements: Record<string, PlacementSetupShape>;
  memberTypes: Record<string, Record<string, readonly unknown[]>>;
  levels: readonly LevelSetupShape[];
  calibrations: Record<string, Record<string, string>>;
  grades: Record<string, MeasureShape>;
  runs: Record<string, unknown>;
  lintels: Record<string, unknown>;
  walls: Record<string, WallSetupShape>;
  surfaces: Record<string, SurfaceSetupShape>;
  siteFacts: Record<string, unknown>;
  edition: EditionSetupShape;
};

/** What a rail is asked (`RailInput`). */
export type RailInputShape = {
  campaignId: string;
  setRevisionId: string;
  kind: string;
  objects: readonly Record<string, unknown>[];
  setup: RailSetupShape;
};

/** A rail: a pure function of what it was handed (L-MEA-08). */
export type RailShape = (input: RailInputShape) => RailBatchShape;

/** The rails' door, as this acceptance drives it (interfaces). */
export type MasonryRailDoor = {
  brickworkRail: RailShape;
  plasterRail: RailShape;
  paintRail: RailShape;
  MASONRY_RAIL_CODES: readonly string[];
  BRICK_WALL_VOLUME_RULE_ID: string;
  PLASTER_RULE_ID: string;
  PAINT_RULE_ID: string;
};

/** The formula method the registry maps a pair to (AC-2). */
export type FormulaMethodShape = {
  role: string;
  ruleId: string;
  version: string;
  kind: string;
  dimension: string;
  variables: readonly { name: string; dimension: string }[];
  deductionChannels: readonly string[];
  tree: unknown;
  template: string;
  evaluate: (bindings: Record<string, { value: string }>) => { toString: () => string };
};

/** The methods registry, as this acceptance asks it what is in force (AC-2). */
export type MethodsRegistry = {
  enumerateMethods: () => readonly MethodPairShape[];
  implementationOf: (pair: MethodPairShape) => unknown;
  methodKey: (pair: MethodPairShape) => string;
};

/** An exact decimal, as the canon answers one — arbitrary precision end to end (B-07). */
export type DecimalLike = {
  add: (other: DecimalLike | string) => DecimalLike;
  sub: (other: DecimalLike | string) => DecimalLike;
  mul: (other: DecimalLike | string) => DecimalLike;
  eq: (other: DecimalLike | string) => boolean;
  lte: (other: DecimalLike | string) => boolean;
  toString: () => string;
};

/** The unit canon, as this acceptance asks it what a reading is worth (B-17). */
export type CanonSeam = {
  exact: (value: string | number) => DecimalLike;
  convert: (value: string, from: string, to: string) => { ok: boolean; value?: string; code?: string };
  isUnit: (value: unknown) => boolean;
  CANONICAL_UNIT: Readonly<Record<string, string>>;
};

/** One entry of the closed refusal taxonomy. */
export type RefusalEntryShape = { code: string; message: string; remedy: string; severity: string; surface: string };

/* ------------------------------------------------------------------ loading the doors */

/** The three rails, with the names their home publishes asserted before any of them is driven. */
export async function masonryRailDoor(): Promise<MasonryRailDoor> {
  const door = await productModule<Record<string, unknown>>(MASONRY_RAIL_MODULE);
  for (const rail of Object.values(MASONRY_ROSTER_LINES)) {
    expect(typeof door[rail], `${MASONRY_RAIL_MODULE} publishes \`${rail}\` — a pure rail this increment lands (interfaces)`).toBe("function");
  }
  expect(Array.isArray(door["MASONRY_RAIL_CODES"]), `${MASONRY_RAIL_MODULE} publishes \`MASONRY_RAIL_CODES\` as a list (interfaces)`).toBe(true);
  return door as unknown as MasonryRailDoor;
}

/** The area's roster, keyed by kind (AC-7, AM-11). */
export async function masonryRoster(): Promise<Record<string, RailShape>> {
  const door = await productModule<Record<string, unknown>>(MASONRY_ROSTER_MODULE);
  const roster = door["MASONRY_RAILS"];
  expect(roster !== null && typeof roster === "object", `${MASONRY_ROSTER_MODULE} publishes \`MASONRY_RAILS\` — this area's roster (AM-11)`).toBe(true);
  return roster as Record<string, RailShape>;
}

/** The barrel the measure job runs (L-MEA-08). */
export async function railsRoster(): Promise<Record<string, RailShape>> {
  const door = await productModule<Record<string, unknown>>(RAILS_BARREL_MODULE);
  const rails = door["RAILS"];
  expect(rails !== null && typeof rails === "object", `${RAILS_BARREL_MODULE} publishes \`RAILS\` — the roster the measure job runs (L-MEA-08)`).toBe(true);
  return rails as Record<string, RailShape>;
}

/** The methods registry (AC-2). */
export async function methodsRegistry(): Promise<MethodsRegistry> {
  const door = await productModule<Record<string, unknown>>(METHODS_REGISTRY_MODULE);
  for (const call of ["enumerateMethods", "implementationOf", "methodKey"]) {
    expect(typeof door[call], `${METHODS_REGISTRY_MODULE} publishes \`${call}\``).toBe("function");
  }
  return door as unknown as MethodsRegistry;
}

/** One method of this shard, read from the registry by its pair (AC-2). */
export async function masonryMethod(pair: MethodPairShape): Promise<FormulaMethodShape> {
  const registry = await methodsRegistry();
  const implementation = registry.implementationOf(pair);
  expect(
    implementation,
    `the registry maps ${pair.ruleId}@${pair.version} to an implementation — an edition cites the pair and the gate resolves it through the registry (AC-2)`,
  ).toBeTruthy();
  return implementation as unknown as FormulaMethodShape;
}

/** The unit canon — the one home a reading's canonical value is asked of (B-17). */
export async function canon(): Promise<CanonSeam> {
  return productModule<CanonSeam>(CANON_MODULE);
}

/** The closed refusal register, read from its one home so nothing re-spells a code (Q-07). */
export async function refusalRegister(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Record<string, RefusalEntryShape | undefined> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/* ------------------------------------------------------------------ the setup, by hand */

/** The surrogates a hand-built case reads — a rail never asks a store for any of them. */
export const TENANT_ID = "00000000-0000-4000-8000-0000000008a1";
export const PROJECT_ID = "00000000-0000-4000-8000-0000000008a2";
export const SET_REVISION = "44444444-4444-4444-8444-444444444444";
export const CAMPAIGN_ID = "00000000-0000-4000-8000-0000000008f1";
export const DRAWING_ID = "55555555-5555-4555-8555-5555555550a1";
export const INGEST_ID = "66666666-6666-4666-8666-6666666660a1";
export const VIEW_KEY = "PLAN:A-12:t:3";
export const CALIBRATION_KEY = "cal-masonry-1";

/**
 * The DRAWING ENTITY a hand-built placement was read at — deliberately NOT its placement key.
 *
 * A placement key is a key of the setup's own map; the source entity is the handle a reader can go
 * back to the drawing with (L-QTY-03). A fixture that spelled them the same string would make a
 * deferral citing the key indistinguishable from one citing the entity, and a queue item carrying
 * the key sends a reader nowhere.
 */
export const PLACEMENT_SOURCE_ENTITY = "A-12:e:41";

/** The edition digest a hand-built case's DERIVED readings cite. */
export const EDITION_DIGEST = "d00000000000000000000000000000000000000000000000000000000000ma50";

/** One reading of the setup, spelled once so a case names only what it changes. */
export function reading(value: string, unit: string, options: { basis?: string; source?: string } = {}): ReadingShape {
  return { value, unit, basis: options.basis ?? TRANSCRIBED, source: options.source ?? "A-12:e:1" };
}

/** One scheduled opening, as an opening schedule states one (interfaces: `OpeningSetup`). */
export function opening(options: {
  mark: string;
  area: ReadingShape | null;
  count?: string;
  floors?: BandShape | null;
  source?: string;
  countUnit?: string;
  countBasis?: string;
}): OpeningSetupShape {
  const source = options.source ?? `sched#${options.mark}`;
  return {
    mark: options.mark,
    area: options.area,
    count: reading(options.count ?? "1", options.countUnit ?? PIECES, { basis: options.countBasis ?? TRANSCRIBED, source }),
    floors: options.floors ?? null,
    source,
  };
}

/** One wall of the setup (interfaces: `WallSetup`). */
export function wall(options: {
  length?: ReadingShape | null;
  height?: ReadingShape | null;
  thickness?: ReadingShape | null;
  openings?: readonly OpeningSetupShape[] | null;
}): WallSetupShape {
  return {
    length: options.length === undefined ? null : options.length,
    height: options.height === undefined ? null : options.height,
    thickness: options.thickness === undefined ? null : options.thickness,
    openings: options.openings === undefined ? null : options.openings,
  };
}

/** One surface of the setup (interfaces: `SurfaceSetup`). */
export function surface(options: {
  closed?: boolean;
  gross?: ReadingShape | null;
  face?: ReadingShape;
  floor?: ReadingShape;
  thickness?: ReadingShape | null;
  mix?: ReadingShape | null;
  openings?: readonly OpeningSetupShape[] | null;
}): SurfaceSetupShape {
  return {
    closed: options.closed ?? true,
    gross: options.gross === undefined ? null : options.gross,
    face: options.face ?? reading("INTERNAL", FACE_UNIT, { source: "model#S1.face" }),
    floor: options.floor ?? reading("2F", FLOOR_UNIT, { source: "model#S1.floor" }),
    thickness: options.thickness === undefined ? null : options.thickness,
    mix: options.mix === undefined ? null : options.mix,
    openings: options.openings === undefined ? null : options.openings,
  };
}

/** One placement of the setup — a masonry placement reads no plan outline (interfaces). */
export function placement(options: { viewKey?: string; memberFamily?: string | null; sourceEntity: string }): PlacementSetupShape {
  return {
    drawingId: DRAWING_ID,
    ingestId: INGEST_ID,
    viewKey: options.viewKey ?? VIEW_KEY,
    memberFamily: options.memberFamily === undefined ? null : options.memberFamily,
    engine: VECTOR,
    sourceEntity: options.sourceEntity,
    outline: null,
  };
}

/** The surrogate id a level of a hand-built stack carries (L-REG-02: a level is a surrogate). */
export function levelIdOf(label: string): string {
  return `level-${label.toLowerCase()}`;
}

/** The stack a hand-built case places a scheduled floor band against (L-FRM-02, L-MEA-02). */
export function levelStack(labels: readonly string[] = LEVEL_LABELS): LevelSetupShape[] {
  return labels.map((label, index) => ({
    levelId: levelIdOf(label),
    label,
    ordinal: index + 1,
    height: { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null },
  }));
}

/** One register object row, as the store holds one — what a rail is handed to read (L-REG-01). */
export function registerRow(options: { placementKey: string; elementType: string; mark: string; levelLabel: string; viewKey?: string; standing?: string }): Record<string, unknown> {
  const levelId = levelIdOf(options.levelLabel);
  const objectKey = `${options.placementKey}@${levelId}`;
  return {
    tenantId: TENANT_ID,
    setRevisionId: SET_REVISION,
    objectKey,
    projectId: PROJECT_ID,
    discipline: "ARCHITECTURAL",
    elementType: options.elementType,
    mark: options.mark,
    viewKey: options.viewKey ?? VIEW_KEY,
    placementKey: options.placementKey,
    levelId,
    levelSlot: null,
    levelLabel: null,
    standing: options.standing ?? MEASURED,
    semantic: `semantic:${objectKey}`,
    registeredAt: new Date(0),
  };
}

/** What one hand-built rail input is made of, so a case names only what it changes. */
export type RailInputDraft = {
  kind: string;
  objects: readonly Record<string, unknown>[];
  placements: Record<string, PlacementSetupShape>;
  walls?: Record<string, WallSetupShape>;
  surfaces?: Record<string, SurfaceSetupShape>;
  levels?: readonly LevelSetupShape[];
  calibrations?: Record<string, Record<string, string>>;
  edition: EditionSetupShape;
};

/** One rail input, whole — every seam of the setup assembled, empty where nothing was read. */
export function railInput(draft: RailInputDraft): RailInputShape {
  const views: Record<string, string> = {};
  for (const one of Object.values(draft.placements)) views[one.viewKey] = CALIBRATION_KEY;
  return {
    campaignId: CAMPAIGN_ID,
    setRevisionId: SET_REVISION,
    kind: draft.kind,
    objects: draft.objects,
    setup: {
      placements: draft.placements,
      memberTypes: {},
      levels: draft.levels ?? levelStack(),
      calibrations: draft.calibrations ?? { [INGEST_ID]: views },
      grades: {},
      runs: {},
      lintels: {},
      walls: draft.walls ?? {},
      surfaces: draft.surfaces ?? {},
      siteFacts: {},
      edition: draft.edition,
    },
  };
}

/** How a DERIVED reading cites the edition it was bound from (interfaces). */
export function editionSource(edition: EditionSetupShape, parameterKey: string): string {
  return `edition:${edition.digest}#${parameterKey}`;
}

/**
 * The SOURCE ENTITY the setup records for one placement — what a deferral about that placement
 * cites (L-QTY-03, AC-4).
 *
 * Read off the setup a case actually handed the rail, never spelled beside it, and asserted here to
 * differ from the placement KEY: the rule is "cites the placement's source entity", and an
 * observation carrying the map key instead would be indistinguishable from a correct one if the two
 * strings were ever allowed to collapse.
 */
export function placementSourceEntity(input: RailInputShape, placementKey: string): string {
  const held = input.setup.placements[placementKey];
  expect(held, `the setup places ${placementKey} — a case citing its source entity is a case that staged one`).toBeTruthy();
  const entity = String(held?.sourceEntity);
  expect(
    entity,
    `the fixture's source entity is a DRAWING handle and not the placement key — a scenario that spelled them the same string could not tell a deferral citing one from a deferral citing the other (L-QTY-03)`,
  ).not.toBe(placementKey);
  return entity;
}

/**
 * The edition a hand-built case binds its DERIVED readings from: the platform seed's own parameters,
 * read from the product rather than transcribed, under a surrogate digest.
 *
 * The two thresholds are asserted to stand where every scenario below assumes them (0.1 m² — the
 * seed's own figure), because the arithmetic of F-MASONRY-PARTITION and F-MASONRY-SURFACE is what
 * the boundary case is FOR: a seed that moved would make those scenarios say something else.
 */
export async function seedEdition(): Promise<EditionSetupShape> {
  const seed = await productModule<{ SEED_EDITION_CONTENT: { parameters: Record<string, { value: string; unit: string }> } }>(SEED_MODULE);
  const parameters = seed.SEED_EDITION_CONTENT.parameters;
  for (const parameter of [OPENING_THRESHOLD_PARAMETER, FINISH_OPENING_THRESHOLD_PARAMETER]) {
    expect(parameters[parameter], `the platform seed states \`${parameter}\` — the threshold its channel is partitioned against (L-MEA-01)`).toBeTruthy();
    expect(
      { value: parameters[parameter]?.value, unit: parameters[parameter]?.unit },
      `and states it at the figure these scenarios are written against — a threshold that moved re-writes the boundary case (L-MEA-02)`,
    ).toEqual({ value: "0.1", unit: "m2" });
  }
  return { digest: EDITION_DIGEST, parameters: { ...parameters } };
}

/* ------------------------------------------------------------------ the three scenarios, by name */

/** The placement key each scenario's one member stands at. */
export const WALL_PLACEMENT = "PLACEMENT:A-12:BW250:1000:2000";
export const PARTITION_PLACEMENT = "PLACEMENT:A-12:BW250:3000:4000";
export const SURFACE_PLACEMENT = "PLACEMENT:A-12:S1:5000:6000";

/** What a scenario hands a case: the input, the wall or surface it was built from, and the edition. */
export type Scenario = {
  input: RailInputShape;
  placementKey: string;
  objectKey: string;
  levelLabel: string;
  edition: EditionSetupShape;
  openings: readonly OpeningSetupShape[];
};

/** The one register row of a one-member scenario, and the input around it. */
function oneMemberScenario(options: {
  kind: string;
  placementKey: string;
  elementType: string;
  mark: string;
  levelLabel: string;
  edition: EditionSetupShape;
  wall?: WallSetupShape;
  surface?: SurfaceSetupShape;
}): Scenario {
  const row = registerRow({ placementKey: options.placementKey, elementType: options.elementType, mark: options.mark, levelLabel: options.levelLabel });
  const held = options.wall ?? options.surface;
  return {
    input: railInput({
      kind: options.kind,
      objects: [row],
      placements: { [options.placementKey]: placement({ memberFamily: options.mark, sourceEntity: `${PLACEMENT_SOURCE_ENTITY}:${options.mark}` }) },
      walls: options.wall === undefined ? {} : { [options.placementKey]: options.wall },
      surfaces: options.surface === undefined ? {} : { [options.placementKey]: options.surface },
      edition: options.edition,
    }),
    placementKey: options.placementKey,
    objectKey: String(row["objectKey"]),
    levelLabel: options.levelLabel,
    edition: options.edition,
    openings: held?.openings ?? [],
  };
}

/**
 * F-MASONRY-WALL (pure) — one 250 mm brick wall on 1F of a 1F–6F stack, with the four-row opening
 * schedule the test contract states: two rows claiming no floors, one claiming 1F–6F (so its
 * instances are DERIVED expansions, L-MEA-02) and one claiming 3F–6F, which this wall's level is
 * not in and which therefore contributes nothing.
 */
export function wallScenario(edition: EditionSetupShape): Scenario {
  const source = (field: string): string => `model#BW250@1F.${field}`;
  return oneMemberScenario({
    kind: MASONRY_BRICKWORK,
    placementKey: WALL_PLACEMENT,
    elementType: BRICK_WALL,
    mark: "BW250",
    levelLabel: "1F",
    edition,
    wall: wall({
      length: reading("55792.977", MILLIMETRE, { source: source("length") }),
      height: reading("2902.8", MILLIMETRE, { source: source("height") }),
      thickness: reading("250", MILLIMETRE, { source: source("thickness") }),
      openings: [
        opening({ mark: "L1", area: reading("1200000", MILLIMETRE_SQUARED, { source: "sched#L1" }), count: "10", floors: null }),
        opening({ mark: "L2", area: reading("2520000", MILLIMETRE_SQUARED, { source: "sched#L2" }), count: "8", floors: { from: "1F", to: "6F" } }),
        opening({ mark: "LS1", area: reading("1800000", MILLIMETRE_SQUARED, { source: "sched#LS1" }), count: "6", floors: null }),
        opening({ mark: "X", area: reading("1000000", MILLIMETRE_SQUARED, { source: "sched#X" }), count: "3", floors: { from: "3F", to: "6F" } }),
      ],
    }),
  });
}

/**
 * F-MASONRY-PARTITION — a 10 m × 3 m × 250 mm wall on 1F with four single openings straddling the
 * threshold: 0.09 m² and 0.10 m² kept (the boundary is KEPT, L-MEA-02's "strictly greater"), 0.11 m²
 * and 2.10 m² deducted. The deducted sum is 2.21 m² and the figure (10 × 3 − 2.21) × 0.25.
 */
export function partitionScenario(edition: EditionSetupShape): Scenario {
  return oneMemberScenario({
    kind: MASONRY_BRICKWORK,
    placementKey: PARTITION_PLACEMENT,
    elementType: BRICK_WALL,
    mark: "BW250",
    levelLabel: "1F",
    edition,
    wall: wall({
      length: reading("10000", MILLIMETRE, { source: "model#P1.length" }),
      height: reading("3000", MILLIMETRE, { source: "model#P1.height" }),
      thickness: reading("250", MILLIMETRE, { source: "model#P1.thickness" }),
      openings: [
        opening({ mark: "o1", area: reading("90000", MILLIMETRE_SQUARED, { source: "sched#o1" }), count: "1", floors: null, source: "sched#o1" }),
        opening({ mark: "o2", area: reading("100000", MILLIMETRE_SQUARED, { source: "sched#o2" }), count: "1", floors: null, source: "sched#o2" }),
        opening({ mark: "o3", area: reading("110000", MILLIMETRE_SQUARED, { source: "sched#o3" }), count: "1", floors: null, source: "sched#o3" }),
        opening({ mark: "o4", area: reading("2100000", MILLIMETRE_SQUARED, { source: "sched#o4" }), count: "1", floors: null, source: "sched#o4" }),
      ],
    }),
  });
}

/** What F-MASONRY-PARTITION's own arithmetic says, spelled once for both lanes (AC-6). */
export const PARTITION_DEDUCTED_SOURCES: readonly string[] = Object.freeze(["sched#o3", "sched#o4"]);
export const PARTITION_KEPT_SOURCES: readonly string[] = Object.freeze(["sched#o1", "sched#o2"]);
export const PARTITION_DEDUCTED_M2 = "2.21";

/**
 * F-MASONRY-SURFACE — one closed internal surface on 2F, 42 m² gross, with three opening instances:
 * one of 0.09 m² kept and two of 2.1 m² deducted. The plaster's net is 42 − 4.2 = 37.8 m².
 */
export function surfaceScenario(edition: EditionSetupShape, kind: string = FINISH_PLASTER): Scenario {
  return oneMemberScenario({
    kind,
    placementKey: SURFACE_PLACEMENT,
    elementType: SURFACE,
    mark: "S1",
    levelLabel: "2F",
    edition,
    surface: surface({
      closed: true,
      gross: reading("42000000", MILLIMETRE_SQUARED, { source: "model#S1.gross" }),
      face: reading("INTERNAL", FACE_UNIT, { source: "model#S1.face" }),
      floor: reading("2F", FLOOR_UNIT, { source: "model#S1.floor" }),
      thickness: reading("12", MILLIMETRE, { source: "model#S1.thickness" }),
      mix: reading("1:4", MIX_UNIT, { source: "model#S1.mix" }),
      openings: [
        opening({ mark: "w1", area: reading("90000", MILLIMETRE_SQUARED, { source: "sched#w1" }), count: "1", floors: null, source: "sched#w1" }),
        opening({ mark: "w2", area: reading("2100000", MILLIMETRE_SQUARED, { source: "sched#w2" }), count: "2", floors: null, source: "sched#w2" }),
      ],
    }),
  });
}

/** What F-MASONRY-SURFACE's own arithmetic says, spelled once for both lanes (AC-7, AC-8). */
export const SURFACE_GROSS_M2 = "42";
export const SURFACE_DEDUCTED_M2 = "4.2";
export const SURFACE_NET_M2 = "37.8";

/** The selectors each finish kind offers, by name (AC-7). */
export const PLASTER_SELECTORS: readonly string[] = Object.freeze(["thickness", "mix", "face", "floor"]);
export const PAINT_SELECTORS: readonly string[] = Object.freeze(["face", "floor"]);

/** The selectors brickwork offers, by name (AC-3). */
export const BRICKWORK_SELECTORS: readonly string[] = Object.freeze(["thickness"]);

/**
 * Every opening INSTANCE a schedule states for one level: one per unit of `count`, and none at all
 * from a row whose claimed floors do not cover that level (L-MEA-02, AC-3).
 *
 * Derived from the scenario's own schedule rather than counted here, so a row added to a scenario
 * moves the expectation with it and nothing is pinned to a number a later edit would falsify (B-19).
 */
export function expectedCandidates(openings: readonly OpeningSetupShape[], levelLabel: string, channel: string, levels: readonly LevelSetupShape[] = levelStack()): DeductionShape[] {
  const ordinalOf = (label: string): number | undefined => levels.find((level) => level.label === label)?.ordinal;
  const standing = ordinalOf(levelLabel);
  expect(standing, `the stack carries ${levelLabel} — a scenario's member stands on a level of its own stack`).not.toBeUndefined();
  const made: DeductionShape[] = [];
  for (const row of openings) {
    const area = row.area;
    if (area === null) continue;
    if (row.floors !== null) {
      const from = row.floors.from === null ? undefined : ordinalOf(row.floors.from);
      const to = row.floors.to === null ? undefined : ordinalOf(row.floors.to);
      const at = standing as number;
      if (at < (from ?? at) || at > (to ?? at)) continue;
    }
    // A row claiming floors is an EXPANSION, so its instances are DERIVED; a row claiming none
    // stands in the wall's own floor group and carries the area's own basis (L-MEA-02).
    const basis = row.floors === null ? area.basis : DERIVED;
    for (let at = 0; at < Number(row.count.value); at += 1) {
      made.push({ channel, measure: { value: area.value, unit: area.unit, basis, source: row.source } });
    }
  }
  return made;
}

/* ------------------------------------------------------------- the fixtures, as they are written */

/** One member of a fixture's model, as the model states it (fixtures/<id>/model.json). */
export type ModelMember = {
  id: string;
  class: string;
  mark: string;
  level: string;
  geom: string;
  length?: string;
  h?: string;
  t?: string;
  openings?: string;
};

/** Every member of a fixture's model, as the fixture wrote them. */
export function modelMembers(relative: string): ModelMember[] {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as { members?: ModelMember[] };
  expect(Array.isArray(parsed.members), `${relative} states the members the fixture was authored from`).toBe(true);
  return parsed.members ?? [];
}

/** How the model spells the class this leaf measures (test contract). */
export const MODEL_BRICK_WALL = "BRICK_WALL";

/** The twelve brick walls of the BNBC model, as the fixture wrote them (AC-5). */
export function bnbcBrickWalls(): ModelMember[] {
  const held = modelMembers(BNBC_MODEL).filter((member) => member.class === MODEL_BRICK_WALL);
  expect(held.length, `${BNBC_MODEL} carries the brick walls this leaf measures`).toBeGreaterThan(0);
  return held;
}

/** The golden rows of one fixture standing in one (class, kind, level, component) — the file's own. */
export function goldenBrickworkRows(fixtureId: string = BNBC_FIXTURE): GoldenRow[] {
  return goldenRowsOf(fixtureId).filter((row) => row.class === GOLDEN_CLASS[BRICK_WALL] && row.kind === GOLDEN_KIND[MASONRY_BRICKWORK]);
}

/**
 * What the golden says one row is worth: its printed figure, and the half unit in the last place
 * the file's own printing could have taken off it.
 *
 * A golden row is a PRINTED figure. L-QTY-06's yardstick is the TAKEOFF the independent model
 * measured, not the string a fixture rounds it to (the reading settled at inc-307), so the over arm
 * of the band is judged against the printed figure plus that half unit.
 */
export function goldenFigure(row: GoldenRow, exact: (value: string) => DecimalLike): { printed: DecimalLike; halfUlp: DecimalLike; said: string } {
  const places = (row.quantity.split(".")[1] ?? "").length;
  return {
    printed: exact(row.quantity),
    halfUlp: exact(places === 0 ? "0.5" : `0.${"0".repeat(places)}5`),
    said: `${row.quantity} ${row.unit}`,
  };
}
