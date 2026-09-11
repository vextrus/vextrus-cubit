// SEAM-GATE's kinds: one campaign, measured over a pinned revision (L-MEA-08).

import type { JobKindGroup } from "./law";

export const GATE_JOB_KINDS = Object.freeze({
  // SEAM-GATE's measurement (L-MEA-08): one campaign at a time per process, because an attempt runs
  // every rail of the roster over a whole pinned revision and hands the gate one batch to write in a
  // single transaction. `expireSeconds` leaves room for a large revision so the queue never re-queues
  // an attempt that is still running — two attempts of one campaign at once would be two writers.
  measure: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 1800 }),
}) satisfies JobKindGroup;

/** What this area's kinds are enqueued with (SEAM-JOBS: "typed payloads"). */
export type GateJobPayloads = {
  /**
   * One campaign, measured (L-MEA-08, L-REG-07). The campaign is named in the payload and the
   * project beside it: a campaign is measured under what it snapshotted at the pin, so the work is
   * about that campaign and never about whatever the project is pinned to when the attempt runs.
   */
  measure: {
    tenantId: string;
    projectId: string;
    campaignId: string;
    requestedBy: string;
  };
};
