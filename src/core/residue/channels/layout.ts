// L-QTY-05's third channel: view membership from the layout inventory, within the campaign's pinned
// manifest.
//
// A layout's inventory is its views, and a view's membership is what stands inside it — so a class
// is sighted here when a view of a sheet of the manifest holds a member of that class. The reading
// is keyed on the VIEW rather than on the placement row, which is what makes this a third channel
// and not a second spelling of the partition's: a sheet whose views were rebuilt keeps its
// membership under the same view key, and the union of EXISTS is over what each channel saw
// (L-QTY-05).
import { and, eq, inArray, partitionViews, placements, type TenantTx } from "../../db";
import type { Sighting } from "../law";
import { drawingIdsOf, layoutOf, type SightingScope } from "./scope";

/** The channel this reader answers for, spelled once. */
const LAYOUT = "LAYOUT" as const;

/** Every class a view of a sheet of this manifest holds a member of. */
export async function layoutSightings(tx: TenantTx, scope: SightingScope): Promise<Sighting[]> {
  const drawingIds = drawingIdsOf(scope);
  if (drawingIds.length === 0) return [];

  const rows = await tx
    .selectDistinct({
      class: placements.elementType,
      drawingId: partitionViews.drawingId,
      sourceKey: partitionViews.viewKey,
    })
    .from(partitionViews)
    .innerJoin(placements, and(eq(placements.tenantId, partitionViews.tenantId), eq(placements.ingestId, partitionViews.ingestId), eq(placements.viewKey, partitionViews.viewKey)))
    .where(and(eq(partitionViews.tenantId, scope.tenantId), eq(partitionViews.projectId, scope.projectId), inArray(partitionViews.drawingId, drawingIds)));

  return rows.map((row) => ({
    class: row.class,
    levelId: null,
    channel: LAYOUT,
    drawingId: row.drawingId,
    layoutName: layoutOf(scope, row.drawingId),
    sourceKey: row.sourceKey,
  }));
}
