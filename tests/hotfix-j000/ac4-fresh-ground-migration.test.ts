/**
 * AC-4 — fresh ground.
 *
 * The diagnosis this increment starts from says the developer cluster cannot show one whole class of
 * defect: `cubit_e2e` is created only if absent, so on a machine whose journeys' database predates
 * inc-010b the invitations migrations have never once been applied from zero. A check that inherits
 * that state inherits the blindness with it.
 *
 * So this file makes its OWN database during the check — named per run, asserted absent before it is
 * created, owned by the migrate role, and dropped afterwards — and drives the product's own
 * migration lane across every committed migration from nothing. The roster it must cross is derived
 * from what the tree commits, so a repair migration this branch appends is carried by the same
 * reading; the two invitations migrations AC-4 names are asserted as a floor on top of it.
 *
 * @vitest-environment node
 */
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { BOOTSTRAP_URL, ROLE_MIGRATE } from "../../db/__tests__/support/fixtures";
import { count, ident, lit, psql, run, scalar } from "../../db/__tests__/support/live-sql";

const REPO_ROOT = process.cwd();

/** Migrations AC-4 names by hand — a floor under the derived roster, never the roster itself. */
const NAMED_MIGRATIONS = ["0010_invitations.sql", "0011_invitations-token-index.sql"] as const;

/**
 * The database this check makes for itself. Randomised per run so it can never be a reuse of ground
 * an earlier run (or the journeys' additive `cubit_e2e`) already migrated — the reuse AC-4 refuses.
 */
const FRESH_DATABASE = `cubit_hotfix_fresh_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

/** The same cluster the db harness bootstraps against, addressed as the migrate role. */
function migrateUrl(database: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.username = ROLE_MIGRATE;
  url.password = ROLE_MIGRATE;
  url.pathname = `/${database}`;
  return url.toString();
}

/** Every migration the tree commits, by file name — the roster the lane has to cross. */
function committedMigrations(): string[] {
  return readdirSync(join(REPO_ROOT, "db", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** The same roster as drizzle's own journal spells it — two homes that must agree. */
function journalTags(): string[] {
  const journal = JSON.parse(readFileSync(join(REPO_ROOT, "db", "migrations", "meta", "_journal.json"), "utf8")) as { entries?: { tag?: string }[] };
  return (journal.entries ?? []).map((entry) => entry.tag ?? "");
}

let created = false;

afterAll(() => {
  // Nothing here opens a driver pool, so the drop cannot race a connection of this suite's making.
  if (created) psql(BOOTSTRAP_URL, `drop database if exists ${ident(FRESH_DATABASE)} with (force);`);
});

describe("AC-4: every committed migration applies from zero on ground made during the check", () => {
  it("AC-4: the check makes its own database — it inherits no pre-migrated state", () => {
    const reachable = psql(BOOTSTRAP_URL, "select 1;");
    expect(reachable.ok, `the cluster the db harness names (${BOOTSTRAP_URL}) does not answer:\n${reachable.stderr.slice(-600)}`).toBe(true);

    // "Created during the check" is the criterion's own wording, and it is checkable: the name must
    // not already be on the cluster, so nothing an earlier run migrated can stand in for this one.
    const already = psql(BOOTSTRAP_URL, `select 1 from pg_database where datname = ${lit(FRESH_DATABASE)};`);
    expect(already.rows.length, `${FRESH_DATABASE} already exists — this check would be reusing pre-migrated ground`).toBe(0);
    expect(FRESH_DATABASE, "the fresh-ground check may never stand on the journeys' own additive database").not.toBe("cubit_e2e");

    run(BOOTSTRAP_URL, `create database ${ident(FRESH_DATABASE)} owner ${ident(ROLE_MIGRATE)};`);
    created = true;

    const owner = scalar(BOOTSTRAP_URL, `select pg_get_userbyid(datdba) from pg_database where datname = ${lit(FRESH_DATABASE)};`);
    expect(owner, "AC-4 wants the fresh database owned by the migrate role, as the harness owns every database it makes").toBe(ROLE_MIGRATE);

    // Zero means zero: no schema of any kind stands here before the lane runs.
    const relations = count(
      BOOTSTRAP_URL.replace(/\/[^/]*$/, `/${FRESH_DATABASE}`),
      "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';",
    );
    expect(relations, `${FRESH_DATABASE} is not empty before the migration lane runs`).toBe(0);
  });

  it("AC-4: `node scripts/db-migrate.mjs` crosses every committed migration and exits 0", () => {
    expect(created, "the fresh database was not made, so there is nothing to migrate onto").toBe(true);

    const migrated = spawnSync(process.execPath, [join(REPO_ROOT, "scripts", "db-migrate.mjs")], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: migrateUrl(FRESH_DATABASE) },
      encoding: "utf8",
      timeout: 300_000,
    });
    expect(
      migrated.status,
      `the committed migrations did not apply to a database made from nothing:\n${`${migrated.stdout ?? ""}${migrated.stderr ?? ""}`.slice(-2000)}`,
    ).toBe(0);

    // What "every committed migration" means is derived from the tree, so an appended repair
    // migration (0012/0013) raises this bar by existing rather than by an edit here.
    const committed = committedMigrations();
    const tags = journalTags();
    expect(committed.length, "the tree commits no migrations at all, so this reading would prove nothing").toBeGreaterThan(0);
    expect(tags.length, "drizzle's journal and the committed .sql roster disagree about how many migrations there are").toBe(committed.length);

    const applied = count(migrateUrl(FRESH_DATABASE), "select count(*) from drizzle.__drizzle_migrations;");
    expect(applied, `the lane recorded ${applied} applied migrations against ${committed.length} committed — an appended migration that never runs is a schema that is never made`).toBe(committed.length);
  });

  it("AC-4: the invitations migrations the criterion names are part of what crossed", () => {
    const committed = committedMigrations();
    const tags = new Set(journalTags());
    for (const name of NAMED_MIGRATIONS) {
      expect(committed, `${name} is named by AC-4 and the tree does not commit it`).toContain(name);
      expect(tags.has(name.replace(/\.sql$/, "")), `${name} is committed but drizzle's journal does not carry it, so the lane never applies it`).toBe(true);
    }

    // And the schema those two migrations exist to make actually stands on the fresh ground: the
    // invitations table, under row security, reachable by the app role the product is served as.
    const invitations = psql(
      migrateUrl(FRESH_DATABASE),
      "select c.relrowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'invitations';",
    );
    expect(invitations.ok, `reading the fresh schema failed:\n${invitations.stderr.slice(-600)}`).toBe(true);
    expect(invitations.rows.length, "0010_invitations.sql applied from zero without leaving an `invitations` relation behind").toBe(1);
    expect(invitations.rows[0]?.[0], "the invitations table stands on fresh ground without row security (AS-01)").toBe("true");
  });
});
