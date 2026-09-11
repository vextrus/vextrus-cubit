// The shape a job kind declares its queue policy in, and nothing else. It stands in its own file
// because every area file of this directory declares its kinds against it and the barrel
// `src/core/jobs/kinds.ts` — which enumerates those areas — hands it out again: a shape imported
// from the barrel would be a cycle, and a shape each area re-spelled would be drift (B-17).

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

/** One area's kinds, each with its policy — the shape every group of this directory declares. */
export type JobKindGroup = Readonly<Record<string, JobKindPolicy>>;
