// R-SPINE-030's "job progress events streamed to the UI (SSE)", as one route with two transports.
//
// The stream is the answer: `event: job` frames carrying the seam's own JobEvent, in seq order,
// history first so a subscriber that attaches late still learns everything, and the connection
// closed by this end once the job has reached its terminal event. `?transport=poll` answers the
// same log as one JSON snapshot, for a client that cannot hold a stream open.
//
// Both transports read the durable log through SEAM-JOBS and nothing else: what an event means, and
// when a job is over, are the seam's answers, not this route's (ARCH-02).
import { jobEvents, TERMINAL_STATUSES, watchJob, type JobEvent } from "../../../core/jobs";
import { reportFault } from "../../../core/faults/report";

/** The route the fault seam records this handler's failures under (ARCH-03). */
const ROUTE = "GET /api/events";

/** The query this route reads, and the one value of it that means anything but "stream". */
const JOB_ID = "jobId";
const TRANSPORT = "transport";
const POLL = "poll";

/** Headers that keep an event stream an event stream, through a proxy that would rather buffer it. */
const STREAM_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
} as const;

/** The log is read per request and is never the same twice; nothing here may be cached or built. */
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

/** Has the job said its last word? Terminality is the seam's judgement, read from the seam. */
function isOver(events: readonly JobEvent[]): boolean {
  const last = events.at(-1);
  return last !== undefined && TERMINAL_STATUSES.has(last.status);
}

/** One frame of the stream, in the event-stream grammar: a named event and its JSON payload. */
function frame(event: JobEvent): Uint8Array {
  return encoder.encode(`event: job\ndata: ${JSON.stringify(event)}\n\n`);
}

/** A JSON answer, with the status it is answering under. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * The whole log of one job as a single snapshot, with the seam's answer to "is it over yet".
 * `done` is read off the events being answered with, so the pair a caller receives always agrees
 * with itself even if the job ends between two requests.
 */
function pollAnswer(events: readonly JobEvent[]): Response {
  return json({ events, done: isOver(events) }, 200);
}

/**
 * What the caller is told about an id no job answers to. It is the caller's question that is wrong,
 * so it is answered as one — and the sentence is a field of the JSON envelope, for a caller, never
 * copy for a person (ARCH-03). The id it asked about is not echoed back into the answer.
 */
const NO_SUCH_JOB = "no job is recorded under that id";

/**
 * How long an empty log is given to say its first word before the id is called unknown, and how
 * often it is asked inside that window. A job's first event is written by the runtime a moment
 * after `enqueue` returns, so a log read empty at once is an early job as often as an unknown one;
 * a log still empty at the end of the window is an id nothing will ever answer to, and it is
 * answered rather than waited on forever. Only an id with nothing recorded under it waits at all,
 * and it waits no longer than its first event takes to appear.
 */
const FIRST_EVENT_GRACE_MS = 3_000;
const FIRST_EVENT_EVERY_MS = 50;

/**
 * The job's log, and whether anything is recorded under this id at all. An empty log is asked
 * again until it says something or the window above runs out, so the answer distinguishes a job
 * that has not spoken yet from an id no job answers to.
 *
 * The wait belongs to the caller: a client that goes away is not waited for, so a disconnection
 * ends the loop at once rather than leaving a window's worth of store reads running for nobody.
 */
async function recordedLog(jobId: string, signal: AbortSignal): Promise<readonly JobEvent[]> {
  const deadline = Date.now() + FIRST_EVENT_GRACE_MS;
  for (;;) {
    const events = await jobEvents(jobId);
    if (events.length > 0 || Date.now() >= deadline || signal.aborted) return events;
    await waited(FIRST_EVENT_EVERY_MS, signal);
  }
}

/** A wait that ends when its time is up or the caller has gone, leaving no timer behind either way. */
function waited(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((settle) => {
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      settle();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * The stream: history in seq order, then every further event as the log records it, then the close.
 * The watcher is bound to the request, so a client that goes away stops being waited for.
 */
function streamAnswer(jobId: string, signal: AbortSignal): Response {
  const watching = new AbortController();
  const stopWatching = (): void => watching.abort();
  signal.addEventListener("abort", stopWatching, { once: true });

  const body = new ReadableStream<Uint8Array>({
    start: (controller) => {
      void (async () => {
        try {
          for await (const event of watchJob(jobId, watching.signal)) controller.enqueue(frame(event));
          controller.close();
        } catch (failure) {
          // The log became unreadable mid-stream: an outage of ours, recorded before the client is
          // told anything, and the client is told — a job never fails silently (ARCH-03, B-21).
          const { faultId } = reportFault({ requestId: jobId, actor: "stream", route: ROUTE, cause: failure });
          // `desiredSize` is null once a stream has been cancelled, closed or errored: a client that
          // has already gone is nobody to tell, and the fault is recorded either way.
          if (controller.desiredSize !== null) {
            controller.enqueue(encoder.encode(`event: fault\ndata: ${JSON.stringify({ faultId })}\n\n`));
            controller.close();
          }
        } finally {
          signal.removeEventListener("abort", stopWatching);
          watching.abort();
        }
      })();
    },
    cancel: () => {
      watching.abort();
    },
  });

  return new Response(body, { status: 200, headers: { ...STREAM_HEADERS } });
}

/** The event log of one job, streamed by default and polled on request (R-SPINE-030). */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const jobId = query.get(JOB_ID)?.trim() ?? "";
  if (jobId === "") return json({ events: [], done: false, error: `${JOB_ID} is required` }, 400);
  const polling = query.get(TRANSPORT) === POLL;
  try {
    // The log is read before either transport answers, so an id no job answers to is settled here,
    // the same way over either transport: the address is unknown or it is not, and which client
    // asked does not change that. A stream opened over an unknown one would otherwise never end —
    // `watchJob` waits for events that are never coming, re-reading the store for the life of the
    // connection — and a poll over one would report an empty log as a job's quiet beginning.
    const events = await recordedLog(jobId, request.signal);
    if (events.length === 0) return json({ events: [], done: false, error: NO_SUCH_JOB }, 404);
    return polling ? pollAnswer(events) : streamAnswer(jobId, request.signal);
  } catch (failure) {
    // Nothing here is a refusal — the caller asked a lawful question and our side could not
    // answer it, so the fault is recorded and its id is what the caller is given (ARCH-03).
    const { faultId } = reportFault({ requestId: jobId, actor: polling ? "poll" : "stream", route: ROUTE, cause: failure });
    return json({ faultId }, 500);
  }
}
