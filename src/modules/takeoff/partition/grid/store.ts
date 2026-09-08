// L-CAD-07's grid, stored: the axes and the deferrals of one ingest record, written and read back.
//
// Written inside the partition's ONE transaction (`../store`), never in one of its own: the grid is a
// stage of a partition that is REBUILT, so its rows are deleted and re-derived with the views they
// were read off — a run that fails leaves the grid that stood before it rather than half of a new one
// (L-REG-04, R-TO-030). That is why this file takes a transaction rather than opening a handle.
import { and, eq, forTenant, gridDeferrals, grids, type TenantTx } from "@/core/db";
import type { DetectedGrid, GridAxisRow, GridDeferralRow } from "./detect";

/** One record's stored grid: what the overlay draws and what placement scales its shares by. */
export type StoredGrid = {
  readonly ingestId: string;
  readonly axes: readonly GridAxisRow[];
  readonly deferrals: readonly GridDeferralRow[];
};

/** One record's grid, as a rebuild hands it over to be written. */
export type GridWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the grid stage detected, or null where the stage list ran no such stage. */
  readonly grid: DetectedGrid | null;
};

/**
 * Rewrite one record's grid rows inside the partition's transaction. Both tables are cleared first,
 * so a rebuild that now reads fewer axes — or a deferral where axes stood — leaves exactly what it
 * derived and nothing of what it replaced.
 */
export async function rewriteGridRows(tx: TenantTx, write: GridWrite): Promise<void> {
  const ofRecord = (table: typeof grids | typeof gridDeferrals) => and(eq(table.tenantId, write.tenantId), eq(table.ingestId, write.ingestId));

  await tx.delete(gridDeferrals).where(ofRecord(gridDeferrals));
  await tx.delete(grids).where(ofRecord(grids));
  if (write.grid === null) return;

  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  if (write.grid.axes.length > 0) {
    await tx.insert(grids).values(
      write.grid.axes.map((axis) => ({
        ...stamp,
        viewKey: axis.viewKey,
        family: axis.family,
        label: axis.label,
        axis: axis.axis,
        position: axis.position,
        bubbleKey: axis.bubbleKey,
        labelKey: axis.labelKey,
        minSpacing: axis.minSpacing,
      })),
    );
  }
  if (write.grid.deferrals.length > 0) {
    await tx.insert(gridDeferrals).values(write.grid.deferrals.map((deferral) => ({ ...stamp, viewKey: deferral.viewKey, reason: deferral.reason })));
  }
}

/**
 * The grid one record stands under (R-TO-030: each stage's result is visible). An answer, never an
 * absence: a record whose layout plans all deferred holds no axis and says why, and a record with no
 * layout plan at all holds neither — both are things a caller can act on, which is what R-UI-050 asks
 * a surface to be able to say.
 *
 * Both lists are read in the reading's own order — the bubbles by the source key they were read from,
 * the deferrals by the view they stand for — so two reads of one grid answer the same lists (L-REG-05).
 */
export async function storedGridOf(tenantId: string, ingestId: string): Promise<StoredGrid> {
  const scoped = forTenant({ tenantId });
  const axes = await scoped
    .select({
      viewKey: grids.viewKey,
      family: grids.family,
      label: grids.label,
      axis: grids.axis,
      position: grids.position,
      bubbleKey: grids.bubbleKey,
      labelKey: grids.labelKey,
      minSpacing: grids.minSpacing,
    })
    .from(grids)
    .where(and(eq(grids.tenantId, tenantId), eq(grids.ingestId, ingestId)))
    .orderBy(grids.bubbleKey);

  const deferrals = await scoped
    .select({ viewKey: gridDeferrals.viewKey, reason: gridDeferrals.reason })
    .from(gridDeferrals)
    .where(and(eq(gridDeferrals.tenantId, tenantId), eq(gridDeferrals.ingestId, ingestId)))
    .orderBy(gridDeferrals.viewKey);

  return { ingestId, axes, deferrals };
}
