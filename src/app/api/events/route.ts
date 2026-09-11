// R-SPINE-030's "job progress events streamed to the UI (SSE)", as one route with two transports.
//
// The stream is the answer: `event: job` frames carrying the seam's own JobEvent, in seq order,
// history first so a subscriber that attaches late still learns everything, and the connection
// closed by this end once the job has reached its terminal event. `?transport=poll` answers the
// same log as one JSON snapshot, for a client that cannot hold a stream open.
//
// Both transports read the durable log through SEAM-JOBS and nothing else: what an event means,
// when a job is over, and whether an id is one the queue holds a job under at all are the seam's
// answers, not this route's (ARCH-02). This route only composes them — the log first, and the
// queue's own knowledge of the id only where the log has nothing to say.
import { jobEvents, jobScope, TERMINAL_STATUSES, watchJob, type JobEvent } from "@/core/jobs";
import { REFUSALS } from "@/core/errors";
import { reportFault } from "@/core/faults/report";
import { resolveSession } from "@/server/auth/session";
import { authorize } from "@/server/authorize";
import { presentedToken } from "@/server/context";

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
 * The one answer to both of the questions a caller may not have answered: an id no job is recorded
 * under, and a job that is recorded under somebody else's workspace. They are the same sentence,
 * the same envelope and the same status, so neither can be told from the other.
 */
function noSuchJob(): Response {
  return json({ events: [], done: false, error: NO_SUCH_JOB }, 404);
}

/**
 * The stream: history in seq order, then every further event as the log records it, then the close.
 * The watcher is bound to the request, so a client that goes away stops being waited for.
 *
 * The history is the log the one read below already holds — empty, for a job the queue knows that
 * has not spoken yet — and it is what the subscriber is given first: there is no second read of the
 * same rows for the same request. What the watcher
 * chooses to replay is the seam's business (the runtime's replays from the beginning of the log), so
 * a seq the history already carried is passed over rather than sent twice: a subscriber that read
 * the same event under two frames would count one thing as two.
 */
function streamAnswer(jobId: string, history: readonly JobEvent[], signal: AbortSignal): Response {
  const watching = new AbortController();
  const stopWatching = (): void => watching.abort();
  signal.addEventListener("abort", stopWatching, { once: true });
  const lastRecorded = history.at(-1)?.seq ?? -1;

  /**
   * Whether this end is finished with the stream — set by our own close AND by the consumer's
   * cancel, because a cancelled stream is one nothing may be written to or closed again: both
   * `close()` and `enqueue()` throw `TypeError: Invalid state: Controller is already closed`.
   *
   * The state is held here rather than read back off `desiredSize`, which does not answer the
   * question: WHATWG Streams gives null only for an ERRORED stream and 0 for a closed or cancelled
   * one. Read as "null once cancelled", a routine disconnect — every finished job, because the
   * subscriber closes the EventSource on the terminal frame (I-111) — filed a fault against an
   * outage that never happened and then threw the second TypeError inside the handler for the
   * first, with only a `finally` above it: one unhandled rejection per closed tab.
   */
  let closed = false;

  const body = new ReadableStream<Uint8Array>({
    start: (controller) => {
      /** Close this end once, and never a stream the consumer has already let go of. */
      const closeOnce = (): void => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      void (async () => {
        try {
          for (const event of history) {
            if (closed) return;
            controller.enqueue(frame(event));
          }
          for await (const event of watchJob(jobId, watching.signal)) {
            if (closed) return;
            if (event.seq > lastRecorded) controller.enqueue(frame(event));
          }
          closeOnce();
        } catch (failure) {
          // A client that has gone is nobody to tell, and its going is not an outage of ours: the
          // watcher ends the way an aborted watcher ends and nothing is left to write to. Only a
          // failure met while somebody was still listening is a fault (ARCH-03, B-21).
          if (closed || signal.aborted) return;
          // The log became unreadable mid-stream: an outage of ours, recorded before the client is
          // told anything, and the client is told — a job never fails silently (ARCH-03, B-21).
          const { faultId } = reportFault({ requestId: jobId, actor: "stream", route: ROUTE, cause: failure });
          controller.enqueue(encoder.encode(`event: fault\ndata: ${JSON.stringify({ faultId })}\n\n`));
          closeOnce();
        } finally {
          signal.removeEventListener("abort", stopWatching);
          watching.abort();
        }
      })();
    },
    // The consumer has let the stream go: the watcher stops, and this end writes nothing more.
    cancel: () => {
      closed = true;
      watching.abort();
    },
  });

  return new Response(body, { status: 200, headers: { ...STREAM_HEADERS } });
}

/** The event log of one job, streamed by default and polled on request (R-SPINE-030). */
export async function GET(request: Request): Promise<Response> {
  // R-SPINE-001: a door answers nobody it has not identified. This one used to answer everybody —
  // it read the durable job log, which carries a tenant's drawing ids and its operators' progress,
  // for any caller who could guess a job id. A missing or dead cookie is SIGNED_OUT under 401,
  // which is a registered answer and not a fault (ARCH-03, B-21).
  // The cookie is read off the request this handler was handed, never through `next/headers`: that
  // jar is a server-component adapter and throws outside a request scope, so a route that reached
  // for it would answer a harness driving it directly with a fault instead of a session.
  const presented = presentedToken(request);
  const session = presented === null ? null : await resolveSession(presented);
  if (session === null) return json({ events: [], done: false, refusal: REFUSALS.SIGNED_OUT.code }, 401);

  const query = new URL(request.url).searchParams;
  const jobId = query.get(JOB_ID)?.trim() ?? "";
  if (jobId === "") return json({ events: [], done: false, error: `${JOB_ID} is required` }, 400);
  const polling = query.get(TRANSPORT) === POLL;
  try {
    // Whose job is this, and may this session read it (src/server/authorize.ts)? The workspace is
    // the JOB's own, read from the payload the queue holds, and never the tenant on the wire: a
    // tenant id in a query string is a value the caller wrote. Until this door asked, a live session
    // of one workspace received another's events under a 200 — the log carries a workspace's drawing
    // ids and its operators' progress — and an id nobody held answered 404 while somebody else's
    // answered 200, which told a caller which job ids exist across the whole deployment.
    //
    // So both questions get ONE answer, byte for byte: a job that is not yours and an id no job
    // answers to are indistinguishable, and nothing can be learned by asking. A job that names no
    // workspace (the spine's own probe) holds nothing of anyone's and has no membership to test.
    const scope = await jobScope(jobId);
    if (scope === null) return noSuchJob();
    if (scope.tenantId !== null) {
      const answer = await authorize({
        userId: session.userId,
        tenantId: scope.tenantId,
        ...(scope.projectId === null ? {} : { projectId: scope.projectId }),
        ...(scope.drawingId === null ? {} : { drawingId: scope.drawingId }),
      });
      if (!answer.authorized) return noSuchJob();
    }

    // The log is read once, and an id no job answers to is settled before either transport answers:
    // the address is unknown or it is not, and which client asked does not change that. A stream
    // opened over an unknown one would otherwise never end — `watchJob` waits for events that are
    // never coming, re-reading the store for the life of the connection — and a poll over one would
    // report an empty log as a job's quiet beginning.
    //
    // A log with anything in it is a job, whatever the queue still remembers, so the door is asked
    // only where the log is silent: what "known" means then is the queue's own record, and it is
    // the seam's answer rather than this route's (ARCH-02, B-17). The question needs no clock —
    // nothing here waits for a first event — so an unknown id is answered the moment it is asked.
    const events = await jobEvents(jobId);
    return polling ? pollAnswer(events) : streamAnswer(jobId, events, request.signal);
  } catch (failure) {
    // Nothing here is a refusal — the caller asked a lawful question and our side could not
    // answer it, so the fault is recorded and its id is what the caller is given (ARCH-03).
    const { faultId } = reportFault({ requestId: jobId, actor: polling ? "poll" : "stream", route: ROUTE, cause: failure });
    return json({ faultId }, 500);
  }
}
