/**
 * RE-EXPANSION: the stored partition re-resolved over the live stack and re-registered under every
 * pinned revision naming the drawing (L-CAD-07, L-REG-03, L-REG-06).
 *
 * The expansion resolver (`./resolve`) is order-independent over its inputs, and its inputs move
 * after ingest: a person pins a set (the revisions the rows register under), inserts or repudiates a
 * level (the stack the rows stand on), authors a typical range. Until the door landed the resolver
 * ran once, in the partition job at ingest — before any of those — so it resolved rows and registered
 * nothing, and no order of clicks reached a measurable campaign on a project a customer had just
 * made (J-000's M2 legs stood as MISSING DOOR stubs). Each of those acts now calls `reexpandProject`
 * after its commit.
 *
 * What runs here is the partition job's own expansion stage over the store instead of over the
 * job's in-memory result: the placements it wrote, the views they were placed in and the schedule
 * bands it registered, resolved over the live stack and the authored ranges, then written the way the
 * job writes them — the deferrals rewritten, the rows registered per revision inside one transaction.
 * No artifact is re-read and nothing of the cad lane runs (L-CAD-01); nothing here mints a view,
 * a placement or a level, so a confirmation, an affirmation or a sighting already of record is
 * untouched (L-ACT-01).
 */
import { and, drawings, eq, forTenant } from "@/core/db";
import { viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import type { PlacementRow } from "../placement/rows";
import { storedPlacementsOf } from "../placement/store";
import { storedMemberTypesOf } from "../schedules/store";
import { partitionStandsFor, storedViewsOf } from "../store";
import { resolveExpansion, type ExpandedView, type FamilyBands } from "./resolve";
import { authoredRangesOf, liveStackOf, registerExpansion, revisionsNaming, rewriteExpansionRows, type RegisteredExpansion } from "./store";

export type ReexpandScope = { readonly tenantId: string; readonly projectId: string };

/** What one drawing's re-expansion amounted to — the job's own census words. */
export type ReexpandedDrawing = {
  readonly drawingId: string;
  readonly ingestId: string;
  /** The rows the resolver answered over the live stack. */
  readonly rows: number;
  /** The views whose vertical members stand on no level, and why. */
  readonly deferred: number;
  /** The pinned revisions naming the drawing that the rows were registered under. */
  readonly revisions: number;
  /** Register objects added across those revisions; the ones that already stood; the keys no longer derived. */
  readonly registered: number;
  readonly standing: number;
  readonly stale: readonly string[];
};

/**
 * Re-expand one drawing's stored partition. Null where the drawing has no current record or no
 * stored partition — a drawing waiting on its first partition is not an error anybody can act on.
 */
export async function reexpandDrawing(scope: ReexpandScope & { readonly drawingId: string }): Promise<ReexpandedDrawing | null> {
  const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId: scope.drawingId });
  if (record === null) return null;
  if (!(await partitionStandsFor(scope.tenantId, record.ingestId))) return null;
  const ingestId = record.ingestId;

  const views = await storedViewsOf(scope.tenantId, ingestId);
  // Two spellings of one view's key meet here: the partition store's `TYPE:anchor` on the view row,
  // and L-REG-04's identity key `v:TYPE:anchor` on every placement row (the job keys a placement by
  // `viewKey(ref)`). The map is keyed by the placement's spelling, which is what has to be found.
  const refs = new Map<string, ViewRef>();
  const expanded: ExpandedView[] = [];
  for (const view of views) {
    if (view.anchorKey === null) continue;
    const ref: ViewRef = { viewClass: view.type, captionAnchorSourceKey: view.anchorKey };
    refs.set(viewKeyOf(ref), ref);
    expanded.push({ caption: view.caption, view: ref });
  }

  const placements: PlacementRow[] = [];
  for (const stored of await storedPlacementsOf(scope.tenantId, ingestId)) {
    const ref = refs.get(stored.viewKey);
    // A placement is read in a layout-plan view with an anchor (L-CAD-06); one whose view the store
    // no longer names is not a placement the resolver can key a row off, and is left as it stands.
    if (ref === undefined) continue;
    placements.push({
      viewKey: stored.viewKey,
      view: ref,
      placementKey: stored.placementKey,
      mark: stored.mark,
      markText: stored.markText,
      elementType: stored.elementType,
      x: stored.x,
      y: stored.y,
      gridLetter: stored.gridLetter,
      gridNumeral: stored.gridNumeral,
      outlineKey: stored.outlineKey,
      markKey: stored.markKey,
      memberFamily: stored.memberFamily,
    });
  }

  const families: FamilyBands[] = (await storedMemberTypesOf(scope.tenantId, ingestId)).families.map((family) => ({
    family: family.family,
    bands: family.variants.map((variant) => ({ from: variant.bandFrom, to: variant.bandTo })),
  }));

  const expansion = resolveExpansion({
    placements,
    views: expanded,
    levels: await liveStackOf(scope.tenantId, scope.projectId),
    ranges: await authoredRangesOf(scope.tenantId, scope.projectId),
    families,
  });

  const revisions = await revisionsNaming({ tenantId: scope.tenantId, projectId: scope.projectId, drawingId: scope.drawingId, sha256: record.sha256 });
  const stamp = { tenantId: scope.tenantId, projectId: scope.projectId, drawingId: scope.drawingId, ingestId };

  const passes = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    await rewriteExpansionRows(tx, { ...stamp, expansion });
    const registered: RegisteredExpansion[] = [];
    for (const setRevisionId of revisions) registered.push(await registerExpansion(tx, { tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId }, expansion.rows));
    return registered;
  });

  return {
    drawingId: scope.drawingId,
    ingestId,
    rows: expansion.rows.length,
    deferred: expansion.deferrals.length,
    revisions: revisions.length,
    registered: passes.reduce((count, pass) => count + pass.registered, 0),
    standing: passes.reduce((count, pass) => count + pass.standing, 0),
    stale: passes.flatMap((pass) => [...pass.stale]),
  };
}

/**
 * Re-expand every drawing of the project that holds a stored partition (or the ones named), in the
 * drawings' own order. The answer lists only the drawings that were re-expanded.
 */
export async function reexpandProject(scope: ReexpandScope & { readonly drawingIds?: readonly string[] }): Promise<ReexpandedDrawing[]> {
  const named =
    scope.drawingIds ??
    (
      await forTenant({ tenantId: scope.tenantId })
        .select({ drawingId: drawings.drawingId })
        .from(drawings)
        .where(and(eq(drawings.tenantId, scope.tenantId), eq(drawings.projectId, scope.projectId)))
        .orderBy(drawings.drawingId)
    ).map((row) => row.drawingId);
  const answered: ReexpandedDrawing[] = [];
  for (const drawingId of named) {
    const one = await reexpandDrawing({ tenantId: scope.tenantId, projectId: scope.projectId, drawingId });
    if (one !== null) answered.push(one);
  }
  return answered;
}
