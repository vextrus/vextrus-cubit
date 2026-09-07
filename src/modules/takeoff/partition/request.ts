// R-TO-030's request half: the one door a screen's server action, a route or the worker's
// composition root asks a partition through, and the scope question every door of the takeoff seam
// asks (B-17, R-SPINE-004).
//
// A partition is a reading of an ingest record, so a drawing nothing has been extracted from has
// nothing to partition and is refused by name rather than enqueued to be refused later. The job's
// key is that record's, which is what makes the work idempotent: while one stands queued for a
// record, asking again is the same ask (SEAM-JOBS).
import { REFUSALS } from "@/core/errors";
import { enqueue, type JobKind, type JobPayloads } from "@/core/jobs";
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import type { PartitionRefusalCode } from "./refusals";
import { drawingProjectOf } from "./store";

/** The kind this seam's work runs under, bound to SEAM-JOBS' roster rather than re-spelled (B-17). */
export const PARTITION_KIND = "partition" satisfies JobKind;

/** Somebody asking for a drawing's partition to be rebuilt. */
export type PartitionRequest = { tenantId: string; drawingId: string; requestedBy: string };

/** What the door answers when it accepted: the job that holds the record's key, and which record. */
export type PartitionRequested = { jobId: string | null; ingestId: string | null; deduplicated: boolean };

/** What the door answers when it did not: a registered code, and nothing enqueued (R-SPINE-062). */
export type PartitionRefused = { refusal: PartitionRefusalCode };

/** The key one record's partition stands under — the partition is OF a record, so the record keys it. */
export function partitionJobKey(tenantId: string, ingestId: string): string {
  return `${PARTITION_KIND}:${tenantId}:${ingestId}`;
}

/**
 * Ask for a drawing's stored partition to be rebuilt (R-TO-030's one door).
 *
 * The workspace scope decides what may be asked for at all: a drawing this scope cannot see is not
 * this scope's to run, and the answer says so with the same code every other named-workspace door
 * answers. A drawing with no ingest record is refused `PARTITION_NOT_AVAILABLE` and enqueues
 * nothing — there is no artifact to classify, and asking again will not make one.
 */
export async function requestPartition(request: PartitionRequest): Promise<PartitionRequested | PartitionRefused> {
  const projectId = await drawingProjectOf(request.tenantId, request.drawingId);
  if (projectId === null) return { refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code };

  const record = await ingestRecordOf({ tenantId: request.tenantId, drawingId: request.drawingId });
  if (record === null) return { refusal: REFUSALS.PARTITION_NOT_AVAILABLE.code };

  const payload: JobPayloads["partition"] = {
    tenantId: request.tenantId,
    drawingId: request.drawingId,
    ingestId: record.ingestId,
    requestedBy: request.requestedBy,
  };
  const enqueued = await enqueue(PARTITION_KIND, payload, { key: partitionJobKey(request.tenantId, record.ingestId) });
  return { jobId: enqueued.jobId, ingestId: record.ingestId, deduplicated: enqueued.deduplicated };
}
