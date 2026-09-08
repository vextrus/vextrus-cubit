// R-TO-030's stored half: the partition of one ingest record, written and read back.
//
// A partition is REBUILT, never appended to: every rewrite deletes the record's rows and writes the
// derived ones again in one transaction, so a run that fails leaves the partition that stood before
// it rather than half of a new one. That is why the two tables carry a DELETE grant and why their
// keys are content-derived — an identical re-derivation writes the identical rows (L-REG-04).
//
// The read is core's (`@/core/views`): the act seam resolves CONFIRM_VIEW_TYPE's membership over the
// same rows and may not reach into a module (ARCH-01), so a view has one reading and this door asks
// for it rather than keeping a second one (B-17).
import { and, drawings, eq, forTenant, isUuid, partitionViews, viewAssignments } from "@/core/db";
import { viewRecordsOf, type ProposedViewType, type ViewRecord } from "@/core/views";
import type { PartitionedView } from "./views/assign";

/** Which drawing's partition is being asked about, in whose workspace and under which project. */
export type PartitionScope = { readonly tenantId: string; readonly projectId: string; readonly drawingId: string };

/** What a model proposed for one view, ready to be stored beside it (L-AI-02). */
export type ViewProposal = { readonly viewKey: string; readonly type: ProposedViewType["type"]; readonly callId: string };

/** One whole partition, as a rebuild hands it over to be written. */
export type PartitionWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  readonly views: readonly PartitionedView[];
  readonly assignments: ReadonlyMap<string, string>;
  readonly proposals: ReadonlyMap<string, ViewProposal>;
};

/**
 * The project a drawing belongs to, or null where this workspace holds no such drawing. Every door
 * of the takeoff seam asks the scope question before it acts (R-SPINE-004), and the partition needs
 * the answer twice over: a drawing outside the scope is refused, and the project is what a model call
 * and an act are attributed to.
 */
export async function drawingProjectOf(tenantId: string, drawingId: string): Promise<string | null> {
  if (!isUuid(drawingId)) return null;
  const rows = await forTenant({ tenantId }).select({ projectId: drawings.projectId }).from(drawings).where(eq(drawings.drawingId, drawingId)).limit(1);
  return rows[0]?.projectId ?? null;
}

/**
 * Write one record's partition, replacing whatever stood for it. One transaction: the views and the
 * assignments that name them land together or neither does, so no reader ever sees an assignment
 * pointing at a view that is not there (L-CAD-06).
 */
export async function rewritePartition(write: PartitionWrite): Promise<void> {
  const ofRecord = (table: typeof partitionViews | typeof viewAssignments) =>
    and(eq(table.tenantId, write.tenantId), eq(table.ingestId, write.ingestId));

  await forTenant({ tenantId: write.tenantId }).transaction(async (tx) => {
    await tx.delete(viewAssignments).where(ofRecord(viewAssignments));
    await tx.delete(partitionViews).where(ofRecord(partitionViews));

    if (write.views.length > 0) {
      await tx.insert(partitionViews).values(
        write.views.map((view) => {
          const proposal = write.proposals.get(view.viewKey) ?? null;
          return {
            tenantId: write.tenantId,
            projectId: write.projectId,
            drawingId: write.drawingId,
            ingestId: write.ingestId,
            viewKey: view.viewKey,
            type: view.type,
            reason: view.reason,
            caption: view.caption,
            anchorKey: view.anchorKey,
            proposedType: proposal === null ? null : proposal.type,
            proposedCallId: proposal === null ? null : proposal.callId,
          };
        }),
      );
    }

    const assigned = [...write.assignments.entries()];
    if (assigned.length > 0) {
      await tx.insert(viewAssignments).values(
        assigned.map(([entityKey, viewKey]) => ({
          tenantId: write.tenantId,
          drawingId: write.drawingId,
          ingestId: write.ingestId,
          entityKey,
          viewKey,
        })),
      );
    }
  });
}

/** Every view of one record, with what was proposed and what has been confirmed (core's own reading). */
export async function storedViewsOf(tenantId: string, ingestId: string): Promise<ViewRecord[]> {
  return forTenant({ tenantId }).transaction((tx) => viewRecordsOf(tx, { tenantId, ingestId }));
}
