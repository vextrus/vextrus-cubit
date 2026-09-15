// The two ways the template cache breaks when nobody is watching (v22 Wave A, P2b finding 1).
//
// 1. A ready template carries `datistemplate = true`, and Postgres refuses `drop database` on such a
//    database outright (ERROR 55006, "cannot drop a template database"). The sweep issued that drop
//    and discarded the result, so no template this harness ever marked ready could be taken away:
//    every migration digest the tree has carried was still standing on the cluster, forever.
// 2. A builder killed between `create database` and `datistemplate = true` leaves a database of the
//    CURRENT digest's name that can never become ready. Every later run found it, waited the full
//    TEMPLATE_BUILD_TIMEOUT_MS (300 s) on it, and then failed — one SIGKILL poisoned the lane until
//    a human dropped it by hand.
//
// Both are proved here against databases this file makes itself, so neither case is asserted by
// breaking the template the rest of the lane is cloning from right now.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { createTemplateDatabase, dropStaleTemplates, ensureTemplateNamed, templateDatabaseName } from "./harness";
import { BOOTSTRAP_URL, ROLE_MIGRATE } from "./support/fixtures";
import { ident, isTrue, lit, psql, run, scalar } from "./support/live-sql";

const unique = (): string => randomUUID().replace(/-/g, "").slice(0, 16);

/**
 * A template of a digest this tree does not carry — what the sweep exists to collect — in a
 * namespace of this file's own. The sweep is told which prefix to collect precisely so that proving
 * it cannot reach the template the rest of this lane is cloning from at this moment.
 */
const SWEPT_PREFIX = "cubit_tplsweep_check_";
const STALE_TEMPLATE = `${SWEPT_PREFIX}${unique()}`;

/**
 * The half-built database a killed builder leaves. Deliberately outside `TEMPLATE_DB_PREFIX` — and
 * outside what that prefix matches as a LIKE pattern, where `_` is a wildcard: a sweep running in
 * another worker of this same lane collects those, and a fixture another process may lawfully take
 * away proves nothing. The reclaim path reads the database, never its name.
 */
const ABANDONED = `cubit_reclaim_check_${unique()}`;

/** The name the create-race case asks for, in the same private namespace and for the same reason. */
const RACE_CHECK = `cubit_racecheck_${unique()}`;

const exists = (name: string): boolean => psql(BOOTSTRAP_URL, `select 1 from pg_database where datname = ${lit(name)};`).rows.length > 0;
const oidOf = (name: string): string => scalar(BOOTSTRAP_URL, `select coalesce((select oid::text from pg_database where datname = ${lit(name)}), 'absent');`);

afterAll(() => {
  for (const name of [STALE_TEMPLATE, ABANDONED, RACE_CHECK]) {
    psql(BOOTSTRAP_URL, `alter database ${ident(name)} is_template false;`);
    psql(BOOTSTRAP_URL, `drop database if exists ${ident(name)} with (force);`);
  }
  delete process.env["CUBIT_TEMPLATE_STALE_MS"];
});

describe("the template cache collects its own leavings", () => {
  test("a template of a digest this tree no longer carries is actually dropped", () => {
    run(BOOTSTRAP_URL, `create database ${ident(STALE_TEMPLATE)} owner ${ident(ROLE_MIGRATE)};`);
    run(BOOTSTRAP_URL, `update pg_database set datistemplate = true where datname = ${lit(STALE_TEMPLATE)};`);
    expect(exists(STALE_TEMPLATE), "the fixture template was not created").toBe(true);

    dropStaleTemplates(templateDatabaseName(), SWEPT_PREFIX);

    expect(exists(STALE_TEMPLATE), "a datistemplate database refuses an unforced drop — the sweep has to clear IS_TEMPLATE first, and read the result").toBe(false);
  });

  test("a half-built database of the wanted name is reclaimed and rebuilt, not waited on", async () => {
    run(BOOTSTRAP_URL, `create database ${ident(ABANDONED)} owner ${ident(ROLE_MIGRATE)};`);
    const before = oidOf(ABANDONED);
    expect(before, "the fixture was not created").not.toBe("absent");
    expect(isTrue(scalar(BOOTSTRAP_URL, `select datistemplate from pg_database where datname = ${lit(ABANDONED)};`)), "a killed builder never gets to set datistemplate").toBe(false);

    // The heartbeat this fixture carries is no heartbeat at all, which is what a builder killed
    // before its first stamp leaves behind. 500 ms rather than the 60 s default so the case is
    // provable in a test instead of in a minute.
    process.env["CUBIT_TEMPLATE_STALE_MS"] = "500";

    const startedAt = Date.now();
    const name = await ensureTemplateNamed(ABANDONED);
    const waited = Date.now() - startedAt;

    expect(name).toBe(ABANDONED);
    expect(oidOf(ABANDONED), "the abandoned database was adopted rather than dropped and rebuilt").not.toBe(before);
    expect(isTrue(scalar(BOOTSTRAP_URL, `select datistemplate from pg_database where datname = ${lit(ABANDONED)};`)), "the rebuilt template never became ready").toBe(true);
    expect(waited, "the waiter polled the full build timeout instead of reclaiming a dead builder's database").toBeLessThan(90_000);
  });
});

/**
 * `createdb` reports one and the same lost race two ways — 42P04 once the winner's row is visible,
 * 23505 from the catalogue's unique index while it still is not — and the second is answered by
 * waiting for the winner to commit and asking again.
 *
 * 23505 itself cannot be staged: no client can hold an uncommitted `CREATE DATABASE` open, so the
 * window belongs to the server alone. What is provable, and what a careless "just retry the create"
 * would break, is that the waiting is scoped to that one race: every other answer still comes back at
 * once, rather than a real fault being sat on for ten seconds before it is reported.
 */
describe("the create race is waited out, and no other answer is", () => {
  test("a free name is created outright, and a name already taken is reported 42P04 without being waited on", async () => {
    const won = await createTemplateDatabase(RACE_CHECK);

    expect(won.ok, `the create of a free name failed: ${won.stderr.slice(-400)}`).toBe(true);
    expect(exists(RACE_CHECK), "the database the create reported making is not there").toBe(true);

    const startedAt = Date.now();
    const lost = await createTemplateDatabase(RACE_CHECK);
    const waited = Date.now() - startedAt;

    expect(lost.ok).toBe(false);
    expect(lost.sqlstate, "a name already committed is the settled verdict the caller waits on, not a race to re-ask").toBe("42P04");
    expect(waited, "an answer that is not 23505 was retried anyway — a real fault would be reported ten seconds late").toBeLessThan(5_000);
  });
});
