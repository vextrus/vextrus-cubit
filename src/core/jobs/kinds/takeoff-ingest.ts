// SEAM-CAD's kinds: one drawing, extracted (R-TO-001).

import type { JobKindGroup } from "./law";

export const TAKEOFF_INGEST_JOB_KINDS = Object.freeze({
  // SEAM-CAD's orchestration (R-TO-001): one drawing at a time per process, because an attempt
  // spawns the extractor in a temp dir of its own. `expireSeconds` covers two 900 s LibreDWG passes
  // with margin, so the queue never re-queues an attempt of a key that is still running (L-CAD-04).
  ingest: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 2100 }),
}) satisfies JobKindGroup;

/** What this area's kinds are enqueued with (SEAM-JOBS: "typed payloads"). */
export type TakeoffIngestJobPayloads = {
  /**
   * One drawing's ingest (R-TO-001). `declared` is what makes a re-ingest a declared act rather
   * than drift (L-CAD-02): the reason a person gave, and the record the new one supersedes.
   */
  ingest: {
    tenantId: string;
    drawingId: string;
    requestedBy: string;
    declared: { reason: string; supersedes: string } | null;
  };
};
