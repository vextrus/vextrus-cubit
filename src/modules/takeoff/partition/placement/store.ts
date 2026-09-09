// L-CAD-07's placements, stored: the members one ingest record's layout plans place, written and
// read back.
//
// Written inside the partition's ONE transaction (`../store`), never in one of its own, for the
// reason the grid's rows are: a placement is a stage of a partition that is REBUILT, so its rows are
// deleted and re-derived with the views they were read off — a run that fails leaves the placements
// that stood before it rather than half of a new one (L-REG-04, R-TO-030).
import { and, asc, eq, forTenant, placements, type TenantTx } from "@/core/db";
import type { DetectedPlacements } from "./detect";

/** One stored placement, whole — every column the store holds, as it holds it. */
export type StoredPlacement = typeof placements.$inferSelect;

/** One record's placements, as a rebuild hands them over to be written. */
export type PlacementWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the placement stage detected, or null where the stage list ran no such stage. */
  readonly placements: DetectedPlacements | null;
};

/**
 * Rewrite one record's placements inside the partition's transaction. The table is cleared first, so
 * a rebuild that now reads fewer members — or none where members stood — leaves exactly what it
 * derived and nothing of what it replaced (L-REG-04).
 */
export async function rewritePlacementRows(tx: TenantTx, write: PlacementWrite): Promise<void> {
  await tx.delete(placements).where(and(eq(placements.tenantId, write.tenantId), eq(placements.ingestId, write.ingestId)));
  const detected = write.placements;
  if (detected === null || detected.placements.length === 0) return;

  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  await tx.insert(placements).values(
    detected.placements.map((row) => ({
      ...stamp,
      placementKey: row.placementKey,
      viewKey: row.viewKey,
      mark: row.mark,
      markText: row.markText,
      elementType: row.elementType,
      x: row.x,
      y: row.y,
      gridLetter: row.gridLetter,
      gridNumeral: row.gridNumeral,
      outlineKey: row.outlineKey,
      markKey: row.markKey,
      memberFamily: row.memberFamily,
    })),
  );
}

/**
 * The placements one record stands under (R-TO-030: each stage's result is visible), in the key's own
 * order so two reads of one partition answer the same list (L-REG-05). An empty list is an answer: a
 * drawing whose plans placed nothing is not a drawing nobody partitioned (R-UI-050).
 */
export async function storedPlacementsOf(tenantId: string, ingestId: string): Promise<StoredPlacement[]> {
  return forTenant({ tenantId })
    .select()
    .from(placements)
    .where(and(eq(placements.tenantId, tenantId), eq(placements.ingestId, ingestId)))
    .orderBy(asc(placements.placementKey));
}
