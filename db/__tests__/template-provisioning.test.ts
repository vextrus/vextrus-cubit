// The database lane's own cost, judged (V-DB). Every file of this lane provisions a scratch
// database; before v22 each one ran all 41 committed migrations through a subprocess, and the lane
// paid that 51 times. Now the migrations build ONE template per cluster per migration digest and
// each file copies it. Two properties have to hold for that to be a lawful trade, and they are what
// this file proves: copies are private to their own file, and the template is built once.
import { afterAll, describe, expect, test } from "vitest";
import { migrationsDigest, provisionScratchDb, templateDatabaseName } from "./harness";
import { AUDIT_REASON, BOOTSTRAP_URL, GUC_SYSTEM_REASON, SEED_REASON, TEMPLATE_DB_PREFIX, TENANTS_TABLE } from "./support/fixtures";
import { ident, isTrue, lit, run, scalar, withSession } from "./support/live-sql";

const mkdtemp = async (): Promise<string> => {
  const { mkdtemp: make } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  return make(join(tmpdir(), "cubit-migrations-"));
};

const dropped: (() => Promise<void>)[] = [];
afterAll(async () => {
  for (const drop of dropped) await drop();
});

/** The template's identity in the cluster. A rebuild is a drop and a create, so the oid moves. */
function templateOid(): string {
  return scalar(BOOTSTRAP_URL, `select coalesce((select oid::text from pg_database where datname = ${lit(templateDatabaseName())}), 'absent');`);
}

describe("the scratch databases are copies of one migrated template", () => {
  test("two provisions are migrated, private to each other, and leave the template built once", async () => {
    const first = await provisionScratchDb();
    dropped.push(first.drop);
    const oidAfterFirst = templateOid();
    expect(oidAfterFirst, "the first provision did not build the template").not.toBe("absent");
    expect(isTrue(scalar(BOOTSTRAP_URL, `select datistemplate from pg_database where datname = ${lit(templateDatabaseName())};`)), "a template is only ready once its migrations applied").toBe(true);

    const second = await provisionScratchDb();
    dropped.push(second.drop);
    expect(templateOid(), "the second provision rebuilt the template instead of copying it").toBe(oidAfterFirst);

    // Both carry the committed schema — a copy that skipped the migrations would carry no tables.
    // Read under system scope, so an empty answer is an empty table and never a policy hiding rows.
    const tenants = (url: string): number => Number(scalar(url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select count(*) from ${ident(TENANTS_TABLE)};`)));
    for (const scratch of [first, second]) {
      expect(scalar(scratch.urlMigrate, `select to_regclass(${lit(TENANTS_TABLE)}) is not null;`), "a copy arrived without the committed schema").toBe("t");
      expect(tenants(scratch.urlMigrate)).toBe(0);
    }

    // And they are private: a row written to one is invisible in the other.
    run(first.urlMigrate, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, `insert into ${ident(TENANTS_TABLE)} (name) values (${lit("template-isolation")});`));
    expect(tenants(first.urlMigrate)).toBe(1);
    expect(tenants(second.urlMigrate), "the second copy saw the first copy's row").toBe(0);

    // Exactly one template stands for this tree's migrations — the stale ones are collected.
    const templates = run(BOOTSTRAP_URL, `select datname from pg_database where datname like ${lit(`${TEMPLATE_DB_PREFIX}%`)};`).map((row) => row[0] ?? "");
    expect(templates, "the cluster carries a template this tree's migrations did not build").toEqual([templateDatabaseName()]);
  });

  test("a changed migration names a different template — a stale schema can never be cloned", async () => {
    const { writeFile, mkdir, cp } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const source = fileURLToPath(new URL("../migrations", import.meta.url));

    const copy = await mkdtemp();
    await cp(source, join(copy, "migrations"), { recursive: true });
    expect(migrationsDigest(join(copy, "migrations")), "a byte-for-byte copy of the migrations is a different tree").toBe(migrationsDigest());

    await mkdir(join(copy, "migrations"), { recursive: true });
    await writeFile(join(copy, "migrations", "9999_a-later-increment.sql"), "create table later (id int);\n");
    expect(migrationsDigest(join(copy, "migrations")), "a new migration left the template's name alone").not.toBe(migrationsDigest());
    expect(templateDatabaseName(join(copy, "migrations"))).not.toBe(templateDatabaseName());
  });
});
