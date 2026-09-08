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
import { and, conventionProfiles, drawings, eq, forTenant, isUuid, partitionViews, viewAssignments } from "@/core/db";
import { CONVENTIONS_METHOD, type ConventionProfile, type EntityCensus } from "@/core/rulesets/methods/conventions/resolve";
import { viewRecordsOf, type ProposedViewType, type ViewRecord } from "@/core/views";
import type { DetectedGrid } from "./grid/detect";
import { rewriteGridRows } from "./grid/store";
import type { PartitionedView } from "./views/assign";

/** Which drawing's partition is being asked about, in whose workspace and under which project. */
export type PartitionScope = { readonly tenantId: string; readonly projectId: string; readonly drawingId: string };

/** What a model proposed for one view, ready to be stored beside it (L-AI-02). */
export type ViewProposal = { readonly viewKey: string; readonly type: ProposedViewType["type"]; readonly callId: string };

/** What the conventions stage read and what it resolved from it (L-CAD-08). */
export type ResolvedConventions = { readonly census: EntityCensus; readonly profile: ConventionProfile };

/** One stored profile, with the method that resolved it and the record it stands for. */
export type StoredConventions = ResolvedConventions & { readonly ingestId: string; readonly ruleId: string; readonly ruleVersion: string };

/** One whole partition, as a rebuild hands it over to be written. */
export type PartitionWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  readonly views: readonly PartitionedView[];
  readonly assignments: ReadonlyMap<string, string>;
  readonly proposals: ReadonlyMap<string, ViewProposal>;
  /** What the conventions stage resolved, or null where the stage list ran no such stage. */
  readonly conventions: ResolvedConventions | null;
  /** What the grid stage detected, or null for the same reason (L-CAD-07). */
  readonly grid: DetectedGrid | null;
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
 * Write one record's partition, replacing whatever stood for it. One transaction: the views, the
 * assignments that name them, the convention profile read beside them and the grid read off both land
 * together or none of them does, so no reader ever sees an assignment pointing at a view that is not
 * there, a profile resolved from views the store no longer holds, or a grid axis standing in a view
 * nobody classified (L-CAD-06, L-CAD-07, L-CAD-08).
 */
export async function rewritePartition(write: PartitionWrite): Promise<void> {
  const ofRecord = (table: typeof partitionViews | typeof viewAssignments | typeof conventionProfiles) =>
    and(eq(table.tenantId, write.tenantId), eq(table.ingestId, write.ingestId));

  await forTenant({ tenantId: write.tenantId }).transaction(async (tx) => {
    await tx.delete(conventionProfiles).where(ofRecord(conventionProfiles));
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

    if (write.conventions !== null) {
      await tx.insert(conventionProfiles).values({
        tenantId: write.tenantId,
        projectId: write.projectId,
        drawingId: write.drawingId,
        ingestId: write.ingestId,
        // The method that resolved it, cited the way an edition cites one (L-MEA-01).
        ruleId: CONVENTIONS_METHOD.ruleId,
        ruleVersion: CONVENTIONS_METHOD.version,
        profile: write.conventions.profile,
        census: write.conventions.census,
      });
    }

    // The grid's own two tables, cleared and written by the stage's store — in THIS transaction, so
    // the axes land with the views they were read off or neither does (L-CAD-07, L-REG-04).
    await rewriteGridRows(tx, { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId, grid: write.grid });
  });
}

/**
 * The convention profile one record stands under, or null where no partition has been rebuilt for it
 * (R-TO-030: each stage's result is visible). An absence is an absence — a drawing waiting on its
 * first partition is not an error anybody can act on (R-UI-050).
 */
export async function storedConventionsOf(tenantId: string, ingestId: string): Promise<StoredConventions | null> {
  const rows = await forTenant({ tenantId })
    .select({
      ruleId: conventionProfiles.ruleId,
      ruleVersion: conventionProfiles.ruleVersion,
      profile: conventionProfiles.profile,
      census: conventionProfiles.census,
    })
    .from(conventionProfiles)
    .where(and(eq(conventionProfiles.tenantId, tenantId), eq(conventionProfiles.ingestId, ingestId)))
    .limit(1);
  const held = rows[0];
  return held === undefined ? null : { ingestId, ruleId: held.ruleId, ruleVersion: held.ruleVersion, profile: held.profile, census: held.census };
}

/** Every view of one record, with what was proposed and what has been confirmed (core's own reading). */
export async function storedViewsOf(tenantId: string, ingestId: string): Promise<ViewRecord[]> {
  return forTenant({ tenantId }).transaction((tx) => viewRecordsOf(tx, { tenantId, ingestId }));
}
