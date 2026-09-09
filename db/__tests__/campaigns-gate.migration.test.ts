/**
 * AC-1 (V-DB) — the four tables SEAM-GATE writes through, as the store holds them (V-DB,
 * R-SPINE-004, SEAM-TENANT, L-REG-07, L-MEA-08).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed, and a second run of the lane converging is that entry recorded.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * L-REG-07 makes the campaign's snapshot immutable, and immutability is graded as the posture that
 * enforces it: the app role is made to attempt the rewrite the clause forbids and is refused for
 * want of the privilege, while the write that opens a campaign is one the same role still holds.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { count, isTrue, lit, psql, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The lane that applies the committed migrations — the only way a table reaches a database. */
const MIGRATE_SCRIPT = join("scripts", "db-migrate.mjs");

/** The four tables the increment's goal names. */
const CAMPAIGNS = "campaigns";
const QUANTITY_LINES = "quantity_lines";
const RAIL_OBSERVATIONS = "rail_observations";
const QUEUE_ITEMS = "queue_items";
const TABLES: readonly string[] = [CAMPAIGNS, QUANTITY_LINES, RAIL_OBSERVATIONS, QUEUE_ITEMS];

/** Postgres' own answer for "you do not hold that privilege" — the refusal AC-1 asks for. */
const INSUFFICIENT_PRIVILEGE = "42501";

type Stage = { bootstrapUrl: string; urlMigrate: string; urlApp: string; tenantScoped: string[] };

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
    return {
      bootstrapUrl,
      urlMigrate: provisioned.urlMigrate,
      urlApp: provisioned.urlApp,
      tenantScoped: await enumerateTenantScopedTables(bootstrapUrl),
    };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Which of this increment's tables the migrated database really holds, in the order declared. */
async function presentTables(): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  const held = new Set(
    run(
      bootstrapUrl,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p');`,
    ).map((row) => row[0] ?? ""),
  );
  return TABLES.filter((table) => held.has(table));
}

/** The privileges a role holds on a table, as the catalogue reports them. */
async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)}
      order by privilege_type;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

describe("AC-1: the gate's four tables are migrated, tenant-scoped and posture-bound", () => {
  it("AC-1: the product's own migration lane lands all four tables, and running it again converges", async () => {
    const { urlMigrate } = await staged();
    expect(await presentTables(), "the lane applied the migration that lands the campaign and the gate's three stores").toEqual([...TABLES]);

    const again = spawnSync(process.execPath, [join(REPO_ROOT, MIGRATE_SCRIPT)], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: urlMigrate },
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(
      again.status,
      `a second run of the migration lane converges on the same database — an unjournaled or rewritten migration re-runs and collides:\n${`${again.stdout ?? ""}${again.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
    expect(await presentTables(), "and the tables it landed are still exactly the ones it landed").toEqual([...TABLES]);
  });

  it("AC-1: each carries tenant_id and stands in the enumeration the seam suite is driven from", async () => {
    const { tenantScoped } = await staged();
    for (const table of TABLES) {
      expect(
        tenantScoped,
        `public.${table} carries ${TENANT_COLUMN}, so every per-table proof seam-tenant.live.test.ts makes over this enumeration binds it too (R-SPINE-004, B-19)`,
      ).toContain(`public.${table}`);
    }
  });

  it("AC-1: each has row-level security enabled AND forced, with a policy that reads the tenant GUC", async () => {
    const { bootstrapUrl } = await staged();
    for (const table of TABLES) {
      const row = run(
        bootstrapUrl,
        `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = ${lit(table)};`,
      )[0];
      expect(isTrue(row?.[0] ?? ""), `public.${table} has row-level security ENABLED`).toBe(true);
      expect(isTrue(row?.[1] ?? ""), `public.${table} has row-level security FORCED — an owner is not exempt from a workspace boundary (SEAM-TENANT)`).toBe(true);
      const policies = count(
        bootstrapUrl,
        `select count(*) from pg_policies where schemaname = 'public' and tablename = ${lit(table)}
          and (coalesce(qual, '') like ${lit(`%${GUC_TENANT}%`)} or coalesce(with_check, '') like ${lit(`%${GUC_TENANT}%`)});`,
      );
      expect(policies, `public.${table} carries at least one policy that reads ${GUC_TENANT} — the boundary is the store's, not a caller's WHERE`).toBeGreaterThan(0);
    }
  });

  it("AC-1: the campaign's snapshot is immutable — the app role may open a campaign and may not rewrite one", async () => {
    const { urlApp } = await staged();
    expect(await presentTables(), `public.${CAMPAIGNS} stands in the migrated database — its posture is what this case reads`).toContain(CAMPAIGNS);

    // The rewrite L-REG-07 forbids, attempted as the role the product runs under.
    const rewrite = psql(urlApp, `update ${CAMPAIGNS} set edition_digest = 'rewritten';`);
    expect(
      rewrite.ok,
      `${ROLE_APP} rewrote a campaign's edition digest — the snapshot a campaign copies at creation is immutable (L-REG-07):\n${rewrite.stderr.slice(-400)}`,
    ).toBe(false);
    expect(
      rewrite.sqlstate,
      `the rewrite is refused for want of the privilege (${INSUFFICIENT_PRIVILEGE}) rather than by chance — it answered ${rewrite.sqlstate ?? "nothing"}: ${rewrite.stderr.slice(-400)}`,
    ).toBe(INSUFFICIENT_PRIVILEGE);

    const held = await privilegesOf(CAMPAIGNS, ROLE_APP);
    expect(held, `${ROLE_APP} may SELECT and INSERT public.${CAMPAIGNS} — pinning a set opens a campaign, so the write that opens one is not refused`).toEqual(
      expect.arrayContaining(["INSERT", "SELECT"]),
    );
    expect(held, `${ROLE_APP} cannot UPDATE public.${CAMPAIGNS} — an edition, catalogue or level-stack snapshot is never edited (L-REG-07)`).not.toContain("UPDATE");
    expect(held, `${ROLE_APP} cannot DELETE public.${CAMPAIGNS} — a campaign is a record of what was measured against, not a scratch row`).not.toContain("DELETE");
  });

  it("AC-1: the three stores the gate writes are append-only to the app role, and reachable by it", async () => {
    for (const table of [QUANTITY_LINES, RAIL_OBSERVATIONS, QUEUE_ITEMS]) {
      const held = await privilegesOf(table, ROLE_APP);
      expect(held, `${ROLE_APP} reads and adds public.${table} — the gate is its sole writer, and it writes through this role (SEAM-GATE)`).toEqual(
        expect.arrayContaining(["INSERT", "SELECT"]),
      );
      expect(held, `${ROLE_APP} cannot DELETE from public.${table} — a published line, an observation and a queue item are records, never scratch (L-QTY-03)`).not.toContain("DELETE");
    }
  });
});
