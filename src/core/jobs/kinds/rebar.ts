// The REBAR area's own job kinds (AM-11, R-TO-054): the bar schedule's render, run off the work
// surface exactly as the draft BOQ's is (I-270's precedent).
//
// The barrel `src/core/jobs/kinds.ts` already enumerates this file, so a kind added to the group
// below joins the roster the runtime declares queues for and consumes — with no shared table to
// edit and no other area's file to touch (B-19).

import type { JobKindGroup } from "./law";

/** This area's kinds, each with the queue policy R-SPINE-030 asks for. */
export const REBAR_JOB_KINDS = Object.freeze({
  // One render at a time per process: an attempt reads a whole campaign's bill of bars and runs the
  // pinned renderer over it, and two renders of one campaign would file two issues of the same
  // schedule. A render that failed is retried once — a second failure is an answer, not a wait —
  // and `expireSeconds` stands well above a four-thousand-row schedule's compile without ever
  // re-queuing a live attempt (the draft's own policy, AM-10 §3 asserts no timing here).
  "bbs-render": Object.freeze({ concurrency: 1, retryLimit: 1, retryDelaySeconds: 5, retryBackoff: false, expireSeconds: 300 }),
}) satisfies JobKindGroup;

/** What this area's kinds are enqueued with (SEAM-JOBS: "typed payloads"). */
export type RebarJobPayloads = {
  "bbs-render": {
    readonly tenantId: string;
    readonly projectId: string;
    readonly campaignId: string;
    /** Who pressed the door: the issue is recorded as theirs (R-SPINE-040). */
    readonly requestedBy: string;
  };
};
