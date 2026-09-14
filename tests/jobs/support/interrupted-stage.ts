// The two states a template namespace can be in when the lane's stale sweep walks it, staged on
// demand — the fixture Q-01's discipline asks for, so the defect this hotfix cures appears when the
// test asks rather than when a machine happens to be unlucky (arbitration of 2026-09-14: a
// criterion is a state, never a sighting).
//
// WHAT IS STAGED, AND WHY IT IS THE REAL RESIDUE. The scratch harness publishes a template by one
// boolean: `datistemplate`, set after the migrations applied and read back by `templateIsReady` as
// the whole of readiness (db/__tests__/harness.ts). Two very different databases refuse the sweep's
// unforced drop with the same 55006 — a finished template another run is cloning from, and a
// database of an older digest whose migrations are still running (or died running). Both are staged
// here: created, held open through the lane's own pooled psql door so the drop is refused, one
// carrying the flag and one not.
//
// Nothing here imports a driver (that ban binds this file as it binds the harness), and every
// database it makes is named outside `cubit_dbtpl_`, the namespace the lane's own sweep collects:
// the sweep under test is asked about this fixture's namespace and no other, so proving it can
// never put the template the rest of the lane is cloning from at risk.
import { BOOTSTRAP_URL } from "../../../db/__tests__/support/fixtures";
import { closePsqlPool, ident, isTrue, lit, psql, run } from "../../../db/__tests__/support/live-sql";

/** A namespace of this fixture's own, outside every namespace the lane sweeps or clones. */
export function stagingNamespace(label: string): string {
  return `cubit_hotfixtpl_${label}_${process.pid.toString(36)}_${Date.now().toString(36)}_`;
}

/** The bootstrap connection, pointed at another database on the same cluster. */
export function urlFor(database: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * A database in the namespace, with or without the flag the harness publishes readiness with —
 * flagged with the harness's own statement, so what is staged is the state the harness itself
 * writes. Neither database is migrated: what the sweep must decide is about the FLAG, and a schema
 * behind it would only make the two stages harder to tell apart.
 */
export function stageDatabase(name: string, options: { published: boolean }): void {
  dropStagedDatabase(name);
  run(BOOTSTRAP_URL, `create database ${ident(name)};`);
  if (options.published) run(BOOTSTRAP_URL, `update pg_database set datistemplate = true where datname = ${lit(name)};`);
}

/**
 * Hold a database open, the way a run cloning from a template or migrating one holds it: a session
 * through the lane's own psql door, which outlives the script it answered. An unforced
 * `drop database` is refused while it stands — which is the whole case the sweep has to judge.
 */
export function holdOpen(name: string): void {
  run(urlFor(name), `select 1;`);
}

/** Let a held database go again. */
export function release(name: string): void {
  closePsqlPool(urlFor(name));
}

/** How many backends are on this database right now — how the fixture proves its hold took. */
export function backendsOn(name: string): number {
  return Number(run(BOOTSTRAP_URL, `select count(*) from pg_stat_activity where datname = ${lit(name)};`)[0]?.[0] ?? "0");
}

/** Does this database carry the flag the harness publishes readiness with? */
export function isPublishedReady(name: string): boolean {
  return isTrue(run(BOOTSTRAP_URL, `select datistemplate from pg_database where datname = ${lit(name)};`)[0]?.[0] ?? "");
}

/** Is there a database of this name at all? */
export function databaseExists(name: string): boolean {
  return run(BOOTSTRAP_URL, `select count(*) from pg_database where datname = ${lit(name)};`)[0]?.[0] === "1";
}

/** Every table a database carries, qualified and sorted — the schema, as the server reports it. */
export function tablesOf(url: string): string[] {
  return run(url, `select schemaname || '.' || tablename from pg_tables where schemaname not in ('pg_catalog', 'information_schema') order by 1;`).map(
    (row) => row[0] ?? "",
  );
}

/** Take a staged database away again, hold and flag and all, whatever state the test left it in. */
export function dropStagedDatabase(name: string): void {
  closePsqlPool(urlFor(name));
  psql(BOOTSTRAP_URL, `update pg_database set datistemplate = false where datname = ${lit(name)};`);
  psql(BOOTSTRAP_URL, `drop database if exists ${ident(name)} with (force);`);
}
