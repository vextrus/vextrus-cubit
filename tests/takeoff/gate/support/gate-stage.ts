/**
 * The mechanics SEAM-GATE, the methods registry, the campaign and the measure job are graded on
 * (L-MEA-08, L-MEA-01, L-REG-07, L-QTY-03/04, SEAM-JOBS, inc-209).
 *
 * Mechanics only — nothing here judges the product. The database, the accounts, the drawing
 * lineages, the pinned set revision and the register objects all come from the stages the register
 * and the level model already run on (`../../register/support/register-stage`,
 * `../../sets/support/sets-stage`): one invariant, one home (B-17, ARCH-02). What this file adds is
 * what a CAMPAIGN needs beyond a pinned set revision — a workspace whose tenant-scope rule-set
 * template cites the method pairs a case is about, so the project's pin (a verbatim fork, L-REG-07)
 * cites them too — plus the offer shapes the gate is driven with and the audit reads a criterion
 * checks the four new stores with.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's goal, its interfaces,
 * its test contract or its riskNotes publish.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import { sql, sqlValue, type Person } from "../../../spine/uploads/support/upload-stage";
import { codeOf, pinning, setRevisionRows, setsSeam, stageLineage } from "../../sets/support/sets-stage";
import { enrol, rejection } from "../../support/sheets-stage";
import {
  COLUMN_C1,
  PRINCIPAL,
  REPO_ROOT,
  actorOf,
  closeStage,
  field,
  grantRole,
  openSheetsStage,
  productModule,
  registerSeam,
  rowsOf,
  saidBy,
  unique,
  type RegisterScope,
  type Sighting,
  type StoreRow,
} from "../../register/support/register-stage";

export {
  COLUMN_C1,
  PRINCIPAL,
  REPO_ROOT,
  actorOf,
  closeStage,
  codeOf,
  enrol,
  field,
  grantRole,
  openSheetsStage,
  productModule,
  registerSeam,
  rejection,
  rowsOf,
  saidBy,
  sql,
  sqlValue,
  unique,
};
export type { Person, RegisterScope, Sighting, StoreRow };

/* ------------------------------------------------------------------ the homes the spec names */

/** The gate in core — the sole writer of lines, observations and queue items (goal, SEAM-GATE). */
export const GATE_MODULE = "src/core/gate/index.ts";

/** The rail↔gate contract, which modules may import and the gate itself may not (riskNotes (2)). */
export const OFFERS_MODULE = "src/core/offers/contract.ts";

/** The committed scan that bans the gate outside the worker, and its declared corpus (AC-2). */
export const GATE_SCAN_MODULE = "src/core/gate/__tests__/gate-import-scan.ts";
export const GATE_SCAN_CORPUS = "tests/lint-fixtures/no-gate-outside-worker";

/** The methods registry and the one formula method this leaf lands (goal, test contract). */
export const METHODS_REGISTRY_MODULE = "src/core/rulesets/methods/registry.ts";
export const MEMBER_VOLUME_MODULE = "src/core/rulesets/methods/member/volume.ts";
export const MEMBER_SHARD = "src/core/rulesets/methods/member/member.methods.json";

/** The campaign core, and the doors the measure job is asked through (goal, interfaces). */
export const CAMPAIGNS_MODULE = "src/core/campaigns/index.ts";
export const MEASURE_MODULE = "src/modules/takeoff/measure/index.ts";
export const MEASURE_JOB_MODULE = "src/modules/takeoff/measure/job.ts";
export const RAILS_MODULE = "src/modules/takeoff/rails/index.ts";
export const MEASURE_HANDLER_MODULE = "src/worker/handlers/measure.ts";

/** The seams already in the tree this acceptance drives (test contract: existing surfaces). */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const UNITS_MODULE = "src/core/units/canon.ts";
export const JOBS_MODULE = "src/core/jobs/index.ts";
export const JOB_KINDS_MODULE = "src/core/jobs/kinds.ts";
export const DB_MODULE = "src/core/db.ts";
export const BEARS_MODULE = "src/core/catalogue/bears.ts";
export const CLASSES_MODULE = "src/core/catalogue/classes.ts";
export const LEVELS_CORE_MODULE = "src/core/levels/index.ts";
export const LEVELS_MODULE = "src/modules/takeoff/levels/index.ts";
export const EDITIONS_MODULE = "src/core/rulesets/editions/index.ts";
export const SEED_MODULE = "src/core/rulesets/seed/index.ts";
export const PROJECTS_MODULE = "src/modules/spine/projects/index.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The four tables this increment lands (goal, AC-1). */
export const CAMPAIGNS_TABLE = "campaigns";
export const QUANTITY_LINES_TABLE = "quantity_lines";
export const RAIL_OBSERVATIONS_TABLE = "rail_observations";
export const QUEUE_ITEMS_TABLE = "queue_items";
export const GATE_TABLES: readonly string[] = [CAMPAIGNS_TABLE, QUANTITY_LINES_TABLE, RAIL_OBSERVATIONS_TABLE, QUEUE_ITEMS_TABLE];

/** The act types this acceptance drives (test contract: existing surfaces). */
export const PIN_DRAWING_SET = "PIN_DRAWING_SET";
export const INSERT_LEVEL = "INSERT_LEVEL";

/** The refusal this leaf's method resolution, unit canon and contract check answer with (goal). */
export const METHOD_NOT_IN_EDITION = "METHOD_NOT_IN_EDITION";
export const METHOD_IMPLEMENTATION_MISSING = "METHOD_IMPLEMENTATION_MISSING";
export const UNIT_UNMAPPED = "UNIT_UNMAPPED";
export const OFFER_NOT_TO_CONTRACT = "OFFER_NOT_TO_CONTRACT";
export const INTERPRETED_UNCORROBORATED = "INTERPRETED_UNCORROBORATED";
export const PIN_STALE = "PIN_STALE";
export const CAMPAIGN_NOT_FOUND = "CAMPAIGN_NOT_FOUND";
export const SET_NOT_PINNABLE = "SET_NOT_PINNABLE";

/** The one method pair this leaf lands, as the interfaces spell it (`MEMBER_VOLUME_METHOD`). */
export const MEMBER_VOLUME: MethodPairShape = Object.freeze({ ruleId: "member.volume", version: "1" });

/** The version AC-6's second workspace pins instead — cited by the edition, implemented by nothing. */
export const UNIMPLEMENTED_VERSION = "99";

/** The three bases a quantity carries, and the two the criteria name by hand (test contract). */
export const MEASURED = "MEASURED";
export const INTERPRETED = "INTERPRETED";

/** How complete a coverage may be at this leaf — the only value the contract admits (scope). */
export const COMPLETE = "COMPLETE";

/** The engine that read the drawing (L-QTY-03, test contract: `ENGINES`). */
export const VECTOR = "VECTOR";

/** The one deduction channel this leaf partitions (scope, test contract: `DEDUCTION_CHANNELS`). */
export const OPENING = "opening";

/** The edition parameter the opening channel is partitioned against (AC-7, L-MEA-01's roster). */
export const OPENING_THRESHOLD_PARAMETER = "openingDeductionMinM2";

/** The three steps the measure job reports (test contract: `MEASURE_STEPS`). */
export const MEASURE_STEPS: readonly string[] = ["measure:rails", "measure:gate", "measure:verdict"];

/** The job kind the measure door enqueues (test contract: `MEASURE_KIND`). */
export const MEASURE_KIND = "measure";

/** How a level is proposed to INSERT_LEVEL (the level model's `ProposedLevel`). */
export const GROUND_FLOOR = "GF";
export const FIRST_FLOOR = "1F";

/* ------------------------------------------------------------------ the shapes the seams answer in */

/** One (rule id, version) pair, as an edition cites one and the registry enumerates one. */
export type MethodPairShape = { ruleId: string; version: string };

/** One reading of a drawing, as an offer carries one (test contract: `Measure`). */
export type MeasureShape = { value: string; unit: string; basis: string; source: string; calibration?: string };

/** One deduction candidate (test contract: `DeductionCandidate`). */
export type DeductionCandidateShape = { channel: string; measure: MeasureShape };

/** One offer, as a rail hands one to the gate (test contract: `Offer`). */
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
  coverage: string;
};

/** One observation a rail reports beside its offers (test contract: `RailObservation`). */
export type RailObservationShape = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string; detail?: Record<string, unknown> };

/** What the gate answers (test contract: `GateVerdict`). */
export type VerdictShape = { published: number; refused: number; queued: number; refusals: readonly { objectKey: string; code: string }[] };

/** An answer that either carried a value or refused, as the gate's helpers answer (test contract). */
export type OkOrCode<T> = ({ ok: true } & T) | { ok: false; code: string };

/** The gate, as this acceptance drives it (goal, test contract: procedures). */
export type GateSeam = {
  evaluateOffers: (
    scope: { tenantId: string; projectId: string; campaignId: string },
    batch: { offers: readonly OfferShape[]; observations: readonly RailObservationShape[] },
  ) => Promise<VerdictShape>;
  renderFormula: (method: unknown, bindings: Record<string, unknown>) => string;
  partitionDeductions: (
    candidates: readonly DeductionCandidateShape[],
    parameters: Readonly<Record<string, { value: string; unit: string }>>,
  ) => OkOrCode<{ deducted: DeductionCandidateShape[]; kept: DeductionCandidateShape[] }>;
  normaliseMeasure: (measure: MeasureShape, dimension: string) => OkOrCode<{ value: string; unit: string }>;
};

/** The names the gate owes this acceptance (test contract: procedures). */
export const GATE_CALLS: readonly (keyof GateSeam & string)[] = ["evaluateOffers", "renderFormula", "partitionDeductions", "normaliseMeasure"];

/** The rail↔gate contract's rosters (test contract: src/core/offers/contract.ts). */
export type OffersContract = {
  QUANTITY_BASES: readonly string[];
  DEDUCTION_CHANNELS: readonly string[];
  GEOMETRY_TYPES: readonly string[];
  ENGINES: readonly string[];
};

/** One implementation the registry maps a pair to (test contract: `MethodImplementation`). */
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

/** The registry (test contract: src/core/rulesets/methods/registry.ts). */
export type MethodsRegistry = {
  enumerateMethods: () => readonly MethodPairShape[];
  implementationOf: (pair: MethodPairShape) => FormulaMethodShape | undefined;
  methodKey: (pair: MethodPairShape) => string;
  METHOD_MANIFEST_SUFFIX: string;
};

/** The names the registry owes this acceptance. */
export const REGISTRY_CALLS: readonly string[] = ["enumerateMethods", "implementationOf", "methodKey"];

/** The campaign core (test contract: src/core/campaigns/index.ts). */
export type CampaignsSeam = {
  campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<StoreRow[]>;
  campaignOf: (scope: { tenantId: string; projectId: string }, campaignId: string) => Promise<StoreRow | null>;
  freshnessOf: (
    scope: { tenantId: string; projectId: string },
    campaignId: string,
  ) => Promise<{ stale: boolean; diverged: readonly string[]; signing: { ok: boolean; code?: string } }>;
  catalogueDigest: (rows: readonly { class: string; kind: string }[]) => string;
  CAMPAIGN_STATUSES: readonly string[];
};

/** The names the campaign core owes this acceptance. */
export const CAMPAIGN_CALLS: readonly string[] = ["openCampaign", "campaignsOf", "campaignOf", "freshnessOf", "catalogueDigest", "campaignDigestsOf"];

/** The measure door (test contract: src/modules/takeoff/measure/index.ts). */
export type MeasureSeam = {
  requestMeasure: (
    scope: { tenantId: string; projectId: string },
    campaignId: string,
    requestedBy: string,
  ) => Promise<{ requested: true; jobId: string; deduplicated: boolean } | { requested: false; refusal: string }>;
  measureJobKey: (tenantId: string, campaignId: string) => string;
  MEASURE_KIND: string;
};

/** The measure job half (test contract: src/modules/takeoff/measure/job.ts). */
export type MeasureJobSeam = {
  runMeasureJob: (
    payload: { tenantId: string; projectId: string; campaignId: string; requestedBy: string },
    progress: { step: (name: string, detail?: Record<string, unknown>) => Promise<void> },
    deps: { rails: Record<string, unknown>; gate: GateSeam["evaluateOffers"] },
  ) => Promise<void>;
  MEASURE_STEPS: readonly string[];
};

/** The production wiring the worker registers (test contract: src/worker/handlers/measure.ts). */
export type MeasureHandlerSeam = {
  registerMeasureHandler: () => void;
  measureDeps: () => { rails: Record<string, unknown>; gate: GateSeam["evaluateOffers"] };
};

/** An exact decimal, as the canon answers one — arbitrary precision end to end (B-07). */
export type DecimalLike = {
  mul: (other: DecimalLike | string | number) => DecimalLike;
  eq: (other: DecimalLike | string | number) => boolean;
  lt: (other: DecimalLike | string | number) => boolean;
  toString: () => string;
};

/** The unit canon, as this acceptance asks it what a reading is worth (B-17). */
export type UnitsSeam = {
  exact: (value: string | number) => DecimalLike;
  convert: (value: string, from: string, to: string) => { ok: boolean; value?: string; code?: string };
  isUnit: (value: unknown) => boolean;
  CANONICAL_UNIT: Readonly<Record<string, string>>;
  DIMENSIONS: readonly string[];
};

/** One entry of the closed refusal taxonomy. */
export type RefusalEntryShape = { code: string; message: string; remedy: string; severity: string; surface: string };

/** L-ACT-02's Consequence, as a caller of the seam reads one. */
export type ConsequenceLike = { actType?: unknown; rendering?: unknown; subjects?: readonly Record<string, unknown>[] } & Record<string, unknown>;

/** Who is acting (SEAM-ACT: `ActorCtx`). */
export type ActorCtx = { tenantId: string; userId: string; actorKind: string };

/** SEAM-ACT, as this acceptance drives it. */
export type ActsSeam = {
  preview: (ctx: ActorCtx, input: Record<string, unknown>) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: Record<string, unknown>, carriedDigest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
};

/* ------------------------------------------------------------------ loading the doors */

/** One door, with the calls this stage makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) {
    expect(typeof door[call], `${home} publishes \`${call}\` — a door this increment's interfaces name`).toBe("function");
  }
  return door as T;
}

/** SEAM-GATE's one door. */
export async function gateSeam(): Promise<GateSeam> {
  return doorOf<GateSeam>(GATE_MODULE, GATE_CALLS);
}

/** The rail↔gate contract's four rosters, each asserted to be a list before it is drawn from. */
export async function offersContract(): Promise<OffersContract> {
  const door = await productModule<Record<string, unknown>>(OFFERS_MODULE);
  for (const roster of ["QUANTITY_BASES", "DEDUCTION_CHANNELS", "GEOMETRY_TYPES", "ENGINES"]) {
    expect(Array.isArray(door[roster]), `${OFFERS_MODULE} publishes \`${roster}\` as a list — the rail↔gate contract's vocabulary (test contract)`).toBe(true);
    expect((door[roster] as unknown[]).length, `${OFFERS_MODULE}'s \`${roster}\` names something — an empty roster admits nothing`).toBeGreaterThan(0);
  }
  return door as unknown as OffersContract;
}

/** The methods registry. */
export async function methodsRegistry(): Promise<MethodsRegistry> {
  const door = await doorOf<MethodsRegistry>(METHODS_REGISTRY_MODULE, REGISTRY_CALLS);
  expect(typeof door.METHOD_MANIFEST_SUFFIX, `${METHODS_REGISTRY_MODULE} publishes \`METHOD_MANIFEST_SUFFIX\` — the suffix a shard is found by`).toBe("string");
  return door;
}

/** The campaign core. */
export async function campaignsSeam(): Promise<CampaignsSeam> {
  const door = await doorOf<CampaignsSeam>(CAMPAIGNS_MODULE, CAMPAIGN_CALLS);
  expect(Array.isArray(door.CAMPAIGN_STATUSES), `${CAMPAIGNS_MODULE} publishes \`CAMPAIGN_STATUSES\` as a list (test contract)`).toBe(true);
  return door;
}

/** The measure door. */
export async function measureSeam(): Promise<MeasureSeam> {
  const door = await doorOf<MeasureSeam>(MEASURE_MODULE, ["requestMeasure", "measureJobKey"]);
  expect(typeof door.MEASURE_KIND, `${MEASURE_MODULE} publishes \`MEASURE_KIND\` (test contract)`).toBe("string");
  return door;
}

/** The measure job half. */
export async function measureJobSeam(): Promise<MeasureJobSeam> {
  const door = await doorOf<MeasureJobSeam>(MEASURE_JOB_MODULE, ["runMeasureJob"]);
  expect(Array.isArray(door.MEASURE_STEPS), `${MEASURE_JOB_MODULE} publishes \`MEASURE_STEPS\` as a list (test contract)`).toBe(true);
  return door;
}

/** The production wiring the worker registers. */
export async function measureHandlerSeam(): Promise<MeasureHandlerSeam> {
  return doorOf<MeasureHandlerSeam>(MEASURE_HANDLER_MODULE, ["registerMeasureHandler", "measureDeps"]);
}

/** The rail roster the production wiring runs — empty at this leaf (scope, AC-8). */
export async function railsRoster(): Promise<Record<string, unknown>> {
  const door = await productModule<Record<string, unknown>>(RAILS_MODULE);
  const rails = door["RAILS"];
  expect(rails !== null && typeof rails === "object", `${RAILS_MODULE} publishes \`RAILS\` — the roster the measure job runs (test contract)`).toBe(true);
  return rails as Record<string, unknown>;
}

/** SEAM-ACT. */
export async function actsSeam(): Promise<ActsSeam> {
  return doorOf<ActsSeam>(ACTS_MODULE, ["preview", "commit", "consequenceDigest"]);
}

/** The unit canon — the one home a reading's canonical value is asked of (B-17). */
export async function unitsSeam(): Promise<UnitsSeam> {
  return productModule<UnitsSeam>(UNITS_MODULE);
}

/** The refusal register, read from its one home so nothing re-spells a code (ARCH-02, Q-07). */
export async function refusals(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Record<string, RefusalEntryShape | undefined> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/** SEAM-JOBS, as the measure door's enqueue is observed through. */
export async function jobsSeam(): Promise<{
  JOB_KINDS: Readonly<Record<string, Record<string, unknown>>>;
  jobEvents: (jobId: string) => Promise<Record<string, unknown>[]>;
  stopJobsRuntime: () => Promise<unknown>;
}> {
  return productModule(JOBS_MODULE);
}

/** The catalogue's `bears` table and its class roster — never a pair spelled here (B-19). */
export async function bears(): Promise<{ rows: readonly { class: string; kind: string }[]; classes: readonly string[] }> {
  const catalogue = await productModule<{ BEARS: readonly { class: string; kind: string }[] }>(BEARS_MODULE);
  const classes = await productModule<{ ELEMENT_TYPES: readonly string[] }>(CLASSES_MODULE);
  expect(catalogue.BEARS.length, `${BEARS_MODULE} says which classes bear which kinds — with none there is nothing to digest (L-REG-07)`).toBeGreaterThan(0);
  return { rows: catalogue.BEARS, classes: classes.ELEMENT_TYPES };
}

/** The project's live pin, as a surface reads it (R-SPINE-012). */
export async function pinnedView(scope: { tenantId: string; projectId: string }): Promise<{ pinned: boolean; digest?: string; parameters?: Readonly<Record<string, { value: string; unit: string }>> }> {
  const editions = await productModule<{ projectRulesetView: (s: { tenantId: string; projectId: string }) => Promise<{ pinned: boolean; digest?: string; parameters?: Readonly<Record<string, { value: string; unit: string }>> }> }>(EDITIONS_MODULE);
  return editions.projectRulesetView(scope);
}

/** The level stack digest, over the members the project's live stack names (L-REG-07). */
export async function liveLevelStackDigest(scope: { tenantId: string; projectId: string }): Promise<string> {
  const levels = await productModule<{ levelStackDigestOf: (s: { tenantId: string; projectId: string }) => Promise<string> }>(LEVELS_MODULE);
  return levels.levelStackDigestOf(scope);
}

/* ------------------------------------------------------------------ staging a workspace and its pin */

/** The reason every statement this stage makes is recorded under — attributable, like any other. */
const STAGE_REASON = "test: stage a campaign and its pinned rule-set edition for the gate acceptance";
void STAGE_REASON;

/**
 * The workspace's tenant-scope rule-set template, minted BEFORE its first project exists.
 *
 * riskNotes (1): the platform seed cites no method, and `pinRulesetForProject` forks verbatim — so
 * a project's pin cites a (rule id, version) pair only if the template it forked already did. This
 * writes that template through the shipped seam (`forTenant` + `tenantRulesetEditions`) with the
 * digest the product's own `editionDigest` computes over its content, so the row is one the product
 * would itself have written and no landed migration's digest moves.
 */
export async function stageTenantTemplate(tenantId: string, methods: readonly MethodPairShape[]): Promise<{ contentDigest: string }> {
  const db = await productModule<{ forTenant: (ctx: { tenantId: string }) => { insert: (table: unknown) => { values: (row: Record<string, unknown>) => Promise<unknown> } }; tenantRulesetEditions: unknown }>(DB_MODULE);
  const seed = await productModule<{ SEED_EDITION_IDENTITY: { name: string; version: string }; SEED_EDITION_CONTENT: { parameters: Readonly<Record<string, { value: string; unit: string }>> } }>(SEED_MODULE);
  const editions = await productModule<{ editionDigest: (content: { parameters: unknown; methods: readonly MethodPairShape[] }) => string }>(EDITIONS_MODULE);

  const parentEditionId = sqlValue(
    `select edition_id::text from ${ident("ruleset_editions")}
      where scope = 'platform' and name = ${lit(seed.SEED_EDITION_IDENTITY.name)} and version = ${lit(seed.SEED_EDITION_IDENTITY.version)} limit 1;`,
  );
  expect(parentEditionId, "the platform seed edition stands in the migrated database — every lineage is forked from it (L-REG-07)").not.toBe("");

  const parameters = seed.SEED_EDITION_CONTENT.parameters;
  const contentDigest = editions.editionDigest({ parameters, methods });
  await db.forTenant({ tenantId }).insert(db.tenantRulesetEditions).values({
    tenantId,
    scope: "tenant",
    projectId: null,
    parentEditionId,
    name: seed.SEED_EDITION_IDENTITY.name,
    version: seed.SEED_EDITION_IDENTITY.version,
    contentDigest,
    parameters,
    methods,
  });
  return { contentDigest };
}

/** A project of this workspace, made through the shipped door — so L-REG-07's pin really forks. */
export async function createProjectThroughDoor(person: Person, name: string): Promise<string> {
  const projects = await productModule<{ createProject: (ctx: ActorCtx, draft: { name: string }) => Promise<{ projectId: string }> }>(PROJECTS_MODULE);
  const created = await projects.createProject(actorOf(person), { name });
  expect(typeof created.projectId, `${PROJECTS_MODULE} answered the project it created: ${JSON.stringify(created)}`).toBe("string");
  return created.projectId;
}

/** Preview an act and commit the digest it answered — the whole L-ACT-02 pair, once. */
export async function performAct(actor: ActorCtx, input: Record<string, unknown>): Promise<{ consequence: ConsequenceLike; actId: string }> {
  const acts = await actsSeam();
  const consequence = await acts.preview(actor, input);
  const written = await acts.commit(actor, input, acts.consequenceDigest(consequence));
  const actId = written["actId"];
  expect(typeof actId === "string" && actId.length > 0, `committing ${String(input["type"])} answered the act it wrote: ${JSON.stringify(written)}`).toBe(true);
  return { consequence, actId: String(actId) };
}

/** One INSERT_LEVEL over one proposed level. */
export function insertion(projectId: string, label: string, ordinal: number): Record<string, unknown> {
  return { type: INSERT_LEVEL, projectId, levels: [{ label, ordinal }] };
}

/** Everything a criterion of this increment is driven against. */
export type StagedCampaign = {
  person: Person;
  actor: ActorCtx;
  tenantId: string;
  projectId: string;
  setId: string;
  setRevisionId: string;
  campaignId: string;
  scope: { tenantId: string; projectId: string };
  gateScope: { tenantId: string; projectId: string; campaignId: string };
  registerScope: RegisterScope;
  /** The register objects staged on the pinned revision, in the order they were registered. */
  objectKeys: string[];
  /** Drawings of the project outside the set — what a further pin has to change. */
  spare: string[];
};

/** The revision ids one set holds today. */
function revisionIdsOf(tenantId: string, setId: string): string[] {
  return setRevisionRows(tenantId, setId).map((row) => row.setRevisionId);
}

/**
 * A workspace, a project pinned to a template citing `methods`, one level, a pinned drawing-set
 * revision and `objects` register objects standing on it.
 *
 * Everything is driven through the shipped doors: sign-up mints the workspace, `createProject` pins
 * (forking the template staged just above it), the act seam inserts the level and pins the set, and
 * the register's own door records the sightings. The campaign is whatever the pin opened.
 */
export async function stageCampaign(
  label: string,
  options: { methods?: readonly MethodPairShape[]; objects?: number } = {},
): Promise<StagedCampaign> {
  await openSheetsStage();
  const methods = options.methods ?? [MEMBER_VOLUME];
  const person = await enrol(`gate-${label}`);
  await stageTenantTemplate(person.tenantId, methods);

  // No role is granted here: L-ACT-03 has project creation install its creator as PRINCIPAL in the
  // same transaction, so the shipped door has already done it and a second grant would collide.
  const projectId = await createProjectThroughDoor(person, unique(`Gate ${label}`));
  const actor = actorOf(person);

  // A level BEFORE the pin, so the campaign's level-stack snapshot is a digest over something.
  await performAct(actor, insertion(projectId, GROUND_FLOOR, 0));

  const sets = await setsSeam();
  const setScope = { tenantId: person.tenantId, projectId };
  const names = [unique(`${label}-a.dxf`), unique(`${label}-b.dxf`), unique(`${label}-c.dxf`)];
  for (const name of names) await stageLineage(person, projectId, name, [`${name}-1`]);
  const lineages = (await sets.drawingLineagesOf(setScope)).filter((lineage) => names.includes(lineage.name));
  expect(lineages.length, `the three lineages staged for ${label} stand in the module's answer`).toBe(3);

  const created = await sets.createSet(setScope, { userId: person.userId }, unique(`${label} set`));
  expect(created.created, `the set for ${label} was created: ${JSON.stringify(created)}`).toBe(true);
  const setId = (created as { created: true; setId: string }).setId;
  for (const member of lineages.slice(0, 2)) {
    const toggled = await sets.toggleMember(setScope, setId, member.drawingId);
    expect(toggled.toggled, `${member.name} was toggled into the set: ${JSON.stringify(toggled)}`).toBe(true);
  }

  const before = new Set(revisionIdsOf(person.tenantId, setId));
  await performAct(actor, pinning(projectId, setId) as unknown as Record<string, unknown>);
  const added = revisionIdsOf(person.tenantId, setId).filter((id) => !before.has(id));
  expect(added.length, "pinning the set added exactly one revision to the ledger (L-REG-06)").toBe(1);
  const setRevisionId = added[0] as string;

  const registerScope: RegisterScope = { tenantId: person.tenantId, projectId, setRevisionId };
  const objectKeys: string[] = [];
  const register = await registerSeam();
  for (let at = 0; at < (options.objects ?? 0); at += 1) {
    const sighting: Sighting = { ...COLUMN_C1, label: `${label}-c${at}`, mark: `C${at + 1}`, x: 1000 + at * 100, level: { levelId: LEVEL_PLACEHOLDER } };
    const answer = await register.registerSighting(registerScope, sighting);
    expect(field(answer, "registered", "registered"), `the sighting ${sighting.label} registered: ${JSON.stringify(answer)}`).toBe(true);
    objectKeys.push(String(field(answer, "objectKey", "object_key")));
  }

  const campaigns = await campaignsSeam();
  const held = await campaigns.campaignsOf({ tenantId: person.tenantId, projectId });
  const mine = held.filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(mine.length, `pinning ${setRevisionId} opened exactly one campaign (goal: one campaign per pinned revision)`).toBe(1);
  const campaignId = String(field(mine[0], "campaignId", "campaign_id"));

  return {
    person,
    actor,
    tenantId: person.tenantId,
    projectId,
    setId,
    setRevisionId,
    campaignId,
    scope: { tenantId: person.tenantId, projectId },
    gateScope: { tenantId: person.tenantId, projectId, campaignId },
    registerScope,
    objectKeys,
    spare: lineages.slice(2).map((lineage) => lineage.drawingId),
  };
}

/**
 * The surrogate level a staged sighting stands on. A level id and nothing else: what a key may say
 * about a level is its surrogate id (L-REG-02), and the register carries it as given.
 */
export const LEVEL_PLACEHOLDER = "8f1d6c3a-0a5e-4a7b-9c2d-33333333ac09";

/* ------------------------------------------------------------------ the offers, as a rail makes them */

/** One reading of a drawing, as an offer's binding or selector carries one. */
export function measure(value: string, unit: string, options: { basis?: string; source?: string; calibration?: string } = {}): MeasureShape {
  const made: MeasureShape = {
    value,
    unit,
    basis: options.basis ?? MEASURED,
    source: options.source ?? "S-101:e:41",
  };
  return options.calibration === undefined ? made : { ...made, calibration: options.calibration };
}

/** What one offer is built from, so a case names only what it changes. */
export type OfferDraft = {
  objectKey: string;
  setRevisionId: string;
  kind: string;
  class: string;
  geometryType: string;
  ruleId?: string;
  basis?: string;
  calibration?: string;
  bindings?: Record<string, MeasureShape>;
  selectors?: Record<string, MeasureShape>;
  deductions?: readonly DeductionCandidateShape[];
  drawingId?: string;
  viewKey?: string;
  engine?: string;
  coverage?: string;
};

/** One offer to the gate's contract (test contract: `Offer`). */
export function offer(draft: OfferDraft): OfferShape {
  return {
    ruleId: draft.ruleId ?? MEMBER_VOLUME.ruleId,
    kind: draft.kind,
    class: draft.class,
    register: { setRevisionId: draft.setRevisionId, objectKey: draft.objectKey },
    drawing: { drawingId: DRAWING_ID, viewKey: draft.viewKey ?? "PLAN:S-101:t:12" },
    engine: draft.engine ?? VECTOR,
    geometry: {
      type: draft.geometryType,
      basis: draft.basis ?? MEASURED,
      ...(draft.calibration === undefined ? {} : { calibration: draft.calibration }),
    },
    bindings: draft.bindings ?? {},
    selectors: draft.selectors ?? {},
    deductions: draft.deductions ?? [],
    coverage: draft.coverage ?? COMPLETE,
  };
}

/** The drawing an offer says it was read from — a surrogate, as `drawing.drawingId` is one. */
export const DRAWING_ID = "0d4a1f60-4c1a-4d2e-8f31-77777777dd01";

/** The bindings `member.volume@1` declares, each as a reading in the same unit (AC-5). */
export function bindingsIn(unit: string, values: Readonly<Record<string, string>>, calibration?: string): Record<string, MeasureShape> {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, measure(value, unit, calibration === undefined ? {} : { calibration })]));
}

/* ------------------------------------------------------------------ reading the four stores */

/** Does the migrated database hold this table at all? */
export function tableStands(table: string): boolean {
  return (
    sql(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(table)};`,
    ).length > 0
  );
}

/** Every row of one of this increment's tables in one workspace, whole — the acceptance's audit read. */
export function storeRows(table: string, tenantId: string): StoreRow[] {
  expect(tableStands(table), `the product's migration lane lands public.${table} — the store this increment's rows stand in (AC-1, V-DB)`).toBe(true);
  return rowsOf(table, tenantId);
}

/** How many rows of a table one workspace holds — the "nothing more was written" reading. */
export function storeCount(table: string, tenantId: string): number {
  return storeRows(table, tenantId).length;
}

/** The counts of all four stores at once, so a second call can be compared to the first (AC-5). */
export function storeCounts(tenantId: string): Record<string, number> {
  return Object.fromEntries(GATE_TABLES.map((table) => [table, storeCount(table, tenantId)]));
}

/** The rows of one store belonging to one campaign. */
export function rowsOfCampaign(table: string, tenantId: string, campaignId: string): StoreRow[] {
  return storeRows(table, tenantId).filter((row) => String(field(row, "campaignId", "campaign_id")) === campaignId);
}

/** The one row of a store this criterion expects, asserted to be one. */
export function oneRow(rows: readonly StoreRow[], what: string): StoreRow {
  expect(rows.length, `${what} — the store holds ${rows.length} such rows: ${JSON.stringify(rows)}`).toBe(1);
  return rows[0] as StoreRow;
}

/** A uuid no project holds — what a call naming nothing is given (AC-8). */
export function unheldId(): string {
  return randomUUID();
}

/** The workspace column, for an audit read that needs to name it. */
export { TENANT_COLUMN };
