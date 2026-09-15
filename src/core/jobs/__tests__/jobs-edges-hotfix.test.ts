// @vitest-environment node
/**
 * HOTFIX inc-hotfix-20260914-1914: db/__tests__/psql-pool.test.ts:252-260 — the pooled session's freshness check asked pg_locks cluster-wide, so an advisory lock any other file of the database lane held on its own scratch database answered for this session and reddened the lane.
 *
 * The red was the lane's, never the file's: every suite in the database lane provisions its own
 * scratch database and runs beside seven others, and `pg_locks` is one view over the whole cluster —
 * an advisory lock is listed there with the database it belongs to, so a lock taken on ANY database
 * is counted by a reader that does not say whose lock it wants. The jobs seam takes one on every
 * enqueue (`withKeyLock`, src/core/db/jobs.ts), the tenant seam's trigger takes one per project, and
 * the drift lock takes one for the whole lane; whenever one of them was held while the pool's own
 * suite asked whether the last script had left an advisory lock behind, the answer was `f` and the
 * lane failed on a file that had done nothing wrong. Alone, nothing else was running, and the same
 * question answered `t` — which is why the red moved between files and looked like flakiness.
 *
 * Staged as a STATE, deterministically, never as a second run of a suite: two scratch databases from
 * the lane's own harness, the seam holding its advisory lock on the first while the pooled session on
 * the second is asked what it carries. The answer asserted here is the pool's own promise — "each
 * script gets a session that looks freshly connected" — read through the one spelling of the question
 * the pool publishes (`SESSION_LEAVINGS`, db/__tests__/support/psql-pool.ts), so a reader that goes
 * back to asking the cluster reds this case rather than a bystander.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { psql } from "../../../../db/__tests__/support/live-sql";
import { SESSION_LEAVINGS, SESSION_LEAVINGS_MADE } from "../../../../db/__tests__/support/psql-pool";
import { jobsStore } from "../../db";

/** Provisioning two databases and taking a lock over a cold pool: the lane's own budget, not a slack. */
const STAGING_BUDGET_MS = 120_000;

/** The kind the lock is taken under — the probe kind the jobs suites enqueue as. */
const PROBE = "probe";

/** Every advisory lock the CLUSTER holds — the reading that cannot answer a question about one session. */
const CLUSTER_WIDE_ADVISORY = "select count(*) from pg_locks where locktype = 'advisory';";

const provisioned: ScratchDb[] = [];

/** A scratch database of this file's own, dropped with the rest. */
async function scratch(): Promise<ScratchDb> {
  const database = await provisionScratchDb();
  provisioned.push(database);
  return database;
}

afterAll(async () => {
  for (const database of provisioned) await database.drop();
}, STAGING_BUDGET_MS);

describe("inc-hotfix-20260914-1914: a pooled session's leavings are the session's own", () => {
  test("an advisory lock the seam holds on another database is not a leaving of the session being judged", async () => {
    const judged = await scratch();
    const elsewhere = await scratch();
    const store = jobsStore(elsewhere.urlMigrate);

    try {
      await store.withKeyLock(PROBE, `hotfix-${randomUUID()}`, randomUUID(), async () => {
        // The state the lane puts a pooled session in: a lock held, for as long as this body runs,
        // by a backend on a database this session has never heard of.
        const clusterWide = psql(judged.urlMigrate, CLUSTER_WIDE_ADVISORY);
        expect(clusterWide.ok, `the staging read failed: ${clusterWide.stderr}`).toBe(true);
        expect(
          Number(clusterWide.rows[0]?.[0] ?? "0"),
          "the seam's lock on the other database must be standing, or this case asserts nothing",
        ).toBeGreaterThanOrEqual(1);

        const left = psql(judged.urlMigrate, SESSION_LEAVINGS_MADE);
        expect(left.ok, `the leavings script failed: ${left.stderr}`).toBe(true);

        const after = psql(judged.urlMigrate, SESSION_LEAVINGS);
        expect(after.ok, `the leavings reading failed: ${after.stderr}`).toBe(true);
        expect(
          after.rows,
          "the session the next script ran in was judged by a lock held on another database, not by what it carries itself",
        ).toEqual([["t"], ["t"], ["t"]]);
      });
    } finally {
      await store.close();
    }
  }, STAGING_BUDGET_MS);
});
