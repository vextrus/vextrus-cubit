/**
 * The FOUNDATIONS shard's public test contract: the module homes, the vocabulary, the shapes and the
 * hand-built rail input every case of this leaf is driven with (R-TO-032, L-FRM-02, L-FRM-04,
 * L-MEA-06, L-QTY-02/04).
 *
 * Mechanics only — nothing here judges the product. It opens no database and imports nothing that
 * does, so a PURE case (a rail is a pure function, L-MEA-08) stays in the unit lane; the live
 * campaign a band criterion needs is staged beside it in `./foundations-stage.ts`, which re-exports
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
 * the spec can pass every case.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { goldenRows as goldenRowsOf, type GoldenRow } from "../../../../golden/support/golden-fixture";
import { REPO_ROOT, productModule } from "../../../../server/support/wire";

export { REPO_ROOT, productModule };
export { goldenDocument, goldenRows, type GoldenRow } from "../../../../golden/support/golden-fixture";

/* ------------------------------------------------------------------ the homes the spec names */

/** The rails themselves: the five pure functions, their rule ids and their closed code roster. */
export const FOUNDATIONS_RAIL_MODULE = "src/modules/takeoff/rails/foundations/index.ts";

/** The area's roster, the frame's (which composes the foundation concrete reader in) and the barrel. */
export const FOUNDATIONS_ROSTER_MODULE = "src/modules/takeoff/rails/foundations.ts";
export const FRAME_ROSTER_MODULE = "src/modules/takeoff/rails/frame.ts";
export const RAILS_BARREL_MODULE = "src/modules/takeoff/rails/index.ts";

/** The rail law, which gains the composition one kind's several class readers are joined by. */
export const RAILS_LAW_MODULE = "src/modules/takeoff/rails/law.ts";

/** The column rail, whose reader the frame's `rcc.concrete` line composes with this leaf's. */
export const COLUMN_RAIL_MODULE = "src/modules/takeoff/rails/columns/index.ts";

/** The SITE-fact law, its core store and the ONE module door that reads the ledger (interfaces). */
export const SITE_FACTS_LAW_MODULE = "src/core/site-facts/law.ts";
export const SITE_FACTS_STORE_MODULE = "src/core/site-facts/store.ts";
export const SITE_FACTS_DOOR_MODULE = "src/modules/takeoff/site-facts/index.ts";

/** The area's method shard, the registry file that records it, and the registry barrel (AC-2). */
export const FOUNDATIONS_SHARD = "src/core/rulesets/methods/foundations/foundations.methods.json";
export const FOUNDATIONS_METHOD_AREA_MODULE = "src/core/rulesets/methods/registry/foundations.ts";
export const METHODS_REGISTRY_MODULE = "src/core/rulesets/methods/registry.ts";

/** The area's refusals, the barrel the closed taxonomy is read at, and Q-07's vocabulary roster. */
export const FOUNDATIONS_ERRORS_MODULE = "src/core/errors/foundations.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const TRANSPORT_VOCABULARY_MODULE = "src/core/errors/transport-vocabulary.ts";

/** The catalogue, its maps, the `bears` relation and the emitter the committed tables come from. */
export const KINDS_MODULE = "src/core/catalogue/kinds.ts";
export const KIND_LAW_MODULE = "src/core/catalogue/kind-law.ts";
export const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";
export const CATALOGUE_MAPS_MODULE = "src/core/catalogue/maps.ts";
export const BEARS_MODULE = "src/core/catalogue/bears.ts";
export const CATALOGUE_EMIT_MODULE = "src/core/catalogue/emit.ts";

/** Where the emitted catalogue tables are committed (L-MEA-04, AC-1). */
export const CATALOGUE_DIR = "db/catalogue";

/** The unit canon, the gate's normalisation and the area's own schema file (interfaces). */
export const CANON_MODULE = "src/core/units/canon.ts";
export const GATE_MODULE = "src/core/gate/index.ts";
export const SCHEMA_FOUNDATIONS_MODULE = "src/core/db/schema-foundations.ts";
export const DB_SEAM_MODULE = "src/core/db.ts";

/** The seed rule set, re-minted so a pin puts this leaf's methods in force (AC-2). */
export const SEED_MODULE = "src/core/rulesets/seed/index.ts";
export const EDITIONS_MODULE = "src/core/rulesets/editions/index.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The four kinds that join the closed catalogue, and the one this leaf's concrete reader joins. */
export const RCC_CONCRETE = "rcc.concrete";
export const PILING_BORED = "piling.bored";
export const PILING_BORING = "piling.boring";
export const EARTHWORK_EXCAVATION = "earthwork.excavation";
export const PCC_BLINDING = "pcc.blinding";

/** The four kinds the FOUNDATIONS roster keys, each by the rail the interfaces name (AC-1). */
export const FOUNDATIONS_ROSTER_LINES: Readonly<Record<string, string>> = Object.freeze({
  [PILING_BORED]: "pileCountRail",
  [PILING_BORING]: "pileLengthRail",
  [EARTHWORK_EXCAVATION]: "excavationRail",
  [PCC_BLINDING]: "blindingRail",
});

/** The three classes this leaf measures (goal). */
export const FOOTING = "footing";
export const PILE_CAP = "pile_cap";
export const PILE = "pile";

/** The seven rule ids, as `src/modules/takeoff/rails/foundations/index.ts` publishes them. */
export const FOUNDATION_PRISM_RECT_RULE_ID = "rcc.foundation.prism_rect";
export const FOUNDATION_PRISM_POLY_RULE_ID = "rcc.foundation.prism_poly";
export const PILE_CONCRETE_RULE_ID = "rcc.pile.concrete";
export const PILE_COUNT_RULE_ID = "piling.bored.count";
export const PILE_LENGTH_RULE_ID = "piling.bored.length";
export const EXCAVATION_RULE_ID = "earthwork.pit_rect";
export const BLINDING_RULE_ID = "pcc.blinding_rect";

/** One (rule id, version) pair, as an edition cites one and the registry enumerates one. */
export type MethodPairShape = { ruleId: string; version: string };

/** The version every method of this shard lands at, and the seven pairs it records (AC-2). */
export const FOUNDATIONS_VERSION = "1";
export const FOUNDATIONS_RULE_IDS: readonly string[] = Object.freeze([
  FOUNDATION_PRISM_RECT_RULE_ID,
  FOUNDATION_PRISM_POLY_RULE_ID,
  PILE_CONCRETE_RULE_ID,
  PILE_COUNT_RULE_ID,
  PILE_LENGTH_RULE_ID,
  EXCAVATION_RULE_ID,
  BLINDING_RULE_ID,
]);
export const FOUNDATIONS_PAIRS: readonly MethodPairShape[] = Object.freeze(
  FOUNDATIONS_RULE_IDS.map((ruleId) => Object.freeze({ ruleId, version: FOUNDATIONS_VERSION })),
);

/** The six SITE facts the closed enum holds (L-MEA-06, interfaces). */
export const GROUND_LEVEL = "GROUND_LEVEL";
export const WATER_TABLE = "WATER_TABLE";
export const WORKING_ALLOWANCE = "WORKING_ALLOWANCE";
export const DEPTH_EXTRA = "DEPTH_EXTRA";
export const BLINDING_PROJECTION = "BLINDING_PROJECTION";
export const BLINDING_THICKNESS = "BLINDING_THICKNESS";

/** The edition parameter each DERIVED reading falls back to (interfaces, L-MEA-01's roster). */
export const WORKING_ALLOWANCE_PARAMETER = "earthworkWorkingAllowance";
export const DEPTH_EXTRA_PARAMETER = "earthworkDepthExtra";
export const BLINDING_PROJECTION_PARAMETER = "blindingProjection";
export const BLINDING_THICKNESS_PARAMETER = "blindingThickness";

/** The ten codes of the foundations shard, by name (AC-8, interfaces). */
export const PILE_LENGTH_UNSTATED = "PILE_LENGTH_UNSTATED";
export const PILE_DIAMETER_UNSTATED = "PILE_DIAMETER_UNSTATED";
export const FOUNDATION_DEPTH_UNSTATED = "FOUNDATION_DEPTH_UNSTATED";
export const FOUNDATION_PLAN_UNSTATED = "FOUNDATION_PLAN_UNSTATED";
export const FOUNDING_LEVEL_UNSTATED = "FOUNDING_LEVEL_UNSTATED";
export const GROUND_LEVEL_UNSTATED = "GROUND_LEVEL_UNSTATED";
export const EARTHWORK_PLAN_DEFERRED = "EARTHWORK_PLAN_DEFERRED";
export const BLINDING_PLAN_DEFERRED = "BLINDING_PLAN_DEFERRED";
export const SITE_FACT_UNKNOWN = "SITE_FACT_UNKNOWN";
export const SITE_FACT_SOURCE_UNSTATED = "SITE_FACT_SOURCE_UNSTATED";

/** The two codes the rails report as OBSERVATIONS, exactly as the column rail reports them (AC-8). */
export const VIEW_SCALE_UNAFFIRMED = "VIEW_SCALE_UNAFFIRMED";
export const MEMBER_TYPE_UNKNOWN = "MEMBER_TYPE_UNKNOWN";

/** The canon's refusal for a spelling it carries no factor for (interfaces). */
export const UNIT_UNMAPPED = "UNIT_UNMAPPED";

/** L-QTY-02's two coverages this leaf publishes under. */
export const COMPLETE = "COMPLETE";
export const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The bases L-QTY-01 orders by recourse that this leaf's readings carry (AC-2, AC-5). */
export const MEASURED = "MEASURED";
export const TRANSCRIBED = "TRANSCRIBED";
export const DERIVED = "DERIVED";
export const ENTERED = "ENTERED";

/** The engine that read the drawing (L-QTY-03). */
export const VECTOR = "VECTOR";

/** The two plan geometries a foundation is read off (L-FRM-01/02). */
export const PRISM_RECT = "PRISM_RECT";
export const PRISM_POLY = "PRISM_POLY";

/** The table the SITE-fact ledger stands in (interfaces). */
export const SITE_FACTS_TABLE = "site_facts";

/** The unit every dimension of a staged member is written in — the model's own (fixtures). */
export const MILLIMETRE = "mm";

/** The unit a plan outline's area is read in (interfaces: the canon gains `mm2`). */
export const MILLIMETRE_SQUARED = "mm2";

/** The unit a count is read in — the canon's canonical unit of the COUNT dimension. */
export const PIECES = "pcs";

/** How the golden spells this leaf's kinds and classes (test contract). */
export const GOLDEN_KIND: Readonly<Record<string, string>> = Object.freeze({
  [RCC_CONCRETE]: "RCC_CONCRETE",
  [PILING_BORED]: "PILE_COUNT",
  [PILING_BORING]: "PILE_LENGTH",
  [EARTHWORK_EXCAVATION]: "EXCAVATION",
  [PCC_BLINDING]: "BLINDING",
});
export const GOLDEN_CLASS: Readonly<Record<string, string>> = Object.freeze({ [FOOTING]: "FOOTING", [PILE_CAP]: "PILE_CAP", [PILE]: "PILE" });
export const GOLDEN_LEVEL: Readonly<Record<string, string>> = Object.freeze({ [FOOTING]: "FDN", [PILE_CAP]: "FDN", [PILE]: "PILE" });

/** The fixtures this leaf is graded against (test contract). */
export const BNBC_FIXTURE = "rcc6-bnbc";
export const RCC6_FIXTURE = "rcc6";
export const BNBC_MODEL = "fixtures/rcc6-bnbc/model.json";
export const BNBC_SITE = "fixtures/rcc6-bnbc/site.json";
export const RCC6_INPUTS = "fixtures/rcc6/inputs.json";

/** L-QTY-06's band: three per cent under a competent manual takeoff, and never a unit over. */
export const UNDER_TOLERANCE = "0.97";

/* ------------------------------------------------------------------ the shapes the rails answer in */

/** One reading, as an offer carries one (`Measure`). */
export type MeasureShape = { value: string; unit: string; basis: string; source: string; calibration?: string };

/** One declared variable a PARTIAL_DECLARED offer leaves out, with the code it is omitted under. */
export type OmittedShape = { variable: string; code: string };

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
  deductions: readonly { channel: string; measure: MeasureShape }[];
  omitted: readonly OmittedShape[];
  coverage: string;
};

/** The own keys of the `Offer` contract — what an offer carries, and nothing else (L-MEA-08). */
export const OFFER_KEYS: readonly string[] = Object.freeze([
  "bindings",
  "class",
  "coverage",
  "deductions",
  "drawing",
  "engine",
  "geometry",
  "kind",
  "omitted",
  "register",
  "ruleId",
  "selectors",
]);

/** One observation a rail reports beside its offers (`RailObservation`). */
export type RailObservationShape = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> };

/** What a rail answers with (`RailBatch`). */
export type RailBatchShape = { offers: readonly OfferShape[]; observations: readonly RailObservationShape[] };

/** The plan outline a placement carries, where a reader read one (interfaces: `OutlineSetup`). */
export type OutlineSetup = { type: string; area: MeasureShape; length: MeasureShape | null; breadth: MeasureShape | null };

/** One placement of the read-only setup (interfaces: `PlacementSetup`, widened with `outline`). */
export type PlacementSetup = {
  drawingId: string;
  ingestId: string;
  viewKey: string;
  memberFamily: string | null;
  engine: string;
  sourceEntity: string;
  outline: OutlineSetup | null;
};

/** One member-type variant (interfaces: `MemberVariantSetup`, widened with `dimensions`). */
export type VariantSetup = {
  variantKey: string;
  bandFrom: string | null;
  bandTo: string | null;
  sectionText: string;
  sectionWidth: number | null;
  sectionDepth: number | null;
  sectionUnit: string | null;
  sourceKeys: readonly string[];
  dimensions: Record<string, MeasureShape>;
};

/** One standing SITE fact, as the setup carries one (interfaces: `SiteFactSetup`). */
export type SiteFactSetup = { value: string; unit: string; canonicalMetres: string; sourceNote: string; actId: string };

/** The pinned edition a DERIVED reading is bound from (interfaces: `RailSetup.edition`). */
export type EditionSetup = { digest: string; parameters: Record<string, { value: string; unit: string }> };

/** The read-only setup a rail is handed (interfaces: `RailSetup`, widened by this leaf). */
export type RailSetupShape = {
  placements: Record<string, PlacementSetup>;
  memberTypes: Record<string, Record<string, readonly VariantSetup[]>>;
  levels: readonly unknown[];
  calibrations: Record<string, Record<string, string>>;
  grades: Record<string, MeasureShape>;
  runs: Record<string, unknown>;
  lintels: Record<string, unknown>;
  siteFacts: Record<string, SiteFactSetup>;
  edition: EditionSetup;
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
export type FoundationsRailDoor = {
  foundationConcreteRail: RailShape;
  pileCountRail: RailShape;
  pileLengthRail: RailShape;
  excavationRail: RailShape;
  blindingRail: RailShape;
  FOUNDATIONS_RAIL_CODES: readonly string[];
  FOUNDATION_PRISM_RECT_RULE_ID: string;
  FOUNDATION_PRISM_POLY_RULE_ID: string;
  PILE_CONCRETE_RULE_ID: string;
  PILE_COUNT_RULE_ID: string;
  PILE_LENGTH_RULE_ID: string;
  EXCAVATION_RULE_ID: string;
  BLINDING_RULE_ID: string;
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

/** The SITE-fact law, as a case drives it (interfaces). */
export type SiteFactWriteShape = {
  fact: string;
  valueAsWritten: string;
  unitAsWritten: string;
  canonicalMetres: string;
  factor: string;
  sourceNote: string;
};
export type SiteFactsLaw = {
  SITE_FACTS: readonly string[];
  isSiteFact: (value: unknown) => boolean;
  siteFactWrite: (input: { fact: string; valueAsWritten: string; unitAsWritten: string; sourceNote: string }) => SiteFactWriteShape;
  standingSiteFacts: (rows: readonly Record<string, unknown>[]) => Record<string, StandingSiteFactShape | undefined>;
};

/** One standing fact, as the door answers one (interfaces: `StandingSiteFact`). */
export type StandingSiteFactShape = {
  fact: string;
  valueAsWritten: string;
  unitAsWritten: string;
  canonicalMetres: string;
  sourceNote: string;
  actId: string;
  enteredAt: string;
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
  /** What one unit is worth in its canonical unit, as the exact decimal string the canon holds. */
  factorOf: (unit: string) => string;
  isUnit: (value: unknown) => boolean;
  CANONICAL_UNIT: Readonly<Record<string, string>>;
  FACTORS: Readonly<Record<string, { dimension: string; factor: string }>>;
};

/** One entry of the closed refusal taxonomy. */
export type RefusalEntryShape = { message: string; remedy: string; severity: string; surface: string };

/* ------------------------------------------------------------------ loading the doors */

/** The five rails, with the names their home publishes asserted before any of them is driven. */
export async function foundationsRailDoor(): Promise<FoundationsRailDoor> {
  const door = await productModule<Record<string, unknown>>(FOUNDATIONS_RAIL_MODULE);
  for (const rail of ["foundationConcreteRail", "pileCountRail", "pileLengthRail", "excavationRail", "blindingRail"]) {
    expect(typeof door[rail], `${FOUNDATIONS_RAIL_MODULE} publishes \`${rail}\` — a pure rail this increment lands (interfaces)`).toBe("function");
  }
  expect(Array.isArray(door["FOUNDATIONS_RAIL_CODES"]), `${FOUNDATIONS_RAIL_MODULE} publishes \`FOUNDATIONS_RAIL_CODES\` as a list (interfaces)`).toBe(true);
  return door as unknown as FoundationsRailDoor;
}

/** The area's roster, keyed by kind (AC-1). */
export async function foundationsRoster(): Promise<Record<string, RailShape>> {
  const door = await productModule<Record<string, unknown>>(FOUNDATIONS_ROSTER_MODULE);
  const roster = door["FOUNDATIONS_RAILS"];
  expect(roster !== null && typeof roster === "object", `${FOUNDATIONS_ROSTER_MODULE} publishes \`FOUNDATIONS_RAILS\` — this area's roster (AM-11)`).toBe(true);
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
export async function foundationsMethod(pair: MethodPairShape): Promise<FormulaMethodShape> {
  const registry = await methodsRegistry();
  const implementation = registry.implementationOf(pair);
  expect(
    implementation,
    `the registry maps ${pair.ruleId}@${pair.version} to an implementation — an edition cites the pair and the gate resolves it through the registry (AC-2)`,
  ).toBeTruthy();
  return implementation as unknown as FormulaMethodShape;
}

/** The SITE-fact law (interfaces). */
export async function siteFactsLaw(): Promise<SiteFactsLaw> {
  const door = await productModule<Record<string, unknown>>(SITE_FACTS_LAW_MODULE);
  for (const call of ["isSiteFact", "siteFactWrite", "standingSiteFacts"]) {
    expect(typeof door[call], `${SITE_FACTS_LAW_MODULE} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  expect(Array.isArray(door["SITE_FACTS"]), `${SITE_FACTS_LAW_MODULE} publishes \`SITE_FACTS\` as a closed list (L-MEA-06)`).toBe(true);
  return door as unknown as SiteFactsLaw;
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

/** Where a refusal's code is read off a thrown failure (the shipped marker, ARCH-03). */
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/**
 * The registered code a call refused with — asserted to have refused at all.
 *
 * A refusal is RETURNED as a code by the taxonomy's own marker, so a case reads the code rather than
 * matching a message (L-QTY-04: reason codes are closed enums, never prose).
 */
export async function refusalCodeOf(call: () => unknown, where: string): Promise<string | null> {
  const marker = await productModule<{ refusalCodeOf: (failure: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  let answered: unknown;
  try {
    answered = await call();
  } catch (failure) {
    const direct = marker.refusalCodeOf(failure);
    if (direct !== null) return direct;
    const cause = (failure as { cause?: unknown } | null)?.cause;
    return cause === undefined ? null : marker.refusalCodeOf(cause);
  }
  expect.fail(`${where} was expected to refuse, and answered ${JSON.stringify(answered)}`);
}

/* ------------------------------------------------------------------ the setup, by hand */

/** One reading of the setup, spelled once so a case names only what it changes. */
export function reading(value: string, unit: string, options: { basis?: string; source?: string; calibration?: string } = {}): MeasureShape {
  const whole: MeasureShape = { value, unit, basis: options.basis ?? MEASURED, source: options.source ?? "S-01:e:1" };
  return options.calibration === undefined ? whole : { ...whole, calibration: options.calibration };
}

/** One member-type variant, with the section a schedule stated and the dimensions it names beside it. */
export function variant(options: {
  variantKey?: string;
  width?: number | null;
  depth?: number | null;
  unit?: string | null;
  sectionText?: string;
  sourceKeys?: readonly string[];
  dimensions?: Record<string, MeasureShape>;
}): VariantSetup {
  const width = options.width ?? null;
  const depth = options.depth ?? null;
  return {
    variantKey: options.variantKey ?? "F1",
    bandFrom: null,
    bandTo: null,
    sectionText: options.sectionText ?? (width === null || depth === null ? "" : `${String(width)}x${String(depth)}`),
    sectionWidth: width,
    sectionDepth: depth,
    sectionUnit: options.unit === undefined ? MILLIMETRE : options.unit,
    sourceKeys: options.sourceKeys ?? [SECTION_SOURCE],
    dimensions: options.dimensions ?? {},
  };
}

/** One plan outline, as a reader of the plan answers one (interfaces: `OutlineSetup`). */
export function outline(options: { type: string; area: MeasureShape; length?: MeasureShape | null; breadth?: MeasureShape | null }): OutlineSetup {
  return { type: options.type, area: options.area, length: options.length ?? null, breadth: options.breadth ?? null };
}

/** One placement of the setup, with the outline a plan reader read where it read one. */
export function placement(options: { viewKey?: string; memberFamily: string | null; sourceEntity: string; outline?: OutlineSetup | null }): PlacementSetup {
  return {
    drawingId: DRAWING_ID,
    ingestId: INGEST_ID,
    viewKey: options.viewKey ?? VIEW_KEY,
    memberFamily: options.memberFamily,
    engine: VECTOR,
    sourceEntity: options.sourceEntity,
    outline: options.outline ?? null,
  };
}

/** One standing SITE fact of the setup, as the measure job reads one off the ledger. */
export function siteFact(options: { value: string; unit?: string; canonicalMetres: string; actId?: string; sourceNote?: string }): SiteFactSetup {
  return {
    value: options.value,
    unit: options.unit ?? MILLIMETRE,
    canonicalMetres: options.canonicalMetres,
    sourceNote: options.sourceNote ?? "S-01 general notes",
    actId: options.actId ?? ACT_ID,
  };
}

/** One register object row, as the store holds one — what a rail is handed to read (L-REG-01). */
export function registerRow(options: {
  setRevisionId?: string;
  placementKey: string;
  elementType: string;
  mark?: string;
  viewKey?: string;
  standing?: string;
}): Record<string, unknown> {
  // A foundation member stands in the FOUNDATION slot and on no level of the stack (L-REG-02).
  const objectKey = `${options.placementKey}@FOUNDATION`;
  return {
    tenantId: TENANT_ID,
    setRevisionId: options.setRevisionId ?? SET_REVISION,
    objectKey,
    projectId: PROJECT_ID,
    discipline: "STRUCTURAL",
    elementType: options.elementType,
    mark: options.mark ?? "F1",
    viewKey: options.viewKey ?? VIEW_KEY,
    placementKey: options.placementKey,
    levelId: null,
    levelSlot: "FOUNDATION",
    levelLabel: null,
    standing: options.standing ?? MEASURED,
    semantic: `semantic:${objectKey}`,
    registeredAt: new Date(0),
  };
}

/** What one hand-built rail input is made of, so a case names only what it changes. */
export type RailInputDraft = {
  kind: string;
  campaignId?: string;
  setRevisionId?: string;
  objects: readonly Record<string, unknown>[];
  placements: Record<string, PlacementSetup>;
  memberTypes?: Record<string, Record<string, readonly VariantSetup[]>>;
  calibrations?: Record<string, Record<string, string>>;
  grades?: Record<string, MeasureShape>;
  siteFacts?: Record<string, SiteFactSetup>;
  edition?: EditionSetup;
  levels?: readonly unknown[];
};

/** One rail input, whole — every seam of the setup assembled, empty where nothing was read. */
export function railInput(draft: RailInputDraft): RailInputShape {
  const views: Record<string, string> = {};
  for (const one of Object.values(draft.placements)) views[one.viewKey] = CALIBRATION_KEY;
  return {
    campaignId: draft.campaignId ?? CAMPAIGN_ID,
    setRevisionId: draft.setRevisionId ?? SET_REVISION,
    kind: draft.kind,
    objects: draft.objects,
    setup: {
      placements: draft.placements,
      memberTypes: draft.memberTypes ?? {},
      levels: draft.levels ?? [],
      calibrations: draft.calibrations ?? { [INGEST_ID]: views },
      grades: draft.grades ?? {},
      runs: {},
      lintels: {},
      siteFacts: draft.siteFacts ?? {},
      edition: draft.edition ?? SEED_EDITION_SETUP,
    },
  };
}

/** The surrogates a hand-built case reads — a rail never asks a store for any of them. */
export const TENANT_ID = "00000000-0000-4000-8000-000000000001";
export const PROJECT_ID = "00000000-0000-4000-8000-000000000002";
export const SET_REVISION = "11111111-1111-4111-8111-111111111111";
export const CAMPAIGN_ID = "00000000-0000-4000-8000-0000000000f1";
export const DRAWING_ID = "22222222-2222-4222-8222-222222222222";
export const INGEST_ID = "33333333-3333-4333-8333-333333333333";
export const VIEW_KEY = "PLAN:S-04:t:2";
export const CALIBRATION_KEY = "cal-fdn-1";
export const SECTION_SOURCE = "S-04:e:7";
export const ACT_ID = "55555555-5555-4555-8555-555555555555";

/** The edition digest a hand-built case's DERIVED readings cite. */
export const EDITION_DIGEST = "d0000000000000000000000000000000000000000000000000000000000000ed";

/**
 * The edition a hand-built case binds its DERIVED readings from: the four L-FRM-04 parameters at the
 * seed's own values and units, which is what a project pinned to the seed holds (L-MEA-01).
 */
export const SEED_EDITION_SETUP: EditionSetup = Object.freeze({
  digest: EDITION_DIGEST,
  parameters: Object.freeze({
    [WORKING_ALLOWANCE_PARAMETER]: Object.freeze({ value: "1.5", unit: "ft" }),
    [DEPTH_EXTRA_PARAMETER]: Object.freeze({ value: "0.5", unit: "ft" }),
    [BLINDING_PROJECTION_PARAMETER]: Object.freeze({ value: "3", unit: "in" }),
    [BLINDING_THICKNESS_PARAMETER]: Object.freeze({ value: "3", unit: "in" }),
  }),
}) as EditionSetup;

/** How a DERIVED reading cites the edition it was bound from (interfaces). */
export function editionSource(edition: EditionSetup, parameterKey: string): string {
  return `edition:${edition.digest}#${parameterKey}`;
}

/** How an ENTERED reading cites the act it was entered by (interfaces). */
export function actSource(actId: string): string {
  return `act:${actId}`;
}

/* ------------------------------------------------------------------ the fixtures, as they are written */

/** One member of a fixture's model, as the model states it (fixtures/<id>/model.json). */
export type ModelMember = {
  id: string;
  class: string;
  mark: string;
  level: string;
  geom: string;
  l?: string;
  b?: string;
  depth?: string;
  area?: string;
  top?: string;
  dia?: string;
  length?: string;
};

/** Every member of a fixture's model, as the fixture wrote them. */
export function modelMembers(relative: string): ModelMember[] {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as { members?: ModelMember[] };
  expect(Array.isArray(parsed.members), `${relative} states the members the fixture was authored from`).toBe(true);
  return parsed.members ?? [];
}

/** The SITE facts a fixture's site file states (fixtures/<id>/site.json). */
export function modelSiteFacts(relative: string): Record<string, string> {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as { facts?: Record<string, string> };
  expect(parsed.facts !== undefined, `${relative} states the SITE facts the fixture was authored under (L-MEA-06)`).toBe(true);
  return parsed.facts ?? {};
}

/** How a fixture's site file names each fact of the closed enum (fixtures/rcc6-bnbc/site.json). */
export const SITE_FILE_KEY: Readonly<Record<string, string>> = Object.freeze({
  [GROUND_LEVEL]: "egl_mm",
  [WORKING_ALLOWANCE]: "working_allowance_mm",
  [DEPTH_EXTRA]: "depth_extra_mm",
  [BLINDING_PROJECTION]: "blinding_projection_mm",
  [BLINDING_THICKNESS]: "blinding_thickness_mm",
});

/** F-RCC6's own inputs: the footing and pile-cap marks it was authored from (test contract). */
export type Rcc6Foundation = { mark: string; count: number; l_mm: number; b_mm: number; depth_mm: number };

export function rcc6Foundations(): { footings: Rcc6Foundation[]; pileCaps: Rcc6Foundation[] } {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, RCC6_INPUTS), "utf8")) as { footings?: Rcc6Foundation[]; pile_caps?: Rcc6Foundation[] };
  expect(Array.isArray(parsed.footings), `${RCC6_INPUTS} states the footings F-RCC6 was authored from`).toBe(true);
  expect(Array.isArray(parsed.pile_caps), `${RCC6_INPUTS} states the pile caps F-RCC6 was authored from`).toBe(true);
  return { footings: parsed.footings ?? [], pileCaps: parsed.pile_caps ?? [] };
}

/** The golden rows of one fixture standing in one (class, kind) — the cell, in the golden's spelling. */
export function goldenCell(fixtureId: string, cell: { class: string; kind: string }): GoldenRow[] {
  return goldenRowsOf(fixtureId).filter(
    (row) => row.class === GOLDEN_CLASS[cell.class] && row.kind === GOLDEN_KIND[cell.kind] && row.level === GOLDEN_LEVEL[cell.class],
  );
}

/**
 * What the golden says one cell is worth: the rows' figures summed, and the half unit in the last
 * place the file's own printing could have taken off that sum.
 *
 * A golden row is a PRINTED figure. L-QTY-06's yardstick is the TAKEOFF the independent model
 * measured, not the string a fixture rounds it to (the reading settled on adjacent ground at
 * inc-307), so the over arm of the band is judged against the printed figure plus that half unit —
 * an equality the file could not print exactly is not an over-measurement.
 */
export function goldenFigure(rows: readonly GoldenRow[], exact: (value: string) => DecimalLike): { printed: DecimalLike; halfUlp: DecimalLike; said: string } {
  expect(rows.length, "the golden carries this cell — a cell it does not carry is not a cell to reconcile").toBeGreaterThan(0);
  let printed = exact("0");
  let places = 0;
  for (const row of rows) {
    printed = printed.add(exact(row.quantity));
    places = Math.max(places, (row.quantity.split(".")[1] ?? "").length);
  }
  const halfUlp = exact(places === 0 ? "0.5" : `0.${"0".repeat(places)}5`).mul(exact(String(rows.length)));
  return { printed, halfUlp, said: rows.map((row) => `${row.quantity} ${row.unit}`).join(" + ") };
}

/** How a cell is keyed: the product's own class and kind spellings, joined (test contract). */
export function cellKey(elementClass: string, kind: string): string {
  return `${elementClass}|${kind}`;
}
