// R-TO-030's stored partition, as core reads it back: the views one ingest record was cut into, what
// a model proposed for the ones its grammar could not read, and what a person has confirmed.
//
// It lives in core for the reason `../sheets` does: the act seam is core and L-ACT-02 makes the act
// map's totality a compile-time property, so CONFIRM_VIEW_TYPE's rendering has to resolve its own
// membership — and a rendering that reached into `src/modules` could not (ARCH-01). The takeoff
// module's door answers the same rows to a screen by asking here, so a view has one reading (B-17).
//
// Nothing here writes: a partition is rewritten by the job that derives it, and a confirmation is
// written by the act seam alone.
import { and, eq, partitionViews, viewTypeConfirmations, type TenantTx } from "../db";

/** Which record's partition is being read, in whose workspace. */
export type ViewRecordScope = { readonly tenantId: string; readonly ingestId: string };

/** What a model proposed a view to be, and the ledger row that proposed it (L-AI-01, L-AI-02). */
export type ProposedViewType = { readonly type: string; readonly callId: string };

/** What a person confirmed a view to be, and the act that carried it (L-ACT-01). */
export type ConfirmedViewType = { readonly type: string; readonly actId: string };

/**
 * One view of a stored partition, whole. `type` is what the grammar read and stays what it read: a
 * proposal stands beside it and a confirmation stands beside that, because neither is a rewrite of
 * what the drawing itself says (L-AI-02, L-ACT-01).
 */
export type ViewRecord = {
  readonly viewKey: string;
  readonly type: string;
  readonly reason: string | null;
  readonly caption: string;
  readonly anchorKey: string | null;
  readonly proposed: ProposedViewType | null;
  readonly confirmed: ConfirmedViewType | null;
};

/**
 * Every view of one ingest record, in view-key order — the order is the reading's own, so two reads
 * of one partition answer the same list and a Consequence computed over it digests the same way
 * (L-ACT-02).
 */
export async function viewRecordsOf(tx: TenantTx, scope: ViewRecordScope): Promise<ViewRecord[]> {
  const rows = await tx
    .select()
    .from(partitionViews)
    .where(and(eq(partitionViews.tenantId, scope.tenantId), eq(partitionViews.ingestId, scope.ingestId)));
  const confirmed = await confirmationsOfRecord(tx, scope);

  return rows
    .map((row) => ({
      viewKey: row.viewKey,
      type: row.type,
      reason: row.reason,
      caption: row.caption,
      anchorKey: row.anchorKey,
      proposed: row.proposedType === null || row.proposedCallId === null ? null : { type: row.proposedType, callId: row.proposedCallId },
      confirmed: confirmed.get(row.viewKey) ?? null,
    }))
    .sort((left, right) => (left.viewKey < right.viewKey ? -1 : left.viewKey > right.viewKey ? 1 : 0));
}

/**
 * What each view of one record has been confirmed as, by view key. Read on the caller's own
 * transaction, so the act seam judges membership against the very state its write will land in.
 */
export async function confirmationsOfRecord(tx: TenantTx, scope: ViewRecordScope): Promise<Map<string, ConfirmedViewType>> {
  const rows = await tx
    .select()
    .from(viewTypeConfirmations)
    .where(and(eq(viewTypeConfirmations.tenantId, scope.tenantId), eq(viewTypeConfirmations.ingestId, scope.ingestId)));
  return new Map(rows.map((row) => [row.viewKey, { type: row.type, actId: row.actId }]));
}
