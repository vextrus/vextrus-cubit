/**
 * AC-6 (V-DB) — the two tables the level model lands, as the store holds them (V-DB, R-SPINE-004,
 * SEAM-TENANT, L-MEA-07, L-ACT-01).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed, and a second run of the lane converging is that entry recorded.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: nothing is transcribed. The tenant scoping is read through `enumerateTenantScopedTables` —
 * the same denominator `seam-tenant.live.test.ts` drives its per-table proofs from — and what the
 * app role may NOT do is graded as the retention property each table encodes: a level is never
 * deleted (L-MEA-07), and a reading is never rewritten (R-TO-051, L-ACT-01).
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { count, isTrue, lit, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The lane that applies the committed migrations — the only way a table reaches a database. */
const MIGRATE_SCRIPT = join("scripts", "db-migrate.mjs");

/** The two tables the increment's goal names. */
const LEVELS = "levels";
const READINGS = "storey_height_readings";
const TABLES: readonly string[] = [LEVELS, READINGS];

/** The ledger every act-bearing column of these two points at (L-ACT-01). */
const ACTS = "acts";

/** The three bases a reading may carry — the closed roster the CHECK admits (AC-4, AC-6). */
const BASES: readonly string[] = ["TRANSCRIBED", "DERIVED", "ENTERED"];

type Stage = { bootstrapUrl: string; urlMigrate: string; tenantScoped: string[] };

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
    return { bootstrapUrl, urlMigrate: provisioned.urlMigrate, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl) };
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

/** The constraint definitions of one kind a table carries. */
async function constraintsOf(table: string, kind: "p" | "u" | "f" | "c"): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select pg_get_constraintdef(oid) from pg_constraint
      where conrelid = ${lit(`public.${table}`)}::regclass and contype = ${lit(kind)}
      order by conname;`,
  ).map((row) => row[0] ?? "");
}

/** Every upper-case literal a constraint definition admits — what a CHECK over a roster says. */
function literalsOf(definition: string): string[] {
  return [...definition.matchAll(/'([A-Z_]+)'/g)].map((found) => found[1] ?? "").sort();
}

describe("AC-6: the level model's two tables are migrated, tenant-scoped and posture-bound", () => {
  it("AC-6: the product's own migration lane lands both tables, and running it again converges", async () => {
    const { urlMigrate } = await staged();
    expect(await presentTables(), "the lane applied the migration that lands the level model's tables").toEqual([...TABLES]);

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

  it("AC-6: both carry tenant_id and stand in the enumeration the seam suite is driven from", async () => {
    const { tenantScoped } = await staged();
    for (const table of TABLES) {
      expect(
        tenantScoped,
        `public.${table} carries ${TENANT_COLUMN}, so every per-table proof seam-tenant.live.test.ts makes over this enumeration binds it too (R-SPINE-004, B-19)`,
      ).toContain(`public.${table}`);
    }
  });

  it("AC-6: both have row-level security enabled AND forced, with a policy that reads the tenant GUC", async () => {
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

  it("AC-6: a level is never deleted and a reading is never rewritten — the role holds no privilege that would let it", async () => {
    for (const table of TABLES) {
      expect(await privilegesOf(table, ROLE_APP), `${ROLE_APP} cannot DELETE from public.${table} — a level with live rows is never deleted, only repudiated (L-MEA-07)`).not.toContain("DELETE");
    }
    expect(
      await privilegesOf(READINGS, ROLE_APP),
      `${ROLE_APP} cannot UPDATE public.${READINGS} — a re-affirmation is another reading, never a rewrite (R-TO-051, L-ACT-01)`,
    ).not.toContain("UPDATE");
    // The proofs above are only proofs if the role reaches these tables at all.
    for (const table of TABLES) {
      expect(await privilegesOf(table, ROLE_APP), `${ROLE_APP} reads and adds public.${table}`).toEqual(expect.arrayContaining(["INSERT", "SELECT"]));
    }
  });

  it("AC-6: a reading stands on a level, and every act-bearing column points at the act log", async () => {
    expect(await presentTables(), `public.${READINGS} stands in the migrated database — its constraints are what this case reads`).toContain(READINGS);

    const readingKeys = await constraintsOf(READINGS, "f");
    expect(
      readingKeys.some((definition) => definition.includes("level_id") && definition.includes(LEVELS)),
      `public.${READINGS}.level_id points at the level it reads — a reading of no level is a reading of nothing (L-MEA-07)`,
    ).toBe(true);
    expect(
      readingKeys.some((definition) => definition.includes("act_id") && definition.includes(ACTS)),
      `and public.${READINGS}.act_id points at the act that carried it (L-ACT-01)`,
    ).toBe(true);

    const levelKeys = await constraintsOf(LEVELS, "f");
    for (const column of ["inserted_act_id", "repudiated_act_id"]) {
      expect(
        levelKeys.some((definition) => definition.includes(column) && definition.includes(ACTS)),
        `public.${LEVELS}.${column} points at the act log — a level is inserted and repudiated by acts, and by nothing else (L-ACT-01)`,
      ).toBe(true);
    }
  });

  it("AC-6: the basis of a reading is checked against the three the law admits, and no other", async () => {
    expect(await presentTables(), `public.${READINGS} stands in the migrated database — its constraints are what this case reads`).toContain(READINGS);

    const checks = (await constraintsOf(READINGS, "c")).filter((definition) => definition.includes("basis"));
    expect(checks.length, `public.${READINGS} carries a CHECK on basis — the roster is the store's, not a writer's memory (AC-6)`).toBeGreaterThan(0);
    const admitted = new Set(checks.flatMap((definition) => literalsOf(definition)));
    expect([...admitted].sort(), `the CHECK admits exactly ${BASES.join(", ")} — a defaulted storey height is barred at the store as well as at the act (L-MEA-07)`).toEqual([...BASES].sort());
  });
});
