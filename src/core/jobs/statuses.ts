// SEAM-JOBS: the vocabulary of a job's life, spelled once (B-17). A leaf: the store's storage
// and the runtime both read the terminal roster from here, so the log's "one ending per job"
// constraint and the runtime's judgement of "ended" can never drift apart (R-SPINE-030).

/** How a job's life is recorded, step by step. The last three end it. */
export type JobStatus = "started" | "progress" | "succeeded" | "refused" | "failed";

/** The statuses after which nothing more is ever said about a job. */
export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>(["succeeded", "refused", "failed"]);
