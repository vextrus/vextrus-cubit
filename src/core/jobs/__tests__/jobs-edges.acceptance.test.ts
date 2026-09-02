// @vitest-environment node
/**
 * Public acceptance for AC-3 (b), AC-4 and AC-6 of the model/jobs debt sweep (SEAM-JOBS,
 * R-SPINE-030, R-SPINE-031, ARCH-02, ARCH-03, B-17): the seam's edges, live.
 *
 * A scratch database from the db lane's own harness, the runtime started against it with
 * `startJobsRuntime`, the fault sink swapped for one that keeps every record, and the storage
 * read back through psql (`cubit_jobs.job_claims`, `cubit_jobs.job_events`, `pg_stat_activity`,
 * `pg_namespace`). Two more scratch databases are provisioned where a criterion needs a database
 * this runtime does not hold connections on: one whose backends are counted after `close()`, one
 * no managing runtime ever opens.
 *
 * The harness reads DATABASE_URL at module load for its bootstrap connection, so it is imported
 * before this process is repointed. The store is reached as `jobsStore(url)` — the seam's own
 * handle, called through a loose local shape so this file typechecks against today's signatures
 * and grades tomorrow's. Staged lazily so a staging failure fails cases rather than skipping them.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { count, run } from "../../../../db/__tests__/support/live-sql";
import { codeOf } from "../../__tests__/support/read-source";
import { jobsStore } from "../../db";
import { refusalCodeOf } from "../../faults/refusal-marker";
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

const SEAM_MODULE = "src/core/db.ts";
const QUEUE_ROUTE_LITERAL = '"jobs/queue"';
const LOCK_HASH = "hashtextextended";
const PROBE = "probe";
const JOBS_SCHEMA = "cubit_jobs";
const BOSS_SCHEMA = "pgboss";
const LOCK_ROUTE = "jobs/lock";
const PROBE_ROUTE = `job/${PROBE}`;
const FAULT_RECORDED = "recorded as fault";
const KEY_EMPTY = "job key is empty";
const DEAD_LETTER_LIMIT_EXPORT = "DEAD_LETTER_LIMIT";
const DEAD_LETTER_LIMIT_VALUE = 200;

/** How long a job is given to reach its ending; a wait bounded by R-SPINE-030's own promise. */
const TERMINAL_BUDGET_MS = 90_000;
/** Longer than the queue's poll, so a job nobody consumes has had every chance to be picked up. */
const NOBODY_CONSUMES_MS = 2_000;
/** The criterion's own bound on `close()` giving every backend back. */
const BACKENDS_GONE_MS = 5_000;
/** A step slow enough that a second enqueue of the key lands while the first job is still live. */
const SLOW_STEP_MS = 1_500;

/** The store's surface as the criteria spell it, loose so today's signatures do not type-fail this file. */
type Draft = {
  jobId: string;
  kind: string;
  key: string;
  step: string;
  status: string;
  attempt: number;
  refusalCode: string | null;
  faultId: string | null;
  detail: Record<string, unknown> | null;
  elapsedMs: number | null;
};
type Store = {
  open(options: { manage: boolean }): Promise<void>;
  close(): Promise<void>;
  withKeyLock(kind: string, key: string, requestId: string, work: () => Promise<unknown>): Promise<unknown>;
  append(draft: Draft): Promise<unknown>;
};
const storeOver = (url: string): Store => jobsStore(url) as unknown as Store;

/** The seam's surface as this file reads it, including the export today's barrel lacks. */
const seam = jobs as unknown as Record<string, unknown>;

type Stage = { primary: ScratchDb; faults: FaultRecord[] };

const provisioned: ScratchDb[] = [];
let previousSink: FaultSink | undefined;
let staging: Promise<Stage> | undefined;

const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const primary = await provisionScratchDb();
    provisioned.push(primary);
    process.env["DATABASE_URL"] = primary.urlMigrate;
    const faults: FaultRecord[] = [];
    previousSink = setFaultSink((record) => {
      faults.push(record);
    });
    await jobs.startJobsRuntime(primary.urlMigrate);
    return { primary, faults };
  })());

/** A scratch database of this file's own, dropped with the rest. */
async function anotherScratch(): Promise<ScratchDb> {
  const scratch = await provisionScratchDb();
  provisioned.push(scratch);
  return scratch;
}

afterAll(async () => {
  await jobs.stopJobsRuntime().then(
    () => undefined,
    () => undefined,
  );
  if (previousSink !== undefined) setFaultSink(previousSink);
  await new Promise((settle) => setTimeout(settle, 500));
  for (const scratch of provisioned) await scratch.drop();
}, 120_000);

const uniqueKey = (label: string): string => `${label}-${randomUUID()}`;

async function waitUntil(holds: () => Promise<boolean>, what: string, budgetMs: number, everyMs = 150): Promise<void> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (await holds()) return;
    if (Date.now() >= deadline) throw new Error(`waited ${budgetMs}ms and ${what} never happened`);
    await new Promise((settle) => setTimeout(settle, everyMs));
  }
}

/** The job's whole log once it has ended — a wait R-SPINE-030 makes legitimate. */
async function waitForTerminal(jobId: string): Promise<jobs.JobEvent[]> {
  let events: jobs.JobEvent[] = [];
  await waitUntil(
    async () => {
      events = await jobs.jobEvents(jobId);
      const last = events.at(-1);
      return last !== undefined && jobs.TERMINAL_STATUSES.has(last.status);
    },
    `job ${jobId} reached a terminal event`,
    TERMINAL_BUDGET_MS,
  );
  return events;
}

const claimsFor = (url: string, key: string): number => count(url, `select count(*) from ${JOBS_SCHEMA}.job_claims where kind = '${PROBE}' and key = '${key.replaceAll("'", "''")}';`);

/** Backends on this database other than the session asking. */
const otherBackends = (url: string): number => count(url, "select count(*) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid();");

/** Occurrences of a needle in a haystack. */
const occurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe("AC-3: one spelling each for the queue route and the lock hash", () => {
  test("AC-3: db.ts spells \"jobs/queue\" once and hashtextextended once, and the key lock still serialises two concurrent enqueues of one key into one job", async () => {
    const { primary } = await staged();
    const code = codeOf(SEAM_MODULE, "the jobs storage lives in the db seam");
    expect(occurrences(code, QUEUE_ROUTE_LITERAL), `${SEAM_MODULE} spells ${QUEUE_ROUTE_LITERAL} exactly once (one const, used as request id and route)`).toBe(1);
    expect(occurrences(code, LOCK_HASH), `${SEAM_MODULE} spells ${LOCK_HASH} exactly once — the state lock and the key lock share it`).toBe(1);

    const key = uniqueKey("dedup");
    const payload = { steps: ["one", "two"], stepDelayMs: SLOW_STEP_MS };
    const [first, second] = await Promise.all([jobs.enqueue(PROBE, payload, { key }), jobs.enqueue(PROBE, payload, { key })]);
    const kept = [first, second].filter((result) => !result.deduplicated);
    const folded = [first, second].filter((result) => result.deduplicated);
    expect(kept.length, "exactly one of two concurrent enqueues of one key made a job").toBe(1);
    expect(folded.length, "…and the other was answered as its duplicate").toBe(1);
    expect(folded[0]?.jobId, "the duplicate names the job that was made").toBe(kept[0]?.jobId);
    const events = await waitForTerminal(kept[0]?.jobId ?? "");
    expect(events.at(-1)?.status, "the one job ran to its ending").toBe("succeeded");
    expect(claimsFor(primary.urlMigrate, key), "the key's claim is released with the ending").toBe(0);
  });
});

describe("AC-4: enqueue, lock and close at their edges", () => {
  test("AC-4: an empty or blank key is refused naming `job key is empty`, with one fault on job/probe and no claim", async () => {
    const { primary, faults } = await staged();
    for (const key of ["", "   "]) {
      const before = faults.length;
      const rejection = await rejectionOf(jobs.enqueue(PROBE, { steps: ["one"] }, { key }));
      expect(rejection, `enqueue with key ${JSON.stringify(key)} must reject`).not.toBe(RESOLVED);
      expect(rejection, "…with an Error").toBeInstanceOf(Error);
      expect((rejection as Error).message, "…naming what was wrong").toContain(KEY_EMPTY);
      expect(refusalCodeOf(rejection), "an empty key is a caller defect recorded as a fault, not a refusal").toBeNull();
      const recorded = faults.slice(before).filter((record) => record.route === PROBE_ROUTE);
      expect(recorded.length, `exactly one fault is recorded on ${PROBE_ROUTE} for key ${JSON.stringify(key)}`).toBe(1);
      expect(claimsFor(primary.urlMigrate, key), `${JOBS_SCHEMA}.job_claims gains no row for key ${JSON.stringify(key)}`).toBe(0);
    }
  });

  test("AC-4: withKeyLock on a closed store rejects `recorded as fault` under the caller's own request id on jobs/lock", async () => {
    const { primary, faults } = await staged();
    const store = storeOver(primary.urlMigrate);
    await store.close();
    const before = faults.length;
    let reached = false;
    const rejection = await rejectionOf(
      store.withKeyLock(PROBE, "k", "req-1", async () => {
        reached = true;
        return "unreached";
      }),
    );
    expect(rejection, "a lock that cannot be taken rejects").not.toBe(RESOLVED);
    expect(rejection, "…with an Error").toBeInstanceOf(Error);
    expect((rejection as Error).message, "…naming the fault it was recorded as").toContain(FAULT_RECORDED);
    expect(reached, "the guarded work never ran").toBe(false);
    const lockFaults = faults.slice(before).filter((record) => record.route === LOCK_ROUTE);
    expect(lockFaults.length, `exactly one fault on ${LOCK_ROUTE}`).toBe(1);
    expect(lockFaults[0]?.requestId, "the fault carries the caller's request id, not a name of the lock's own").toBe("req-1");
  });

  test("AC-4: close() on a store whose managing open is still in flight resolves and gives every backend back within 5 s", async () => {
    await staged();
    const own = await anotherScratch();
    const store = storeOver(own.urlMigrate);
    const opening = store.open({ manage: true }).then(
      () => "resolved",
      (failure: unknown) => failure,
    );
    expect(await rejectionOf(store.close()), "close() resolves while the open is in flight").toBe(RESOLVED);
    await waitUntil(async () => otherBackends(own.urlMigrate) === 0, `every backend on the scratch database was given back (last count ${otherBackends(own.urlMigrate)})`, BACKENDS_GONE_MS, 250);
    expect(otherBackends(own.urlMigrate), "no backend but the prober's own remains").toBe(0);
    // Waited for, not cut off: close() awaits the start still in flight and only then stops it, so
    // the open completes and the storage it was provisioning is there when everything is quiet.
    expect(await opening, "the open that was in flight completed rather than failing on pools ended under it").toBe("resolved");
    expect(count(own.urlMigrate, `select count(*) from pg_namespace where nspname = '${BOSS_SCHEMA}';`), `the managing open provisioned ${BOSS_SCHEMA} before close() stopped it`).toBe(1);
  });

  test("AC-4: a succeeded job's claim is gone, and deadLetters answers at most DEAD_LETTER_LIMIT entries, dropping the oldest", async () => {
    const { primary } = await staged();
    const key = uniqueKey("released");
    const { jobId } = await jobs.enqueue(PROBE, { steps: ["one"] }, { key });
    const events = await waitForTerminal(jobId);
    expect(events.at(-1)?.status, "the probe succeeded").toBe("succeeded");
    expect(claimsFor(primary.urlMigrate, key), `${JOBS_SCHEMA}.job_claims holds no row for a job that ended`).toBe(0);

    const limit = seam[DEAD_LETTER_LIMIT_EXPORT];
    expect(limit, `src/core/jobs/index.ts exports ${DEAD_LETTER_LIMIT_EXPORT} = ${DEAD_LETTER_LIMIT_VALUE}`).toBe(DEAD_LETTER_LIMIT_VALUE);
    const bound = limit as number;

    const store = storeOver(primary.urlMigrate);
    const failedIds: string[] = [];
    for (let i = 0; i <= bound; i += 1) {
      const failedId = randomUUID();
      failedIds.push(failedId);
      await store.append({
        jobId: failedId,
        kind: PROBE,
        key: uniqueKey("dead"),
        step: "finish",
        status: "failed",
        attempt: 1,
        refusalCode: null,
        faultId: randomUUID(),
        detail: { cause: `Error: appended failure ${i}` },
        elapsedMs: 1,
      });
    }
    await store.close();

    const dead = await jobs.deadLetters();
    expect(dead.length, `deadLetters answers at most ${DEAD_LETTER_LIMIT_EXPORT} entries`).toBeLessThanOrEqual(bound);
    const listed = new Set(dead.map((entry) => entry.jobId));
    expect(listed.has(failedIds[0] ?? ""), "the oldest of the appended failures is the one absent").toBe(false);
    expect(listed.has(failedIds.at(-1) ?? ""), "the newest of them is present").toBe(true);
  });
});

describe("AC-6: tiers and rollback", () => {
  test("AC-6: a consumer-free runtime enqueues against a provisioned database and never migrates an unprovisioned one", async () => {
    const { primary } = await staged();
    await jobs.stopJobsRuntime();
    process.env["DATABASE_URL"] = primary.urlMigrate;

    const key = uniqueKey("consumer-free");
    const { jobId, deduplicated } = await jobs.enqueue(PROBE, { steps: ["one"] }, { key });
    expect(deduplicated, "a fresh key on a consumer-free runtime makes a job").toBe(false);
    await new Promise((settle) => setTimeout(settle, NOBODY_CONSUMES_MS));
    const unconsumed = await jobs.jobEvents(jobId);
    expect(unconsumed.map((event) => event.status), "nothing consumes on a consumer-free tier, so the log holds no `started`").not.toContain("started");

    await jobs.startJobsRuntime(primary.urlMigrate);
    const events = await waitForTerminal(jobId);
    expect(events.at(-1)?.status, "once a worker starts, the job runs to its ending").toBe("succeeded");

    await jobs.stopJobsRuntime();
    const unopened = await anotherScratch();
    process.env["DATABASE_URL"] = unopened.urlMigrate;
    const rejection = await rejectionOf(jobs.enqueue(PROBE, { steps: ["one"] }, { key: uniqueKey("unprovisioned") }));
    expect(rejection, "against a database no managing runtime ever opened, the enqueue fails honestly").not.toBe(RESOLVED);
    expect(rejection, "…with a plain Error").toBeInstanceOf(Error);
    expect(refusalCodeOf(rejection), "…that is a fault, not a refusal").toBeNull();
    expect((rejection as Error).message, "…naming the fault it was recorded as").toContain(FAULT_RECORDED);
    expect(count(unopened.urlMigrate, `select count(*) from pg_namespace where nspname = '${BOSS_SCHEMA}';`), `the queue library's migration ran on no tier but the managing one: no ${BOSS_SCHEMA} schema`).toBe(0);

    await jobs.stopJobsRuntime();
    process.env["DATABASE_URL"] = primary.urlMigrate;
    await jobs.startJobsRuntime(primary.urlMigrate);
  });

  test("AC-6: a failed ROLLBACK under withKeyLock is reported once on jobs/lock and the guarded failure is rethrown as-is", async () => {
    const { faults } = await staged();
    const own = await anotherScratch();
    const store = storeOver(own.urlMigrate);
    const marker = Object.assign(new Error("the guarded work refused"), { refusalCode: "FIXTURE_MISSING" });
    const before = faults.length;

    const rejection = await rejectionOf(
      store.withKeyLock(PROBE, uniqueKey("rollback"), randomUUID(), async () => {
        run(own.urlMigrate, "select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid();");
        throw marker;
      }),
    );
    expect(rejection, "the guarded failure is the rejection — the same object, not a wrapper and not the ROLLBACK's failure").toBe(marker);
    const lockFaults = faults.slice(before).filter((record) => record.route === LOCK_ROUTE);
    expect(lockFaults.length, `the failed ROLLBACK is recorded exactly once on ${LOCK_ROUTE}`).toBe(1);
    await store.close();
  });
});
