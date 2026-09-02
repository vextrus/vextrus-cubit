/**
 * Public acceptance for AC-3 (c) and the store-facing half of AC-4 (b) of the model/jobs debt
 * sweep (R-SPINE-030, R-SPINE-031, ARCH-02, ARCH-03): what the runtime says to its store, judged
 * with the store substituted.
 *
 * `jobsStore` is replaced through `vi.mock` of the db seam by a store that records every call and
 * answers nothing from a database — so the roster `jobsHealth` answers is compared with the kinds
 * the fake actually accepted `consume` for, the request id `enqueue` hands the key lock is compared
 * with the job id it answered, and the id the sweep hands the lock is compared with the claim the
 * fake answered. No connection is made, and the sweep is driven by fake timers rather than waited
 * for — its period is derived by advancing the clock until it first fires, never spelled here.
 *
 * One composed journey: the health answers and the lock ids belong to one runtime's life, started,
 * asked, closed and asked again.
 */
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setFaultSink, type FaultRecord, type FaultSink } from "../../faults/report";
import * as jobs from "../index";

/** The sentinel a promise that resolved is reported as, so a test can say "expected a rejection". */
const RESOLVED: unique symbol = Symbol("resolved");

/** The value a promise rejected with, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => RESOLVED,
    (reason: unknown) => reason,
  );

const STUB_URL = "postgres://stub:stub@127.0.0.1:1/stub";
const PROBE = "probe";
const HEALTH_ROUTE = "jobs/health";

/** The longest the sweep may go without a pass before this file declares it never runs. */
const LONGEST_SWEEP_PERIOD_MS = 60 * 60 * 1000;
const CLOCK_STEP_MS = 1000;

/** What the fake store saw and how it is told to answer. Hoisted so the mock factory can reach it. */
const stub = vi.hoisted(() => ({
  consumed: [] as string[],
  lockCalls: [] as unknown[][],
  claims: [] as { kind: string; key: string; jobId: string }[],
  pingFailure: null as Error | null,
  closeGate: null as Promise<void> | null,
  seq: 0,
}));

vi.mock("../../db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const store = {
    open: async () => undefined,
    ping: async () => {
      if (stub.pingFailure !== null) throw stub.pingFailure;
    },
    declareQueue: async () => undefined,
    consume: async (name: string) => {
      stub.consumed.push(name);
    },
    publish: async (_name: string, jobId: string) => jobId,
    queueStateOf: async () => "pending",
    withKeyLock: async (...args: unknown[]) => {
      stub.lockCalls.push(args);
      const work = args.at(-1) as () => Promise<unknown>;
      return await work();
    },
    liveJobFor: async () => null,
    liveClaims: async () => stub.claims,
    claimKey: async () => undefined,
    releaseKey: async () => undefined,
    append: async (draft: Record<string, unknown>) => ({ ...draft, seq: (stub.seq += 1), at: new Date().toISOString() }),
    appendEnding: async (draft: Record<string, unknown>) => ({ ...draft, seq: (stub.seq += 1), at: new Date().toISOString() }),
    read: async () => [],
    deadLetterRows: async () => [],
    listen: async () => undefined,
    close: async () => {
      if (stub.closeGate !== null) await stub.closeGate;
    },
  };
  return { ...actual, jobsStore: () => store };
});

const faults: FaultRecord[] = [];
let previousSink: FaultSink | undefined;

afterEach(async () => {
  stub.closeGate = null;
  stub.pingFailure = null;
  await jobs.stopJobsRuntime();
  if (previousSink !== undefined) setFaultSink(previousSink);
  vi.useRealTimers();
});

/** The lock calls whose key is `key`, each as [kind, key, requestId, work]. */
const lockCallsFor = (key: string): unknown[][] => stub.lockCalls.filter((call) => call[1] === key);

describe("AC-3 / AC-4: the runtime and its store", () => {
  test("AC-3: jobsHealth answers the roster consume accepted — ok:false unstarted, closing, or unreachable; AC-4: enqueue and the sweep hand withKeyLock the job id", async () => {
    previousSink = setFaultSink((record) => {
      faults.push(record);
    });
    vi.useFakeTimers();

    expect(await jobs.jobsHealth(), "never started: nothing is served").toEqual({ ok: false, queues: [] });

    await jobs.startJobsRuntime(STUB_URL);
    expect(stub.consumed.length, "the substituted store was asked to consume — the mock is in force").toBeGreaterThan(0);
    expect(await jobs.jobsHealth(), "started: ok, and the queues are exactly the kinds the store accepted consume for, in that order").toEqual({ ok: true, queues: [...stub.consumed] });

    // AC-4 (b): the id enqueue hands the lock is the job id it minted and answered.
    const key = `lock-id-${randomUUID()}`;
    const { jobId, deduplicated } = await jobs.enqueue(PROBE, { steps: [] }, { key });
    expect(deduplicated, "a fresh key is not a duplicate").toBe(false);
    const enqueueLock = lockCallsFor(key);
    expect(enqueueLock.length, "enqueue took the key lock once").toBe(1);
    expect(enqueueLock[0]?.[0], "…for the kind").toBe(PROBE);
    expect(enqueueLock[0]?.[2], "…handing it the freshly minted job id as the request id (withKeyLock(kind, key, requestId, work))").toBe(jobId);

    // AC-4 (b): the sweep hands the lock the claim's job id.
    const swept = { kind: PROBE, key: `swept-${randomUUID()}`, jobId: randomUUID() };
    stub.claims = [swept];
    let elapsed = 0;
    while (lockCallsFor(swept.key).length === 0 && elapsed < LONGEST_SWEEP_PERIOD_MS) {
      await vi.advanceTimersByTimeAsync(CLOCK_STEP_MS);
      elapsed += CLOCK_STEP_MS;
    }
    const sweepLock = lockCallsFor(swept.key);
    expect(sweepLock.length, `the sweep took the lock on the claim the store answered within ${LONGEST_SWEEP_PERIOD_MS}ms of clock`).toBeGreaterThan(0);
    expect(sweepLock[0]?.[2], "…handing it the claim's job id as the request id").toBe(swept.jobId);
    stub.claims = [];

    // AC-3 (c): a ping that rejects is ok:false with nothing served, and one fault on jobs/health.
    const before = faults.length;
    stub.pingFailure = new Error("the database went away");
    expect(await jobs.jobsHealth(), "unreachable: ok:false, nothing served").toEqual({ ok: false, queues: [] });
    const healthFaults = faults.slice(before).filter((record) => record.route === HEALTH_ROUTE);
    expect(healthFaults.length, `exactly one fault is recorded on ${HEALTH_ROUTE}`).toBe(1);
    stub.pingFailure = null;
    expect(await jobs.jobsHealth(), "reachable again: the same roster").toEqual({ ok: true, queues: [...stub.consumed] });

    // AC-3 (c): while closing, nothing is served.
    let openGate: () => void = () => undefined;
    stub.closeGate = new Promise<void>((settle) => {
      openGate = settle;
    });
    const stopping = jobs.stopJobsRuntime();
    expect(await jobs.jobsHealth(), "closing: ok:false, nothing served").toEqual({ ok: false, queues: [] });
    openGate();
    expect(await rejectionOf(stopping), "the stop completes").toBe(RESOLVED);
    expect(await jobs.jobsHealth(), "stopped: ok:false, nothing served").toEqual({ ok: false, queues: [] });
  });
});
