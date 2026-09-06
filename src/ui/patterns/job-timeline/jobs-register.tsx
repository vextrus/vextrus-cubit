"use client";
/**
 * The job register (R-UI-024): one watch per job id, and the one reading both surfaces answer from —
 * the timeline inline where the work was started, and the global tray in the frame's top bar. Two
 * watches over one job would be two answers about one fact (docs/design/job-timeline.md I-111).
 *
 * The provider renders no DOM. It holds what this tab has tracked, in the order it was tracked, and
 * what each job's transport last said; the consumers ask for their own jobs (`useTrackedJobs`) or for
 * everything (`useJobs`, the tray).
 *
 * ARCH-01 / I-113: this layer formats nothing and looks nothing up. Whole seconds and the refusal
 * registry are `JobsFormat`, bound once in the tenant frame and handed in — so `src/ui` stays
 * value-import-free of `src/core` and a bare jsdom mount needs no lookup table.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { JobKind } from "../../../core/jobs/kinds";
import type { RefusalEntry } from "../../../core/errors";
import { UNANSWERED, ALREADY_DONE, watchJob, type JobReading } from "./job-watch";
import { timelineState, type JobsEvidence, type TimelineState, type TimelineStep } from "./reading";

/** One job a consumer follows. `subject` never renders: it is the consumer's key for what it is about. */
export interface TrackedJob {
  readonly jobId: string | null;
  readonly kind: JobKind;
  readonly subject: string;
  readonly evidence: JobsEvidence;
}

/** What the pattern cannot do for itself: whole seconds as copy, and the refusal registry (I-113). */
export interface JobsFormat {
  seconds(elapsedMs: number): string;
  refusal(code: string): RefusalEntry | null;
}

/** A tracked job as the tray reads it: the step, plus when this tab started following it. */
export type TrackedJobReading = TimelineStep & { readonly startedAt: string };

/** A job this tab has tracked, in the shape the register holds it. */
interface Registered extends TrackedJob {
  readonly id: string;
  readonly startedAt: string;
}

interface JobsRegister {
  readonly format: JobsFormat;
  readonly readings: Readonly<Record<string, JobReading>>;
  readonly tracked: readonly Registered[];
  track(jobs: readonly TrackedJob[]): void;
}

const JobsContext = createContext<JobsRegister | null>(null);

/** A job's key in the register: its own id, or what a job with no id was about (I-112). */
function keyOf(job: TrackedJob): string {
  return job.jobId ?? `${job.kind}:${job.subject}`;
}

/** What one job stands at, resolved for a reader: the register's reading through the frame's format. */
function stepOf(job: TrackedJob & { id: string }, reading: JobReading, format: JobsFormat): TimelineStep {
  return {
    id: job.id,
    jobId: job.jobId,
    kind: job.kind,
    status: reading.status,
    timing: reading.elapsedMs === null ? null : format.seconds(reading.elapsedMs),
    refusal: reading.refusalCode === null ? null : format.refusal(reading.refusalCode),
    faultId: reading.faultId,
    evidence: job.evidence,
  };
}

/** What the register last heard about one job — a job with no id was already answered (I-112). */
function readingOf(job: TrackedJob, readings: Readonly<Record<string, JobReading>>): JobReading {
  if (job.jobId === null) return ALREADY_DONE;
  return readings[job.jobId] ?? UNANSWERED;
}

export interface JobsProviderProps {
  format: JobsFormat;
  children?: ReactNode;
}

export function JobsProvider({ format, children }: JobsProviderProps) {
  const [readings, setReadings] = useState<Readonly<Record<string, JobReading>>>({});
  const [tracked, setTracked] = useState<readonly Registered[]>([]);
  /** The open watches, one per job id, ever: a terminal reading is never watched a second time. */
  const watches = useRef<Map<string, () => void>>(new Map());

  const track = useCallback((jobs: readonly TrackedJob[]): void => {
    const startedAt = new Date().toISOString();
    setTracked((held) => {
      const known = new Set(held.map((job) => job.id));
      const fresh = jobs.filter((job) => !known.has(keyOf(job))).map((job) => ({ ...job, id: keyOf(job), startedAt }));
      return fresh.length === 0 ? held : [...held, ...fresh];
    });

    for (const job of jobs) {
      const jobId = job.jobId;
      if (jobId === null || watches.current.has(jobId)) continue;
      watches.current.set(
        jobId,
        watchJob(jobId, (reading) => {
          setReadings((held) => ({ ...held, [jobId]: reading }));
        }),
      );
    }
  }, []);

  // The watches belong to the register rather than to the consumer that asked for them: a screen
  // that unmounts mid-job has not stopped the job, and the tray is still following it. They end when
  // the frame does.
  useEffect(() => {
    const open = watches.current;
    return () => {
      for (const stop of open.values()) stop();
      open.clear();
    };
  }, []);

  const register = useMemo<JobsRegister>(() => ({ format, readings, tracked, track }), [format, readings, tracked, track]);

  return <JobsContext.Provider value={register}>{children}</JobsContext.Provider>;
}

/** The register, or a plain sentence naming what is missing (Decision § 2). */
function useRegister(): JobsRegister {
  const register = useContext(JobsContext);
  if (register === null) {
    throw new Error("The jobs register is missing: a screen that tracks jobs is mounted inside a JobsProvider, which the tenant frame renders.");
  }
  return register;
}

export interface TrackedJobsOptions {
  /** Told once per job the moment it succeeds — what a screen refreshes and chains on (I-88). */
  onSucceeded?: (job: TrackedJob) => void;
}

/**
 * Follow exactly these jobs, in the order given, and answer what they stand at. Registration is the
 * whole of the request: the register opens the watch, and a job it already knows opens nothing.
 */
export function useTrackedJobs(jobs: readonly TrackedJob[], options?: TrackedJobsOptions): { steps: readonly TimelineStep[]; lost: boolean } {
  const register = useRegister();
  const { track, readings, format } = register;
  /** Which jobs have already been reported: a chained request is made once per job, not per frame. */
  const announced = useRef<Set<string>>(new Set());
  const held = useRef<TrackedJobsOptions | undefined>(options);

  useEffect(() => {
    held.current = options;
  });

  useEffect(() => {
    track(jobs);
  }, [jobs, track]);

  const steps = useMemo(() => jobs.map((job) => stepOf({ ...job, id: keyOf(job) }, readingOf(job, readings), format)), [jobs, readings, format]);

  useEffect(() => {
    for (const [at, step] of steps.entries()) {
      if (step.status !== "succeeded" || announced.current.has(step.id)) continue;
      announced.current.add(step.id);
      const job = jobs[at];
      if (job !== undefined) held.current?.onSucceeded?.(job);
    }
  }, [steps, jobs]);

  const lost = jobs.some((job) => readingOf(job, readings).lost);
  return { steps, lost };
}

/**
 * Everything this tab has tracked, newest first, and the one state word derived exactly as the
 * timeline's — the tray's reading (docs/design/shell-top-bar.md § 1). Null outside a provider, so a
 * bare mount of the shell renders no tray at all (I-116).
 */
export function useJobs(): { jobs: readonly TrackedJobReading[]; state: TimelineState } | null {
  const register = useContext(JobsContext);
  if (register === null) return null;
  const { tracked, readings, format } = register;

  const inOrder = tracked.map((job) => ({ ...stepOf(job, readingOf(job, readings), format), startedAt: job.startedAt }));
  // Newest first, by when this tab started following the job. `Array#sort` is stable, so jobs tracked
  // within one millisecond of each other keep the reverse of the order they were tracked in.
  const newestFirst = [...inOrder].reverse().sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));

  return { jobs: newestFirst, state: timelineState(inOrder.map((job) => job.status)) };
}
