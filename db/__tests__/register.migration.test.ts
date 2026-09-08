/**
 * AC-6 — the four register tables, as the store holds them (V-DB, R-SPINE-004, SEAM-TENANT,
 * L-REG-03, L-REG-04).
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
 * the same denominator `seam-tenant.live.test.ts` drives its per-table proofs from, so these four
 * tables are covered by that suite the moment they land — and the RLS predicate below is that
 * suite's own. What the app role may NOT do is graded as the retention property each table encodes.
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

/** The four tables the increment's goal names. */
const REGISTER_OBJECTS = "register_objects";
const REFUSED_SIGHTINGS = "refused_sightings";
const REGISTER_ATTRIBUTES = "register_attributes";
const REGISTER_OBSERVATIONS = "register_observations";
const TABLES: readonly string[] = [REGISTER_OBJECTS, REFUSED_SIGHTINGS, REGISTER_ATTRIBUTES, REGISTER_OBSERVATIONS];

/**
 * The three whose rows are evidence: a refused sighting, an attribute slot and an observation are
 * records of something that happened, and a correction to any of them is another row (R-TO-051).
 */
const APPENDED: readonly string[] = [REFUSED_SIGHTINGS, REGISTER_ATTRIBUTES, REGISTER_OBSERVATIONS];

/** The ledger of pinned set revisions a register object is scoped to (L-REG-03). */
const SET_REVISIONS = "drawing_set_revisions";

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

describe("AC-6: the register tables are migrated, tenant-scoped and posture-bound", () => {
  it("AC-6: the product's own migration lane lands all four tables, and running it again converges", async () => {
    const { urlMigrate } = await staged();
    expect(await presentTables(), "the lane applied the migration that lands the register tables").toEqual([...TABLES]);

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

  it("AC-6: each of the four carries tenant_id and stands in the enumeration the seam suite is driven from", async () => {
    const { tenantScoped } = await staged();
    for (const table of TABLES) {
      expect(
        tenantScoped,
        `public.${table} carries ${TENANT_COLUMN}, so every per-table proof seam-tenant.live.test.ts makes over this enumeration binds it too (R-SPINE-004, B-19)`,
      ).toContain(`public.${table}`);
    }
  });

  it("AC-6: each of the four has row-level security enabled AND forced, with a policy that reads the tenant GUC", async () => {
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

  it("AC-6: a register object is one row per identity in one set revision, and cites the revision it was sighted in", async () => {
    expect(await presentTables(), `public.${REGISTER_OBJECTS} stands in the migrated database — its constraints are what this case reads`).toContain(REGISTER_OBJECTS);

    const unique = [...(await constraintsOf(REGISTER_OBJECTS, "u")), ...(await constraintsOf(REGISTER_OBJECTS, "p"))];
    expect(
      unique.some((definition) => definition.includes(TENANT_COLUMN) && definition.includes("set_revision_id") && definition.includes("object_key")),
      `public.${REGISTER_OBJECTS} is unique over (${TENANT_COLUMN}, set_revision_id, object_key): the double-count guard is a property of the store and not of a writer remembering to look (L-REG-03)`,
    ).toBe(true);

    const foreign = await constraintsOf(REGISTER_OBJECTS, "f");
    expect(
      foreign.some((definition) => definition.includes("set_revision_id") && definition.includes(SET_REVISIONS)),
      `and it points at the ${SET_REVISIONS} row it was sighted in — a sighting with no revision is a sighting of nothing (L-REG-03)`,
    ).toBe(true);
  });

  it("AC-6: nothing the register holds can be taken away, and the three appended tables cannot be rewritten either", async () => {
    for (const table of TABLES) {
      expect(await privilegesOf(table, ROLE_APP), `${ROLE_APP} cannot DELETE from public.${table} — a register row is evidence (L-REG-01)`).not.toContain("DELETE");
    }
    for (const table of APPENDED) {
      expect(
        await privilegesOf(table, ROLE_APP),
        `${ROLE_APP} cannot UPDATE public.${table} — a correction is another row, never a rewrite (R-TO-051, L-ACT-01)`,
      ).not.toContain("UPDATE");
    }
    // The proofs above are only proofs if the role reaches these tables at all.
    for (const table of TABLES) {
      expect(await privilegesOf(table, ROLE_APP), `${ROLE_APP} reads and adds public.${table}`).toEqual(expect.arrayContaining(["INSERT", "SELECT"]));
    }
  });
});
