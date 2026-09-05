/**
 * AC-1(b) — `GET /api/events`, beside the route it judges.
 *
 * Two rules, both about what the caller can observe on the wire:
 *
 * 1. A caller that goes away is not waited for. The grace window an empty log is given belongs to
 *    the caller, so an abort settles the response rather than the deadline doing it — under fake
 *    timers the promise settles while the clock still stands well short of the window.
 * 2. The history the existence read already holds is what the stream carries first, and a seq is
 *    emitted exactly once. What `watchJob` chooses to replay is the seam's business: a watcher that
 *    hands back only the events after the history must still leave the subscriber holding the whole
 *    log, and one that replays the history must not make the subscriber read it twice.
 *
 * The seam is stubbed, never the route: SEAM-JOBS answers what a log holds, and this file only
 * decides what it answers so the route's own composition is what is judged (ARCH-02).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { JobEvent } from "../../../../core/jobs";

/** The grace an empty log is given before an id is called unknown — the window this must beat. */
const FIRST_EVENT_GRACE_MS = 3_000;

/** A real timer, captured before the fake clock takes over, so "still pending" is answerable. */
const realSetTimeout = globalThis.setTimeout;

const seam = vi.hoisted(() => ({
  jobEvents: vi.fn<(jobId: string) => Promise<JobEvent[]>>(async () => []),
  watchJob: vi.fn<(jobId: string, signal?: AbortSignal) => AsyncGenerator<JobEvent>>(),
}));

vi.mock("../../../../core/jobs", async (importOriginal) => {
  // The terminal statuses are the seam's own judgement and are kept, not restated (B-17).
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, jobEvents: seam.jobEvents, watchJob: seam.watchJob };
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

const address = (jobId: string): string => `http://127.0.0.1/api/events?jobId=${encodeURIComponent(jobId)}`;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AC-1(b): the wait belongs to the caller", () => {
  test("AC-1(b): an abort over an empty log settles the answer well inside the grace window", async () => {
    seam.jobEvents.mockImplementation(async () => []);
    seam.watchJob.mockImplementation(watcherOver([]));
    vi.useFakeTimers();

    const caller = new AbortController();
    const startedAt = Date.now();
    const answering = GET(new Request(address("job-nobody-answers-to"), { signal: caller.signal }));
    // A moment of the window spent, and then the caller goes away. Nothing advances the clock after
    // this point, so an answer that arrives at all arrived on the abort.
    await vi.advanceTimersByTimeAsync(200);
    caller.abort();

    const settled = await Promise.race([
      answering.then(() => "settled" as const),
      new Promise<"pending">((resolve) => realSetTimeout(() => resolve("pending"), 1_000)),
    ]);

    expect(settled, "the response settles when the caller goes away, rather than holding the store's window open for nobody").toBe("settled");
    expect(Date.now() - startedAt, `the answer came back inside the ${FIRST_EVENT_GRACE_MS} ms window, not at the end of it`).toBeLessThan(FIRST_EVENT_GRACE_MS);
  });
});

describe("AC-1(b): the stream carries every recorded seq exactly once", () => {
  test("AC-1(b): the recorded history reaches the subscriber even when the watcher replays none of it", async () => {
    const history = [event(1, "started"), event(2, "progress")];
    seam.jobEvents.mockImplementation(async () => [...history]);
    // A watcher that hands back only what happened after the history: the route already holds the
    // history, so what the subscriber receives cannot depend on the watcher repeating it.
    seam.watchJob.mockImplementation(watcherOver([event(3, "succeeded")]));

    const frames = await framesOf(await GET(new Request(address("job-1"))));

    expect(
      frames.map((frame) => frame.seq),
      "history first, in seq order, then the events after it — the log the existence read already holds is what is streamed",
    ).toEqual([1, 2, 3]);
  });

  test("AC-1(b): a watcher that replays the history does not make the subscriber read it twice", async () => {
    const history = [event(1, "started"), event(2, "progress")];
    seam.jobEvents.mockImplementation(async () => [...history]);
    // The runtime's own watcher replays from the beginning of the log.
    seam.watchJob.mockImplementation(watcherOver([event(1, "started"), event(2, "progress"), event(3, "succeeded")]));

    const seqs = (await framesOf(await GET(new Request(address("job-1"))))).map((frame) => frame.seq);

    expect([...seqs].sort((left, right) => left - right), "every recorded seq reaches the subscriber").toEqual([1, 2, 3]);
    expect(new Set(seqs).size, `each seq is emitted exactly once (got ${seqs.join(", ")})`).toBe(seqs.length);
  });

  test("AC-1(b): a log with nothing recorded under it is still the 404 answer, not a stream", async () => {
    seam.jobEvents.mockImplementation(async () => []);
    seam.watchJob.mockImplementation(watcherOver([]));
    vi.useFakeTimers();

    const answering = GET(new Request(address("job-nobody-answers-to")));
    await vi.advanceTimersByTimeAsync(FIRST_EVENT_GRACE_MS + 100);
    const response = await answering;

    expect(response.status, "an id nothing will ever answer to is the caller's question being wrong").toBe(404);
  });
});
