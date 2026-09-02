// @vitest-environment node
/**
 * The log's one ending per job, as the storage itself enforces it (SEAM-JOBS, R-SPINE-030, B-17):
 * writers that race past the store's existence check still cannot both land, because the terminal
 * rows share a partial unique index. A live scratch database from the db lane's harness, the store
 * opened as the managing tier, the storage read back over psql.
 *
 * The harness reads DATABASE_URL at module load for its bootstrap connection, so it is imported
 * before anything else touches the environment.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { count, lit } from "../../../db/__tests__/support/live-sql";
import { jobsStore, type JobEventDraft, type JobsStore } from "../db";
import { TERMINAL_STATUSES } from "./statuses";

const RACERS = 8;
const KIND = "probe";

let scratch: ScratchDb;
let store: JobsStore;

beforeAll(async () => {
  scratch = await provisionScratchDb();
  store = jobsStore(scratch.urlMigrate);
  await store.open({ manage: true });
}, 120_000);

afterAll(async () => {
  await store.close();
  await new Promise((settle) => setTimeout(settle, 500));
  await scratch.drop();
}, 120_000);

const draftOf = (jobId: string, key: string, status: string, step: string): JobEventDraft => ({
  jobId,
  kind: KIND,
  key,
  step,
  status,
  attempt: 1,
  refusalCode: null,
  faultId: null,
  detail: null,
  elapsedMs: null,
});

const endingsOf = (jobId: string): number =>
  count(
    scratch.urlMigrate,
    `select count(*) from cubit_jobs.job_events where job_id = ${lit(jobId)} and status in (${[...TERMINAL_STATUSES].map(lit).join(", ")})`,
  );

const claimsOf = (key: string): number => count(scratch.urlMigrate, `select count(*) from cubit_jobs.job_claims where kind = ${lit(KIND)} and key = ${lit(key)}`);

describe("appendEnding lands one terminal row per job", () => {
  test("concurrent endings for one job: one row written, one caller answered, the claim released once", async () => {
    const jobId = randomUUID();
    const key = `ending-${randomUUID()}`;
    await store.claimKey(KIND, key, jobId);
    await store.append(draftOf(jobId, key, "started", "start"));

    const answers = await Promise.all(
      Array.from({ length: RACERS }, (_, racer) => store.appendEnding(draftOf(jobId, key, racer % 2 === 0 ? "succeeded" : "failed", `racer-${racer}`), [...TERMINAL_STATUSES])),
    );

    const landed = answers.filter((answer) => answer !== null);
    expect(landed).toHaveLength(1);
    expect(endingsOf(jobId)).toBe(1);
    expect(claimsOf(key)).toBe(0);
  });

  test("an ending after one already landed writes nothing and answers null", async () => {
    const jobId = randomUUID();
    const key = `ending-${randomUUID()}`;
    await store.claimKey(KIND, key, jobId);
    await store.append(draftOf(jobId, key, "started", "start"));

    const first = await store.appendEnding(draftOf(jobId, key, "refused", "first"), [...TERMINAL_STATUSES]);
    const second = await store.appendEnding(draftOf(jobId, key, "failed", "second"), [...TERMINAL_STATUSES]);

    expect(first?.status).toBe("refused");
    expect(second).toBeNull();
    expect(endingsOf(jobId)).toBe(1);
  });

  test("the storage refuses a second ending even when the caller's ended roster misses one", async () => {
    const jobId = randomUUID();
    const key = `ending-${randomUUID()}`;
    await store.claimKey(KIND, key, jobId);

    const first = await store.appendEnding(draftOf(jobId, key, "succeeded", "first"), ["succeeded"]);
    const second = await store.appendEnding(draftOf(jobId, key, "failed", "second"), ["failed"]);

    expect(first?.status).toBe("succeeded");
    expect(second).toBeNull();
    expect(endingsOf(jobId)).toBe(1);
  });
});
