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
import { inflateSync } from "node:zlib";
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
  renderSheet: (graph: ArtifactGraph, layoutName: string, longEdge: number) => { png: Uint8Array; width: number; height: number };
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

/**
 * An EntityGraph artifact as this acceptance reads it: the sheet inventory, plus the two rosters
 * of drawn records L-CAD-03 spells (the originals and the paint derived from block instances).
 * Loose in its records because nothing here re-describes the vocabulary — the fields read below
 * are only `space` and `points`, which is what a line rasteriser is given to draw.
 */
export type ArtifactGraph = { layouts: ArtifactLayout[]; entities?: unknown[]; derived?: unknown[] };

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
 * The whole EntityGraph a record points at, read out of SEAM-STORAGE by the record's own address.
 * It is the corpus every expectation about the rasters is derived from — which sheets there are,
 * and what geometry each of them carries — so a corpus that changes changes the expectations with
 * it rather than leaving a transcription behind (B-19).
 */
export async function artifactOf(storage: StorageLike, tenantId: string, record: IngestRecord): Promise<ArtifactGraph> {
  const bytes = await storage.get(tenantId, record.artifactSha256);
  expect(bytes, `the artifact at ${record.artifactSha256} is held by SEAM-STORAGE — a record pointing at nothing has no sheets`).not.toBeNull();
  const document = JSON.parse(new TextDecoder().decode(bytes as Uint8Array)) as Partial<ArtifactGraph>;
  const layouts = document.layouts ?? [];
  expect(layouts.length, "the artifact carries the sheets its rasters are of (L-CAD-05: model space and every paper layout)").toBeGreaterThan(0);
  return { ...document, layouts } as ArtifactGraph;
}

/**
 * The layouts of the artifact a record points at. Every expectation about "one per sheet" is
 * derived from this rather than transcribed: a corpus that grows a layout grows the expected
 * roster with it (B-19).
 */
export async function layoutsOf(storage: StorageLike, tenantId: string, record: IngestRecord): Promise<ArtifactLayout[]> {
  return (await artifactOf(storage, tenantId, record)).layouts;
}

/* ------------------------------------------------------------------ what shape a sheet is */

/** How far one sheet reaches along each axis, in the artifact's own units. */
export type SheetSpans = { x: number; y: number };

/** One corner of a bounding box, read out of the artifact rather than assumed. */
function corner(value: JsonValue | undefined, what: string): { x: number; y: number } {
  const point = (Array.isArray(value) ? value : []) as JsonValue[];
  expect(point.length, `${what} is a point of the plane`).toBeGreaterThanOrEqual(2);
  const x = Number(point[0]);
  const y = Number(point[1]);
  expect([Number.isFinite(x), Number.isFinite(y)], `${what} is a pair of finite numbers`).toEqual([true, true]);
  return { x, y };
}

/**
 * How far a layout's bounding box reaches along each axis, or null when the artifact carries none
 * for that sheet — the case the interface answers with a blank square canvas.
 *
 * Read off the artifact under test at the moment it is judged, so the proportions a raster is held
 * to are the corpus's own and grow with it, rather than a pair transcribed here (B-19).
 */
export function bboxSpansOf(layout: ArtifactLayout): SheetSpans | null {
  const box = bboxOf(layout);
  return box === null ? null : { x: box.max.x - box.min.x, y: box.max.y - box.min.y };
}

/** A sheet's extents as the artifact states them, or null where it states none. */
export type SheetBox = { min: { x: number; y: number }; max: { x: number; y: number } };

/** The bounding box a layout declares, read out of the artifact under test (B-19). */
export function bboxOf(layout: ArtifactLayout): SheetBox | null {
  const bbox = layout.bbox;
  if (bbox === null || bbox === undefined || typeof bbox !== "object" || Array.isArray(bbox)) return null;
  const box = bbox as { [key: string]: JsonValue };
  const what = `layout ${JSON.stringify(layout.name)}'s bbox`;
  return { min: corner(box["min"], `${what}.min`), max: corner(box["max"], `${what}.max`) };
}

/* --------------------------------------------------- what geometry a sheet carries, from the corpus */

/** A rectangle on a raster or a sheet, stated as fractions of its width and its height. */
export type UnitBox = { x0: number; x1: number; y0: number; y1: number };

/** What the corpus says is drawn on one sheet: how many path records, and how far they reach. */
export type SheetGeometry = { drawn: number; box: UnitBox };

/** One point of a path record, or null for anything that is not a pair of finite numbers. */
function pointOf(value: unknown): { x: number; y: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * How far the geometry the artifact puts on one sheet reaches, as fractions of that sheet's own
 * bounding box — the extent a raster of the sheet has to show ink over, derived from the corpus
 * rather than measured off today's output (B-19). `y` runs the drawing's way, upward from the
 * box's minimum; which way up a raster writes its rows is the raster's business.
 *
 * A path record is counted only when at least one of its points is on the sheet, and each of its
 * points is held to the sheet's own extents: a stray reaching a million units away is off the
 * canvas, and the segment that leaves is cut where the sheet ends. Null when the sheet declares no
 * box, has no extent along an axis, or carries no path record at all — the cases where there is no
 * derived extent to hold a raster to.
 */
export function drawnExtentOf(graph: ArtifactGraph, layoutName: string): SheetGeometry | null {
  const layout = graph.layouts.find((candidate) => candidate.name === layoutName);
  if (layout === undefined) return null;
  const sheet = bboxOf(layout);
  if (sheet === null) return null;
  const spanX = sheet.max.x - sheet.min.x;
  const spanY = sheet.max.y - sheet.min.y;
  if (!(spanX > 0) || !(spanY > 0)) return null;

  const hold = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);
  let drawn = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const record of [...(graph.entities ?? []), ...(graph.derived ?? [])]) {
    const drawnRecord = record as { space?: unknown; points?: unknown };
    if (drawnRecord.space !== layoutName) continue;
    const points = (Array.isArray(drawnRecord.points) ? drawnRecord.points : []).map(pointOf).filter((point): point is { x: number; y: number } => point !== null);
    // Two points is what makes a path: a record carrying one is an insertion, and glyphs are not
    // rendered (this increment's scope note).
    if (points.length < 2) continue;
    if (!points.some((point) => point.x >= sheet.min.x && point.x <= sheet.max.x && point.y >= sheet.min.y && point.y <= sheet.max.y)) continue;
    drawn += 1;
    for (const point of points) {
      const x = hold(point.x, sheet.min.x, sheet.max.x);
      const y = hold(point.y, sheet.min.y, sheet.max.y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (drawn === 0) return null;
  return {
    drawn,
    box: { x0: (minX - sheet.min.x) / spanX, x1: (maxX - sheet.min.x) / spanX, y0: (minY - sheet.min.y) / spanY, y1: (maxY - sheet.min.y) / spanY },
  };
}

/**
 * The canvas a sheet of these spans fills at a tier's long edge: the sheet's longer axis takes the
 * whole long edge and its other axis stands in the sheet's own proportion to it.
 *
 * Real numbers, not pixels — a rasteriser may round a fitted axis either way, and that pixel is all
 * the latitude the criterion grants.
 */
export function fittedCanvas(spans: SheetSpans, longEdge: number): { width: number; height: number } {
  const longest = Math.max(spans.x, spans.y);
  expect(longest, "a sheet's bounding box reaches somewhere along at least one axis").toBeGreaterThan(0);
  const scale = longEdge / longest;
  return { width: spans.x * scale, height: spans.y * scale };
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

/* ------------------------------------------------------------------ reading a PNG's pixels */

/** How coarse the signature that says two rasters depict different sheets is. */
const INK_SIGNATURE_CELLS = 16;

/** One byte's worth of channel, and the number of distinct values one carries. */
const CHANNEL_VALUES = 256;

/** The colour types this reader knows how to un-filter: truecolour, with or without alpha. */
const RGB_COLOUR_TYPE = 2;
const RGBA_COLOUR_TYPE = 6;

/**
 * What one raster's pixels say: the paper it stands on (the colour most of it is), how much of it
 * is marked, how far the marks reach, and a coarse signature of where they fall.
 *
 * The background is derived from the raster itself rather than named here: the Bible fixes no
 * palette, so ink is judged as "not the paper" and never against a transcribed colour.
 */
export type Ink = {
  width: number;
  height: number;
  background: number;
  count: number;
  ratio: number;
  box: UnitBox | null;
  signature: string;
};

/** Paeth's predictor, as the PNG format defines filter type 4. */
function paeth(left: number, above: number, corner: number): number {
  const estimate = left + above - corner;
  const toLeft = Math.abs(estimate - left);
  const toAbove = Math.abs(estimate - above);
  const toCorner = Math.abs(estimate - corner);
  if (toLeft <= toAbove && toLeft <= toCorner) return left;
  return toAbove <= toCorner ? above : corner;
}

/** The scanlines of an inflated image datastream, with each line's filter undone. */
function unfiltered(raw: Uint8Array, width: number, height: number, channels: number, what: string): Uint8Array {
  const stride = width * channels;
  expect(raw.length, `${what}'s image data is ${height} filtered scanlines of ${stride} bytes`).toBe((stride + 1) * height);
  const out = new Uint8Array(stride * height);
  const none = new Uint8Array(stride);
  let at = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[at] ?? 0;
    expect(filter, `${what}'s scanline ${row} carries one of the five filters the format defines`).toBeLessThanOrEqual(4);
    at += 1;
    const line = out.subarray(row * stride, (row + 1) * stride);
    const prior = row === 0 ? none : out.subarray((row - 1) * stride, row * stride);
    for (let index = 0; index < stride; index += 1) {
      const value = raw[at + index] ?? 0;
      const left = index >= channels ? (line[index - channels] ?? 0) : 0;
      const above = prior[index] ?? 0;
      const corner = index >= channels ? (prior[index - channels] ?? 0) : 0;
      let restored = value;
      if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + above;
      else if (filter === 3) restored = value + Math.floor((left + above) / 2);
      else if (filter === 4) restored = value + paeth(left, above, corner);
      line[index] = restored % CHANNEL_VALUES;
    }
    at += stride;
  }
  return out;
}

/**
 * The marks on one stored raster, read out of the PNG itself.
 *
 * The format is decoded rather than trusted — signature, IHDR, every IDAT inflated through
 * `node:zlib` and the scanline filters undone — because the question the criteria ask is what the
 * bytes DEPICT, and a container of the right size depicts nothing on its own (R-SPINE-022).
 */
export function inkOf(bytes: Uint8Array, what: string): Ink {
  const header = pngHeader(bytes, what);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const depth = bytes[24] ?? 0;
  const colourType = bytes[25] ?? 0;
  const interlace = bytes[28] ?? 0;
  expect({ depth, interlace }, `${what} is an eight-bit, non-interlaced PNG, which is what its IHDR has to say for these pixels to be readable`).toStrictEqual({ depth: 8, interlace: 0 });
  expect([RGB_COLOUR_TYPE, RGBA_COLOUR_TYPE], `${what} is truecolour (its IHDR says colour type ${colourType})`).toContain(colourType);
  const channels = colourType === RGBA_COLOUR_TYPE ? 4 : 3;

  const parts: Uint8Array[] = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const chunk = new TextDecoder().decode(bytes.subarray(at + 4, at + 8));
    if (chunk === "IDAT") parts.push(bytes.subarray(at + 8, at + 8 + length));
    if (chunk === "IEND") break;
    at += length + 12;
  }
  expect(parts.length, `${what} carries the image data every PNG must (at least one IDAT chunk)`).toBeGreaterThan(0);

  const pixels = unfiltered(new Uint8Array(inflateSync(Buffer.concat(parts))), header.width, header.height, channels, what);
  const total = header.width * header.height;
  const packed = new Uint32Array(total);
  for (let index = 0; index < total; index += 1) {
    const from = index * channels;
    const red = pixels[from] ?? 0;
    const green = pixels[from + 1] ?? 0;
    const blue = pixels[from + 2] ?? 0;
    const alpha = channels === 4 ? (pixels[from + 3] ?? 0) : CHANNEL_VALUES - 1;
    packed[index] = ((red * CHANNEL_VALUES + green) * CHANNEL_VALUES + blue) * CHANNEL_VALUES + alpha;
  }

  // The paper is whichever colour most of the raster is — asked of the raster, never transcribed.
  const tally = new Map<number, number>();
  for (const value of packed) tally.set(value, (tally.get(value) ?? 0) + 1);
  let background = packed[0] ?? 0;
  let commonest = -1;
  for (const [value, count] of tally) {
    if (count > commonest) {
      background = value;
      commonest = count;
    }
  }

  const cells = new Uint8Array(INK_SIGNATURE_CELLS * INK_SIGNATURE_CELLS);
  let count = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let y = 0; y < header.height; y += 1) {
    for (let x = 0; x < header.width; x += 1) {
      if ((packed[y * header.width + x] ?? 0) === background) continue;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const column = Math.min(INK_SIGNATURE_CELLS - 1, Math.floor((x * INK_SIGNATURE_CELLS) / header.width));
      const row = Math.min(INK_SIGNATURE_CELLS - 1, Math.floor((y * INK_SIGNATURE_CELLS) / header.height));
      cells[row * INK_SIGNATURE_CELLS + column] = 1;
    }
  }

  return {
    width: header.width,
    height: header.height,
    background,
    count,
    ratio: total === 0 ? 0 : count / total,
    box: count === 0 ? null : { x0: minX / header.width, x1: (maxX + 1) / header.width, y0: minY / header.height, y1: (maxY + 1) / header.height },
    signature: [...cells].map((cell) => (cell === 1 ? "#" : ".")).join(""),
  };
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
