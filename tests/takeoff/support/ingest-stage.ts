/**
 * The mechanics the ingest pipeline's acceptance runs on (SEAM-CAD, R-TO-001, inc-106).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts and
 * the projects come from the upload seam's own stage (`tests/spine/uploads/support/upload-stage.ts`)
 * rather than from a second staging dialect invented here: one invariant, one home (B-17, ARCH-02).
 * What this file adds is what the ingest pipeline needs beyond a transfer — a drawing seeded from
 * bytes the upload seam would refuse, a stand-in for the `cad/` CLI, and the declared shapes the
 * suites read the seam through.
 *
 * Product modules are loaded by absolute path so a file the Builder has not written yet fails as an
 * assertion naming it, rather than as a collection death that reads as a defect in the acceptance.
 *
 * Nothing here reads product source: every name below is one the increment's interface list or its
 * test contract publishes.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { expect } from "vitest";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { sql, sqlValue, type Person } from "../../spine/uploads/support/upload-stage";
import type { JobEvent, JobsModule } from "../../jobs/support/jobs-acceptance";

/** The checkout this suite drives — the lane runs at the root of it. */
export const REPO_ROOT: string = process.cwd();

/** The homes the increment's interface list names. */
export const INGEST_MODULE = "src/modules/takeoff/ingest/index.ts";
/**
 * The job door (ARCH-01): `runIngestJob`, `ingestDrawing` and the CLI's environment name live behind
 * it so the app's module graph never holds the process boundary — the bundler traced the whole
 * checkout from the CLI client and died on `cad/.venv`. The seam this suite drives is both doors.
 */
export const INGEST_JOB_MODULE = "src/modules/takeoff/ingest/job.ts";
export const INGEST_HANDLER_MODULE = "src/worker/handlers/ingest.ts";
export const JOBS_MODULE = "src/core/jobs/index.ts";
export const UPLOADS_MODULE = "src/modules/spine/uploads/index.ts";
export const ENTITYGRAPH_MODULE = "src/core/entitygraph/schema.ts";

/** The kind, the refusals and the environment name the test contract spells. */
export const INGEST_KIND = "ingest";
export const SHEET_NOT_INGESTABLE = "SHEET_NOT_INGESTABLE";
export const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";
export const CAD_COMMAND_VAR = "CUBIT_CAD_COMMAND";

/** The reason every statement this file makes is recorded under — attributable, like any other. */
const SEED_REASON = "test: seed a recorded drawing for the ingest pipeline";

/** A JSON document, described no more tightly than JSON itself is. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/* ------------------------------------------------------------------ loading product modules */

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative_: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative_);
  expect(existsSync(absolute), `${relative_} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The whole ingest seam: the request door and the job door, as one object (the suite's contract). */
export async function ingestSeam(): Promise<IngestSeam> {
  const door = await productModule<Partial<IngestSeam>>(INGEST_MODULE);
  const job = await productModule<Partial<IngestSeam>>(INGEST_JOB_MODULE);
  return { ...door, ...job } as IngestSeam;
}

/* ------------------------------------------------------------------ the shapes the seam answers in */

/** What one invocation of the CLI amounted to (increment interfaces: `IngestOutcome`). */
export type IngestOutcome =
  | { ok: true; graph: Record<string, JsonValue>; artifact: Uint8Array }
  | { ok: false; refusal: string; detail: string };

/** The answer of `requestIngest` (increment interfaces: `IngestRequested | IngestRefused`). */
export type IngestAnswer = { jobId: string | null; ingestId: string | null; deduplicated: boolean } | { refusal: string };

/** The counters and named facts a record pins (increment interfaces: `IngestFacts`). */
export type IngestFacts = {
  insunits: JsonValue;
  dropped_layouts: string[];
  layouts: { name: string; kind: string; strays_rejected: number }[];
  counters: { space: string; explode_truncated: boolean; explode_losses: JsonValue; flatten_capped: JsonValue }[];
};

/** One persisted ingest (increment interfaces: `IngestRecord`). */
export type IngestRecord = {
  ingestId: string;
  drawingId: string;
  sha256: string;
  jobId: string;
  artifactSha256: string;
  extractor: { scheme: string; tool: string; toolVersion: string; parameterSetHash: string };
  facts: IngestFacts;
  supersedes: string | null;
  declaredReason: string | null;
  createdAt: string;
};

/** What a running job is given (SEAM-JOBS: `JobProgress`), as a handler driven by hand is given it. */
export type ProgressLike = { readonly jobId?: string; readonly tempDir: string; step: (name: string, detail?: Record<string, unknown>) => Promise<void> };

/** SEAM-CAD's orchestration, through the surface the increment publishes. */
export type IngestSeam = {
  ingestDrawing: (bytes: Uint8Array, format: string, options: { tempDir: string }) => Promise<IngestOutcome>;
  requestIngest: (request: { tenantId: string; drawingId: string; requestedBy: string; declared?: { reason: string } }) => Promise<IngestAnswer>;
  ingestRecordOf: (request: { tenantId: string; drawingId: string }) => Promise<IngestRecord | null>;
  ingestRecords: (request: { tenantId: string; drawingId: string }) => Promise<IngestRecord[]>;
  factsOf: (graph: unknown) => IngestFacts;
  runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void>;
  ingestJobKey: (tenantId: string, drawingId: string, supersedes: string | null) => string;
  INGEST_KIND: string;
  CAD_COMMAND_VAR: string;
};

/** The composition root the worker calls before it starts consuming (increment interfaces). */
export type IngestHandlerModule = { registerIngestHandler: () => void };

/** SEAM-JOBS as this increment extends it: the merged surface plus the registration door. */
export type JobsSeam = JobsModule & { registerJobHandler?: unknown };

/** SEAM-STORAGE as the app holds it (`uploadStorage()` reads STORAGE_ROOT). */
export type UploadSeam = {
  uploadStorage: () => { put: (tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }>; get: (tenantId: string, sha256: string) => Promise<Uint8Array | null> };
  createUpload: (request: { actor: { tenantId: string; userId: string }; projectId: string; name: string; size: number; sha256: string }) => Promise<{ uploadId?: string; chunkBytes?: number; refusal?: string }>;
  appendChunk: (request: { actor: { tenantId: string; userId: string }; uploadId: string; offset: number; bytes: Uint8Array }) => Promise<{
    receivedBytes?: number;
    complete?: true;
    drawings?: { drawingId: string; name: string; sha256: string; format: string; duplicate: boolean }[];
    refusal?: string;
  }>;
};

/** The Zod mirror of EntityGraph v2 (L-CAD-05), which both sides of the seam parse. */
export type GraphSchema = { entityGraphSchema: { parse: (value: unknown) => unknown; safeParse: (value: unknown) => { success: boolean; error?: unknown } } };

export type { JobEvent, Person };

/* ------------------------------------------------------------------ bytes and fixtures */

/** The sha256 of some bytes, lowercase hex — the address SEAM-STORAGE holds them under. */
export function sha256Of(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A file of the declared corpus, as bytes, asserted present before anything depends on it. */
export function corpusBytes(relativePath: string): Uint8Array {
  const path = join(REPO_ROOT, relativePath);
  expect(existsSync(path), `${relativePath} is part of the declared fixture corpus`).toBe(true);
  return new Uint8Array(readFileSync(path));
}

/** One of the committed cad fixtures, by name (`cad/tests/fixtures/<name>.dxf`). */
export function cadFixture(name: string): Uint8Array {
  return corpusBytes(join("cad", "tests", "fixtures", `${name}.dxf`));
}

/** The committed artifact beside it, read as an input — never re-baselined here. */
export function committedArtifact(name: string): Record<string, JsonValue> {
  const text = new TextDecoder().decode(corpusBytes(join("cad", "tests", "fixtures", `${name}.entitygraph.json`)));
  return JSON.parse(text) as Record<string, JsonValue>;
}

/** A temp directory of this run's own, outside the tree. */
export function tempDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `cubit-ingest-${label}-`));
}

/** Every file under a directory, as paths relative to it — how a storage root is compared over time. */
export function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(root, path));
    }
  };
  walk(root);
  return found.sort();
}

/* ------------------------------------------------------------------ a stand-in for the cad CLI */

/** What a stand-in CLI does when it is called, and where it records having been called. */
export type StubPlan = {
  /** The bytes it writes to the path behind `--out`, or null when it writes nothing at all. */
  artifact: string | null;
  /** What it says on stderr before it exits. */
  stderr: string;
  /** The status it exits with — which is never the thing the pipeline judges it by. */
  exitCode: number;
};

/** A stand-in CLI, and the way to read what it was really asked to do. */
export type Stub = {
  /** The value `CUBIT_CAD_COMMAND` is set to: two words, so whitespace-splitting is exercised. */
  command: string;
  /** The argv after the command prefix, and the directory it was run in — or null if never called. */
  invocation: () => { argv: string[]; cwd: string } | null;
  /** How many times it was called. */
  calls: () => number;
};

/**
 * Write a stand-in for the `cad/` CLI. It records the argv it was handed and the directory it ran
 * in, then does exactly what its plan says — which is how "the judgement is the artifact, never the
 * exit status" can be driven from both sides.
 */
export function stubCli(plan: StubPlan): Stub {
  const home = tempDir("stub");
  const log = join(home, "invocations.jsonl");
  const planPath = join(home, "plan.json");
  const script = join(home, "cli.cjs");
  writeFileSync(planPath, JSON.stringify(plan));
  writeFileSync(
    script,
    [
      'const fs = require("node:fs");',
      'const plan = JSON.parse(fs.readFileSync(__dirname + "/plan.json", "utf8"));',
      "const argv = process.argv.slice(2);",
      'fs.appendFileSync(__dirname + "/invocations.jsonl", JSON.stringify({ argv, cwd: process.cwd() }) + "\\n");',
      'if (plan.stderr !== "") process.stderr.write(plan.stderr);',
      "if (plan.artifact !== null) {",
      '  const at = argv.indexOf("--out");',
      "  if (at >= 0 && argv[at + 1] !== undefined) fs.writeFileSync(argv[at + 1], plan.artifact);",
      "}",
      "process.exit(plan.exitCode);",
      "",
    ].join("\n"),
  );

  const read = (): { argv: string[]; cwd: string }[] =>
    !existsSync(log)
      ? []
      : readFileSync(log, "utf8")
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => JSON.parse(line) as { argv: string[]; cwd: string });

  return { command: `${process.execPath} ${script}`, invocation: () => read()[0] ?? null, calls: () => read().length };
}

/** Run `body` with the CLI command prefix replaced, and put the environment back afterwards. */
export async function withCadCommand<T>(command: string | undefined, body: () => Promise<T>): Promise<T> {
  const held = process.env[CAD_COMMAND_VAR];
  if (command === undefined) delete process.env[CAD_COMMAND_VAR];
  else process.env[CAD_COMMAND_VAR] = command;
  try {
    return await body();
  } finally {
    if (held === undefined) delete process.env[CAD_COMMAND_VAR];
    else process.env[CAD_COMMAND_VAR] = held;
  }
}

/* ------------------------------------------------------------------ a recorded drawing */

/** A drawing the store holds, as the pipeline finds one. */
export type StagedDrawing = { drawingId: string; sha256: string; name: string };

/**
 * Record a drawing the way the store holds one: the bytes at their address in SEAM-STORAGE, a
 * `files` row for the content and a `drawings` row naming it.
 *
 * Seeded rather than uploaded on purpose: the upload seam refuses bytes that are not a drawing at
 * its format sniff, so a sheet the extractor cannot read — and a format the pipeline refuses —
 * cannot arrive through the door at all, and this is how the pipeline is shown one anyway.
 */
export async function stageDrawing(
  person: Person,
  projectId: string,
  bytes: Uint8Array,
  options: { name: string; format: string },
): Promise<StagedDrawing> {
  const uploads = await productModule<UploadSeam>(UPLOADS_MODULE);
  const { sha256 } = await uploads.uploadStorage().put(person.tenantId, bytes);

  sql(
    `insert into ${ident("files")} (${ident(TENANT_COLUMN)}, sha256, byte_length, format, scan_verdict)
       values (${lit(person.tenantId)}::uuid, ${lit(sha256)}, ${bytes.length}, ${lit(options.format)}, 'skipped')
       on conflict do nothing;`,
  );
  const drawingId = sqlValue(
    `insert into ${ident("drawings")} (${ident(TENANT_COLUMN)}, project_id, sha256, name, format, uploaded_by)
       values (${lit(person.tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(sha256)}, ${lit(options.name)}, ${lit(options.format)}, ${lit(person.userId)}::uuid)
       returning drawing_id::text;`,
  );
  expect(drawingId, `seeding ${options.name} recorded no drawing (${SEED_REASON})`).not.toBe("");
  return { drawingId, sha256, name: options.name };
}

/**
 * A label no two runs of this suite can collide on. A name that carries an extension keeps it: the
 * upload seam reads the declared format off the end of the name, so a marker appended after `.dxf`
 * would make the same fixture arrive as a format the door does not accept.
 */
export function unique(label: string): string {
  const marker = randomUUID().slice(0, 8);
  const dot = label.lastIndexOf(".");
  return dot <= 0 ? `${label}-${marker}` : `${label.slice(0, dot)}-${marker}${label.slice(dot)}`;
}

/* ------------------------------------------------------------------ reading a job's log */

/**
 * The step names a job's log carries, in the order it carries them. Read off every event rather
 * than off one status: which status labels a step is the seam's business, and the order the steps
 * were reached in is the pipeline's.
 */
export function stepsOf(events: readonly JobEvent[]): string[] {
  return events.map((event) => event.step);
}

/** Where each named step first appears in a log, refusing one the log never reached. */
export function orderOf(events: readonly JobEvent[], steps: readonly string[]): number[] {
  const seen = stepsOf(events);
  return steps.map((step) => {
    const at = seen.indexOf(step);
    expect(at, `the job never recorded the step \`${step}\` — its log reads: ${seen.join(" → ")}`).toBeGreaterThanOrEqual(0);
    return at;
  });
}

/** The last thing said about a job — its ending. */
export function endingOf(events: readonly JobEvent[]): JobEvent | undefined {
  return events.at(-1);
}
