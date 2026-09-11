// R-TO-030's kinds: one ingest record's stored partition, rebuilt.

import type { JobKindGroup } from "./law";

export const TAKEOFF_PARTITION_JOB_KINDS = Object.freeze({
  // R-TO-030's stored partition: one ingest record at a time per process, because an attempt reads a
  // whole artifact into memory and rewrites the record's partition in one transaction. A silent
  // caption may reach a model, so `expireSeconds` leaves room for a provider's own latency without
  // the queue ever re-queuing an attempt that is still running.
  partition: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 900 }),
}) satisfies JobKindGroup;

/** What this area's kinds are enqueued with (SEAM-JOBS: "typed payloads"). */
export type TakeoffPartitionJobPayloads = {
  /**
   * One ingest record's stored partition, rebuilt (R-TO-030). The record is named in the payload
   * rather than looked up when the attempt runs: the partition is a reading of the artifact that
   * stood when the work was asked for, and the job's key is that record's, so a record superseded
   * meanwhile leaves this one alone rather than being silently redirected.
   */
  partition: {
    tenantId: string;
    drawingId: string;
    ingestId: string;
    requestedBy: string;
  };
};
