// The wall lane's store: the walls and openings one ingest record's architect's plans place (s-takeoff
// I-593), written with the placements they stand for and read back by the measure setup.
//
// Rewritten inside the partition's ONE transaction (`../store`), cleared first, so a rebuild that now
// reads fewer walls leaves exactly what it derived and nothing of what it replaced (L-REG-04). Every
// row is keyed by the placement key its wall or opening stands under, so a re-derivation of the same
// artifact writes the same rows.
import { and, asc, eq, forTenant, wallOpenings, wallRuns, type TenantTx } from "@/core/db";
import type { DetectedPlacements, WallOpeningRow, WallRow } from "../placement/rows";

/** One stored wall, whole — every column the store holds, as it holds it. */
export type StoredWall = typeof wallRuns.$inferSelect;

/** One stored opening, whole. */
export type StoredWallOpening = typeof wallOpenings.$inferSelect;

/** One record's walls and openings, as a rebuild hands them over to be written. */
export type WallWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the placement stage detected, or null where the stage list ran no such stage. */
  readonly placements: DetectedPlacements | null;
};

/** Rewrite one record's walls and openings inside the partition's transaction. */
export async function rewriteWallRows(tx: TenantTx, write: WallWrite): Promise<void> {
  await tx.delete(wallOpenings).where(and(eq(wallOpenings.tenantId, write.tenantId), eq(wallOpenings.ingestId, write.ingestId)));
  await tx.delete(wallRuns).where(and(eq(wallRuns.tenantId, write.tenantId), eq(wallRuns.ingestId, write.ingestId)));
  const walls: readonly WallRow[] = write.placements?.walls ?? [];
  const openings: readonly WallOpeningRow[] = write.placements?.wallOpenings ?? [];
  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  if (walls.length > 0) {
    await tx.insert(wallRuns).values(
      walls.map((wall) => ({
        ...stamp,
        placementKey: wall.placementKey,
        viewKey: wall.viewKey,
        family: wall.family,
        layoutName: wall.sheet,
        fromX: wall.from[0],
        fromY: wall.from[1],
        toX: wall.to[0],
        toY: wall.to[1],
        thicknessValue: wall.thickness.value,
        thicknessUnit: wall.thickness.unit,
        thicknessSourceKeys: [...wall.thickness.sourceKeys],
        lengthValue: wall.length.value,
        lengthUnit: wall.length.unit,
        lengthSourceKeys: [...wall.length.sourceKeys],
      })),
    );
  }
  if (openings.length > 0) {
    await tx.insert(wallOpenings).values(
      openings.map((opening) => ({
        ...stamp,
        placementKey: opening.placementKey,
        hostPlacementKey: opening.hostPlacementKey,
        viewKey: opening.viewKey,
        mark: opening.mark,
        tagKey: opening.tagKey,
        layoutName: opening.sheet,
        fromX: opening.from[0],
        fromY: opening.from[1],
        toX: opening.to[0],
        toY: opening.to[1],
        width: opening.width,
        checked: opening.checked,
      })),
    );
  }
}

/** The walls one record stands under, in the key's own order so two reads answer one list (L-REG-05). */
export async function storedWallsOf(tenantId: string, ingestId: string): Promise<StoredWall[]> {
  return forTenant({ tenantId })
    .select()
    .from(wallRuns)
    .where(and(eq(wallRuns.tenantId, tenantId), eq(wallRuns.ingestId, ingestId)))
    .orderBy(asc(wallRuns.placementKey));
}

/** The openings one record stands under, in the key's own order. */
export async function storedWallOpeningsOf(tenantId: string, ingestId: string): Promise<StoredWallOpening[]> {
  return forTenant({ tenantId })
    .select()
    .from(wallOpenings)
    .where(and(eq(wallOpenings.tenantId, tenantId), eq(wallOpenings.ingestId, ingestId)))
    .orderBy(asc(wallOpenings.placementKey));
}
