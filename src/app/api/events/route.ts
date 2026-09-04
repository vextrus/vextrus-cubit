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
  const actor = query.get(TRANSPORT) === POLL ? "poll" : "stream";

  // The log is read before either transport answers, because it is what decides whether there is
  // anything to answer with. SEAM-JOBS publishes a job's first event inside the lock that admits
  // it, so an id whose log is empty names no job this seam has ever held — not a job that has yet
  // to start. A stream opened on one would poll the database every 250 ms for a job that will
  // never speak, for as long as the client is willing to hold the connection.
  let events: readonly JobEvent[];
  try {
    events = await jobEvents(jobId);
  } catch (failure) {
    // Nothing here is a refusal — the caller asked a lawful question and our side could not
    // answer it, so the fault is recorded and its id is what the caller is given (ARCH-03).
    const { faultId } = reportFault({ requestId: jobId, actor, route: ROUTE, cause: failure });
    return json({ faultId }, 500);
  }

  // An address that names nothing is answered as an absence, in the same shape a caller already
  // reads the log in: `error` is a field of the answer, not copy — no screen renders this route.
  if (events.length === 0) return json({ events: [], done: false, error: `${JOB_ID} names no job` }, 404);

  // `done` is read off the events being answered with, so the pair a caller receives always agrees
  // with itself even if the job ends between two requests.
  if (actor === "poll") return json({ events, done: isOver(events) }, 200);
  return streamAnswer(jobId, request.signal);
}
