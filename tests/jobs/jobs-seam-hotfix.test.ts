/**
 * HOTFIX inc-hotfix-20260914-0052: db/__tests__/harness.ts:180-200 — the stale-template sweep put
 * `datistemplate` back on every database whose unforced drop it could not complete, including one
 * that never carried the flag, so a half-built template of the wanted digest read as READY and the
 * files that provisioned next — tests/jobs/jobs-seam.test.ts among them — cloned a database whose
 * migrations had not finished.
 *
 * WHY THIS IS THE SEAM SUITE'S OWN PATH. tests/jobs/jobs-seam.test.ts stages on
 * `provisionScratchDb()`, which asks `ensureTemplate()` for the run's migrated template and copies
 * it. Readiness has exactly one signal — `datistemplate`, set only after the migrations applied, so
 * that "a template that exists but is half-built is never cloned" (db/__tests__/harness.ts). The
 * sweep runs on the same cluster from every run that builds a template, over every database the
 * template prefix matches; a sweep that hands the flag to a database that was not ready breaks the
 * one invariant the clone rests on, and the file that then clones stages on a schema the tree does
 * not say is current. That is a red no assertion of the suite can see and no timeout can clear.
 *
 * WHAT IS PROVED, AND WHERE. Against three databases this file makes in a namespace of its own —
 * outside `TEMPLATE_DB_PREFIX` and outside what that prefix matches as a LIKE pattern, where `_` is
 * a wildcard — so nothing here can reach the template the rest of this lane is cloning from right
 * now (the idiom db/__tests__/template-reclaim.test.ts established). A database is held against the
 * unforced drop the way a live builder holds its own: by a standing session of the lane's pooled
 * psql, which is what `heartbeat()` leaves on a template while its migrations run.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { dropStaleTemplates } from "../../db/__tests__/harness";
import { BOOTSTRAP_URL, TEMPLATE_DB_PREFIX } from "../../db/__tests__/support/fixtures";
import { PSQL_APP_NAME, closePsqlPool, count, ident, isTrue, lit, psql, run, scalar } from "../../db/__tests__/support/live-sql";

/** A namespace of this file's own, which no production sweep's prefix reaches. */
const NAMESPACE = `cubit_hotfix0052_${randomUUID().replace(/-/g, "").slice(0, 16)}_`;

/** The database a builder is still migrating: created, not yet ready, and held by its own session. */
const HALF_BUILT = `${NAMESPACE}halfbuilt`;

/** A ready template somebody is cloning from at this moment: the flag is theirs to keep. */
const HELD_READY = `${NAMESPACE}ready`;

/** A ready template of a digest nobody wants and nobody holds: the sweep's actual quarry. */
const FREE_STALE = `${NAMESPACE}stale`;

/** The name the sweep is told to keep — this run's own digest, which is none of the three above. */
const KEEP = `${NAMESPACE}keep`;

/** The same server, addressed against one of this file's databases. */
function urlOf(database: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

function exists(database: string): boolean {
  return psql(BOOTSTRAP_URL, `select 1 from pg_database where datname = ${lit(database)};`).rows.length > 0;
}

/** What the harness's own readiness signal says about a database — the question a cloner asks. */
function readsAsReady(database: string): boolean {
  return isTrue(scalar(BOOTSTRAP_URL, `select datistemplate from pg_database where datname = ${lit(database)};`));
}

/** Hold a database against an unforced drop, as a builder's heartbeat holds the template it is building. */
function holdOpen(database: string): void {
  const held = psql(urlOf(database), "select 1;");
  expect(held.ok, `the fixture's session on ${database} could not be opened: ${held.stderr.slice(-400)}`).toBe(true);
  expect(
    count(BOOTSTRAP_URL, `select count(*) from pg_stat_activity where datname = ${lit(database)} and application_name = ${lit(PSQL_APP_NAME)};`),
    `${database} is not held open, so the unforced drop this case turns on would not be refused and the case would prove nothing`,
  ).toBeGreaterThan(0);
}

afterAll(() => {
  for (const database of [HALF_BUILT, HELD_READY, FREE_STALE]) {
    closePsqlPool(urlOf(database));
    psql(BOOTSTRAP_URL, `alter database ${ident(database)} is_template false;`);
    psql(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);`);
  }
}, 120_000);

describe("the stale-template sweep leaves no database saying it is ready when it never was", () => {
  test("a half-built template the sweep could not drop is left un-ready, a held one keeps its flag, and a free one still goes", () => {
    expect(NAMESPACE.startsWith(TEMPLATE_DB_PREFIX), "this file's fixtures must sit outside the prefix production sweeps collect").toBe(false);

    for (const database of [HALF_BUILT, HELD_READY, FREE_STALE]) {
      run(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);`);
      run(BOOTSTRAP_URL, `create database ${ident(database)};`);
    }
    // A builder sets this only once the migrations have applied, so the half-built one has none.
    for (const database of [HELD_READY, FREE_STALE]) {
      run(BOOTSTRAP_URL, `update pg_database set datistemplate = true where datname = ${lit(database)};`);
    }
    expect(readsAsReady(HALF_BUILT), "the half-built fixture was staged as ready, which is not what a killed builder leaves").toBe(false);
    holdOpen(HALF_BUILT);
    holdOpen(HELD_READY);

    const dropped = dropStaleTemplates(KEEP, NAMESPACE);

    // The regression: the flag goes back only where the sweep took it away. A database that was
    // still being migrated must never be left answering the one question `ensureTemplate()` asks
    // before it clones — otherwise the next file to provision copies an unfinished schema.
    expect(exists(HALF_BUILT), "a database held open is refused an unforced drop, so the sweep leaves it for the next pass").toBe(true);
    expect(
      readsAsReady(HALF_BUILT),
      "the sweep left a half-built database marked datistemplate = true — every run that clones the template reads that flag as READY (db/__tests__/harness.ts templateIsReady), so the next file to provision stages on a schema whose migrations never finished",
    ).toBe(false);

    // …and the case the restore exists for is untouched: a ready template somebody is cloning from
    // keeps the flag, so that clone still reads it as ready.
    expect(exists(HELD_READY), "a template another run is cloning from is kept, not forced away").toBe(true);
    expect(readsAsReady(HELD_READY), "a ready template the sweep could not drop must be given its flag back").toBe(true);

    // …and the sweep still collects what it can reach.
    expect(dropped, `the sweep answers with what it took away; it said ${JSON.stringify(dropped)}`).toEqual([FREE_STALE]);
    expect(exists(FREE_STALE), "an unheld stale template is what the sweep exists to take away").toBe(false);
  }, 180_000);
});
