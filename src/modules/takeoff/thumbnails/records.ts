// The persisted half of R-SPINE-022: one append-only row per (ingest, layout, tier), naming the
// address SEAM-STORAGE holds that raster at and the size it was rendered to.
//
// A row is never rewritten. A second attempt of the same work finds the row it already wrote — the
// bytes are content-addressed, so re-rendering a sheet lands on the same address anyway — and the
// history of what a revision looked like stands whatever the queue does with an attempt.
import { asc, eq, forTenant, isUuid, sheetRasters, type RasterTier } from "../../../core/db";

/** Which record's rasters are being asked about, in whose workspace. */
export type SheetRasterScope = { tenantId: string; ingestId: string };

/** One recorded raster, whole, as a caller reads it back. */
export type SheetRasterRecord = {
  rasterId: string;
  ingestId: string;
  drawingId: string;
  jobId: string;
  layoutName: string;
  tier: RasterTier;
  width: number;
  height: number;
  sha256: string;
  createdAt: string;
};

/** What one rendered sheet lays down. */
export type SheetRasterEntry = Omit<SheetRasterRecord, "rasterId" | "createdAt"> & { tenantId: string };

/** The row as the store holds it, before it is read as a record. */
type SheetRasterRow = typeof sheetRasters.$inferSelect;

/** A stored row, as the seam publishes it. */
function record(row: SheetRasterRow): SheetRasterRecord {
  return {
    rasterId: row.rasterId,
    ingestId: row.ingestId,
    drawingId: row.drawingId,
    jobId: row.jobId,
    layoutName: row.layoutName,
    tier: row.tier,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every raster of one ingest record — the sheets of that revision, at every tier they were rendered at. */
export async function sheetRasterRecords(scope: SheetRasterScope): Promise<SheetRasterRecord[]> {
  if (!isUuid(scope.ingestId)) return [];
  const rows = await forTenant({ tenantId: scope.tenantId })
    .select()
    .from(sheetRasters)
    .where(eq(sheetRasters.ingestId, scope.ingestId))
    .orderBy(asc(sheetRasters.layoutName), asc(sheetRasters.tier));
  return rows.map(record);
}

/**
 * Lay one raster down. The row is written at most once per (record, sheet, tier) however many
 * attempts render it: `sheet_rasters_once` is the belt, and a re-render finds the row already there
 * rather than adding a second picture of one sheet (SEAM-JOBS: every job idempotent on its key).
 */
export async function writeSheetRaster(entry: SheetRasterEntry): Promise<void> {
  await forTenant({ tenantId: entry.tenantId })
    .insert(sheetRasters)
    .values({
      tenantId: entry.tenantId,
      ingestId: entry.ingestId,
      drawingId: entry.drawingId,
      jobId: entry.jobId,
      layoutName: entry.layoutName,
      tier: entry.tier,
      width: entry.width,
      height: entry.height,
      sha256: entry.sha256,
    })
    .onConflictDoNothing({ target: [sheetRasters.tenantId, sheetRasters.ingestId, sheetRasters.layoutName, sheetRasters.tier] });
}

/** Whether one record already has a raster of any of its sheets — what makes a second request a repeat. */
export async function hasSheetRasters(scope: SheetRasterScope): Promise<boolean> {
  if (!isUuid(scope.ingestId)) return false;
  const rows = await forTenant({ tenantId: scope.tenantId })
    .select({ rasterId: sheetRasters.rasterId })
    .from(sheetRasters)
    .where(eq(sheetRasters.ingestId, scope.ingestId))
    .limit(1);
  return rows.length > 0;
}
