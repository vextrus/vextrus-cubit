// R-SPINE-022's kinds: one ingest record's sheets, rendered at every tier.

import type { JobKindGroup } from "./law";

export const TAKEOFF_RASTERS_JOB_KINDS = Object.freeze({
  // R-SPINE-022's sheet rasters: one record at a time per process, because an attempt renders every
  // sheet of a drawing at every tier and holds each canvas in memory while it does. `expireSeconds`
  // covers a large sheet set at 2048 px with margin, so the queue never re-queues a running attempt.
  thumbnails: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 900 }),
}) satisfies JobKindGroup;

/** What this area's kinds are enqueued with (SEAM-JOBS: "typed payloads"). */
export type TakeoffRastersJobPayloads = {
  /**
   * One ingest record's sheets, rendered (R-SPINE-022). The record is named in the payload rather
   * than looked up when the attempt runs: the rasters are of the artifact that stood when the work
   * was asked for, so a record superseded meanwhile does not silently redirect the job.
   */
  thumbnails: {
    tenantId: string;
    drawingId: string;
    ingestId: string;
    requestedBy: string;
  };
};
