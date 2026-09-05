"use client";
// R-UI-024's job timeline, inline where the work was started (X-1: "the job timeline animates
// ingestion"). It reports jobs and invents none: every step is a job somebody asked for, and its
// status is the word SEAM-JOBS itself last said about it.
//
// Two transports, in the order the Decision rules: an `EventSource` over `/api/events?jobId=`, then
// the same route's `?transport=poll` snapshot. When both fail the list keeps its last known statuses
// and says live progress stopped arriving — a timeline that silently froze would read as a job that
// stalled (R-UI-050's offline cell).
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { JobKind } from "../../../../../../../core/jobs/kinds";
import { formatUserFigure } from "../../../../../../../core/format";
import { Skeleton } from "../../../../../../../ui/primitives/core";
import { fill } from "../../../../../../../ui/strings";
import { drawings } from "./strings";

/** One job the timeline follows. A step with no job id is work a seam answered was already done. */
export interface TimelineJob {
  readonly jobId: string | null;
  readonly kind: JobKind;
  /** Which drawing this job is about, so a consumer can chain the next request on it (I-88). */
  readonly drawingId: string;
}

export interface JobTimelineProps {
  jobs: readonly TimelineJob[];
  /** Told once per job the moment it succeeds — what the screen refreshes and chains on. */
  onSucceeded?: (job: TimelineJob) => void;
}

/** What a step can be standing at: SEAM-JOBS' own words, and the order they read in. */
type StepStatus = "queued" | "running" | "succeeded" | "failed" | "refused";

/** What the whole region is standing at, derived from its steps (Decision § 1). */
type TimelineState = "idle" | "running" | "done" | "failed";

/** One step's reading: the status the log last said, and how long the job has taken. */
interface StepReading {
  status: StepStatus;
  elapsedMs: number | null;
  lost: boolean;
}

/** The name each job kind reads as — a total map over the roster, so a new kind cannot be nameless. */
const KIND_WORDS: Readonly<Record<JobKind, string>> = {
  probe: drawings.drawings_step_probe,
  ingest: drawings.drawings_step_ingest,
  thumbnails: drawings.drawings_step_thumbnails,
};

/** The word each status reads as (Decision § 3). */
const STATUS_WORDS: Readonly<Record<StepStatus, string>> = {
  queued: drawings.drawings_status_queued,
  running: drawings.drawings_status_running,
  succeeded: drawings.drawings_status_succeeded,
  failed: drawings.drawings_status_failed,
  refused: drawings.drawings_status_refused,
};

/** How long a poll waits before asking again, in milliseconds. */
const POLL_INTERVAL_MS = 1000;

/** The status `/api/events` answers an id nothing is recorded under — an address, not a failure. */
const NO_SUCH_JOB_STATUS = 404;

/** A millisecond count as the whole seconds a person reads (I-92). */
const MS_PER_SECOND = 1000;

/** The status words the log can end on — a job that said one of these says nothing more. */
const SETTLED: readonly StepStatus[] = ["succeeded", "failed", "refused"];

/** The status a reading carries, refusing a word SEAM-JOBS does not use. */
function statusOf(value: unknown): StepStatus | null {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "refused" ? value : null;
}

export function JobTimeline({ jobs, onSucceeded }: JobTimelineProps) {
  const [readings, setReadings] = useState<Readonly<Record<string, StepReading>>>({});
  const headingId = useId();
  // Which jobs have already been reported as succeeded: a chained request is made once per job, not
  // once per event that repeats the ending.
  const announced = useRef<Set<string>>(new Set());

  const report = useCallback((jobId: string, reading: StepReading): void => {
    setReadings((held) => ({ ...held, [jobId]: reading }));
  }, []);

  const steps = jobs.map((job) => ({
    job,
    reading: job.jobId === null ? ({ status: "succeeded", elapsedMs: null, lost: false } satisfies StepReading) : (readings[job.jobId] ?? { status: "queued", elapsedMs: null, lost: false }),
  }));

  useEffect(() => {
    for (const { job, reading } of steps) {
      const at = job.jobId ?? `${job.kind}:${job.drawingId}`;
      if (reading.status !== "succeeded" || announced.current.has(at)) continue;
      announced.current.add(at);
      onSucceeded?.(job);
    }
  }, [steps, onSucceeded]);

  const state = stateOf(steps.map((step) => step.reading.status), steps.map((step) => step.job.kind));
  const lost = steps.some((step) => step.reading.lost);

  return (
    <section className="cx-drawings-timeline" data-testid="job-timeline" data-state={state} aria-labelledby={headingId}>
      <h2 className="cx-drawings-section-heading" id={headingId}>
        {drawings.drawings_timeline_heading}
      </h2>
      {steps.length === 0 ? <p className="cx-drawings-hint">{drawings.drawings_timeline_idle}</p> : null}
      <ol className="cx-drawings-steps">
        {steps.map(({ job, reading }) => (
          <li className="cx-drawings-step" data-testid="job-timeline-step" data-kind={job.kind} data-status={reading.status} key={job.jobId ?? `${job.kind}:${job.drawingId}`}>
            {/* The status word carries the meaning; the marker only repeats it (R-UI-060). */}
            <span className="cx-drawings-marker" aria-hidden="true" />
            <span className="cx-drawings-step-name">{KIND_WORDS[job.kind]}</span>
            <span className="cx-drawings-step-status" aria-live="polite">
              {STATUS_WORDS[reading.status]}
            </span>
            {reading.status === "running" && reading.elapsedMs === null ? (
              <Skeleton className="cx-drawings-step-bone" />
            ) : (
              <span className="cx-drawings-step-timing">{reading.elapsedMs === null ? "" : fill(drawings.drawings_timeline_seconds, { seconds: formatUserFigure(String(Math.round(reading.elapsedMs / MS_PER_SECOND))) })}</span>
            )}
            {job.jobId === null ? null : <JobWatch jobId={job.jobId} onReading={report} />}
          </li>
        ))}
      </ol>
      {lost ? (
        <p className="cx-drawings-hint" role="status">
          {drawings.drawings_timeline_transport_lost}
        </p>
      ) : null}
    </section>
  );
}

/**
 * What the region as a whole is standing at. `done` asks for a thumbnails step among the steps as
 * well as for every step having succeeded: an ingest that finished is not a drawing whose sheets can
 * be seen, and reporting it as done would say the work is over while the pictures are still coming.
 */
function stateOf(statuses: readonly StepStatus[], kinds: readonly JobKind[]): TimelineState {
  if (statuses.length === 0) return "idle";
  if (statuses.some((status) => status === "failed" || status === "refused")) return "failed";
  if (statuses.every((status) => status === "succeeded")) return kinds.includes("thumbnails") ? "done" : "running";
  return "running";
}

/**
 * One job, watched. The stream is tried first and the poll stands behind it; a job that has already
 * settled by the time either attaches is answered out of the durable log, which is why history comes
 * first on both transports (R-SPINE-030).
 */
function JobWatch({ jobId, onReading }: { jobId: string; onReading: (jobId: string, reading: StepReading) => void }): null {
  useEffect(() => {
    let stopped = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last: StepStatus = "queued";

    const take = (raw: unknown, lost: boolean): void => {
      const event = raw as { status?: unknown; elapsedMs?: unknown };
      const status = statusOf(event.status);
      if (status === null) return;
      last = status;
      onReading(jobId, { status, elapsedMs: typeof event.elapsedMs === "number" ? event.elapsedMs : null, lost });
    };

    // The failure is answered rather than caught: a poll that does not come back is the transport
    // being gone, and the answer to that is this screen's own offline reading — the last known
    // status stands and the region says live progress stopped arriving (I-89, R-UI-050). It is not
    // a fault of the product's, so nothing here reports one.
    //
    // The answer's status is read as well as its body. A 404 is the route saying nothing is recorded
    // under this id and never will be, so it takes the same offline reading and the watch stops:
    // asking again every interval for the life of the screen would be a poll that can only ever be
    // answered the same way. It is not the job's `failed` either — that word is SEAM-JOBS' terminal
    // judgement about work, not the transport's about an address.
    const poll = async (): Promise<void> => {
      if (stopped) return;
      const answered = await fetch(`/api/events?jobId=${encodeURIComponent(jobId)}&transport=poll`, { cache: "no-store" })
        .then(async (answer) => ({ status: answer.status, body: (await answer.json()) as { events?: unknown[]; done?: boolean } }))
        .catch(() => null);
      if (answered === null || answered.status === NO_SUCH_JOB_STATUS) {
        onReading(jobId, { status: last, elapsedMs: null, lost: true });
        if (answered !== null) return;
      } else {
        for (const event of answered.body.events ?? []) take(event, false);
        if (answered.body.done === true) return;
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    if (typeof EventSource === "function") {
      source = new EventSource(`/api/events?jobId=${encodeURIComponent(jobId)}`);
      source.addEventListener("job", (event) => {
        // A frame this end cannot read is a stream that is not giving us readings, which is the same
        // answer as a transport that stopped: the last known status stands and the region says so.
        void Promise.resolve((event as MessageEvent<string>).data)
          .then((data) => take(JSON.parse(data), false))
          .catch(() => onReading(jobId, { status: last, elapsedMs: null, lost: true }));
      });
      source.addEventListener("error", () => {
        source?.close();
        source = null;
        if (SETTLED.includes(last)) return;
        void poll();
      });
    } else {
      void poll();
    }

    return () => {
      stopped = true;
      source?.close();
      if (timer !== null) clearTimeout(timer);
    };
  }, [jobId, onReading]);

  return null;
}
