/**
 * AC-5(a)/(b)/(d) — the jobs store against a real log.
 *
 * (a) [11qwnqt] `createLog` builds `job_events_one_ending` and, on a unique violation, reports the
 * jobs standing in the way. A first write racing another process past that build sees the same
 * violation with NOTHING standing in the way, and reports "more than one ending for 0 job(s) — ": a
 * fault an operator is told to resolve, naming nothing to resolve (ARCH-03).
 * (b) [q0b6kp] on a log that already holds two endings the index is never built, so a store relying
 * on `on conflict do nothing` writes a second ending for every job afterwards. One ending per job is
 * the STORE's own predicate, and it must hold with the index unbuilt (R-SPINE-030).
 * (d) [1cxtcgi] a guarded body whose lock connection dies must not have a ROLLBACK issued on it
 * afterwards, and the caller must hear its own failure — not the driver's report of the socket.
 *
 * The log is unmade by hand exactly once, at the one place the criterion names: the index is dropped
 * and two endings are written for a job nothing else touches, so the next store finds a log the
 * constraint cannot be built over. Nothing here transcribes the log's DDL — the store makes its own
 * tables, and this file only takes the constraint away again.
 */
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { BOOTSTRAP_URL } from "../../../../db/__tests__/support/fixtures";
import { lit, run } from "../../../../db/__tests__/support/live-sql";
import { jobsStore, type JobEventDraft, type JobsStore } from "../jobs";
import { setFaultSink, type FaultRecord, type FaultSink } from "../../faults/report";

/** The log's schema, its table and the constraint this file takes away and puts back in the way. */
const JOBS_SCHEMA = "cubit_jobs";
const JOB_EVENTS = "job_events";
const ONE_ENDING = "job_events_one_ending";

/** The route a lock failure is recorded on. */
const LOCK_ROUTE = "jobs/lock";
const LOG_ROUTE = "jobs/log";

/** The job whose two endings make the constraint unbuildable, and the job the writes are judged on. */
const JOB_A = "job-a-two-endings";
const JOB_B = "job-b-one-ending";

/** The terminal statuses an ending is written under, as the seam's own roster spells them. */
const ENDED: readonly string[] = ["succeeded", "refused", "failed"];

let scratch: ScratchDb | undefined;
const opened: JobsStore[] = [];
let records: FaultRecord[] = [];
let previous: FaultSink | undefined;

beforeEach(() => {
  records = [];
  previous = setFaultSink((record) => records.push(record));
});

afterAll(async () => {
  if (previous !== undefined) setFaultSink(previous);
  for (const store of opened) await store.close().catch(() => undefined);
  await scratch?.drop();
});

/** One draft, with everything but the job and the status held constant. */
function draft(jobId: string, status: string): JobEventDraft {
  return { jobId, kind: "probe", key: `${jobId}-key`, step: "settle", status, attempt: 1, refusalCode: null, faultId: null, detail: null, elapsedMs: null };
}

let staging: Promise<ScratchDb> | undefined;

/** The migrated database, built once. Lazy and memoised, so a failure fails cases rather than skipping them. */
function staged(): Promise<ScratchDb> {
  return (staging ??= (async () => {
    scratch = await provisionScratchDb();
    return scratch;
  })());
}

/** A store on the staged database, remembered so it is closed when the file is done. */
async function store(): Promise<JobsStore> {
  const held = await staged();
  const opening = jobsStore(held.urlApp);
  opened.push(opening);
  return opening;
}

/**
 * A superuser handle on the staged database: the log's tables are made by the app role, so the role
 * that may unmake the constraint over them is the cluster's own — and only it may signal a backend.
 */
async function asSuperuser(): Promise<string> {
  const held = await staged();
  const name = held.urlApp.slice(held.urlApp.lastIndexOf("/") + 1).split("?")[0] ?? "";
  return `${BOOTSTRAP_URL.slice(0, BOOTSTRAP_URL.lastIndexOf("/"))}/${name}`;
}

/** The staged database's name, as pg_stat_activity spells it. */
async function databaseName(): Promise<string> {
  const held = await staged();
  return held.urlApp.slice(held.urlApp.lastIndexOf("/") + 1).split("?")[0] ?? "";
}

/** How many endings the log holds for one job. */
async function endingsOf(jobId: string): Promise<number> {
  const counted = run(await asSuperuser(), `select count(*)::text from ${JOBS_SCHEMA}.${JOB_EVENTS} where job_id = ${lit(jobId)} and status in (${ENDED.map(lit).join(", ")});`);
  return Number(counted[0]?.[0] ?? "0");
}

/**
 * Take the constraint away and leave a log it cannot be rebuilt over: two endings for a job nothing
 * else in this file touches. The store makes the tables; this only unmakes what a log written before
 * the constraint existed would already be missing.
 */
let unmaking: Promise<void> | undefined;

/** The same log for every case of this file: unmade once, because it is unmade for good. */
function unbuildableLog(): Promise<void> {
  return (unmaking ??= unmakeLog());
}

async function unmakeLog(): Promise<void> {
  const first = await store();
  await first.append(draft("job-warm", "started"));
  expect(records.filter((record) => record.route === LOG_ROUTE), "a fresh log builds its constraint with nothing standing in the way, and reports no fault for it (AC-5(a))").toEqual([]);

  const superuser = await asSuperuser();
  run(superuser, `drop index if exists ${JOBS_SCHEMA}.${ONE_ENDING};`);
  for (const status of ["succeeded", "failed"]) {
    run(
      superuser,
      `insert into ${JOBS_SCHEMA}.${JOB_EVENTS} (job_id, kind, key, step, status, attempt) values (${lit(JOB_A)}, 'probe', ${lit(`${JOB_A}-key`)}, 'settle', ${lit(status)}, 1);`,
    );
  }
  expect(await endingsOf(JOB_A), "the log now holds two endings for one job — the state the constraint cannot be built over (R-SPINE-030)").toBe(2);
}

describe("AC-5(b): one ending per job is the store's own predicate", () => {
  test("AC-5(b): with the index unbuildable, the second appendEnding answers null and the log holds one ending", async () => {
    await unbuildableLog();
    records.length = 0;

    const next = await store();
    const written = await next.appendEnding(draft(JOB_B, "succeeded"), ENDED);
    expect(written?.jobId, "the first ending of a job is written").toBe(JOB_B);

    const second = await next.appendEnding(draft(JOB_B, "failed"), ENDED);
    expect(
      second,
      "a job that has already ended has ended: the store's own `not exists` over the terminal statuses is what says so, and it must hold where the unique index could not be built (R-SPINE-030, B-17)",
    ).toBeNull();
    expect(await endingsOf(JOB_B), "and the log holds exactly one ending for that job").toBe(1);
  });

  test("AC-5(a): a store opening over that log reports one fault, naming the job that stands in the way", async () => {
    await unbuildableLog();
    records.length = 0;

    const next = await store();
    await next.append(draft("job-warm-2", "started"));

    const reported = records.filter((record) => record.route === LOG_ROUTE);
    expect(reported.length, "a log that really holds two endings for a job is one fault, reported once (ARCH-03)").toBe(1);
    expect(reported[0]?.cause, "and the fault names the job an operator must resolve, and the constraint it keeps unbuilt").toContain(JOB_A);
    expect(reported[0]?.cause).toContain(ONE_ENDING);
  });
});

describe("AC-5(d): a lock whose connection dies answers the caller's own failure", () => {
  test("AC-5(d): the caller hears its marker, one fault stands on jobs/lock, and close resolves", async () => {
    const held = await staged();
    const guarded = await store();
    await guarded.append(draft("job-warm-3", "started"));
    records.length = 0;

    const staledName = await databaseName();
    const marker = new Error("the guarded work's own failure");
    const caught = await guarded
      .withKeyLock("probe", "lock-dies", "request-1", async () => {
        // The lock's transaction is idle on its own connection while this body runs: killing it is
        // what the row is about — the hand ROLLBACK afterwards would be issued on a socket the
        // driver has already reported gone.
        const pids = run(
          BOOTSTRAP_URL,
          `select pid::text from pg_stat_activity where datname = ${lit(staledName)} and state = 'idle in transaction' and query ilike '%advisory%';`,
        ).map((row) => String(row[0] ?? ""));
        expect(pids.length, "the lock is held on a connection of its own, and this case can name it").toBeGreaterThan(0);
        for (const pid of pids) run(BOOTSTRAP_URL, `select pg_terminate_backend(${pid});`);
        throw marker;
      })
      .then(
        () => null,
        (failure: unknown) => failure,
      );

    expect(caught, "the caller hears the failure ITS OWN work threw — never the driver's report of a socket that closed under the lock (ARCH-03)").toBe(marker);
    expect(
      records.filter((record) => record.route === LOCK_ROUTE).length,
      "the key was unguarded for the tail of the work and that is one fault on the lock's route; a statement issued on a connection the driver already reported gone would be a second (ARCH-03, B-21)",
    ).toBe(1);

    await expect(guarded.close(), "and no body holds the pool open, so the store gives its connections back").resolves.toBeUndefined();
    expect(held.urlApp.length, "the staged database is what all of this ran against").toBeGreaterThan(0);
  }, 120_000);
});
