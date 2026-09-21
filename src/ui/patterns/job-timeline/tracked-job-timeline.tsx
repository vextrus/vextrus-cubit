"use client";
/**
 * THE TIMELINE OF JOBS A SCREEN TRACKS — the pattern's two halves in one component (R-UI-024, X-1).
 *
 * `JobTimeline` draws steps and `useTrackedJobs` follows jobs; every screen that watches a run
 * composes the two. A module screen cannot: `src/modules/**` may not import `src/ui` (ARCH-01), so
 * the register was handed `JobTimeline` alone as chrome and drew the run the Measure door answered
 * from a step it wrote itself — `queued`, forever, while the worker finished the run in two seconds
 * (found 2026-09-21 by J-000's column-lines leg: 480 readings of `data-status="queued"` over 240 s
 * against a queue row `completed` at +2 s). A step nobody follows is a lie after its first frame.
 *
 * So the composition is the pattern's own: a screen — module or not — hands this the jobs it started
 * and reads nothing else; the register follows them and the timeline draws what it reads.
 */
import { JobTimeline } from "./job-timeline";
import { useTrackedJobs, type TrackedJob, type TrackedJobsOptions } from "./jobs-register";

export interface TrackedJobTimelineProps {
  readonly heading: string;
  /** The jobs this screen started, in the order it started them. */
  readonly jobs: readonly TrackedJob[];
  /** Called once per job that reaches `succeeded` — the screen's cue to re-read what the run wrote. */
  readonly onSucceeded?: TrackedJobsOptions["onSucceeded"];
}

export function TrackedJobTimeline({ heading, jobs, onSucceeded }: TrackedJobTimelineProps) {
  const { steps } = useTrackedJobs(jobs, onSucceeded === undefined ? undefined : { onSucceeded });
  return <JobTimeline heading={heading} steps={steps} />;
}
