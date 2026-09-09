/**
 * The four tables the placement, expansion and levels-proposal stages land, as the store holds them
 * (V-DB, R-SPINE-004, SEAM-TENANT, L-CAD-07, L-REG-04, L-ACT-01).
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
 * the same denominator `seam-tenant.live.test.ts` drives its per-table proofs from — the deferral
 * roster is read off the register that publishes it, and what the app role may NOT do is graded as
 * the retention property each table encodes: a stage's rows are rebuilt per ingest (R-TO-030) and a
 * person's authored range is neither rewritten nor erased (L-ACT-01).
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXPANSION_DEFERRAL_REASONS } from "../../src/core/errors";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { count, isTrue, lit, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The lane that applies the committed migrations — the only way a table reaches a database. */
const MIGRATE_SCRIPT = join("scripts", "db-migrate.mjs");

/**
 * The three tables a partition REBUILDS: their rows are deleted and re-derived with the views they
 * were read off, so the app role holds DELETE on them and on nothing else here (R-TO-030).
 */
const PLACEMENTS = "placements";
const DEFERRALS = "expansion_deferrals";
const PROPOSED = "proposed_levels";
const REBUILT: readonly string[] = [PLACEMENTS, DEFERRALS, PROPOSED];

/** The fourth: what a person AUTHORED, which no rebuild may take away (L-ACT-01, L-CAD-07). */
const AUTHORED = "typical_ranges";

const TABLES: readonly string[] = [...REBUILT, AUTHORED];

/** The two ledgers an authored range points at: the levels it runs between, and the act that made it. */
const LEVELS = "levels";
const ACTS = "acts";

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

describe("V-DB: the placement stages' four tables are migrated, tenant-scoped and posture-bound", () => {
  it("the product's own migration lane lands all four tables, and running it again converges", async () => {
    const { urlMigrate } = await staged();
    expect(await presentTables(), "the lane applied the migration that lands the three stages' tables").toEqual([...TABLES]);

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

  it("all four carry tenant_id and stand in the enumeration the seam suite is driven from", async () => {
    const { tenantScoped } = await staged();
    for (const table of TABLES) {
      expect(
        tenantScoped,
        `public.${table} carries ${TENANT_COLUMN}, so every per-table proof seam-tenant.live.test.ts makes over this enumeration binds it too (R-SPINE-004, B-19)`,
      ).toContain(`public.${table}`);
    }
  });

  it("all four have row-level security enabled AND forced, with a policy that reads the tenant GUC", async () => {
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

  it("a rebuilt stage's rows may be re-derived, and an authored range may neither be rewritten nor erased", async () => {
    for (const table of REBUILT) {
      expect(
        await privilegesOf(table, ROLE_APP),
        `${ROLE_APP} reads, adds and clears public.${table} — a stage of a partition is rebuilt per ingest, rows and all (R-TO-030, L-REG-04)`,
      ).toEqual(expect.arrayContaining(["DELETE", "INSERT", "SELECT"]));
    }

    const authored = await privilegesOf(AUTHORED, ROLE_APP);
    expect(authored, `${ROLE_APP} cannot DELETE from public.${AUTHORED} — a rebuild may not take away what a person authored (L-ACT-01)`).not.toContain("DELETE");
    expect(authored, `${ROLE_APP} cannot UPDATE public.${AUTHORED} — a range is authored, never edited (L-ACT-01)`).not.toContain("UPDATE");
    // The two proofs above are only proofs if the role reaches the table at all.
    expect(authored, `${ROLE_APP} reads and adds public.${AUTHORED}`).toEqual(expect.arrayContaining(["INSERT", "SELECT"]));
  });

  it("an authored range names the levels it runs between and the act that authored it", async () => {
    expect(await presentTables(), `public.${AUTHORED} stands in the migrated database — its constraints are what this case reads`).toContain(AUTHORED);

    const keys = await constraintsOf(AUTHORED, "f");
    for (const column of ["from_level_id", "to_level_id"]) {
      expect(
        keys.some((definition) => definition.includes(column) && definition.includes(LEVELS)),
        `public.${AUTHORED}.${column} points at the level it names — a range runs between surrogates, never between labels (L-REG-02)`,
      ).toBe(true);
    }
    expect(
      keys.some((definition) => definition.includes("act_id") && definition.includes(ACTS)),
      `and public.${AUTHORED}.act_id points at the act that authored it (L-ACT-01)`,
    ).toBe(true);
  });

  it("the reason a view defers under is checked against the two the register admits, and no other", async () => {
    expect(await presentTables(), `public.${DEFERRALS} stands in the migrated database — its constraints are what this case reads`).toContain(DEFERRALS);

    const checks = (await constraintsOf(DEFERRALS, "c")).filter((definition) => definition.includes("reason"));
    expect(checks.length, `public.${DEFERRALS} carries a CHECK on reason — the roster is the store's, not a writer's memory (Q-07)`).toBeGreaterThan(0);
    const admitted = new Set(checks.flatMap((definition) => literalsOf(definition)));
    expect(
      [...admitted].sort(),
      `the CHECK admits exactly ${EXPANSION_DEFERRAL_REASONS.join(", ")} — a reason nobody registered is barred at the store as well as at the resolver (L-CAD-07, Q-07)`,
    ).toEqual([...EXPANSION_DEFERRAL_REASONS].sort());
  });
});
