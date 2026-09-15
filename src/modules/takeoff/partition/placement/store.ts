// L-CAD-07's placements, stored: the members one ingest record's layout plans place, written and
// read back.
//
// Written inside the partition's ONE transaction (`../store`), never in one of its own, for the
// reason the grid's rows are: a placement is a stage of a partition that is REBUILT, so its rows are
// deleted and re-derived with the views they were read off — a run that fails leaves the placements
// that stood before it rather than half of a new one (L-REG-04, R-TO-030).
import { and, asc, eq, forTenant, placementRuns, placements, type TenantTx } from "@/core/db";
import type { QuantityBasis } from "@/core/offers/law";
import type { DetectedPlacements, RunReading } from "./rows";


/** One stored placement, whole — every column the store holds, as it holds it. */
export type StoredPlacement = typeof placements.$inferSelect;

/** One reading of a run as the door answers one — the value, its unit, its basis and its evidence. */
export type SideReading = RunReading;

/**
 * One placement's run as the door answers one (L-MEA-09): the clear axis, and
 * what adjoins each of its two sides. Each is null where the drawing said nothing to read — a run
 * nobody could read is stored as unread, never as a zero (L-QTY-02).
 */
export type StoredRun = {
  readonly placementKey: string;
  readonly clear: SideReading | null;
  readonly sides: readonly [SideReading | null, SideReading | null];
};

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
  await tx.delete(placementRuns).where(and(eq(placementRuns.tenantId, write.tenantId), eq(placementRuns.ingestId, write.ingestId)));
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

  // The runs land with the placements they were read for, in the same transaction: a run keyed to a
  // placement the store no longer holds is a reading of nothing (L-REG-04, R-TO-030).
  const runs = detected.runs ?? [];
  if (runs.length === 0) return;
  await tx.insert(placementRuns).values(
    runs.map((run) => ({
      ...stamp,
      placementKey: run.placementKey,
      clearValue: run.clear?.value ?? null,
      clearUnit: run.clear?.unit ?? null,
      clearBasis: run.clear?.basis ?? null,
      clearSourceKeys: run.clear?.sourceKeys ?? null,
      sideAValue: run.sides[0]?.value ?? null,
      sideAUnit: run.sides[0]?.unit ?? null,
      sideABasis: run.sides[0]?.basis ?? null,
      sideASourceKeys: run.sides[0]?.sourceKeys ?? null,
      sideBValue: run.sides[1]?.value ?? null,
      sideBUnit: run.sides[1]?.unit ?? null,
      sideBBasis: run.sides[1]?.basis ?? null,
      sideBSourceKeys: run.sides[1]?.sourceKeys ?? null,
    })),
  );
}

/**
 * The runs one record stands under, in the key's own order so two reads answer the same list
 * (L-REG-05). An empty list is an answer of its own: a drawing whose plans drew no member as a pair
 * of edge lines is not a drawing nobody partitioned (R-UI-050).
 */
export async function storedRunsOf(tenantId: string, ingestId: string): Promise<StoredRun[]> {
  const rows = await forTenant({ tenantId })
    .select()
    .from(placementRuns)
    .where(and(eq(placementRuns.tenantId, tenantId), eq(placementRuns.ingestId, ingestId)))
    .orderBy(asc(placementRuns.placementKey));
  return rows.map((row) => ({
    placementKey: row.placementKey,
    clear: readingOf(row.clearValue, row.clearUnit, row.clearBasis, row.clearSourceKeys),
    sides: [
      readingOf(row.sideAValue, row.sideAUnit, row.sideABasis, row.sideASourceKeys),
      readingOf(row.sideBValue, row.sideBUnit, row.sideBBasis, row.sideBSourceKeys),
    ] as const,
  }));
}

/** One stored reading read back whole, or null where the store holds none — never a part of one (B-07). */
function readingOf(value: string | null, unit: string | null, basis: string | null, sourceKeys: readonly string[] | null): SideReading | null {
  if (value === null || unit === null || basis === null) return null;
  return { value, unit: unit as SideReading["unit"], basis: basis as QuantityBasis, sourceKeys: sourceKeys ?? [] };
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
