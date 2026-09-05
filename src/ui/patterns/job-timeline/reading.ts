/**
 * The job pattern's vocabulary and the two rules both of its surfaces read by (R-UI-024, B-17): what
 * a step can be standing at, what a region of steps is standing at, and the words each of them reads
 * as. The inline timeline and the global jobs tray answer from this one module, so a tray and a
 * timeline over the same jobs can never disagree.
 *
 * ARCH-01: `JobKind` arrives as a type only — this layer holds no value import of core.
 */
import type { JobKind } from "../../../core/jobs/kinds";
import type { RefusalEntry } from "../../../core/errors";
import type { RefusalEvidence } from "../refusal-state";
import { strings } from "../../strings";

/** What one step can be standing at — the screen's five words (docs/design/job-timeline.md I-108). */
export type StepStatus = "queued" | "running" | "succeeded" | "failed" | "refused";

/** What a whole region of steps is standing at (Decision § 1). */
export type TimelineState = "idle" | "running" | "done" | "failed";

/** Where a step's cause is resolved: the one evidence shape the refusal pattern already rules. */
export type JobsEvidence = RefusalEvidence;

/** One step, resolved: every string it shows has already been formatted or looked up (I-113). */
export interface TimelineStep {
  readonly id: string;
  readonly jobId: string | null;
  readonly kind: JobKind;
  readonly status: StepStatus;
  /** The elapsed time as a person reads it, or null while no number exists. */
  readonly timing: string | null;
  readonly refusal: RefusalEntry | null;
  readonly faultId: string | null;
  readonly evidence: JobsEvidence;
}

/** The status words the log can end on — a job that said one of these says nothing more. */
export const SETTLED: readonly StepStatus[] = ["succeeded", "failed", "refused"];

/** Whether a reading is terminal, and so never watched again (I-111). */
export function isSettled(status: StepStatus): boolean {
  return SETTLED.includes(status);
}

/** The word each kind reads as — total over `JobKind`, so a kind the seam grows cannot be nameless. */
const KIND_WORDS: Readonly<Record<JobKind, string>> = {
  ingest: strings.job_step_ingest,
  thumbnails: strings.job_step_thumbnails,
  probe: strings.job_step_probe,
};

/** The word each status reads as (Decision § 4). */
const STATUS_WORDS: Readonly<Record<StepStatus, string>> = {
  queued: strings.job_status_queued,
  running: strings.job_status_running,
  succeeded: strings.job_status_succeeded,
  failed: strings.job_status_failed,
  refused: strings.job_status_refused,
};

export function kindWord(kind: JobKind): string {
  return KIND_WORDS[kind];
}

export function statusWord(status: StepStatus): string {
  return STATUS_WORDS[status];
}

/**
 * What a region of steps is standing at, in the order the first rule that holds wins (Decision § 1):
 * empty is idle; a terminal cause outranks everything; anything unfinished — or a chain the consumer
 * says is still incomplete (`awaiting`, I-109) — is running; a settled, whole list is done.
 */
export function timelineState(statuses: readonly StepStatus[], awaiting = false): TimelineState {
  if (statuses.length === 0) return "idle";
  if (statuses.some((status) => status === "failed" || status === "refused")) return "failed";
  if (awaiting || statuses.some((status) => status === "queued" || status === "running")) return "running";
  return "done";
}
