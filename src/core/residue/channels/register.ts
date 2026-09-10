// L-QTY-05's first channel: the register rows of a class, within the campaign's pinned manifest.
//
// A recogniser's output type is `Sighting[]` and there is no `absent()` constructor here or in any
// file beside it: this reader says what the register SAW, and an empty list is the only way it can
// say it saw nothing. Whether anything follows from that absence is the residue query's judgement,
// made once, where the tree's one `NOT EXISTS` lives (L-QTY-05).
import { and, eq, inArray, placements, registerObjects, type TenantTx } from "../../db";
import type { Sighting } from "../law";
import { drawingIdsOf, layoutOf, type SightingScope } from "./scope";

/** The channel this reader answers for, spelled once. */
const REGISTER = "REGISTER" as const;

/**
 * Every class the register holds a row for in this campaign's revision, on the level the row stands
 * on, with the sheet it was sighted on and the placement key it was read at.
 *
 * The drawing is the placement's, joined rather than stored on the register row: a register object
 * is keyed on the placement it was sighted at (L-REG-04), and the placement is where the sheet is
 * recorded. Rows whose placement stands outside the pinned manifest are not sighted by this
 * campaign at all, so the join is what scopes the answer.
 */
export async function registerSightings(tx: TenantTx, scope: SightingScope): Promise<Sighting[]> {
  const drawingIds = drawingIdsOf(scope);
  if (drawingIds.length === 0) return [];

  const rows = await tx
    .selectDistinct({
      class: registerObjects.elementType,
      levelId: registerObjects.levelId,
      drawingId: placements.drawingId,
      sourceKey: registerObjects.placementKey,
    })
    .from(registerObjects)
    .innerJoin(placements, and(eq(placements.tenantId, registerObjects.tenantId), eq(placements.placementKey, registerObjects.placementKey)))
    .where(
      and(
        eq(registerObjects.tenantId, scope.tenantId),
        eq(registerObjects.setRevisionId, scope.setRevisionId),
        eq(registerObjects.projectId, scope.projectId),
        inArray(placements.drawingId, drawingIds),
      ),
    );

  return rows.map((row) => ({
    class: row.class,
    levelId: row.levelId,
    channel: REGISTER,
    drawingId: row.drawingId,
    layoutName: layoutOf(scope, row.drawingId),
    sourceKey: row.sourceKey,
  }));
}
