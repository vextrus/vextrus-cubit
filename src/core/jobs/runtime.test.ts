// What the runtime says to its store (R-SPINE-030, R-SPINE-031, ARCH-03): judged with the store
// substituted for one that records every call, so no database is needed to see the roster the
// health answer reads, the request ids the lock is handed, the one terminal step an ending takes,
// the bound the views pass, and the sweep's guard against a second pass joining a first.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFaultSink, type FaultRecord, type FaultSink } from "../faults/report";
import { DEAD_LETTER_LIMIT, SWEEP_BATCH, deadLetters, enqueue, jobsHealth, startJobsRuntime, stopJobsRuntime } from "./index";

const STUB_URL = "postgres://stub:stub@127.0.0.1:1/stub";

/** The longest the sweep may go without a pass before this file declares it never runs. */
const LONGEST_SWEEP_PERIOD_MS = 60 * 60 * 1000;
const CLOCK_STEP_MS = 1000;

type Call = { method: string; args: unknown[] };
type Run = (job: { jobId: string; data: unknown; attempt: number }) => Promise<void>;

const stub = vi.hoisted(() => ({
  calls: [] as { method: string; args: unknown[] }[],
  runs: new Map<string, (job: { jobId: string; data: unknown; attempt: number }) => Promise<void>>(),
  claims: [] as { kind: string; key: string; jobId: string }[],
  claimsGate: null as Promise<void> | null,
  seq: 0,
}));

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const note = (method: string, ...args: unknown[]): void => {
    stub.calls.push({ method, args });
  };
  const row = (draft: Record<string, unknown>): Record<string, unknown> => ({ ...draft, seq: (stub.seq += 1), at: new Date().toISOString() });
  const store = {
    open: async (...args: unknown[]) => note("open", ...args),
    ping: async () => note("ping"),
    declareQueue: async (...args: unknown[]) => note("declareQueue", ...args),
    consume: async (name: string, _shape: unknown, run: Run) => {
      note("consume", name);
      stub.runs.set(name, run);
    },
    publish: async (_name: string, jobId: string) => jobId,
    queueStateOf: async () => "pending",
    withKeyLock: async (...args: unknown[]) => {
      note("withKeyLock", ...args.slice(0, 3));
      return await (args.at(-1) as () => Promise<unknown>)();
    },
    liveJobFor: async () => null,
    liveClaims: async (...args: unknown[]) => {
      note("liveClaims", ...args);
      if (stub.claimsGate !== null) await stub.claimsGate;
      return stub.claims;
    },
    claimKey: async (...args: unknown[]) => note("claimKey", ...args),
    releaseKey: async (...args: unknown[]) => note("releaseKey", ...args),
    append: async (draft: Record<string, unknown>) => {
      note("append", draft);
      return row(draft);
    },
    appendEnding: async (draft: Record<string, unknown>, ended: unknown) => {
      note("appendEnding", draft, ended);
      return row(draft);
    },
    read: async () => [],
    deadLetterRows: async (...args: unknown[]) => {
      note("deadLetterRows", ...args);
      return [];
    },
    listen: async () => undefined,
    close: async () => note("close"),
  };
  return { ...actual, jobsStore: () => store };
});

const faults: FaultRecord[] = [];
let previousSink: FaultSink | undefined;

afterEach(async () => {
  await stopJobsRuntime();
  if (previousSink !== undefined) setFaultSink(previousSink);
  vi.useRealTimers();
  stub.calls.length = 0;
  stub.claims = [];
  stub.claimsGate = null;
  faults.length = 0;
});

const callsTo = (method: string): Call[] => stub.calls.filter((call) => call.method === method);

/** The value a promise rejected with, or undefined when it resolved — no catch clause of the test's own. */
const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );

describe("the runtime over a recording store", () => {
  it("answers health as the kinds consume accepted, refuses an empty key before any lock, and hands the lock the ids it minted or swept", async () => {
    previousSink = setFaultSink((record) => {
      faults.push(record);
    });
    vi.useFakeTimers();
    expect(await jobsHealth()).toEqual({ ok: false, queues: [] });

    await startJobsRuntime(STUB_URL);
    const consumed = callsTo("consume").map((call) => call.args[0]);
    expect(consumed.length).toBeGreaterThan(0);
    expect(await jobsHealth()).toEqual({ ok: true, queues: consumed });
    expect(callsTo("ping").length, "ok is a round trip, made once per answer").toBe(1);

    for (const key of ["", "  \t"]) {
      const rejection = (await rejectionOf(enqueue("probe", { steps: [] }, { key }))) as Error;
      expect(rejection, JSON.stringify(key)).toBeInstanceOf(Error);
      expect(rejection.message).toContain("job key is empty");
      expect(rejection.message).toContain("recorded as fault");
    }
    expect(faults.filter((record) => record.route === "job/probe").length).toBe(2);
    expect(callsTo("withKeyLock").length, "nothing was locked or claimed for an empty key").toBe(0);
    expect(callsTo("claimKey").length).toBe(0);

    const key = `k-${randomUUID()}`;
    const { jobId, deduplicated } = await enqueue("probe", { steps: [] }, { key });
    expect(deduplicated).toBe(false);
    expect(callsTo("withKeyLock").map((call) => call.args)).toEqual([["probe", key, jobId]]);

    const swept = { kind: "probe", key: `swept-${randomUUID()}`, jobId: randomUUID() };
    stub.claims = [swept];
    let elapsed = 0;
    while (callsTo("liveClaims").length === 0 && elapsed < LONGEST_SWEEP_PERIOD_MS) {
      await vi.advanceTimersByTimeAsync(CLOCK_STEP_MS);
      elapsed += CLOCK_STEP_MS;
    }
    // The first pass reads from the start: no batch has left a cursor behind yet.
    expect(callsTo("liveClaims").map((call) => call.args)).toEqual([[expect.any(Array), SWEEP_BATCH, undefined]]);
    expect(callsTo("withKeyLock").at(-1)?.args).toEqual(["probe", swept.key, swept.jobId]);
  });

  it("does not start a second sweep while one is still under way", async () => {
    vi.useFakeTimers();
    await startJobsRuntime(STUB_URL);
    let release: () => void = () => undefined;
    stub.claimsGate = new Promise<void>((settle) => {
      release = settle;
    });
    let elapsed = 0;
    while (callsTo("liveClaims").length === 0 && elapsed < LONGEST_SWEEP_PERIOD_MS) {
      await vi.advanceTimersByTimeAsync(CLOCK_STEP_MS);
      elapsed += CLOCK_STEP_MS;
    }
    const period = elapsed;
    await vi.advanceTimersByTimeAsync(period * 3);
    expect(callsTo("liveClaims").length, "the first pass is still reading, so no second pass began").toBe(1);
    release();
    await vi.advanceTimersByTimeAsync(period);
    expect(callsTo("liveClaims").length, "once the first pass ended, the next one ran").toBe(2);
  });

  it("ends a performed job only through appendEnding, and bounds the dead-letter view", async () => {
    await startJobsRuntime(STUB_URL);
    const run = stub.runs.get("probe");
    expect(run).toBeDefined();
    const jobId = randomUUID();
    await run!({ jobId, data: { key: "k", payload: { steps: ["one"] } }, attempt: 1 });
    const appended = callsTo("append").map((call) => (call.args[0] as { status: string }).status);
    expect(appended).toEqual(["started", "progress"]);
    const endings = callsTo("appendEnding").map((call) => call.args[0] as { jobId: string; status: string });
    expect(endings).toEqual([{ jobId, status: "succeeded" }].map((ending) => expect.objectContaining(ending)));
    expect(callsTo("appendEnding")[0]?.args[1]).toEqual(expect.arrayContaining(["succeeded", "refused", "failed"]));

    await deadLetters();
    expect(callsTo("deadLetterRows").map((call) => call.args[1])).toEqual([DEAD_LETTER_LIMIT]);
    expect(DEAD_LETTER_LIMIT).toBe(200);
    expect(SWEEP_BATCH).toBe(100);
  });
});
