// L-QTY-05's second channel: the stored partition's placements and the member-type families they
// normalise to, within the campaign's pinned manifest.
//
// It says what the partition SAW. A placement carries its own member-type family, so the family a
// class was recognised through is read off the sighted row rather than resolved a second time
// (B-17), and a class the partition placed nowhere simply contributes no member to the list.
import { and, eq, inArray, placements, type TenantTx } from "../../db";
import type { Sighting } from "../law";
import { drawingIdsOf, layoutOf, type SightingScope } from "./scope";

/** The channel this reader answers for, spelled once. */
const PARTITION = "PARTITION" as const;

/**
 * Every class the stored partition placed on a sheet of this manifest.
 *
 * A placement is sighted on a sheet rather than on a level: the level a placement stands on is the
 * register's reading of it (L-REG-04), so this channel answers with none and the union takes the
 * level from the channel that holds one.
 */
export async function partitionSightings(tx: TenantTx, scope: SightingScope): Promise<Sighting[]> {
  const drawingIds = drawingIdsOf(scope);
  if (drawingIds.length === 0) return [];

  const rows = await tx
    .selectDistinct({
      class: placements.elementType,
      drawingId: placements.drawingId,
      sourceKey: placements.placementKey,
      memberFamily: placements.memberFamily,
    })
    .from(placements)
    .where(and(eq(placements.tenantId, scope.tenantId), eq(placements.projectId, scope.projectId), inArray(placements.drawingId, drawingIds)));

  return rows.map((row) => ({
    class: row.class,
    levelId: null,
    channel: PARTITION,
    drawingId: row.drawingId,
    layoutName: layoutOf(scope, row.drawingId),
    sourceKey: row.memberFamily === null ? row.sourceKey : `${row.sourceKey}@${row.memberFamily}`,
  }));
}
