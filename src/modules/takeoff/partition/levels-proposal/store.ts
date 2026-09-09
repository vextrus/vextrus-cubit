// The seventh stage's store: the level stack a record's sections state, written and read back.
//
// Written inside the partition's ONE transaction (`../store`) with the views it was read off, and
// into `proposed_levels` and never into `levels`: a proposal authors nothing, because authoring a
// level stack is a human's act (L-ACT-03, L-MEA-07).
import { and, asc, eq, forTenant, proposedLevels, type TenantTx } from "@/core/db";
import type { ProposedLevelStack } from "./propose";

/** One stored proposed level, whole — every column the store holds, as it holds it. */
export type StoredProposedLevel = typeof proposedLevels.$inferSelect;

/** One record's proposed levels, as a rebuild hands them over to be written. */
export type LevelProposalWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the levels-proposal stage read, or null where the stage list ran no such stage. */
  readonly proposal: ProposedLevelStack | null;
};

/**
 * Rewrite one record's proposed levels inside the partition's transaction. Cleared first, so a
 * re-ingest that reads a different section leaves exactly the stack it read (L-REG-04, R-TO-030).
 */
export async function rewriteProposedLevelRows(tx: TenantTx, write: LevelProposalWrite): Promise<void> {
  await tx.delete(proposedLevels).where(and(eq(proposedLevels.tenantId, write.tenantId), eq(proposedLevels.ingestId, write.ingestId)));
  const proposal = write.proposal;
  if (proposal === null || proposal.levels.length === 0) return;

  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  await tx.insert(proposedLevels).values(
    proposal.levels.map((level) => ({
      ...stamp,
      viewKey: level.viewKey,
      label: level.label,
      ordinal: level.ordinal,
      elevation: level.elevation,
      heightAsWritten: level.heightAsWritten,
      heightUnit: level.heightUnit,
      markKey: level.markKey,
    })),
  );
}

/**
 * Every level one record's sections proposed, in the order they physically stand (R-TO-030). An empty
 * list is an answer: a drawing with no section proposes no stack, which is not the same thing as a
 * drawing nobody has partitioned (R-UI-050).
 */
export async function storedProposedLevelsOf(tenantId: string, ingestId: string): Promise<StoredProposedLevel[]> {
  return forTenant({ tenantId })
    .select()
    .from(proposedLevels)
    .where(and(eq(proposedLevels.tenantId, tenantId), eq(proposedLevels.ingestId, ingestId)))
    .orderBy(asc(proposedLevels.viewKey), asc(proposedLevels.ordinal));
}
