// The sheet's own words: every text entity standing on one layout of a drawing's CURRENT ingest
// (L-CAD-03, L-CAD-05).
//
// One read, three readers (B-17): the grammar proposes off it, TRANSCRIBE_SHEET_NOTES checks a
// reading's evidence against it and re-judges what was kept, and the schedules screen renders the
// proposals that came out of it. A screen that read the sheet one way while the act judged it
// another would offer a figure the act then refused.
//
// It stands in core because the act seam is core and may not reach a module (ARCH-01); the takeoff
// module's `sheetTextsOf` is this function with the app's storage and a transaction around it.
//
// Only ORIGINAL entities count. Derived paint carries `src` rather than a key of its own — it is
// not an atom a source key names, so a reading could never cite one (L-CAD-03).
import { and, desc, drawings, eq, ingests, isUuid, type TenantTx } from "../db";
import { artifactAt } from "../entitygraph/artifact";
import type { Storage } from "../storage";
import type { SheetText } from "./grammar";

/** Which drawing's sheet is being read, in whose workspace and under which project. */
export type SheetTextScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
};

/**
 * The drawing's current ingest — the newest of it — as the artifact address it points at, or null
 * where this project holds no such drawing or nothing has ever read it.
 *
 * The order is TOTAL, for the reason the module's own record read states: `created_at` alone leaves
 * two rows written in one transaction in whichever order the planner reached them, and "the current
 * record" would change between two reads of the same rows. The record id settles it.
 */
async function currentArtifactOf(tx: TenantTx, scope: SheetTextScope): Promise<string | null> {
  if (!isUuid(scope.drawingId)) return null;
  const held = await tx
    .select({ artifactSha256: ingests.artifactSha256 })
    .from(ingests)
    .innerJoin(drawings, and(eq(drawings.tenantId, ingests.tenantId), eq(drawings.drawingId, ingests.drawingId)))
    .where(and(eq(ingests.tenantId, scope.tenantId), eq(ingests.drawingId, scope.drawingId), eq(drawings.projectId, scope.projectId)))
    .orderBy(desc(ingests.createdAt), desc(ingests.ingestId))
    .limit(1);
  return held[0]?.artifactSha256 ?? null;
}

/**
 * Every text entity of one sheet, in the artifact's own order — the order the extractor read the
 * drawing in, which is the same for every reader of the same bytes (L-CAD-05).
 *
 * A drawing this project does not hold, one nothing has ingested, and a layout the artifact does not
 * carry all answer an empty list: a sheet with no text is a sheet with no text, and the surfaces
 * above state that absence as the absence it is rather than guessing at it (R-UI-050, L-MEA-01).
 */
export async function sheetTextsOn(tx: TenantTx, scope: SheetTextScope, layoutName: string, deps: { readonly storage: Storage }): Promise<SheetText[]> {
  const artifactSha256 = await currentArtifactOf(tx, scope);
  if (artifactSha256 === null) return [];
  const graph = await artifactAt(scope.tenantId, artifactSha256, deps.storage, `the sheet ${layoutName} of drawing ${scope.drawingId}`);
  const said: SheetText[] = [];
  for (const entity of graph.entities) {
    if (entity.space !== layoutName) continue;
    if (typeof entity.text !== "string") continue;
    said.push({ sourceKey: entity.key, text: entity.text });
  }
  return said;
}
