/**
 * Public acceptance for SEAM-JOBS (R-SPINE-030, R-SPINE-031, SEAM-JOBS, ARCH-03): AC-1 … AC-4.
 *
 * Everything here is driven through the names the increment's interface list publishes — `enqueue`,
 * `jobEvents`, `deadLetters`, `startJobsRuntime`, `JOB_KINDS`, the `/api/events` route handler and
 * the worker entrypoint. No implementation file is read, and no policy number is spelled: the retry
 * limit, the retry delay and the concurrency all come out of `JOB_KINDS`, which the spec exports
 * "so acceptance reads policy, never re-spells it". A later increment that raises a limit therefore
 * moves this suite with it instead of reddening it (B-19).
 *
 * The database is the tree's own scratch harness (`db/__tests__/harness.ts`, ARCH-02) and the seam
 * is started against `urlMigrate` — SEAM-JOBS' storage is runtime-managed, so the owner of the
 * database is the role that may create it.
 *
 * READING RECORDED HERE: AC-1 asks for "one attempt-1 `started`" and AC-2 counts fault records in
 * *this* process through `setFaultSink`, so `startJobsRuntime(url)` is read as starting a runtime
 * that also *runs* the registered kinds in the calling process; the separate worker process
 * (AC-3) is the same runtime in its own process, not the only place work can happen.
 *
 * The suite stages once, lazily and memoised, and every test awaits that staging as its first line:
 * a `beforeAll` that throws leaves every test skipped, and a skipped test judges no criterion.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  atMs,
  EVENTS_ROUTE_MODULE,
  eventIdentity,
  freePort,
  isTerminal,
  jobFrames,
  JOBS_MODULE,
  productModule,
  readEventStream,
  spawnWorker,
  startsOf,
  TERMINAL_STATUSES,
  uniqueKey,
  waitForTerminal,
  type DbHarness,
  type EventsRoute,
  type FaultRecord,
  type FaultsModule,
  type JobEvent,
  type JobsModule,
} from "./support/jobs-acceptance";

/** The kind the spec builds in so every path can be driven end to end. */
const PROBE = "probe";

/**
 * Slack on the clock. The scheduler's floor is a real floor, so a gap may sit only a tick under it;
 * ordering between two scheduled delays is coarser, because the queue is polled. Both are named
 * here rather than sprinkled through the assertions, and neither is a sub-millisecond margin.
 */
const FLOOR_SLACK_MS = 100;
const ORDER_SLACK_MS = 500;

/** Long enough that a second enqueue lands while the first job is still queued-or-active. */
const SLOW_STEP_MS = 1200;

type Staged = { jobs: JobsModule; databaseUrl: string };

let dropDatabase: (() => Promise<void>) | undefined;
let staging: Promise<Staged> | undefined;

/** Provision, point the environment at it, start the runtime — once, however many tests ask. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    // The harness reads DATABASE_URL at module load for its bootstrap connection, so it is imported
    // before this process is repointed at the database it is about to make.
    const harness = await productModule<DbHarness>("db/__tests__/harness.ts");
    const database = await harness.provisionScratchDb();
    dropDatabase = database.drop;
    process.env["DATABASE_URL"] = database.urlMigrate;

    const jobs = await productModule<JobsModule>(JOBS_MODULE);
    for (const name of ["JOB_KINDS", "enqueue", "jobEvents", "deadLetters", "startJobsRuntime", "stopJobsRuntime"]) {
      expect(jobs[name as keyof JobsModule], `${JOBS_MODULE} must export \`${name}\` (SEAM-JOBS' declared interface)`).toBeDefined();
    }
    await jobs.startJobsRuntime(database.urlMigrate);
    return { jobs, databaseUrl: database.urlMigrate };
  })());
}

afterAll(async () => {
  if (staging !== undefined) {
    const { jobs } = await staging.catch(() => ({ jobs: undefined as JobsModule | undefined }));
    await jobs?.stopJobsRuntime().catch(() => undefined);
  }
  await dropDatabase?.();
}, 120_000);

/** The policy for one kind, read from the seam — never transcribed into this file. */
function policyFor(jobs: JobsModule, kind: string) {
  const policy = jobs.JOB_KINDS[kind];
  expect(policy, `JOB_KINDS must carry \`${kind}\`, the kind the spec builds in`).toBeDefined();
  for (const field of ["concurrency", "retryLimit", "retryDelaySeconds"] as const) {
    expect(typeof policy?.[field], `JOB_KINDS.${kind}.${field} must be a number acceptance can read`).toBe("number");
  }
  return policy!;
}

/** Every event of a job, in the order the log holds them, with the seq order it claims. */
function expectSeqOrder(events: readonly JobEvent[], what: string): void {
  const seqs = events.map((event) => event.seq);
  expect(seqs.length, `${what} recorded no events at all — a job never runs silently (R-SPINE-030)`).toBeGreaterThan(0);
  for (let i = 1; i < seqs.length; i += 1) {
    expect(seqs[i]! > seqs[i - 1]!, `${what} is not in seq order: ${seqs.join(", ")}`).toBe(true);
  }
}

describe("SEAM-JOBS: the typed, idempotent queue and its event log", () => {
  test("AC-1: enqueue answers a jobId, a duplicate key while queued-or-active answers the same job once", async () => {
    const { jobs } = await staged();
    const key = uniqueKey("ac1");
    const payload = { steps: ["survey", "settle"], stepDelayMs: SLOW_STEP_MS };

    const first = await jobs.enqueue(PROBE, payload, { key });
    expect(typeof first.jobId, "enqueue must answer a jobId (SEAM-JOBS)").toBe("string");
    expect(first.jobId.length, "the jobId enqueue answers must not be empty").toBeGreaterThan(0);
    expect(first.deduplicated, "the first enqueue of a key deduplicated nothing").toBe(false);

    // Still queued-or-active: the job has at least two slow steps ahead of it.
    const second = await jobs.enqueue(PROBE, payload, { key });
    expect(second.jobId, "a second enqueue on a queued-or-active key must answer the FIRST job's id").toBe(first.jobId);
    expect(second.deduplicated, "the duplicate must be answered with deduplicated: true").toBe(true);

    const events = await waitForTerminal(jobs, first.jobId, 90_000);
    expectSeqOrder(events, `job ${first.jobId}`);
    expect(events.at(-1)?.status, "a probe with no forced failure or refusal ends succeeded").toBe("succeeded");
    for (const event of events) {
      expect(event.kind, "every event names the kind it belongs to").toBe(PROBE);
      expect(event.key, "every event names the key it was enqueued under").toBe(key);
      expect(event.jobId, "every event names its job").toBe(first.jobId);
    }

    const starts = startsOf(events);
    expect(starts.length, "the deduplicated pair is ONE execution, so the log holds one `started`").toBe(1);
    expect(starts[0]?.attempt, "that one execution is attempt 1").toBe(1);
  }, 180_000);

  test("AC-2: a forced failure retries to the policy's limit, dead-letters, and reports exactly one fault", async () => {
    const { jobs } = await staged();
    const faults = await productModule<FaultsModule>("src/core/faults/report.ts");
    const policy = policyFor(jobs, PROBE);
    const key = uniqueKey("ac2-fail");

    const records: FaultRecord[] = [];
    const previousSink = faults.setFaultSink((record) => records.push(record));
    try {
      const { jobId } = await jobs.enqueue(PROBE, { steps: ["survey", "settle"], failAtStep: "settle" }, { key });
      const events = await waitForTerminal(jobs, jobId, 240_000);

      const starts = startsOf(events);
      const owedAttempts = 1 + policy.retryLimit;
      expect(starts.length, `a failing job is attempted 1 + retryLimit (${owedAttempts}) times`).toBe(owedAttempts);
      expect(
        starts.map((event) => event.attempt),
        "the attempts are numbered 1..1+retryLimit, in order",
      ).toEqual(Array.from({ length: owedAttempts }, (_unused, index) => index + 1));

      const gaps: number[] = [];
      for (let i = 1; i < starts.length; i += 1) gaps.push(atMs(starts[i]!) - atMs(starts[i - 1]!));
      const floorMs = policy.retryDelaySeconds * 1000;
      for (const gap of gaps) {
        expect(gap, `every retry waits at least retryDelaySeconds (${policy.retryDelaySeconds}s); gaps were ${gaps.join(", ")}ms`).toBeGreaterThanOrEqual(floorMs - FLOOR_SLACK_MS);
      }
      for (let i = 1; i < gaps.length; i += 1) {
        expect(gaps[i]!, `backoff means the gaps do not shrink; gaps were ${gaps.join(", ")}ms`).toBeGreaterThanOrEqual(gaps[i - 1]! - ORDER_SLACK_MS);
      }

      const last = events.at(-1)!;
      expect(last.status, "a job that ran out of retries ends failed").toBe("failed");
      expect(last.refusalCode, "a failure is not a refusal, so it carries no refusal code").toBeNull();
      expect(last.faultId, "a non-refusal terminal failure carries the faultId ARCH-03 recorded — a job never fails silently").not.toBeNull();

      const letters = await jobs.deadLetters();
      const letter = letters.find((entry) => entry.jobId === jobId);
      expect(letter, `the exhausted job ${jobId} must appear in deadLetters(); it held ${JSON.stringify(letters.map((l) => l.jobId))}`).toBeDefined();
      expect(letter?.kind, "the dead letter names the kind").toBe(PROBE);
      expect(letter?.key, "the dead letter names the key").toBe(key);
      expect(typeof letter?.cause, "the dead letter carries the cause the operator reads").toBe("string");
      expect((letter?.cause ?? "").length, "the dead letter's cause is not empty").toBeGreaterThan(0);

      expect(
        records.filter((record) => record.faultId === last.faultId).length,
        "exactly one FaultRecord carrying the job's faultId reached the sink",
      ).toBe(1);
      expect(records.length, `only that one fault was reported while the job ran; the sink saw ${JSON.stringify(records.map((r) => r.cause))}`).toBe(1);
    } finally {
      faults.setFaultSink(previousSink);
    }
  }, 300_000);

  test("AC-2: a named refusal ends refused, dead-letters, and is not a fault", async () => {
    const { jobs } = await staged();
    const faults = await productModule<FaultsModule>("src/core/faults/report.ts");
    const errors = await productModule<{ REFUSALS: Readonly<Record<string, unknown>> }>("src/core/errors.ts");
    // Any code the registry holds is "a code registered in REFUSALS" — read from the registry so a
    // renamed or added code cannot leave this test asserting a string nothing answers to.
    const code = Object.keys(errors.REFUSALS)[0];
    expect(code, "the refusal registry must hold at least one code for a probe to refuse with").toBeDefined();
    const key = uniqueKey("ac2-refuse");

    const records: FaultRecord[] = [];
    const previousSink = faults.setFaultSink((record) => records.push(record));
    try {
      const { jobId } = await jobs.enqueue(PROBE, { steps: ["survey"], refuseWith: code }, { key });
      const events = await waitForTerminal(jobs, jobId, 240_000);
      const last = events.at(-1)!;

      expect(last.status, "a probe told to refuse ends refused, not failed").toBe("refused");
      expect(last.refusalCode, "the refusal carries the registered code it was told to answer with").toBe(code);
      expect(last.faultId, "a refusal is not a fault, so it carries no faultId (B-21)").toBeNull();

      const letters = await jobs.deadLetters();
      expect(
        letters.some((entry) => entry.jobId === jobId),
        `the refused job ${jobId} must appear in deadLetters()`,
      ).toBe(true);

      expect(records, `a refusal reports no fault; the sink saw ${JSON.stringify(records.map((r) => r.cause))}`).toEqual([]);
    } finally {
      faults.setFaultSink(previousSink);
    }
  }, 300_000);

  test("AC-4: /api/events serves the same log as an SSE stream and as a poll snapshot", async () => {
    const { jobs } = await staged();
    const route = await productModule<EventsRoute>(EVENTS_ROUTE_MODULE);
    expect(typeof route.GET, `${EVENTS_ROUTE_MODULE} must export a GET handler`).toBe("function");

    const ask = async (jobId: string, transport?: "poll"): Promise<Response> =>
      await route.GET(new Request(`http://127.0.0.1/api/events?jobId=${encodeURIComponent(jobId)}${transport === undefined ? "" : `&transport=${transport}`}`));

    // A job no SSE client ever attaches to — the polling fallback must stand on its own.
    const polled = await jobs.enqueue(PROBE, { steps: ["survey", "settle"], stepDelayMs: 50 }, { key: uniqueKey("ac4-poll") });
    const polledEvents = await waitForTerminal(jobs, polled.jobId, 120_000);

    const pollAnswer = await ask(polled.jobId, "poll");
    expect(pollAnswer.status, "the poll fallback answers 200").toBe(200);
    expect(pollAnswer.headers.get("content-type") ?? "", "the poll fallback answers JSON").toContain("application/json");
    const snapshot = (await pollAnswer.json()) as { events: JobEvent[]; done: boolean };
    expect(Array.isArray(snapshot.events), "the poll answer carries an `events` array").toBe(true);
    expect(snapshot.events.map(eventIdentity), "the poll answer is the job's log, in seq order").toEqual(polledEvents.map(eventIdentity));
    expect(snapshot.done, "after the terminal event the poll answer is done").toBe(true);

    // A subscriber that attaches while the job is still running: it must end when the job does.
    const streamed = await jobs.enqueue(PROBE, { steps: ["survey", "settle", "sign"], stepDelayMs: 300 }, { key: uniqueKey("ac4-sse") });
    const live = await ask(streamed.jobId);
    expect(live.status, "the stream answers 200").toBe(200);
    expect(live.headers.get("content-type") ?? "", "the default transport is an event stream").toContain("text/event-stream");
    const liveRead = await readEventStream(live, 120_000);
    expect(liveRead.closed, "the stream closes itself after the terminal event, rather than being cancelled by its reader").toBe(true);
    const liveEvents = jobFrames(liveRead.frames);
    const streamedLog = await jobs.jobEvents(streamed.jobId);
    expectSeqOrder(liveEvents, `the frames of job ${streamed.jobId}`);
    expect(liveEvents.map(eventIdentity), "the `event: job` frames are the job's events, in seq order").toEqual(streamedLog.map(eventIdentity));
    expect(isTerminal(liveEvents.at(-1)), "the last frame the stream sent is the terminal event").toBe(true);

    // A subscriber attaching after the fact is owed the whole history, then the close.
    const backfill = await ask(streamed.jobId);
    expect(backfill.headers.get("content-type") ?? "", "the same route answers a late subscriber with a stream too").toContain("text/event-stream");
    const backfillRead = await readEventStream(backfill, 60_000);
    expect(backfillRead.closed, "a stream over an already-finished job closes after the history").toBe(true);
    expect(jobFrames(backfillRead.frames).map(eventIdentity), "a late subscriber receives the full history first").toEqual(streamedLog.map(eventIdentity));
  }, 300_000);

  test("AC-3: the worker is a separate process with a health endpoint, and drains on SIGTERM", async () => {
    const { jobs, databaseUrl } = await staged();
    const healthPort = await freePort();
    const worker = spawnWorker(databaseUrl, healthPort);
    try {
      await worker.waitForLine("worker: ready", 120_000);

      const health = await fetch(`http://127.0.0.1:${healthPort}/health`);
      expect(health.status, "the worker's health endpoint answers 200 (R-SPINE-031)").toBe(200);
      const reported = (await health.json()) as { ok: boolean; queues: string[] };
      expect(reported.ok, "a healthy worker answers ok: true").toBe(true);
      expect(Array.isArray(reported.queues), "the health answer lists the queues this worker serves").toBe(true);
      // The rule, not today's roster: a worker serves every kind the seam registers, "probe"
      // among them. Read off JOB_KINDS, so a kind added later is covered without editing this line.
      expect(reported.queues, "the worker's health answer lists every kind the seam registers").toEqual(expect.arrayContaining(Object.keys(jobs.JOB_KINDS)));
      expect(Object.keys(jobs.JOB_KINDS), "the built-in probe kind is one of them").toContain(PROBE);

      const { jobId } = await jobs.enqueue(PROBE, { steps: ["survey", "settle"], stepDelayMs: 50 }, { key: uniqueKey("ac3") });
      const events = await waitForTerminal(jobs, jobId, 180_000);
      expect(events.at(-1)?.status, "a probe enqueued while the worker runs reaches a terminal succeeded event").toBe("succeeded");
      expect(TERMINAL_STATUSES.has(events.at(-1)!.status), "the last event is terminal").toBe(true);

      worker.kill("SIGTERM");
      await worker.waitForLine("worker: draining", 60_000);
      await worker.waitForLine("worker: shutdown complete", 120_000);
      const output = worker.output();
      expect(
        output.indexOf("worker: draining") < output.indexOf("worker: shutdown complete"),
        `the worker drains before it reports shutdown; it said: ${output.slice(-600)}`,
      ).toBe(true);
      expect(await worker.exited(), "a drained worker exits 0").toBe(0);
    } finally {
      worker.kill("SIGKILL");
      await worker.exited();
    }
  }, 420_000);
});
