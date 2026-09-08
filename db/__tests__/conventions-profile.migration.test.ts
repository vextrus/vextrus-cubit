/**
 * AC-4 (the store's half) — one ingest's convention profile is a tenant-scoped row that the app
 * role rewrites and never accumulates (R-TO-030, L-CAD-08, SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: no posture is transcribed. The profile is a second table of the SAME stored partition as
 * `partition_views` — rebuilt per ingest, deleted and written again in one transaction — so its
 * scope and its privileges are derived by COMPARISON against that table. An increment that changes
 * how the partition is scoped changes this case with it.
 */
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { lit, run } from "./support/live-sql";

/** The table this increment lands, and the table of the same partition it is compared against. */
const PROFILES = "convention_profiles";
const VIEWS = "partition_views";

/** The columns the increment's test contract fixes for it. */
const COLUMNS: readonly string[] = [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id", "rule_id", "rule_version", "profile", "census", "created_at"];

/** The key the profile stands under: one per ingest, in one workspace. */
const KEY: readonly string[] = [TENANT_COLUMN, "ingest_id"];

type Stage = { bootstrapUrl: string; tenantScoped: string[] };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    const bootstrapUrl = url.toString();
    return { bootstrapUrl, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl) };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Whether the migrated database holds a table of this name at all. */
async function holds(table: string): Promise<boolean> {
  const { bootstrapUrl } = await staged();
  return (
    run(
      bootstrapUrl,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(table)};`,
    ).length === 1
  );
}

/** The table, asserted present first, so a case below reds as the absence rather than as psql. */
async function requireProfiles(): Promise<void> {
  expect(await holds(PROFILES), `public.${PROFILES} is missing from the migrated database — the product does not store a convention profile yet`).toBe(true);
}

/** The columns a table carries, in code-point order. */
async function columnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by 1;`).map((row) => row[0] ?? "");
}

/** The privileges a role holds on a table, as the catalogue reports them. */
async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)} order by 1;`,
  ).map((row) => row[0] ?? "");
}

/** Whether row-level security is enabled on a table, and whether the owner is bound by it too. */
async function securityOf(table: string): Promise<{ enabled: string; forced: string }> {
  const { bootstrapUrl } = await staged();
  const rows = run(bootstrapUrl, `select relrowsecurity::text, relforcerowsecurity::text from pg_class where oid = ${lit(`public.${table}`)}::regclass;`);
  return { enabled: rows[0]?.[0] ?? "", forced: rows[0]?.[1] ?? "" };
}

/**
 * The policies a table wears, as what they SAY rather than as what they are called: the command
 * they bind, the rows they admit and the rows they accept. A policy named differently but reading
 * the same is the same guarantee; a policy named the same and reading differently is not.
 */
async function policiesOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select polcmd::text || ' | ' || coalesce(pg_get_expr(polqual, polrelid), '-') || ' | ' || coalesce(pg_get_expr(polwithcheck, polrelid), '-')
       from pg_policy where polrelid = ${lit(`public.${table}`)}::regclass order by 1;`,
  ).map((row) => (row[0] ?? "").replaceAll(`"${table}".`, "").replaceAll(table, ""));
}

/** The primary key of a table, as the catalogue defines it. */
async function primaryKeyOf(table: string): Promise<string> {
  const { bootstrapUrl } = await staged();
  return (
    run(bootstrapUrl, `select pg_get_constraintdef(oid) from pg_constraint where conrelid = ${lit(`public.${table}`)}::regclass and contype = 'p';`).map((row) => row[0] ?? "")[0] ?? ""
  );
}

describe("AC-4: convention_profiles is migrated, scoped and rewritable", () => {
  it("AC-4: the product's own migration lane lands the table, with the columns a stored profile is made of", async () => {
    expect(await holds(PROFILES), `the lane applied a migration that lands public.${PROFILES} — a profile with nowhere to stand is not stored (R-TO-030)`).toBe(true);
    expect(
      await columnsOf(PROFILES),
      `a stored profile says whose it is, which drawing and ingest it was resolved from, which method resolved it, and what it read (L-CAD-08)`,
    ).toEqual(expect.arrayContaining([...COLUMNS]));
  });

  it("AC-4: one profile stands per ingest, in one workspace", async () => {
    await requireProfiles();
    const key = await primaryKeyOf(PROFILES);
    expect(key, `public.${PROFILES} carries a primary key`).not.toBe("");
    for (const column of KEY) {
      expect(key, `the key is (${KEY.join(", ")}): a rebuilt partition replaces the profile of the ingest it rebuilt rather than standing a second one beside it (L-REG-04)`).toContain(column);
    }
  });

  it("AC-4: the profile is scoped exactly as the views it is rebuilt with", async () => {
    await requireProfiles();
    const { tenantScoped } = await staged();
    expect(tenantScoped, `public.${PROFILES} carries ${TENANT_COLUMN} — a workspace's drawings are its own (R-SPINE-004)`).toContain(`public.${PROFILES}`);

    const views = await securityOf(VIEWS);
    expect([views.enabled, views.forced], `public.${VIEWS} is the posture this table is compared against — with none there is nothing to compare`).toEqual(["true", "true"]);
    expect(
      await securityOf(PROFILES),
      `row-level security, WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee the owner escapes is not a guarantee (SEAM-TENANT)`,
    ).toEqual(views);

    const worn = await policiesOf(VIEWS);
    expect(worn.length, `public.${VIEWS} wears the tenant-scope and system-scope policies this table is compared against`).toBeGreaterThan(0);
    expect(
      await policiesOf(PROFILES),
      `the profile admits exactly the rows the partition's views admit — the workspace's own, and a system session that has recorded its reason (SEAM-TENANT)`,
    ).toEqual(worn);
  });

  it("AC-4: the app role rewrites a profile and never accumulates one", async () => {
    await requireProfiles();
    const views = await privilegesOf(VIEWS, ROLE_APP);
    expect(
      await privilegesOf(PROFILES, ROLE_APP),
      `${ROLE_APP} holds on public.${PROFILES} what it holds on public.${VIEWS}: a partition is REBUILT, so its rows are read, written and taken away again in one transaction (R-TO-030)`,
    ).toEqual(views);
    expect(views, `and that is exactly reading, adding and taking away — never an UPDATE, which would edit a derivation in place instead of re-deriving it (L-REG-04)`).toEqual([
      "DELETE",
      "INSERT",
      "SELECT",
    ]);
  });
});
