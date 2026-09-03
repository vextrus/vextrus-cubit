/**
 * The mechanics the sheet-raster acceptance runs on (R-SPINE-022, R-SPINE-021, inc-107).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts and
 * the projects come from the upload seam's own stage, and the recorded drawing plus the stand-in for
 * the `cad/` CLI come from the ingest pipeline's (`./ingest-stage`): one invariant, one home
 * (B-17, ARCH-02). What this file adds is what a raster needs beyond an ingest — an ingest record
 * written from a committed EntityGraph artifact without spending a `uv run` on it, the declared
 * shapes the suites read this seam through, and a reader for the PNG header the criteria judge.
 *
 * Product modules are loaded by absolute path (`productModule`) so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance.
 *
 * Nothing here reads product source: every name below is one the increment's interface list or its
 * test contract publishes.
 */
import { expect } from "vitest";
import { enrol, openStage, stageProject, type Person } from "../../spine/uploads/support/upload-stage";
import {
  cadFixture,
  corpusBytes,
  productModule,
  stageDrawing,
  stubCli,
  tempDir,
  unique,
  withCadCommand,
  INGEST_MODULE,
  UPLOADS_MODULE,
  type IngestRecord,
  type IngestSeam,
  type JsonValue,
  type ProgressLike,
  type StagedDrawing,
} from "./ingest-stage";

/** The homes this increment's interface list names. */
export const THUMBNAILS_MODULE = "src/modules/takeoff/thumbnails/index.ts";
export const THUMBNAILS_HANDLER_MODULE = "src/worker/handlers/thumbnails.ts";
export const JOBS_MODULE = "src/core/jobs/index.ts";
export const ERRORS_MODULE = "src/core/errors.ts";

/** The refusals the test contract spells for this door. */
export const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";
export const RASTER_NOT_AVAILABLE = "RASTER_NOT_AVAILABLE";

/** The environment name the signed URLs of R-SPINE-021 are minted under (test contract). */
export const SIGNING_SECRET_VAR = "CUBIT_STORAGE_SIGNING_SECRET";

/** The steps `runThumbnailsJob` reports, in the order the interface list takes them. */
export const RASTER_STEPS: readonly string[] = Object.freeze(["resolve", "render", "store", "record"]);

/** The eight bytes every PNG opens with, written as decimals: a hex number would read as a colour. */
const PNG_SIGNATURE: readonly number[] = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * The signing secret is published as this module loads, before any product module is imported.
 *
 * `uploadStorage()` mints a secret of its own when the machine names none and holds it for the life
 * of the process (Q-12, B-23: no secret is written into the tree as a default), so a URL minted
 * before this name is stated could never be verified against it. Stating it here — the one module
 * every suite of this increment imports first — is what makes the order certain.
 */
process.env[SIGNING_SECRET_VAR] = `rasters-acceptance-${unique("secret")}`;

/* ------------------------------------------------------------------ the shapes the seams answer in */

/** What SEAM-STORAGE says about a signed URL it is shown (`Storage.verify`). */
export type SignVerification = { ok: true; tenantId: string; sha256: string } | { ok: false; reason: string };

/** SEAM-STORAGE as this acceptance holds it — content addressing plus Q-12's signed download URLs. */
export type StorageLike = {
  put: (tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }>;
  get: (tenantId: string, sha256: string) => Promise<Uint8Array | null>;
  sign: (tenantId: string, sha256: string, options: { expiresInSeconds: number }) => string;
  verify: (url: string, at?: Date) => SignVerification;
};

/** The app's one storage, as `src/modules/spine/uploads` publishes it. */
export type StorageSeam = { uploadStorage: () => StorageLike };

/** One recorded raster (increment interfaces: `SheetRasterRecord`). */
export type SheetRasterRecord = {
  rasterId: string;
  ingestId: string;
  drawingId: string;
  jobId: string;
  layoutName: string;
  tier: string;
  width: number;
  height: number;
  sha256: string;
  createdAt: string;
};

/** What one tier of one sheet is served as (increment interfaces: `SheetRasters["tiers"]`). */
export type SheetTier = { url: string; width: number; height: number; sha256: string };

/** One sheet as the read door answers it (increment interfaces: `SheetRasters`). */
export type SheetRasters = { layoutName: string; kind: string; tiers: Record<string, SheetTier> };

/** The answer of `requestThumbnails` (increment interfaces). */
export type ThumbnailsAnswer = { jobId: string | null; deduplicated: boolean } | { refusal: string };

/** R-SPINE-022's seam, through the surface the increment publishes. */
export type ThumbnailsSeam = {
  THUMBNAILS_KIND: string;
  RASTER_TIERS: readonly string[];
  RASTER_TIER_LONG_EDGE: Readonly<Record<string, number>>;
  RASTER_URL_LIFETIME_SECONDS: number;
  thumbnailsJobKey: (tenantId: string, ingestId: string) => string;
  requestThumbnails: (request: { tenantId: string; drawingId: string; requestedBy: string }) => Promise<ThumbnailsAnswer>;
  runThumbnailsJob: (payload: unknown, progress: ProgressLike, deps: { storage: StorageLike }) => Promise<void>;
  sheetRasterRecords: (scope: { tenantId: string; ingestId: string }) => Promise<SheetRasterRecord[]>;
  sheetRastersOf: (scope: { tenantId: string; drawingId: string }) => Promise<SheetRasters[]>;
};

/** The composition root the worker calls before it starts consuming (increment interfaces). */
export type ThumbnailsHandlerModule = { registerThumbnailsHandler: () => void };

/** SEAM-JOBS through the surface this acceptance uses: enqueue, registration and the runtime. */
export type JobsLike = {
  enqueue: (kind: string, payload: unknown, options: { key: string }) => Promise<{ jobId: string; deduplicated: boolean }>;
  registerJobHandler: (kind: string, handler: (payload: unknown, progress: ProgressLike) => Promise<void>) => void;
  startJobsRuntime: (databaseUrl: string) => Promise<unknown>;
  stopJobsRuntime: () => Promise<unknown>;
};

/** One layout of an EntityGraph artifact — a sheet, which is what a raster is of (L-CAD-05). */
export type ArtifactLayout = { name: string; kind: string; bbox: JsonValue };

export type { IngestRecord, Person, ProgressLike, StagedDrawing };

/* ------------------------------------------------------------------ the stage */

/** The scratch database and the scratch storage root this increment's suites run over. */
export async function openThumbnailsStage(): Promise<{ urlMigrate: string; root: string }> {
  expect(process.env[SIGNING_SECRET_VAR] ?? "", `${SIGNING_SECRET_VAR} is stated before anything mints a signed URL (Q-12)`).not.toBe("");
  const { db, root } = await openStage();
  return { urlMigrate: db.urlMigrate, root };
}

/** The app's one storage, loaded through the door that reads the machine's answer. */
export async function storageOf(): Promise<StorageLike> {
  return (await productModule<StorageSeam>(UPLOADS_MODULE)).uploadStorage();
}

/** A person with a project of their own, made through the shipped doors. */
export async function stagePerson(label: string): Promise<{ person: Person; projectId: string }> {
  const person = await enrol(label);
  return { person, projectId: stageProject(person.tenantId, `Rasters ${label}`) };
}

/**
 * A drawing of the committed corpus with an ingest record written from the committed artifact
 * beside it.
 *
 * The extractor is stood in for rather than run: R-SPINE-022 is about what is rendered FROM an
 * EntityGraph, and the graph a raster is taken from must be one the criteria can name — which is
 * exactly what the committed `<fixture>.entitygraph.json` is. The record is written by the shipped
 * ingest job, so nothing here invents a second way to record one (ARCH-02).
 */
export async function stageIngested(person: Person, projectId: string, fixture: string): Promise<{ drawing: StagedDrawing; record: IngestRecord }> {
  const ingest = await productModule<IngestSeam>(INGEST_MODULE);
  const drawing = await stageDrawing(person, projectId, cadFixture(fixture), { name: unique(`${fixture}.dxf`), format: "dxf" });
  const artifact = new TextDecoder().decode(corpusBytes(`cad/tests/fixtures/${fixture}.entitygraph.json`));
  const stub = stubCli({ artifact, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await ingest.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${fixture}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await ingest.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${fixture}.dxf left no ingest record — a raster is of a record, so nothing below could be judged`).not.toBeNull();
  return { drawing, record: record as IngestRecord };
}

/**
 * The layouts of the artifact a record points at, read out of SEAM-STORAGE by the record's own
 * address. Every expectation about "one per sheet" is derived from this rather than transcribed:
 * a corpus that grows a layout grows the expected roster with it (B-19).
 */
export async function layoutsOf(storage: StorageLike, tenantId: string, record: IngestRecord): Promise<ArtifactLayout[]> {
  const bytes = await storage.get(tenantId, record.artifactSha256);
  expect(bytes, `the artifact at ${record.artifactSha256} is held by SEAM-STORAGE — a record pointing at nothing has no sheets`).not.toBeNull();
  const document = JSON.parse(new TextDecoder().decode(bytes as Uint8Array)) as { layouts?: ArtifactLayout[] };
  const layouts = document.layouts ?? [];
  expect(layouts.length, "the artifact carries the sheets its rasters are of (L-CAD-05: model space and every paper layout)").toBeGreaterThan(0);
  return layouts;
}

/* ------------------------------------------------------------------ reading a PNG */

/** What a PNG's own header says it is — the only thing that can settle a raster's size. */
export type PngHeader = { width: number; height: number };

/**
 * The width and height a PNG declares in its IHDR, refusing anything that is not one. The format is
 * read rather than trusted: a stored object that is not a PNG, or one whose header disagrees with
 * the row that describes it, is exactly what AC-1 exists to catch.
 */
export function pngHeader(bytes: Uint8Array, what: string): PngHeader {
  expect(bytes.length, `${what} is too short to be a PNG at all (${bytes.length} bytes)`).toBeGreaterThan(24);
  expect([...bytes.subarray(0, PNG_SIGNATURE.length)], `${what} opens with the PNG signature`).toEqual([...PNG_SIGNATURE]);
  expect(new TextDecoder().decode(bytes.subarray(12, 16)), `${what}'s first chunk is the IHDR the format begins with`).toBe("IHDR");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/* ------------------------------------------------------------------ comparing rosters */

/** The identity of one raster row, for comparing two readings without pinning either's order. */
export function rasterKey(row: { layoutName: string; tier: string }): string {
  return `${row.layoutName} ${row.tier}`;
}

/** Sorted by code point — `localeCompare` is not available to this tree (L-REG-05). */
export function byCodePoint(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Rows in one settled order, so two readings of the same set compare as sets rather than as lists. */
export function inRasterOrder<T extends { layoutName: string; tier: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const a = rasterKey(left);
    const b = rasterKey(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Where each named step first stands in what a job reported, refusing one it never reached. The
 * order the steps were taken in is the pipeline's promise; which other steps it also reported is
 * not this acceptance's business (B-19).
 */
export function stepOrder(reported: readonly string[], steps: readonly string[]): number[] {
  return steps.map((step) => {
    const at = reported.indexOf(step);
    expect(at, `the job never reported the step \`${step}\` — it reported: ${reported.join(" → ")}`).toBeGreaterThanOrEqual(0);
    return at;
  });
}
