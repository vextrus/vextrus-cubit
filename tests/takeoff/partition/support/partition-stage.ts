/**
 * The mechanics the stored-partition acceptance runs on (L-CAD-06, R-TO-030, L-ACT-02, L-AI-02).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts,
 * the projects, the recorded drawing and the stand-in for the `cad/` CLI all come from the seams'
 * own stages (`tests/spine/uploads/support/upload-stage.ts`, `tests/takeoff/support/ingest-stage.ts`,
 * `tests/takeoff/support/sheets-stage.ts`) rather than from a second staging dialect invented here:
 * one invariant, one home (B-17, ARCH-02). What this file adds is what a view partition needs beyond
 * an ingest — a hand-authored EntityGraph whose model space really carries captions, labels and
 * paint, the doors the criteria drive, and the store reads they are graded by.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interface list, its
 * test contract or the declared fixture corpus publishes.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "vitest";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { sql, sqlValue, type Person } from "../../../spine/uploads/support/upload-stage";
import {
  REPO_ROOT,
  actorOf,
  byCodePoint,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  rejection,
  rowCount,
  stagePerson,
  storageOf,
  tempDir,
  unique,
  PRINCIPAL,
  ACTS_MODULE,
  ERRORS_MODULE,
  TAKEOFF_ROUTER_MODULE,
  JOBS_MODULE,
  INGEST_HANDLER_MODULE,
  type ActorCtx,
  type ConsequenceLike,
  type ErrorsSeam,
  type JobsLike,
} from "../../support/sheets-stage";
import { stageDrawing, stubCli, withCadCommand, type StagedDrawing } from "../../support/ingest-stage";

export {
  REPO_ROOT,
  actorOf,
  byCodePoint,
  closeStage,
  grantRole,
  openSheetsStage,
  productModule,
  rejection,
  rowCount,
  stagePerson,
  storageOf,
  tempDir,
  unique,
  sql,
  sqlValue,
  PRINCIPAL,
  ACTS_MODULE,
  ERRORS_MODULE,
  TAKEOFF_ROUTER_MODULE,
  JOBS_MODULE,
  INGEST_HANDLER_MODULE,
};
export type { ActorCtx, ConsequenceLike, ErrorsSeam, JobsLike, Person, StagedDrawing };

/** The typed grouping key this act is offered by (AC-4: a closed enum plus resolved membership). */
export type ViewGroupKey = { kind: string; drawingId: string; viewType: string };

/* ------------------------------------------------------------------ the homes the spec names */

/** The modules this increment publishes (increment interfaces, test contract). */
export const VIEWS_LAW_MODULE = "src/modules/takeoff/partition/views/law.ts";
export const VIEWS_GRAMMAR_MODULE = "src/modules/takeoff/partition/views/grammar.ts";
export const LITERAL_SCAN_MODULE = "src/modules/takeoff/partition/views/__tests__/literal-scan.ts";
export const PARTITION_MODULE = "src/modules/takeoff/partition/index.ts";
export const PARTITION_REBUILD_MODULE = "src/modules/takeoff/partition/rebuild.ts";
export const VIEW_CAPTIONS_MODULE = "src/modules/ai/view-captions/index.ts";
export const PARTITION_HANDLER_MODULE = "src/worker/handlers/partition.ts";
export const MODEL_BARREL = "src/core/model/index.ts";
export const INGEST_JOB_MODULE = "src/modules/takeoff/ingest/job.ts";
export const INGEST_MODULE = "src/modules/takeoff/ingest/index.ts";

/** The declared caption corpus (declared fixtures). */
export const CAPTION_CORPUS = join("fixtures", "view-captions");

/** The declared lint-fixture corpus the literal scan is proved on (declared fixtures). */
export const LITERAL_CORPUS = join("tests", "lint-fixtures", "view-type-literals");

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The job kind and the stage list (test contract). */
export const PARTITION_KIND = "partition";
export const VIEWS_STAGE = "views";

/** The act, the permission it moves, and the group kind it is offered by (AC-4). */
export const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE";
export const MEASURE = "MEASURE";
export const PROPOSED_VIEW_TYPE = "PROPOSED_VIEW_TYPE";
export const SUBJECTS = "SUBJECTS";

/** The model AS-05 pins cheap classification to, and the fixture-root environment name (L-AI-01). */
export const VIEW_CAPTION_MODEL = "claude-sonnet-5";
export const FIXTURE_ROOT_VAR = "CUBIT_MODEL_FIXTURE_ROOT";

/** The refusal codes this increment's doors answer with (test contract). */
export const CAPTION_UNCLASSIFIABLE = "CAPTION_UNCLASSIFIABLE";
export const PARTITION_NOT_AVAILABLE = "PARTITION_NOT_AVAILABLE";
export const GROUP_NOT_OFFERED = "GROUP_NOT_OFFERED";
export const CONSEQUENCES_NOT_CARRIED = "CONSEQUENCES_NOT_CARRIED";
export const MALFORMED = "MALFORMED";
export const FIXTURE_MISSING = "FIXTURE_MISSING";
export const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";

/** The three tables the partition is stored in (test contract). */
export const PARTITION_VIEWS = "partition_views";
export const VIEW_ASSIGNMENTS = "view_assignments";
export const VIEW_TYPE_CONFIRMATIONS = "view_type_confirmations";

/** The view type an anchorless view carries, which is also its whole key (AC-3). */
export const UNASSIGNED = "UNASSIGNED";

/* ------------------------------------------------------------------ the shapes the doors answer in */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** L-CAD-06's law, as this acceptance reads it (increment interfaces). */
export type ViewsLaw = {
  VIEW_TYPES: readonly string[];
  VIEW_TYPE: Readonly<Record<string, string>>;
  isViewType: (value: unknown) => boolean;
  yieldsInstances: (type: string) => boolean;
};

/** What the caption grammar answers (increment interfaces: `Classification`). */
export type Classification = { type: string; reason: string | null };

/** The grammar door. */
export type GrammarSeam = { classifyCaption: (caption: string) => Classification };

/** One finding of the literal scan (AC-1). */
export type LiteralHit = { file: string; line: number; literal: string };

/** The scanner, which the committed scan test drives (AC-1). */
export type LiteralScan = { scanViewTypeLiterals: (files: readonly string[]) => readonly LiteralHit[] };

/** What a running job is given (SEAM-JOBS: `JobProgress`). */
export type ProgressLike = { readonly jobId?: string; readonly tempDir: string; step: (name: string, detail?: Record<string, unknown>) => Promise<void> };

/** One step a job recorded, as this stage collects them. */
export type StepRecord = { step: string; detail: Record<string, unknown> };

/** The answer of `requestPartition` — the shape every `requestX` door in the tree answers in. */
export type PartitionAnswer = { jobId: string | null; ingestId?: string | null; deduplicated?: boolean } | { refusal: string };

/** One view as `viewsOf` answers one (AC-4). */
export type ViewRow = {
  viewKey?: string;
  view_key?: string;
  type: string;
  reason: string | null;
  proposed: { type: string; callId: string } | null;
  confirmed: { type: string; actId: string } | null;
} & Record<string, unknown>;

/** The partition's module door and its job door (increment interfaces). */
export type PartitionSeam = {
  requestPartition: (request: { tenantId: string; drawingId: string; requestedBy: string }) => Promise<PartitionAnswer>;
  viewsOf: (scope: { tenantId: string; projectId: string; drawingId: string }) => Promise<ViewRow[]>;
  partitionJobKey: (tenantId: string, ingestId: string) => string;
  PARTITION_KIND: string;
};

/** The rebuild door (increment interfaces). */
export type RebuildSeam = {
  runPartitionJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void>;
  PARTITION_STAGES: readonly string[];
};

/** The view-caption model module (increment interfaces). */
export type ViewCaptionsSeam = {
  viewCaptionRequest: (caption: string, anchorKey: string) => unknown;
  VIEW_CAPTION_MODEL: string;
  proposeViewType?: (...args: never[]) => Promise<unknown>;
  readViewTypeProposal?: (...args: never[]) => unknown;
};

/** SEAM-ACT through the surface this acceptance drives it by (L-ACT-02). */
export type ActsSeam = {
  ACT_TYPES: readonly string[];
  ACT_PERMISSION: Record<string, string>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
  preview: (ctx: ActorCtx, input: ConfirmViewTypeInput) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: ConfirmViewTypeInput, carriedDigest: string) => Promise<{ actId: string; consequenceDigest: string; consequence: ConsequenceLike }>;
};

/** What a confirmation asks for (increment interfaces: `ConfirmViewTypeInput`). */
export type ConfirmViewTypeInput = { type: string; projectId: string; group: ViewGroupKey };

/** The recorded-answer file format (`fixtures/model/README.md`). */
export type ModelFixture = { requestHash: string; modelId: string; payload: JsonValue; inputTokens: number; outputTokens: number };

/* ------------------------------------------------------------------ loading the doors */

/** One door, with the calls this stage makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

export async function viewsLaw(): Promise<ViewsLaw> {
  return doorOf<ViewsLaw>(VIEWS_LAW_MODULE, ["isViewType", "yieldsInstances"]);
}

export async function grammar(): Promise<GrammarSeam> {
  return doorOf<GrammarSeam>(VIEWS_GRAMMAR_MODULE, ["classifyCaption"]);
}

export async function literalScan(): Promise<LiteralScan> {
  return doorOf<LiteralScan>(LITERAL_SCAN_MODULE, ["scanViewTypeLiterals"]);
}

export async function partitionDoor(): Promise<PartitionSeam> {
  return doorOf<PartitionSeam>(PARTITION_MODULE, ["requestPartition", "viewsOf", "partitionJobKey"]);
}

export async function rebuildDoor(): Promise<RebuildSeam> {
  return doorOf<RebuildSeam>(PARTITION_REBUILD_MODULE, ["runPartitionJob"]);
}

export async function viewCaptionsDoor(): Promise<ViewCaptionsSeam> {
  return doorOf<ViewCaptionsSeam>(VIEW_CAPTIONS_MODULE, ["viewCaptionRequest"]);
}

export async function actsDoor(): Promise<ActsSeam> {
  return doorOf<ActsSeam>(ACTS_MODULE, ["preview", "commit", "consequenceDigest"]);
}

/** The model seam's `requestHash` — the identity a recorded answer is filed under (L-AI-01). */
export async function requestHash(): Promise<(request: unknown) => string> {
  const barrel = await productModule<{ requestHash?: (request: unknown) => string }>(MODEL_BARREL);
  expect(typeof barrel.requestHash, `${MODEL_BARREL} publishes requestHash (L-AI-01)`).toBe("function");
  return barrel.requestHash as (request: unknown) => string;
}

/* ------------------------------------------------------------------ the declared caption corpus */

/** One entry of the committed caption corpus (declared fixtures). */
export type CaptionEntry = { caption: string; type: string; file: string };

/** Every entry of every `fixtures/view-captions/*.json`, in file then document order. */
export function captionCorpus(): CaptionEntry[] {
  const root = join(REPO_ROOT, CAPTION_CORPUS);
  expect(existsSync(root), `${CAPTION_CORPUS} is the declared caption corpus`).toBe(true);
  const files = readdirSync(root)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return files.flatMap((name) => {
    const parsed = JSON.parse(readFileSync(join(root, name), "utf8")) as unknown;
    expect(Array.isArray(parsed), `${CAPTION_CORPUS}/${name} is a JSON array of { caption, type } entries`).toBe(true);
    return (parsed as { caption?: unknown; type?: unknown }[]).map((entry, index) => {
      expect(typeof entry.caption, `${name}[${index}] carries a caption`).toBe("string");
      expect(typeof entry.type, `${name}[${index}] carries the type it is classified as`).toBe("string");
      return { caption: String(entry.caption), type: String(entry.type), file: `${CAPTION_CORPUS}/${name}` };
    });
  });
}

/* ------------------------------------------------------------------ a hand-authored artifact */

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** The height a caption stands at, and the height an ordinary label stands at (the fixed share). */
export const CAPTION_HEIGHT = 5;
export const LABEL_HEIGHT = 1;

/** The spaces the built artifact carries. */
export const MODEL_SPACE = "Model";
export const PAPER_SPACE = "SHEET-1";

/** One caption of the built artifact: the words it says and where its cluster stands. */
export type CaptionSpec = { caption: string; at: [number, number] };

/** What a built artifact carries, so a criterion can derive its expectations from it. */
export type BuiltArtifact = {
  /** The artifact as bytes, for the stand-in CLI to write. */
  json: string;
  /** The graph, as an object. */
  graph: Record<string, JsonValue>;
  /** The key of each caption's own text entity, by caption. */
  anchorOf: Map<string, string>;
  /** Every ORIGINAL entity key standing in model space. */
  modelKeys: string[];
  /** Every original entity key standing on the paper layout. */
  paperKeys: string[];
  /** The `src` of every derived record — paint, which is not an atom a key names (L-CAD-03). */
  derivedSources: string[];
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/**
 * An EntityGraph v2 whose MODEL SPACE really carries what a partition partitions: caption texts at
 * caption height, small label texts beside them, drawn lines clustered around each caption, one line
 * standing on its own far from every caption, one paper layout carrying entities of its own, and one
 * record of exploded paint.
 *
 * Every ordinal is minted from `salt`, so two artifacts built here are two different drawings.
 */
export function buildArtifact(captions: readonly CaptionSpec[], salt: number): BuiltArtifact {
  const base = salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const entities: Record<string, JsonValue>[] = [];
  const anchorOf = new Map<string, string>();

  const at = (x: number, y: number): JsonValue => [[x, y]] as unknown as JsonValue;

  for (const spec of captions) {
    const [x, y] = spec.at;
    const anchor = next();
    anchorOf.set(spec.caption, anchor);
    entities.push({ key: anchor, type: "TEXT", space: MODEL_SPACE, layer: "CAPTIONS", colour: CHANNELS, text: spec.caption, height: CAPTION_HEIGHT, points: at(x, y) });
    entities.push({ key: next(), type: "TEXT", space: MODEL_SPACE, layer: "LABELS", colour: CHANNELS, text: "C1", height: LABEL_HEIGHT, points: at(x + 1, y - 2) });
    entities.push({ key: next(), type: "TEXT", space: MODEL_SPACE, layer: "LABELS", colour: CHANNELS, text: "300x450", height: LABEL_HEIGHT, points: at(x + 2, y - 3) });
    entities.push({ key: next(), type: "LINE", space: MODEL_SPACE, layer: "GRID", colour: CHANNELS, points: [[x, y - 5], [x + 8, y - 5]] as unknown as JsonValue });
    entities.push({ key: next(), type: "LINE", space: MODEL_SPACE, layer: "GRID", colour: CHANNELS, points: [[x, y - 5], [x, y - 12]] as unknown as JsonValue });
  }

  // A line standing nowhere near a caption: whatever the clustering rule is, this is what an
  // anchorless view is FOR, and a partition that quietly dropped it would leave an entity in no view.
  const stray = next();
  entities.push({ key: stray, type: "LINE", space: MODEL_SPACE, layer: "STRAY", colour: CHANNELS, points: [[9000, 9000], [9010, 9010]] as unknown as JsonValue });

  // The paper layout: its entities are a sheet's border and title, never model geometry (L-CAD-06
  // partitions MODEL space).
  const paperText = next();
  const paperLine = next();
  entities.push({ key: paperText, type: "TEXT", space: PAPER_SPACE, layer: "TITLEBLOCK", colour: CHANNELS, text: "S-101 GENERAL ARRANGEMENT", height: 3, points: at(5, 5) });
  entities.push({ key: paperLine, type: "LINE", space: PAPER_SPACE, layer: "BORDER", colour: CHANNELS, points: [[0, 0], [297, 210]] as unknown as JsonValue });

  const derivedSource = entities.find((entity) => entity["space"] === MODEL_SPACE && entity["type"] === "LINE")?.["key"] as string;
  const derived = [{ src: derivedSource, type: "LWPOLYLINE", space: MODEL_SPACE, layer: "GRID", colour: CHANNELS, points: [[0, 0], [1, 0]] as unknown as JsonValue }];

  const graph: Record<string, JsonValue> = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [0, 0], max: [9010, 9010] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ] as unknown as JsonValue,
    dropped_layouts: [],
    entities: entities as unknown as JsonValue,
    derived: derived as unknown as JsonValue,
    block_attributes: [],
    counters: [],
  };

  return {
    json: JSON.stringify(graph),
    graph,
    anchorOf,
    modelKeys: entities.filter((entity) => entity["space"] === MODEL_SPACE).map((entity) => String(entity["key"])),
    paperKeys: [paperText, paperLine],
    derivedSources: [derivedSource],
  };
}

/* ------------------------------------------------------------------ staging a drawing to partition */

/** A drawing of the built artifact, ingested through the stubbed CLI, with its record. */
export type StagedIngest = { drawing: StagedDrawing; ingestId: string; artifact: BuiltArtifact };

/** The bytes a stored drawing is addressed by — the sniffed format only has to be accepted. */
function drawingBytes(label: string): Uint8Array {
  return new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${label}\n`);
}

/** The sha256 of some bytes, lowercase hex. */
export function sha256Of(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * A recorded drawing whose ingest artifact is the built one: the bytes are seeded into the store
 * (the upload door would refuse a hand-written stub), and the shipped ingest job is run over a
 * stand-in CLI that hands back the artifact. What lands is a real `ingests` row, written by the
 * product's own pipeline.
 */
export async function stageIngested(person: Person, projectId: string, captions: readonly CaptionSpec[], salt: number, label: string): Promise<StagedIngest> {
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

  const artifact = buildArtifact(captions, salt);
  const drawing = await stageDrawing(person, projectId, drawingBytes(label), { name: unique(`${label}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${label}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${label} left no ingest record — a partition is a reading of a record`).not.toBeNull();
  return { drawing, ingestId: (record as { ingestId: string }).ingestId, artifact };
}

/** A progress sink that keeps every step a job records, in order. */
export function stepSink(jobLabel: string): { progress: ProgressLike; steps: StepRecord[] } {
  const steps: StepRecord[] = [];
  return {
    steps,
    progress: {
      jobId: unique(jobLabel),
      tempDir: tempDir("partition"),
      step: async (name: string, detail?: Record<string, unknown>) => {
        steps.push({ step: name, detail: detail ?? {} });
      },
    },
  };
}

/** One run of the shipped partition job over a staged ingest, with the steps it recorded. */
export async function runPartition(person: Person, staged: StagedIngest, label = "partition"): Promise<StepRecord[]> {
  const rebuild = await rebuildDoor();
  const sink = stepSink(label);
  await rebuild.runPartitionJob(
    { tenantId: person.tenantId, drawingId: staged.drawing.drawingId, ingestId: staged.ingestId, requestedBy: person.userId },
    sink.progress,
    { storage: await storageOf() },
  );
  return sink.steps;
}

/* ------------------------------------------------------------------ minting a recorded answer */

/** A fresh, empty fixture root under $TMPDIR — nothing this acceptance mints is committed (Q-08). */
export function tempFixtureRoot(label: string): string {
  return mkdtempSync(join(tmpdir(), `cubit-${label}-`));
}

/** One recorded answer, filed under the request it answers (`fixtures/model/README.md`). */
export function mintFixture(root: string, hash: string, wire: { payload: JsonValue; sources: string[] }, modelId: string = VIEW_CAPTION_MODEL): ModelFixture {
  const fixture: ModelFixture = { requestHash: hash, modelId, payload: { payload: wire.payload, sources: wire.sources }, inputTokens: 120, outputTokens: 12 };
  writeFileSync(join(root, `${hash}.json`), JSON.stringify(fixture));
  return fixture;
}

/** Run `body` with the model fixture root replaced, and put the environment back afterwards. */
export async function withFixtureRoot<T>(root: string | undefined, body: () => Promise<T>): Promise<T> {
  const held = process.env[FIXTURE_ROOT_VAR];
  if (root === undefined) delete process.env[FIXTURE_ROOT_VAR];
  else process.env[FIXTURE_ROOT_VAR] = root;
  try {
    return await body();
  } finally {
    if (held === undefined) delete process.env[FIXTURE_ROOT_VAR];
    else process.env[FIXTURE_ROOT_VAR] = held;
  }
}

/* ------------------------------------------------------------------ reading the store */

/** Every `partition_views` row of one ingest, as the acceptance's own audit read. */
export function partitionViewRows(tenantId: string, ingestId: string): { viewKey: string; type: string; reason: string | null }[] {
  return sql(
    `select view_key, type, coalesce(reason, '') from ${ident(PARTITION_VIEWS)}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
       order by view_key;`,
  ).map((row) => ({ viewKey: row[0] ?? "", type: row[1] ?? "", reason: (row[2] ?? "") === "" ? null : (row[2] ?? null) }));
}

/** Every `view_assignments` row of one ingest: which entity key landed in which view. */
export function viewAssignmentRows(tenantId: string, ingestId: string): { entityKey: string; viewKey: string }[] {
  return sql(
    `select entity_key, view_key from ${ident(VIEW_ASSIGNMENTS)}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid
       order by entity_key;`,
  ).map((row) => ({ entityKey: row[0] ?? "", viewKey: row[1] ?? "" }));
}

/** Every confirmation row one workspace holds, newest last. */
export function viewTypeConfirmationRows(tenantId: string): { viewKey: string; type: string; actId: string }[] {
  return sql(
    `select view_key, type, act_id::text from ${ident(VIEW_TYPE_CONFIRMATIONS)}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid order by created_at;`,
  ).map((row) => ({ viewKey: row[0] ?? "", type: row[1] ?? "", actId: row[2] ?? "" }));
}

/** Every model call one workspace made, by the call id the ledger minted (L-AI-01). */
export function modelCallRows(tenantId: string): { callId: string; modelId: string; outcome: string; requestHash: string }[] {
  return sql(
    `select call_id::text, model_id, outcome, request_hash from ${ident("model_calls")}
       where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid;`,
  ).map((row) => ({ callId: row[0] ?? "", modelId: row[1] ?? "", outcome: row[2] ?? "", requestHash: row[3] ?? "" }));
}

/**
 * The job a (kind, key) pair is claimed by, or null where nothing holds that key — SEAM-JOBS' own
 * claim table, which is what makes a job idempotent on its key.
 */
export function claimedJobFor(kind: string, key: string): string | null {
  const held = sqlValue(`select coalesce(max(job_id), '') from cubit_jobs.job_claims where kind = ${lit(kind)} and key = ${lit(key)};`);
  return held === "" ? null : held;
}

/** Every step one job's log carries, in the order it carries them. */
export function jobLog(jobId: string): { step: string; status: string; kind: string; key: string }[] {
  return sql(
    `select step, status, kind, key from cubit_jobs.job_events where job_id = ${lit(jobId)} order by seq;`,
  ).map((row) => ({ step: row[0] ?? "", status: row[1] ?? "", kind: row[2] ?? "", key: row[3] ?? "" }));
}

/** The key a view row answers under, whichever of the two published spellings the door uses. */
export function keyOf(view: ViewRow): string {
  const key = view.viewKey ?? view.view_key;
  expect(typeof key, "a view answers under its own key — `viewKey` (or the column spelling `view_key`)").toBe("string");
  return String(key);
}

/** The refusal code a failure carries, whether it arrived bare or wrapped by a transport. */
export async function codeOf(failure: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf: (e: unknown) => string | null }>("src/core/faults/refusal-marker.ts");
  const direct = refusalCodeOf(failure);
  if (direct !== null) return direct;
  const cause = (failure as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** A tRPC caller for the takeoff lane, acting as one staged person (the sheets suite's shape). */
export async function takeoffCaller(person: Person): Promise<Record<string, (input: unknown) => Promise<unknown>>> {
  const router = await productModule<{ takeoffRouter: { createCaller: (ctx: unknown) => Record<string, (input: unknown) => Promise<unknown>> } }>(TAKEOFF_ROUTER_MODULE);
  expect(typeof router.takeoffRouter?.createCaller, `${TAKEOFF_ROUTER_MODULE} publishes the takeoff lane's router`).toBe("function");
  const here = "http://127.0.0.1";
  return router.takeoffRouter.createCaller({
    requestId: randomUUID(),
    actor: "an-account",
    origin: here,
    statedOrigin: null,
    requestOrigin: here,
    deviceLabel: "acceptance",
    client: "an unobserved caller",
    session: { sessionId: randomUUID(), userId: person.userId },
    secureCookies: false,
    cookies: [],
  });
}
