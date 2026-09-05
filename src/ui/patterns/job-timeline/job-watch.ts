/**
 * One job, watched (C-SPINE-JOBS: progress is streamed with per-step status, timings and named
 * refusals; R-UI-024: results appear without reload). Two transports in the order the Decision rules
 * (docs/design/job-timeline.md I-111): an `EventSource` over `/api/events?jobId=`, then the same
 * route's `?transport=poll` snapshot when the constructor is absent or the stream gives up before a
 * terminal frame.
 *
 * The seam's vocabulary stops here (I-108): `/api/events` says `started | progress | succeeded |
 * refused | failed`, and what leaves this module is the screen's five words. Nothing downstream
 * knows the stream's spelling.
 *
 * A transport that is gone is a reading, not a blank: the last known status stands and `lost` is set,
 * so the surface can say live progress stopped arriving instead of painting a frozen status as live.
 * It is the transport that failed and not the product, so nothing here reports a fault.
 */
import type { StepStatus } from "./reading";
import { isSettled } from "./reading";

/** What one watch last knows about its job, before any of it is formatted for a reader. */
export interface JobReading {
  readonly status: StepStatus;
  readonly elapsedMs: number | null;
  readonly refusalCode: string | null;
  readonly faultId: string | null;
  readonly lost: boolean;
}

/** A job nobody has said anything about yet. */
export const UNANSWERED: JobReading = Object.freeze({ status: "queued", elapsedMs: null, refusalCode: null, faultId: null, lost: false });

/** Work a seam answered was already done: no id to follow, and nothing timed it (I-112). */
export const ALREADY_DONE: JobReading = Object.freeze({ status: "succeeded", elapsedMs: null, refusalCode: null, faultId: null, lost: false });

/** How long a poll waits before asking again, in milliseconds. */
const POLL_INTERVAL_MS = 1000;

/** The status `/api/events` answers an id nothing is recorded under — an address, not a failure. */
const NO_SUCH_JOB_STATUS = 404;

/** The seam's word as the screen's, or null for a frame this end cannot read (I-108). */
function statusOf(value: unknown): StepStatus | null {
  if (value === "started" || value === "progress") return "running";
  if (value === "succeeded" || value === "failed" || value === "refused") return value;
  return null;
}

/** The events route's address for one job, on either transport. */
function eventsHref(jobId: string, poll: boolean): string {
  return `/api/events?jobId=${encodeURIComponent(jobId)}${poll ? "&transport=poll" : ""}`;
}

/**
 * Follow one job until it settles, the route says it is done, or the transport is gone. The answer
 * is the stop function the caller closes the watch with; calling it twice is harmless.
 */
export function watchJob(jobId: string, onReading: (reading: JobReading) => void): () => void {
  let stopped = false;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: JobReading = UNANSWERED;

  const report = (reading: JobReading): void => {
    last = reading;
    onReading(reading);
  };

  /** The transport is gone; whatever was last known stands, and the surface says so in words. */
  const lostNow = (): void => {
    report({ ...last, lost: true });
  };

  const take = (raw: unknown): void => {
    const event = raw as { status?: unknown; elapsedMs?: unknown; refusalCode?: unknown; faultId?: unknown };
    const status = statusOf(event.status);
    if (status === null) return;
    report({
      status,
      elapsedMs: typeof event.elapsedMs === "number" ? event.elapsedMs : null,
      refusalCode: typeof event.refusalCode === "string" ? event.refusalCode : null,
      faultId: typeof event.faultId === "string" ? event.faultId : null,
      lost: false,
    });
  };

  /** A `fault` frame: the job failed and the fault id is the thread to what happened (I-110). */
  const takeFault = (raw: unknown): void => {
    const event = raw as { faultId?: unknown };
    report({ status: "failed", elapsedMs: last.elapsedMs, refusalCode: null, faultId: typeof event.faultId === "string" ? event.faultId : null, lost: false });
  };

  const close = (): void => {
    source?.close();
    source = null;
  };

  /**
   * The snapshot leg. A 404 is the route saying nothing is recorded under this id and never will be,
   * and a rejection is the network being gone: both take the transport-lost reading and stop, because
   * asking again every interval could only ever be answered the same way.
   */
  const poll = async (): Promise<void> => {
    if (stopped) return;
    const answered = await fetch(eventsHref(jobId, true), { cache: "no-store" })
      .then(async (answer) => ({ status: answer.status, body: (await answer.json()) as { events?: unknown[]; done?: boolean } }))
      .catch(() => null);
    if (stopped) return;
    if (answered === null || answered.status === NO_SUCH_JOB_STATUS) {
      lostNow();
      return;
    }
    for (const event of answered.body.events ?? []) take(event);
    if (answered.body.done === true || isSettled(last.status)) return;
    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
  };

  if (typeof EventSource === "function") {
    source = new EventSource(eventsHref(jobId, false));
    source.addEventListener("job", (event) => {
      // A frame this end cannot parse is a stream that is not giving us readings, which is the same
      // answer as a transport that stopped: the last known status stands and the region says so.
      try {
        take(JSON.parse((event as MessageEvent<string>).data));
      } catch {
        lostNow();
      }
    });
    source.addEventListener("fault", (event) => {
      try {
        takeFault(JSON.parse((event as MessageEvent<string>).data));
      } catch {
        lostNow();
      }
    });
    source.addEventListener("error", () => {
      close();
      if (isSettled(last.status)) return;
      void poll();
    });
  } else {
    void poll();
  }

  return () => {
    stopped = true;
    close();
    if (timer !== null) clearTimeout(timer);
  };
}
