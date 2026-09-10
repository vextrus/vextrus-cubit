// L-QTY-05's first channel: the register rows of a class, within the campaign's pinned manifest.
//
// A recogniser's output type is `Sighting[]` and there is no `absent()` constructor here or in any
// file beside it: this reader says what the register SAW, and an empty list is the only way it can
// say it saw nothing. Whether anything follows from that absence is the residue query's judgement,
// made once, where the tree's one `NOT EXISTS` lives (L-QTY-05).
import { and, eq, placements, registerObjects, type TenantTx } from "../../db";
import type { Sighting } from "../law";
import { drawingIdsOf, layoutOf, type SightingScope } from "./scope";

/** The channel this reader answers for, spelled once. */
const REGISTER = "REGISTER" as const;

/**
 * Every class the register holds a row for in this campaign's revision, on the level the row stands
 * on, with the sheet it was sighted on and the placement key it was read at.
 *
 * The pinned manifest is the SET REVISION: a register object is registered against one revision
 * (L-REG-03's double-count guard keys on it), so a row of this revision was sighted within this
 * campaign's manifest by construction, and no second scoping is needed to say so.
 *
 * The sheet a row was read on is the partition placement's, taken where the partition holds one —
 * a sighting made at the register's own door carries a placement key nothing placed, and it is a
 * sighting all the same (L-QTY-05: the reader says what the register SAW). So the join is LEFT and
 * attribution is what it adds, never what it filters by; a row the partition places on a sheet
 * OUTSIDE the manifest is the one case the revision cannot vouch for, and it alone is dropped.
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
    .leftJoin(placements, and(eq(placements.tenantId, registerObjects.tenantId), eq(placements.placementKey, registerObjects.placementKey)))
    .where(
      and(
        eq(registerObjects.tenantId, scope.tenantId),
        eq(registerObjects.setRevisionId, scope.setRevisionId),
        eq(registerObjects.projectId, scope.projectId),
      ),
    );

  const manifest = new Set(drawingIds);
  return rows
    .filter((row) => row.drawingId === null || manifest.has(row.drawingId))
    .map((row) => ({
      class: row.class,
      levelId: row.levelId,
      channel: REGISTER,
      drawingId: row.drawingId ?? "",
      layoutName: row.drawingId === null ? "" : layoutOf(scope, row.drawingId),
      sourceKey: row.sourceKey,
    }));
}
