// R-SPINE-022's orchestration: one door in, one job per ingest record, every sheet that record's
// artifact carries rendered at every tier, each raster stored at its own address and recorded once,
// and one read door that answers the signed links a sheet card is drawn from.
//
// A raster is of a record, never of a drawing in the abstract (R-TO-001): the record names the
// artifact the sheets are read out of, so the job carries the record's id and a record superseded
// while the job waited does not silently redirect it.
//
// The store the handler reads the artifact from and writes rasters to arrives as a dependency: the
// composition root that holds the app's Storage is src/worker, and nothing here re-reads where
// objects live (ARCH-01, B-17). The read door mints its URLs from the app's one storage instance,
// which is core's — a second instance would mean a second signing secret, and a URL one minted the
// other would refuse (Q-12).
import { REFUSALS } from "../../../core/errors";
import { entityGraphSchema, type EntityGraph } from "../../../core/entitygraph/schema";
import { refusal } from "../../../core/faults/refusal-marker";
import { enqueue, type JobKind, type JobPayloads, type JobProgress } from "../../../core/jobs";
import type { Storage } from "../../../core/storage";
import { appStorage } from "../../../core/storage/app";
import { drawingInScope, ingestRecordOf, ingestRecords, type IngestRecord } from "../ingest";
import { renderSheet } from "./raster";
import type { ThumbnailsRefusalCode } from "./refusals";
import { hasSheetRasters, sheetRasterRecords, writeSheetRaster, type SheetRasterRecord } from "./records";
import { RASTER_TIERS, RASTER_TIER_LONG_EDGE, RASTER_URL_LIFETIME_SECONDS, type RasterTier } from "./tiers";

/** The kind this seam's work runs under, bound to SEAM-JOBS' roster rather than re-spelled (B-17). */
export const THUMBNAILS_KIND = "thumbnails" satisfies JobKind;

/** The steps the job records, in the order it takes them (R-SPINE-022). */
const STEP_RESOLVE = "resolve";
const STEP_RENDER = "render";
const STEP_STORE = "store";
const STEP_RECORD = "record";

/**
 * How much of a layout's name is recorded. The name is a drawing's own text and a btree entry has a
 * ceiling: a sheet named past this would fault the index rather than be stored, so the recorded name
 * is bounded here where the bound can be stated, and no sheet name a person types comes near it.
 */
const LAYOUT_NAME_MAX_BYTES = 512;

/** The two spaces a sheet can be — model space, or one of the paper layouts (L-CAD-05). */
type SheetKind = EntityGraph["layouts"][number]["kind"];

/** One tier of one sheet, as the read door serves it. */
export type SheetTier = { url: string; width: number; height: number; sha256: string };

/** One sheet, as the read door serves it: what it is, and a signed link per tier (Q-12). */
export type SheetRasters = { layoutName: string; kind: SheetKind; tiers: Record<RasterTier, SheetTier> };

/** Somebody asking for a drawing's sheets to be rendered. */
export type ThumbnailsRequest = { tenantId: string; drawingId: string; requestedBy: string };

/** What the door answers when it accepted: the job it enqueued, or nothing to do and why not. */
export type ThumbnailsRequested = { jobId: string | null; deduplicated: boolean };

/** What the door answers when it did not: a registered code, and nothing enqueued (R-SPINE-062). */
export type ThumbnailsRefused = { refusal: ThumbnailsRefusalCode };

/** The key one record's rasters stand under: one job per record, whoever asks for it. */
export function thumbnailsJobKey(tenantId: string, ingestId: string): string {
  return `${THUMBNAILS_KIND}:${tenantId}:${ingestId}`;
}

/** A sheet name as it is recorded — the drawing's own, bounded by what an index can hold. */
function recordedLayoutName(name: string): string {
  const bytes = new TextEncoder().encode(name);
  if (bytes.length <= LAYOUT_NAME_MAX_BYTES) return name;
  // A cut through the middle of a character decodes to one replacement character; it is dropped, so
  // the recorded name is a prefix of the sheet's own name and nothing else.
  return new TextDecoder().decode(bytes.subarray(0, LAYOUT_NAME_MAX_BYTES)).replace(/�+$/u, "");
}

/**
 * Ask for a drawing's sheets to be rendered (R-SPINE-022's one door).
 *
 * The workspace scope decides what may be asked for at all: a drawing this scope cannot see is not
 * this scope's to render, and the answer says so with the same code every other named-workspace door
 * answers (R-SPINE-004). A drawing nothing was ever extracted from has no artifact to render sheets
 * out of, and it is refused by name rather than enqueued to fail later.
 */
export async function requestThumbnails(request: ThumbnailsRequest): Promise<ThumbnailsRequested | ThumbnailsRefused> {
  const scope = { tenantId: request.tenantId, drawingId: request.drawingId };
  if ((await drawingInScope(request.tenantId, request.drawingId)) === null) return { refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code };

  const record = await ingestRecordOf(scope);
  if (record === null) return { refusal: REFUSALS.RASTER_NOT_AVAILABLE.code };

  // Rasters of a record are a function of the artifact it names, and an artifact never changes: a
  // record whose sheets are already rendered is answered with that, and nothing is spent rendering
  // the same picture twice.
  if (await hasSheetRasters({ tenantId: request.tenantId, ingestId: record.ingestId })) return { jobId: null, deduplicated: true };

  const payload: JobPayloads["thumbnails"] = {
    tenantId: request.tenantId,
    drawingId: request.drawingId,
    ingestId: record.ingestId,
    requestedBy: request.requestedBy,
  };
  const enqueued = await enqueue(THUMBNAILS_KIND, payload, { key: thumbnailsJobKey(request.tenantId, record.ingestId) });
  return { jobId: enqueued.jobId, deduplicated: enqueued.deduplicated };
}

/**
 * One render, run: read the record's artifact out of SEAM-STORAGE, draw every sheet it carries at
 * every tier, put each raster at its own address and record it (R-SPINE-022).
 *
 * Idempotent per record: the bytes are content-addressed, so a second attempt renders the same
 * pictures onto the same addresses, and `sheet_rasters_once` refuses a second row underneath. A
 * record the job cannot find is answered with the registered refusal — the door judged it before
 * enqueueing, so a job that reaches here without one was enqueued past the door. An artifact the
 * store does not hold, or one it cannot read back, is an outage of ours and is thrown as the fault
 * it is (ARCH-03, B-21).
 */
export async function runThumbnailsJob(payload: JobPayloads["thumbnails"], progress: JobProgress, deps: { storage: Storage }): Promise<void> {
  const { tenantId, drawingId, ingestId } = payload;
  const record = (await ingestRecords({ tenantId, drawingId })).find((candidate) => candidate.ingestId === ingestId) ?? null;
  if (record === null) throw refusal(REFUSALS.RASTER_NOT_AVAILABLE.code, `drawing ${drawingId} holds no ingest record ${ingestId} in this workspace`);

  const graph = await artifactOf(record, tenantId, deps.storage);
  await progress.step(STEP_RESOLVE);

  const rendered = graph.layouts.flatMap((layout) =>
    RASTER_TIERS.map((tier) => {
      const raster = renderSheet(graph, layout.name, RASTER_TIER_LONG_EDGE[tier]);
      // A canvas of no pixels is a picture of nothing: the store closes its tier list and nothing
      // else, so a size that could never be shown is caught here rather than written down.
      if (raster.width < 1 || raster.height < 1) throw new Error(`the ${tier} raster of sheet ${layout.name} came out ${raster.width}×${raster.height}`);
      return { layoutName: recordedLayoutName(layout.name), tier, raster };
    }),
  );
  await progress.step(STEP_RENDER);

  const stored = [];
  for (const sheet of rendered) {
    const { sha256 } = await deps.storage.put(tenantId, sheet.raster.png);
    stored.push({ ...sheet, sha256 });
  }
  await progress.step(STEP_STORE);

  for (const sheet of stored) {
    await writeSheetRaster({
      tenantId,
      ingestId,
      drawingId,
      jobId: progress.jobId,
      layoutName: sheet.layoutName,
      tier: sheet.tier,
      width: sheet.raster.width,
      height: sheet.raster.height,
      sha256: sheet.sha256,
    });
  }
  await progress.step(STEP_RECORD);
}

/** The artifact a record was written from, read back and validated against the one mirror (L-CAD-05). */
async function artifactOf(record: IngestRecord, tenantId: string, storage: Storage): Promise<EntityGraph> {
  const bytes = await storage.get(tenantId, record.artifactSha256);
  // An artifact a record points at that the store does not hold is an outage of ours, not the
  // drawing's fault: the record and the object were written together (ARCH-03).
  if (bytes === null) throw new Error(`the store holds no artifact at ${record.artifactSha256} for ingest ${record.ingestId} (SEAM-STORAGE)`);
  const parsed = entityGraphSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  if (!parsed.success) throw new Error(`the artifact at ${record.artifactSha256} is not an EntityGraph this tree reads: ${parsed.error.message}`);
  return parsed.data;
}

/**
 * The sheets of a drawing's current ingest record, each with a signed download URL per tier (Q-12).
 *
 * A drawing with no record has no sheets to serve, which is an empty answer rather than a refusal: a
 * sheet index asks this of every drawing it lists, and a drawing waiting on its first ingest is not
 * an error anybody can act on. A sheet whose rasters are not all rendered yet is left out for the
 * same reason — half a tier set is not something a card can be drawn from.
 */
export async function sheetRastersOf(scope: { tenantId: string; drawingId: string }): Promise<SheetRasters[]> {
  const record = await ingestRecordOf(scope);
  if (record === null) return [];

  const rows = await sheetRasterRecords({ tenantId: scope.tenantId, ingestId: record.ingestId });
  const storage = appStorage();
  const sheets: SheetRasters[] = [];

  for (const layout of record.facts.layouts) {
    const layoutName = recordedLayoutName(layout.name);
    const tiers = tiersOf(
      rows.filter((row) => row.layoutName === layoutName),
      scope.tenantId,
      storage,
    );
    if (tiers === null) continue;
    sheets.push({ layoutName, kind: sheetKind(layout.kind, layoutName), tiers });
  }
  return sheets;
}

/** Every tier of one sheet, signed — or null where the record has not been rendered at all of them. */
function tiersOf(rows: readonly SheetRasterRecord[], tenantId: string, storage: Storage): Record<RasterTier, SheetTier> | null {
  const served = {} as Record<RasterTier, SheetTier>;
  for (const tier of RASTER_TIERS) {
    const row = rows.find((candidate) => candidate.tier === tier);
    if (row === undefined) return null;
    served[tier] = {
      url: storage.sign(tenantId, row.sha256, { expiresInSeconds: RASTER_URL_LIFETIME_SECONDS }),
      width: row.width,
      height: row.height,
      sha256: row.sha256,
    };
  }
  return served;
}

/** The space a recorded sheet stands in, refusing a fact that is neither of the two (L-CAD-05). */
function sheetKind(kind: string, layoutName: string): SheetKind {
  // A record carries what the artifact said, and the artifact was validated against the mirror
  // before it was recorded — so a third answer here is our own record gone wrong (ARCH-03).
  if (kind !== "model" && kind !== "paper") throw new Error(`the record says sheet ${layoutName} stands in ${JSON.stringify(kind)}, which is no space (L-CAD-05)`);
  return kind;
}
