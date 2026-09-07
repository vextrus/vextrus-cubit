/**
 * AC-1 — SEAM-JOBS' one door for "is this id known to the queue" (B-17, ARCH-02).
 *
 * `isKnownJob` is asked of a live runtime, against the tree's own scratch database
 * (`db/__tests__/harness.ts`), and it is asked in the three moments that decide what "known" means:
 *
 * - the instant `enqueue` answers, before anything has been waited for. A job the queue has just
 *   been given is known, whether or not its first event has been written yet — which is the whole
 *   point of a door that asks the queue rather than the log.
 * - after that job's log has reached its terminal event. A job the queue is done with is still a job
 *   it holds a record of, archive included, so the answer does not flip when the work ends.
 * - for an id nothing was ever enqueued under, which is the only case that is false.
 *
 * Nothing here reads the route or the store: the door is driven through the name the seam publishes.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { JOBS_MODULE, productModule, uniqueKey, waitForTerminal, type DbHarness, type JobsModule } from "./support/jobs-acceptance";

/** The kind the spec builds in, so the door can be asked about a job that really exists. */
const PROBE = "probe";

/** The seam as this criterion needs it: everything SEAM-JOBS already publishes, plus the door. */
type KnownJobs = JobsModule & { isKnownJob: (jobId: string) => Promise<boolean> };

type Staged = { jobs: KnownJobs };

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

    const jobs = await productModule<KnownJobs>(JOBS_MODULE);
    await jobs.startJobsRuntime(database.urlMigrate);
    return { jobs };
  })());
}

afterAll(async () => {
  if (staging !== undefined) {
    const staged_ = await staging.catch(() => undefined);
    await staged_?.jobs.stopJobsRuntime().catch(() => undefined);
  }
  await dropDatabase?.();
}, 120_000);

describe("SEAM-JOBS: the queue's own answer to whether it knows an id", () => {
  test("AC-1: isKnownJob knows a job the moment it is enqueued, still knows it once it has ended, and knows no id nothing enqueued", async () => {
    // Asked of the published door before anything is staged, so a seam that does not offer it yet
    // fails naming the export rather than somewhere inside a database.
    const published = await productModule<Partial<KnownJobs>>(JOBS_MODULE);
    expect(
      typeof published.isKnownJob,
      `${JOBS_MODULE} must export isKnownJob(jobId) — the one home of "does the queue hold a job under this id" (B-17, SEAM-JOBS)`,
    ).toBe("function");

    const { jobs } = await staged();
    const { jobId } = await jobs.enqueue(PROBE, { steps: ["survey"] }, { key: uniqueKey("ac1-known") });

    // Read at once: the queue has the job, and the log may not have a word about it yet.
    expect(
      await jobs.isKnownJob(jobId),
      `the queue holds the job enqueue just answered with (${jobId}), so the door says so before any event has been waited for`,
    ).toBe(true);

    const events = await waitForTerminal(jobs, jobId, 180_000);
    expect(
      await jobs.isKnownJob(jobId),
      `job ${jobId} ended at ${JSON.stringify(events.at(-1)?.status ?? null)} and the queue still holds a record of it — archive included, a finished job is still a known one`,
    ).toBe(true);

    const neverEnqueued = randomUUID();
    expect(await jobs.isKnownJob(neverEnqueued), `nothing was ever enqueued under ${neverEnqueued}, so the queue knows no job by that id`).toBe(false);
  }, 300_000);
});
