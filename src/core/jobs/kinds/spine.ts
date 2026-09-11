// SEAM-JOBS' own kind: the probe, which belongs to no product area because it exists to drive the
// seam itself (R-SPINE-030).

import type { RefusalCode } from "../../errors";
import type { JobKindGroup } from "./law";

/**
 * `probe` is the built-in kind: it does nothing a product needs, and it can be told to take steps,
 * to dawdle, to fail and to refuse — so every path R-SPINE-030 names can be driven end to end by an
 * operator or by a test without a real kind having to be invented first.
 */
export const SPINE_JOB_KINDS = Object.freeze({
  probe: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 1, retryBackoff: true, expireSeconds: 900 }),
}) satisfies JobKindGroup;

/**
 * What this area's kinds are enqueued with (SEAM-JOBS: "typed payloads"). `refuseWith` is a key of
 * the closed refusal registry rather than a free string, so a probe cannot be asked to answer with a
 * refusal the taxonomy does not hold (R-SPINE-062, B-06).
 */
export type SpineJobPayloads = {
  probe: {
    steps: string[];
    stepDelayMs?: number;
    failAtStep?: string;
    refuseWith?: RefusalCode;
    /**
     * A file whose existence ends every remaining step's wait at once. A test that holds a slot
     * with a long probe can let it go the moment its proof is made instead of waiting the delays
     * out — the hold still outlasts whatever it was guarding if nobody ever writes the file.
     */
    releaseWhen?: string;
  };
};
