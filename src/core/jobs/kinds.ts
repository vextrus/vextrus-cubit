// SEAM-JOBS: the roster of job kinds, each with the queue policy R-SPINE-030 asks for — a
// concurrency limit and a retry rule with backoff — and the payload type its enqueuers must
// satisfy. The three are one roster, not three: a kind exists here or it does not exist, and a
// kind without a payload type or without a policy cannot be written down.
//
// The policy table is exported rather than hidden because it is the answer to "how often does this
// kind retry": a caller, an operator's screen and a test all read the number from here instead of
// each keeping a copy of it (ARCH-02).
import type { RefusalCode } from "../errors";

/**
 * One kind's queue policy: how many at once, how many attempts, how long between them, and how long
 * one attempt may take before the queue decides the process running it is gone.
 *
 * `concurrency` is per process, and deliberately so: it is how many of this kind's jobs one runtime
 * takes at a time, so N workers serve N × concurrency of them. The limit a kind needs across a fleet
 * is the product, and it is read here as this number times the number of workers run.
 *
 * `expireSeconds` is not a timeout the handler is told about: when an attempt outlives it the queue
 * re-queues that attempt while the original is still running, which is two attempts of one key at
 * once — exactly what SEAM-JOBS forbids. A kind therefore states a number its longest attempt fits
 * inside rather than inheriting the library's, and the log refuses a second ending regardless.
 */
export type JobKindPolicy = {
  concurrency: number;
  retryLimit: number;
  retryDelaySeconds: number;
  retryBackoff: boolean;
  expireSeconds: number;
};

/**
 * Every kind the seam runs, with its policy.
 *
 * `probe` is the built-in kind: it does nothing a product needs, and it can be told to take steps,
 * to dawdle, to fail and to refuse — so every path R-SPINE-030 names can be driven end to end by an
 * operator or by a test without a real kind having to be invented first.
 */
export const JOB_KINDS = Object.freeze({
  probe: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 1, retryBackoff: true, expireSeconds: 900 }),
  // SEAM-CAD's orchestration (R-TO-001): one drawing at a time per process, because an attempt
  // spawns the extractor in a temp dir of its own. `expireSeconds` covers two 900 s LibreDWG passes
  // with margin, so the queue never re-queues an attempt of a key that is still running (L-CAD-04).
  ingest: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 2100 }),
  // R-SPINE-022's sheet rasters: one record at a time per process, because an attempt renders every
  // sheet of a drawing at every tier and holds each canvas in memory while it does. `expireSeconds`
  // covers a large sheet set at 2048 px with margin, so the queue never re-queues a running attempt.
  thumbnails: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 900 }),
}) satisfies Readonly<Record<string, JobKindPolicy>>;

/** The kind vocabulary: the keys of the policy table and nothing else. */
export type JobKind = keyof typeof JOB_KINDS;

/**
 * What each kind is enqueued with (SEAM-JOBS: "typed payloads"). `refuseWith` is a key of the
 * closed refusal registry rather than a free string, so a probe cannot be asked to answer with a
 * refusal the taxonomy does not hold (R-SPINE-062, B-06).
 */
export type JobPayloads = {
  probe: {
    steps: string[];
    stepDelayMs?: number;
    failAtStep?: string;
    refuseWith?: RefusalCode;
  };
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

/** The kinds as a list, in the order the table declares them. */
export const KIND_NAMES: readonly JobKind[] = Object.freeze(Object.keys(JOB_KINDS) as JobKind[]);
