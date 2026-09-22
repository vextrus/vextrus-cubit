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
import { expansionEvidenceIn } from "./evidence";
// Loaded for what it registers: `AUTHOR_TYPICAL_RANGE` asks the resolver through core's port, and
// every door that commits that act re-expands through this file — so the answer is in the process
// before the question can be asked (ARCH-01).
import "./range-reading";
import { resolveExpansion } from "./resolve";
import { registerExpansion, revisionsNaming, rewriteExpansionRows, type RegisteredExpansion } from "./store";

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
  // The stored partition, read in one transaction so the resolver is handed one state of the store
  // (`./evidence`: the assembly the typical-range reading asks for too).
  const read = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => expansionEvidenceIn(tx, scope));
  if (read === null) return null;
  const { record } = read;
  const ingestId = record.ingestId;

  const expansion = resolveExpansion(read.evidence);

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
