/**
 * AC-4 (the store's half) — the two tables L-CAD-07's grid backbone is rewritten into
 * (R-TO-030, L-CAD-07, SEAM-TENANT, V-DB).
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/ is read here: a table standing in that database is the migration and its journal entry,
 * observed.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: no posture is transcribed. These are two more tables of the SAME stored partition as
 * `convention_profiles` — rebuilt per ingest, deleted and written again in one transaction — so
 * their scope and their privileges are derived by COMPARISON against that table. An increment that
 * changes how the partition is scoped changes this case with it.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { lit, psql, run, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT). */
const DB_MODULE = "src/core/db.ts";

/** The two tables this increment lands, and the table of the same partition they are compared against. */
const GRIDS = "grids";
const DEFERRALS = "grid_deferrals";
const PEER = "convention_profiles";

/** The reason this suite runs its system-scoped statements under — attributable, like any other. */
const REASON = "test: probe the grid store's closed lists";

/** A CHECK violation, as Postgres names one. */
const CHECK_VIOLATION = "23514";

/** Each table, the name it is exported under, the columns it carries and the key it stands under. */
const TABLES = [
  {
    table: GRIDS,
    exported: "grids",
    columns: [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id", "view_key", "family", "label", "axis", "position", "bubble_key", "label_key", "min_spacing", "created_at"],
    key: [TENANT_COLUMN, "ingest_id", "bubble_key"],
  },
  {
    table: DEFERRALS,
    exported: "gridDeferrals",
    columns: [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id", "view_key", "reason", "created_at"],
    key: [TENANT_COLUMN, "ingest_id", "view_key"],
  },
] as const;

/** Import a product module by repo-relative path, asserting it exists first. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

type Stage = { bootstrapUrl: string };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    return { bootstrapUrl: url.toString() };
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
async function requireTable(table: string): Promise<void> {
  expect(await holds(table), `public.${table} is missing from the migrated database — the product does not store a grid yet`).toBe(true);
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
 * The policies a table wears, as what they SAY rather than as what they are called: the command they
 * bind, the rows they admit and the rows they accept. A policy named differently but reading the
 * same is the same guarantee; a policy named the same and reading differently is not.
 */
async function policiesOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select polcmd::text || ' | ' || coalesce(pg_get_expr(polqual, polrelid), '-') || ' | ' || coalesce(pg_get_expr(polwithcheck, polrelid), '-')
       from pg_policy where polrelid = ${lit(`public.${table}`)}::regclass order by 1;`,
  ).map((row) => (row[0] ?? "").replaceAll(`"${table}".`, "").replaceAll(table, ""));
}

/** The columns of a table's primary key, in key order, read out of the catalogue. */
async function primaryKeyColumnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select a.attname
       from pg_constraint c
       join unnest(c.conkey) with ordinality as k(attnum, ord) on true
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.conrelid = ${lit(`public.${table}`)}::regclass and c.contype = 'p'
      order by k.ord;`,
  ).map((row) => row[0] ?? "");
}

/** One axis row, as the store is asked to accept it: lawful unless the case says otherwise. */
function insertGrid(row: { family?: string; axis?: string; minSpacing?: string }): string {
  const columns = [TENANT_COLUMN, "project_id", "drawing_id", "ingest_id", "view_key", "family", "label", "axis", "position", "bubble_key", "label_key", "min_spacing"];
  return `insert into "${GRIDS}" (${columns.map((column) => `"${column}"`).join(", ")})
    values (${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid,
            ${lit("LAYOUT_PLAN:DXF_HANDLE:1")}, ${lit(row.family ?? "letter")}, ${lit("A")}, ${lit(row.axis ?? "x")}, 12.5,
            ${lit(`DXF_HANDLE:${randomUUID()}`)}, ${lit(`DXF_HANDLE:${randomUUID()}`)}, ${row.minSpacing ?? "15"});`;
}

/** That insert, attempted under a session the store's system scope admits. */
async function attemptGrid(row: { family?: string; axis?: string; minSpacing?: string }): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertGrid(row)));
}

describe("AC-4: the grid's two tables are migrated, scoped and rewritable", () => {
  it("AC-4: the product's own migration lane lands both tables, with the columns a stored grid is made of", async () => {
    for (const { table, columns } of TABLES) {
      expect(await holds(table), `the lane applied a migration that lands public.${table} — a grid with nowhere to stand is not stored (R-TO-030)`).toBe(true);
      expect(
        await columnsOf(table),
        `public.${table} says whose it is, which drawing, ingest and view it was read from, and what the stage read there (L-CAD-07)`,
      ).toEqual(expect.arrayContaining([...columns]));
    }
  });

  it("AC-4: one axis stands per bubble and one deferral per view, in one workspace", async () => {
    for (const { table, key } of TABLES) {
      await requireTable(table);
      expect(
        await primaryKeyColumnsOf(table),
        `the key of public.${table} is exactly (${key.join(", ")}) and nothing more: a rebuilt partition replaces the rows of the ingest it rebuilt rather than standing a second set beside them (L-REG-04, R-TO-030)`,
      ).toEqual([...key]);
    }
  });

  it("AC-4: each table is scoped exactly as the convention profile it is rebuilt beside", async () => {
    const peerSecurity = await securityOf(PEER);
    expect([peerSecurity.enabled, peerSecurity.forced], `public.${PEER} is the posture these tables are compared against — with none there is nothing to compare`).toEqual(["true", "true"]);
    const peerPolicies = await policiesOf(PEER);
    expect(peerPolicies.length, `public.${PEER} wears the tenant-scope and system-scope policies these tables are compared against`).toBeGreaterThan(0);

    for (const { table } of TABLES) {
      await requireTable(table);
      expect(
        await securityOf(table),
        `row-level security on public.${table}, WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee the owner escapes is not a guarantee (SEAM-TENANT)`,
      ).toEqual(peerSecurity);
      expect(
        await policiesOf(table),
        `public.${table} admits exactly the rows the convention profile admits — the workspace's own, and a system session that has recorded its reason (SEAM-TENANT)`,
      ).toEqual(peerPolicies);
    }
  });

  it("AC-4: the app role rewrites a grid and never accumulates one", async () => {
    const peer = await privilegesOf(PEER, ROLE_APP);
    expect(peer, `${ROLE_APP} reads, adds and takes away on public.${PEER} — never an UPDATE, which would edit a derivation in place instead of re-deriving it (L-REG-04)`).toEqual([
      "DELETE",
      "INSERT",
      "SELECT",
    ]);
    for (const { table } of TABLES) {
      await requireTable(table);
      expect(
        await privilegesOf(table, ROLE_APP),
        `${ROLE_APP} holds on public.${table} what it holds on public.${PEER}: a partition is REBUILT, so its rows are read, written and taken away again in one transaction (R-TO-030)`,
      ).toEqual(peer);
    }
  });

  it("AC-4: the store closes the families, the axes and a spacing that is not a distance", async () => {
    await requireTable(GRIDS);
    const lawful = await attemptGrid({});
    expect(lawful.ok, `a lawful axis row is one public.${GRIDS} accepts — with none accepted the refusals below would prove nothing:\n${lawful.stderr.slice(-600)}`).toBe(true);

    for (const family of ["diagonal", "LETTER", ""]) {
      const attempt = await attemptGrid({ family });
      expect(attempt.ok, `a family of '${family}' is outside the two L-CAD-07 names, so the store refuses the row however it reached the insert`).toBe(false);
      expect(attempt.sqlstate, `and it is a CHECK that refused '${family}', not something else about the row`).toBe(CHECK_VIOLATION);
    }

    for (const axis of ["z", "X", ""]) {
      const attempt = await attemptGrid({ axis });
      expect(attempt.ok, `an axis of '${axis}' is not a world axis a family georeferences along, so the store refuses the row`).toBe(false);
      expect(attempt.sqlstate, `and it is a CHECK that refused '${axis}'`).toBe(CHECK_VIOLATION);
    }

    for (const spacing of ["0", "-15"]) {
      const attempt = await attemptGrid({ minSpacing: spacing });
      expect(attempt.ok, `a minimum spacing of ${spacing} is not a distance placement can scale a share by (L-MEA-01), so the store refuses the row`).toBe(false);
      expect(attempt.sqlstate, `and it is a CHECK that refused ${spacing}`).toBe(CHECK_VIOLATION);
    }
  });

  it("AC-4: both tables are declared once, in the typed surface every seam read passes through", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const surface = core["SEAM_SCHEMA"] as Record<string, unknown> | undefined;
    expect(surface, `${DB_MODULE} exports SEAM_SCHEMA`).toBeTruthy();

    for (const { table, exported } of TABLES) {
      const declared = core[exported];
      expect(declared, `${DB_MODULE} must export \`${exported}\` for public.${table} — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();
      expect(
        Object.values(surface ?? {}).includes(declared),
        `SEAM_SCHEMA must carry ${table}: a table joins the typed surface by joining that object (B-05), and the live seam suite counts it there`,
      ).toBe(true);
    }
  });
});
