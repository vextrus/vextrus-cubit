/**
 * The job pattern (R-UI-024), and its one home (B-17, ARCH-02): the presentational `JobTimeline`
 * rendered inline where a long operation was started, and the register — `JobsProvider`,
 * `useTrackedJobs`, `useJobs` — that watches each job exactly once and feeds both that timeline and
 * the frame's global jobs tray. A second timeline, or a second watch over one job, is a second
 * answer about the same work.
 *
 * Importing it brings its stylesheet and the reticle's single home (R-UI-012), so no consumer can
 * render the pattern unstyled or its evidence link unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./job-timeline.css";

export { JobTimeline } from "./job-timeline";
export type { JobTimelineProps } from "./job-timeline";
export { JobsProvider, useJobs, useTrackedJobs } from "./jobs-register";
export type { JobsFormat, JobsProviderProps, TrackedJob, TrackedJobReading, TrackedJobsOptions } from "./jobs-register";
export { kindWord, statusWord, timelineState } from "./reading";
export type { JobsEvidence, StepStatus, TimelineState, TimelineStep } from "./reading";
export { JOB_TIMELINE_STATES } from "./states";
export type { JobStateCell, JobStateRow } from "./states";
