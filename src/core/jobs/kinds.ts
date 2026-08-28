// SEAM-JOBS: the roster of job kinds, each with the queue policy R-SPINE-030 asks for — a
// concurrency limit and a retry rule with backoff — and the payload type its enqueuers must
// satisfy. The three are one roster, not three: a kind exists here or it does not exist, and a
// kind without a payload type or without a policy cannot be written down.
//
// The policy table is exported rather than hidden because it is the answer to "how often does this
// kind retry": a caller, an operator's screen and a test all read the number from here instead of
// each keeping a copy of it (ARCH-02).
import type { RefusalCode } from "../errors";

/** One kind's queue policy: how many at once, how many attempts, and how long between them. */
export type JobKindPolicy = {
  concurrency: number;
  retryLimit: number;
  retryDelaySeconds: number;
  retryBackoff: boolean;
};

/**
 * Every kind the seam runs, with its policy.
 *
 * `probe` is the built-in kind: it does nothing a product needs, and it can be told to take steps,
 * to dawdle, to fail and to refuse — so every path R-SPINE-030 names can be driven end to end by an
 * operator or by a test without a real kind having to be invented first.
 */
export const JOB_KINDS = Object.freeze({
  probe: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 1, retryBackoff: true }),
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
};

/** The kinds as a list, in the order the table declares them. */
export const KIND_NAMES: readonly JobKind[] = Object.freeze(Object.keys(JOB_KINDS) as JobKind[]);
