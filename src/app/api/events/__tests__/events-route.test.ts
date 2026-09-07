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
}));

vi.mock("../../../../core/jobs", async (importOriginal) => {
  // The terminal statuses are the seam's own judgement and are kept, not restated (B-17).
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, jobEvents: seam.jobEvents, watchJob: seam.watchJob, isKnownJob: seam.isKnownJob };
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AC-2: an id no job answers to is settled at once, over either transport", () => {
  test("AC-2: an id the queue does not know is 404 JSON on both transports, and no clock is needed to say so", async () => {
    seam.jobEvents.mockImplementation(async () => []);
    seam.isKnownJob.mockImplementation(async () => false);
    vi.useFakeTimers();

    const answers: { status: number; body: unknown }[] = [];
    for (const transport of [undefined, "poll"] as const) {
      const what = `an id no job answers to, asked ${transport === undefined ? "over the stream transport" : "over the poll transport"}`;
      const response = await answered(GET(new Request(address("job-nobody-answers-to", transport))), what);

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

    const response = await GET(new Request(address("job-just-enqueued", "poll")));

    expect(response.status, "a job the queue knows is not a wrong question, so it is answered 200").toBe(200);
    expect(response.headers.get("content-type") ?? "", "the poll transport answers JSON").toContain("application/json");
    expect(await response.json(), "nothing is recorded yet and the job is not over — the snapshot says both").toEqual({ events: [], done: false });
  });

  test("AC-3: a known job with nothing recorded is streamed what the watcher says next, then closed", async () => {
    const spoken = [event(1, "started"), event(2, "succeeded")];
    seam.jobEvents.mockImplementation(async () => []);
    seam.isKnownJob.mockImplementation(async () => true);
    seam.watchJob.mockImplementation(watcherOver(spoken));

    const response = await GET(new Request(address("job-just-enqueued")));

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

    const frames = await framesOf(await GET(new Request(address("job-1"))));

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

    const seqs = (await framesOf(await GET(new Request(address("job-1"))))).map((frame) => frame.seq);

    expect([...seqs].sort((left, right) => left - right), "every recorded seq reaches the subscriber").toEqual([1, 2, 3]);
    expect(new Set(seqs).size, `each seq is emitted exactly once (got ${seqs.join(", ")})`).toBe(seqs.length);
    expect(seam.isKnownJob, "a log with something in it has already answered the question, so the queue is never asked").not.toHaveBeenCalled();
  });
});
