/**
 * AC-5(a) [debt-src-core-11qwnqt] and AC-5(c) [debt-src-core-1lwivug] — two ways the jobs store
 * answers for itself, neither of which needs a cluster to judge.
 *
 * (a) A first writer that finds `job_events_one_ending` already being built somewhere else sees the
 * unique violation and reports "the job log holds more than one ending for 0 job(s) — " — a fault an
 * operator is told to resolve, naming nothing to resolve. A concurrent first write is no fault at
 * all; a log that really holds two endings for a job is one, and it names the jobs. Which of the two
 * a duplicate list is, is a judgement, and a judgement is a function (B-17, ARCH-03).
 *
 * (c) pg-boss opens its pool before it checks for its schema, and a start that failed is one it will
 * not stop — but it may already have started supervising. Giving the pool back is not enough: the
 * supervisor's interval outlives the failed start and keeps the process alive. The library's own
 * `stop()` is what takes it down, and its failure is nothing to report on top of the failure being
 * answered for (R-SPINE-031, ARCH-03).
 *
 * The queue is reached without a database on purpose: `consume` asks for the queue and nothing else,
 * so this lane judges the start path with no cluster open (V-VERIFY: `pnpm test` opens no database).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setFaultSink, type FaultRecord, type FaultSink } from "../faults/report";
import * as jobsStoreModule from "./jobs";

/** The storage constraint the collision is about, named in the fault an operator reads. */
const ONE_ENDING = "job_events_one_ending";

/** What the caller must hear when the queue would not start (R-SPINE-031). */
const START_FAILED = "the job queue could not be started";

/** A url nothing connects to: no case here opens a cluster. */
const UNREACHED = "postgres://unreached.invalid:5432/none";

/** The queue shape `consume` is asked for — values a policy would carry; no case reads them back. */
const SHAPE = { concurrency: 1, retryLimit: 0, retryDelaySeconds: 1, retryBackoff: false, expireSeconds: 60 };

/** The library's handle and its stop, as each case observes them. */
const handleClose = vi.fn(async () => undefined);
const bossStop = vi.fn(async () => undefined);
const startFailure = new Error("the queue's own schema is not installed");

vi.mock("pg-boss", () => ({
  default: class {
    on(): void {
      return undefined;
    }
    async start(): Promise<void> {
      throw startFailure;
    }
    async stop(): Promise<void> {
      await bossStop();
    }
    getDb(): { close: () => Promise<void> } {
      return { close: handleClose };
    }
  },
}));

/**
 * The new export, reached through the module namespace so a store that does not yet publish it fails
 * this file's own assertion by name rather than killing its collection.
 */
const collisionOf = (jobsStoreModule as unknown as { oneEndingCollision?: (duplicated: readonly string[]) => Error | null }).oneEndingCollision;

let records: FaultRecord[] = [];
let previous: FaultSink | undefined;

beforeEach(() => {
  records = [];
  previous = setFaultSink((record) => records.push(record));
  handleClose.mockClear();
  bossStop.mockClear();
});

afterEach(() => {
  if (previous !== undefined) setFaultSink(previous);
});

describe("AC-5(a): a duplicate list is judged, not reported wholesale", () => {
  test("AC-5(a): the store exports oneEndingCollision", () => {
    expect(typeof collisionOf, "the judgement has one home the store and its tests both reach (B-17)").toBe("function");
  });

  test("AC-5(a): an empty list is no fault — a concurrent first write built the index elsewhere", () => {
    expect(
      collisionOf?.([]),
      'a unique violation with no job holding two endings is another process building the index, not a log to resolve: reporting it says "0 job(s) — " and names nothing an operator could act on (ARCH-03)',
    ).toBeNull();
  });

  test("AC-5(a): a list naming a job is a fault that names it, and the constraint it blocks", () => {
    const answered = collisionOf?.(["j1"]);
    expect(answered, "a log that really holds two endings for a job is a fault an operator must resolve (R-SPINE-030)").toBeInstanceOf(Error);
    expect((answered as Error).message, "and the fault names the job standing in the way").toContain("j1");
    expect((answered as Error).message, `and the constraint it keeps unbuilt (${ONE_ENDING})`).toContain(ONE_ENDING);
  });
});

describe("AC-5(c): a failed queue start leaves no supervisor behind", () => {
  test("AC-5(c): stop is called once, the handle is closed once, and one fault is reported", async () => {
    const store = jobsStoreModule.jobsStore(UNREACHED);

    await expect(
      store.consume("probe", SHAPE, async () => undefined),
      "a queue that would not start is this seam's failure to answer for, and the caller hears it (ARCH-03, B-21)",
    ).rejects.toThrow(START_FAILED);

    expect(bossStop, "the library's own stop is what takes the supervisor's interval down; closing the pool alone leaves it running (R-SPINE-031)").toHaveBeenCalledTimes(1);
    expect(handleClose, "and the pool the library opened before its check is still given back, exactly once").toHaveBeenCalledTimes(1);
    expect(
      records.filter((record) => record.route === "jobs/queue").length,
      "one failure is one fault: the stop's own failure is swallowed, because it is nothing to report on top of the failure being answered for (ARCH-03)",
    ).toBe(1);
  });

  test("AC-5(c): the stop happens before the handle is closed", async () => {
    const order: string[] = [];
    bossStop.mockImplementation(async () => {
      order.push("stop");
    });
    handleClose.mockImplementation(async () => {
      order.push("close");
    });
    const store = jobsStoreModule.jobsStore(UNREACHED);
    await expect(store.consume("probe", SHAPE, async () => undefined)).rejects.toThrow(START_FAILED);
    expect(order, "the supervisor is stopped while it still has a pool to stop on — a handle closed under it is a stop with nothing to speak through").toEqual(["stop", "close"]);
  });
});
