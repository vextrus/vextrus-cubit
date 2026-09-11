/**
 * `GET /api/events`, beside the route it judges.
 *
 * The law this file holds the route to, after the door SEAM-JOBS now publishes (AC-2, AC-3, B-20):
 *
 * 1. An id nothing answers to is settled at once. The log is read; if it holds nothing, the queue
 *    itself is asked whether it knows the id, and an id it does not know is the caller's question
 *    being wrong — 404, the same JSON over either transport, with no stream opened. No request
 *    waits for a first event any more: the answer needs no clock, so none is advanced to reach it;
 *    and a log that holds something is not a question for the queue at all — the door is reached
 *    only where the log has nothing to say, so a recorded history costs no round trip either way.
 * 2. A job the queue knows but that has not spoken yet is live on both transports: an empty,
 *    unfinished snapshot to a poll, and a stream that carries whatever the watcher yields next.
 * 3. The history the log read already holds is what the stream carries first, and a seq is emitted
 *    exactly once. What `watchJob` chooses to replay is the seam's business: a watcher that hands
 *    back only the events after the history must still leave the subscriber holding the whole log,
 *    and one that replays the history must not make the subscriber read it twice.
 *
 * The grace window an earlier reading gave an empty log is gone with the rules that needed it, and
 * so are the tests that pinned it (B-20): nothing here advances a fake clock to reach an answer.
 *
 * The seam is stubbed, never the route: SEAM-JOBS answers what a log holds and whether the queue
 * knows an id, and this file only decides what it answers so the route's own composition is what is
 * judged (ARCH-02).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { JobEvent } from "@/core/jobs";
import { setFaultSink, type FaultRecord } from "@/core/faults/report";
import { SESSION_COOKIE } from "@/server/auth/session";

/**
 * How long a real clock is given for an answer that must not need a fake one. Generous by a wide
 * margin: these answers settle on microtasks, so the budget is only ever reached by a route that is
 * waiting for a timer nothing is going to advance.
 */
const ANSWER_BUDGET_MS = 2_000;

/** A real timer, captured before the fake clock takes over, so "never answered" is answerable. */
const realSetTimeout = globalThis.setTimeout;

/** The sentence the unknown-id answer carries, as the route's JSON envelope spells it. */
const NO_SUCH_JOB = "no job is recorded under that id";

const seam = vi.hoisted(() => ({
  jobEvents: vi.fn<(jobId: string) => Promise<JobEvent[]>>(async () => []),
  watchJob: vi.fn<(jobId: string, signal?: AbortSignal) => AsyncGenerator<JobEvent>>(),
  isKnownJob: vi.fn<(jobId: string) => Promise<boolean>>(async () => false),
  jobScope: vi.fn<(jobId: string) => Promise<{ tenantId: string | null; projectId: string | null; drawingId: string | null } | null>>(async () => null),
}));

/** What the guard answered. The door asks it about the job's OWN workspace, never the caller's. */
const guard = vi.hoisted(() => ({ authorize: vi.fn(async () => ({ authorized: true, actor: {}, tenantId: "t", userId: "user-1" })) }));

vi.mock("@/server/authorize", () => ({ authorize: guard.authorize }));

/**
 * The door identifies its caller since src/server/authorize.ts (R-SPINE-001): it reads the session
 * off the cookie the request carries. The log this suite is about is the same log either way, so the
 * caller is signed in here and the refusing limb states itself below.
 */
vi.mock("@/server/auth/session", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  resolveSession: async () => ({ sessionId: "session-1", userId: "user-1", tenantId: "tenant-1" }),
}));

/** What a signed-in caller presents. The cookie's name is the identity seam's, not this file's. */
const SIGNED_IN = { headers: { cookie: `${SESSION_COOKIE}=a-live-token` } } as const;

vi.mock("../../../../core/jobs", async (importOriginal) => {
  // The terminal statuses are the seam's own judgement and are kept, not restated (B-17).
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, jobEvents: seam.jobEvents, watchJob: seam.watchJob, isKnownJob: seam.isKnownJob, jobScope: seam.jobScope };
});

const { GET } = await import("../route");

/** One recorded event, with only the fields this route reads carrying meaning. */
function event(seq: number, status: JobEvent["status"]): JobEvent {
  return {
    jobId: "job-1",
    kind: "ingest",
    key: "drawing-1",
    seq,
    step: `step-${seq}`,
    status,
    attempt: 1,
    refusalCode: null,
    faultId: null,
    detail: null,
    at: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    elapsedMs: seq * 100,
  };
}

/** A generator over a fixed roster, which is what a watcher looks like from the route's side. */
function watcherOver(events: readonly JobEvent[]): () => AsyncGenerator<JobEvent> {
  return async function* watcher() {
    for (const each of events) yield each;
  };
}

/** Every `event: job` frame the stream carried, parsed back out of the event-stream grammar. */
async function framesOf(response: Response): Promise<JobEvent[]> {
  const body = response.body;
  expect(body, "a stream answer carries a body").not.toBeNull();
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text
    .split("\n\n")
    .filter((block) => block.includes("event: job"))
    .map((block) => {
      const line = block.split("\n").find((each) => each.startsWith("data: "));
      expect(line, `a job frame carries its payload: ${block}`).toBeDefined();
      return JSON.parse((line as string).slice("data: ".length)) as JobEvent;
    });
}

const address = (jobId: string, transport?: "poll"): string =>
  `http://127.0.0.1/api/events?jobId=${encodeURIComponent(jobId)}${transport === undefined ? "" : `&transport=${transport}`}`;

/**
 * An answer, or the fact that none came while the clock stood still. A route that arms a timer
 * before it answers is reported as exactly that, rather than as a bare timeout of the test.
 */
async function answered(pending: Promise<Response>, what: string): Promise<Response> {
  const outcome = await Promise.race([
    pending.then((response) => ({ response })),
    new Promise<"never answered">((settle) => realSetTimeout(() => settle("never answered"), ANSWER_BUDGET_MS)),
  ]);
  expect(outcome, `${what} answered without the clock being advanced — no request arms a timer before it answers`).not.toBe("never answered");
  return (outcome as { response: Response }).response;
}

beforeEach(() => {
  vi.clearAllMocks();
  seam.jobEvents.mockImplementation(async () => []);
  seam.watchJob.mockImplementation(watcherOver([]));
  seam.isKnownJob.mockImplementation(async () => false);
  seam.jobScope.mockImplementation(async () => ({ ...UNOWNED }));
  guard.authorize.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: "t", userId: "user-1" }));
});

/** A job of somebody's workspace, as the queue's own payload names it. */
const OWNED = { tenantId: "tenant-a", projectId: "project-a", drawingId: null } as const;

/** A job that names no workspace — the spine's probe, which holds nothing of anyone's. */
const UNOWNED = { tenantId: null, projectId: null, drawingId: null } as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("AC-2: an id no job answers to is settled at once, over either transport", () => {
  test("AC-2: an id the queue does not know is 404 JSON on both transports, and no clock is needed to say so", async () => {
    seam.jobEvents.mockImplementation(async () => []);
    seam.isKnownJob.mockImplementation(async () => false);
    // No queue holds a job under this id, so the seam names no workspace for it either.
    seam.jobScope.mockImplementation(async () => null);
    vi.useFakeTimers();

    const answers: { status: number; body: unknown }[] = [];
    for (const transport of [undefined, "poll"] as const) {
      const what = `an id no job answers to, asked ${transport === undefined ? "over the stream transport" : "over the poll transport"}`;
      const response = await answered(GET(new Request(address("job-nobody-answers-to", transport), SIGNED_IN)), what);

      expect(response.status, `${what}: the caller's question is the thing that is wrong`).toBe(404);
      expect(response.headers.get("content-type") ?? "", `${what}: the answer is JSON, not a stream`).toContain("application/json");
      const body = await response.json();
      expect(body, `${what}: the envelope carries the empty log, the unfinished flag and the sentence`).toEqual({
        events: [],
        done: false,
        error: NO_SUCH_JOB,
      });
      answers.push({ status: response.status, body });
    }

    expect(answers[1], "the address is unknown or it is not — which client asked does not change the answer").toEqual(answers[0]);
    expect(seam.watchJob, "an id nothing answers to opens no stream, so the watcher is never reached").not.toHaveBeenCalled();
    expect(vi.getTimerCount(), "answering an unknown id leaves no timer behind, because none was ever armed").toBe(0);
  });
});

describe("AC-3: a job the queue knows is live on both transports before it has spoken", () => {
  test("AC-3: a known job with nothing recorded polls an empty, unfinished snapshot", async () => {
    seam.jobEvents.mockImplementation(async () => []);
    seam.isKnownJob.mockImplementation(async () => true);
    seam.jobScope.mockImplementation(async () => ({ ...UNOWNED }));

    const response = await GET(new Request(address("job-just-enqueued", "poll"), SIGNED_IN));

    expect(response.status, "a job the queue knows is not a wrong question, so it is answered 200").toBe(200);
    expect(response.headers.get("content-type") ?? "", "the poll transport answers JSON").toContain("application/json");
    expect(await response.json(), "nothing is recorded yet and the job is not over — the snapshot says both").toEqual({ events: [], done: false });
  });

  test("AC-3: a known job with nothing recorded is streamed what the watcher says next, then closed", async () => {
    const spoken = [event(1, "started"), event(2, "succeeded")];
    seam.jobEvents.mockImplementation(async () => []);
    seam.isKnownJob.mockImplementation(async () => true);
    seam.jobScope.mockImplementation(async () => ({ ...UNOWNED }));
    seam.watchJob.mockImplementation(watcherOver(spoken));

    const response = await GET(new Request(address("job-just-enqueued"), SIGNED_IN));

    expect(response.status, "a job the queue knows is streamed rather than refused").toBe(200);
    expect(response.headers.get("content-type") ?? "", "the default transport is an event stream").toMatch(/^text\/event-stream/);
    const frames = await framesOf(response);
    expect(
      frames.map((frame) => ({ seq: frame.seq, status: frame.status })),
      "the stream carries, as `event: job` frames in seq order, exactly what the watcher yielded",
    ).toEqual(spoken.map((each) => ({ seq: each.seq, status: each.status })));
  });
});

describe("AC-1(b): the stream carries every recorded seq exactly once", () => {
  // The prior increment's law, unchanged by the door — and the cost half of the new one: a log that
  // holds something is streamed from that history, and the queue is not consulted about it. The door
  // answers `true` here on purpose, so a route that asked anyway would still answer correctly and
  // only the call assertion would catch it.
  test("AC-1(b): the recorded history reaches the subscriber even when the watcher replays none of it", async () => {
    const history = [event(1, "started"), event(2, "progress")];
    seam.jobEvents.mockImplementation(async () => [...history]);
    seam.isKnownJob.mockImplementation(async () => true);
    // A watcher that hands back only what happened after the history: the route already holds the
    // history, so what the subscriber receives cannot depend on the watcher repeating it.
    seam.watchJob.mockImplementation(watcherOver([event(3, "succeeded")]));

    const frames = await framesOf(await GET(new Request(address("job-1"), SIGNED_IN)));

    expect(
      frames.map((frame) => frame.seq),
      "history first, in seq order, then the events after it — the log the route read is what is streamed",
    ).toEqual([1, 2, 3]);
    expect(seam.isKnownJob, "a log with something in it has already answered the question, so the queue is never asked").not.toHaveBeenCalled();
  });

  test("AC-1(b): a watcher that replays the history does not make the subscriber read it twice", async () => {
    const history = [event(1, "started"), event(2, "progress")];
    seam.jobEvents.mockImplementation(async () => [...history]);
    seam.isKnownJob.mockImplementation(async () => true);
    // The runtime's own watcher replays from the beginning of the log.
    seam.watchJob.mockImplementation(watcherOver([event(1, "started"), event(2, "progress"), event(3, "succeeded")]));

    const seqs = (await framesOf(await GET(new Request(address("job-1"), SIGNED_IN)))).map((frame) => frame.seq);

    expect([...seqs].sort((left, right) => left - right), "every recorded seq reaches the subscriber").toEqual([1, 2, 3]);
    expect(new Set(seqs).size, `each seq is emitted exactly once (got ${seqs.join(", ")})`).toBe(seqs.length);
    expect(seam.isKnownJob, "a log with something in it has already answered the question, so the queue is never asked").not.toHaveBeenCalled();
  });
});

/**
 * The door's own question, which it used to ask of nobody (src/server/authorize.ts's third
 * half-guard). The log carries a workspace's drawing ids and its operators' progress, and until now
 * any signed-in caller who could name a job id read it — a live session of one workspace received
 * another's events under a 200, and an id nobody held answered 404 while somebody ELSE's answered
 * 200, which is an existence oracle over every job in the deployment.
 *
 * The cure is one answer to both questions. The job's workspace is the queue's own — it is in the
 * payload every enqueuer writes — and the caller is authorized against THAT, never against a tenant
 * from the wire. A job that is not the caller's and an id no job answers to are then the same
 * answer, byte for byte, so nothing can be learned by asking.
 */
describe("AC-5: the events door answers about the caller's own workspace, and nothing else", () => {
  const OTHERS = "11111111-1111-4111-8111-111111111111";
  const NOBODYS = "22222222-2222-4222-8222-222222222222";

  test("a job of another workspace and an id nothing answers to are the SAME answer", async () => {
    const answers: { status: number; body: unknown; type: string }[] = [];
    for (const [jobId, scope] of [
      [OTHERS, { ...OWNED }],
      [NOBODYS, null],
    ] as const) {
      seam.jobEvents.mockImplementation(async () => [event(1, "succeeded")]);
      seam.jobScope.mockImplementation(async () => scope);
      guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
      const response = await GET(new Request(address(jobId, "poll"), SIGNED_IN));
      answers.push({ status: response.status, body: await response.json(), type: response.headers.get("content-type") ?? "" });
    }
    expect(answers[0], "a job that is not yours and an id that is nobody's answer identically — the uniformity law").toEqual(answers[1]);
    expect(answers[0]?.status, "and the answer says nothing about what exists").toBe(404);
    expect(answers[0]?.body, "no event of another workspace's job reaches the caller").toEqual({ events: [], done: false, error: NO_SUCH_JOB });
  });

  test("a refused caller is never streamed, so no watcher is opened over another workspace's job", async () => {
    seam.jobEvents.mockImplementation(async () => [event(1, "started")]);
    seam.jobScope.mockImplementation(async () => ({ ...OWNED }));
    guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
    const response = await GET(new Request(address(OTHERS), SIGNED_IN));
    expect(response.status, "the stream transport answers the same refusal as the poll transport").toBe(404);
    expect(response.headers.get("content-type") ?? "", "and it is JSON, not a stream held open").toContain("application/json");
    expect(seam.watchJob, "nothing is watched on behalf of a caller who may not read the job").not.toHaveBeenCalled();
  });

  test("the guard is asked about the JOB's workspace, never about a tenant the caller wrote", async () => {
    seam.jobEvents.mockImplementation(async () => []);
    seam.jobScope.mockImplementation(async () => ({ tenantId: "tenant-a", projectId: "project-a", drawingId: "drawing-a" }));
    await GET(new Request(`${address(OTHERS, "poll")}&tenant=tenant-b`, SIGNED_IN));
    expect(guard.authorize, "the workspace, the project and the drawing the job itself names").toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-a",
      projectId: "project-a",
      drawingId: "drawing-a",
    });
  });

  test("a job that names no workspace holds nothing of anyone's and is not authorized against one", async () => {
    seam.jobEvents.mockImplementation(async () => [event(1, "succeeded")]);
    seam.jobScope.mockImplementation(async () => ({ ...UNOWNED }));
    const response = await GET(new Request(address(NOBODYS, "poll"), SIGNED_IN));
    expect(response.status, "the spine's own probe belongs to no workspace, so there is none to hold").toBe(200);
    expect(guard.authorize, "and no workspace question is asked").not.toHaveBeenCalled();
  });
});

/**
 * The subscriber's own ending. `src/ui/patterns/job-timeline/job-watch.ts` closes the EventSource on
 * the terminal frame (I-111), and a person closing a tab does the same thing less politely: the
 * consumer cancels the response stream while this route is still inside its watch. That is the
 * COMMON ending of a stream, not an exceptional one, and the route owes it silence — no fault filed
 * against an outage that never happened, and nothing thrown out of the reader that has no catch
 * above it.
 */
describe("a subscriber that goes away is an ending, not an outage", () => {
  /** Every fault the seam recorded while a case ran, whoever the sink was before it. */
  function recorder(): { faults: FaultRecord[]; restore: () => void } {
    const faults: FaultRecord[] = [];
    const previous = setFaultSink((record) => void faults.push(record));
    return { faults, restore: () => void setFaultSink(previous) };
  }

  /** A watcher that has yielded its first event and is waiting for the next one when it is stopped. */
  function watcherStoppedByAbort(first: JobEvent): (jobId: string, signal?: AbortSignal) => AsyncGenerator<JobEvent> {
    return async function* watcher(_jobId: string, signal?: AbortSignal) {
      yield first;
      await new Promise<void>((settle) => {
        if (signal === undefined || signal.aborted) {
          settle();
          return;
        }
        signal.addEventListener("abort", () => settle(), { once: true });
      });
    };
  }

  /** Let every microtask and the timer queue settle, so a rejection has somewhere to surface. */
  async function settle(): Promise<void> {
    for (let turn = 0; turn < 5; turn += 1) await new Promise((wake) => realSetTimeout(wake, 0));
  }

  test("a client that cancels the stream mid-watch files no fault and throws nothing", async () => {
    const { faults, restore } = recorder();
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown): void => void rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      seam.jobEvents.mockImplementation(async () => []);
      seam.jobScope.mockImplementation(async () => ({ ...UNOWNED }));
      seam.watchJob.mockImplementation(watcherStoppedByAbort(event(1, "started")));

      const response = await GET(new Request(address("job-1"), SIGNED_IN));
      const reader = (response.body as ReadableStream<Uint8Array>).getReader();
      const first = await reader.read();
      expect(first.done, "the subscriber reads the frame the watcher yielded").toBe(false);

      // The subscriber has what it came for and lets the stream go — the EventSource's own close,
      // and the tab's. The watch is stopped by that, and the route's loop ends the moment it is.
      await reader.cancel();
      await settle();

      expect(faults, `a routine disconnect is not an outage, and none may be filed: ${JSON.stringify(faults)}`).toEqual([]);
      expect(rejections, `nothing may be thrown at the reader that let go: ${String(rejections[0])}`).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
      restore();
    }
  });

  test("a log that fails while somebody is still listening is still the fault it always was", async () => {
    const { faults, restore } = recorder();
    try {
      seam.jobEvents.mockImplementation(async () => []);
      seam.jobScope.mockImplementation(async () => ({ ...UNOWNED }));
      seam.watchJob.mockImplementation(async function* failing() {
        yield event(1, "started");
        throw new Error("the log became unreadable");
      });

      const response = await GET(new Request(address("job-1"), SIGNED_IN));
      const body = await new Response(response.body).text();

      expect(faults.length, "the outage is recorded for the operator (ARCH-03)").toBe(1);
      expect(faults[0]?.route, "under the route that met it").toBe("GET /api/events");
      expect(body, "and the subscriber is told, with the id the record is filed under").toContain("event: fault");
      expect(body, "which is the record's own id").toContain(faults[0]?.faultId ?? "no fault was filed");
    } finally {
      restore();
    }
  });
});
