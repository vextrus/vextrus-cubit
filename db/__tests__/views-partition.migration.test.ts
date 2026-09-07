/**
 * AC-3 (the store's half) — the three tables the stored partition is rewritten into
 * (R-TO-030, L-CAD-06, SEAM-TENANT, V-DB).
 *
 * A partition is REBUILT per ingest: its rows are deleted and written again in one transaction, so
 * unlike a ledger these tables are not append-only and the app role really holds a DELETE on the two
 * that are rewritten. What makes them trustworthy instead is the scope — a workspace's partition is
 * its own — and that is what is graded here, by COMPARISON against the tenant-scoped tables already
 * in the migrated database rather than by transcription, so an increment that tightens the posture
 * tightens this case with it (B-19).
 *
 * The column names below are the acceptance's own contract with the store: the rebuild suite and the
 * held-out set read a partition back through exactly these names, so a table that carries the facts
 * under other spellings is a table those reads cannot make.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file too.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, GUC_TENANT, HANDWRITTEN_MARKER, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { isTrue, lit, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT), and the tree the drift lane reads them back from. */
const DB_MODULE = "src/core/db.ts";
const SCHEMA_BARREL = "db/schema.ts";
const SCHEMA_AREA = "db/schema/takeoff-views.ts";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const MIGRATION = "views-partition";

/**
 * The three tables, the name each is exported under, and the columns the acceptance reads it by.
 * `partition_views` (not `views`): a bare `views` identifier reads as SQL's information_schema view
 * and as drizzle's view builders (settled).
 */
const TABLES = [
  {
    table: "partition_views",
    exported: "partitionViews",
    /** A view is keyed by its own key, carries the type the grammar read and why it could not. */
    columns: ["view_key", "type", "reason"],
    rewritten: true,
  },
  {
    table: "view_assignments",
    exported: "viewAssignments",
    /** One row per model-space original entity: which entity, and the view it landed in. */
    columns: ["entity_key", "view_key"],
    rewritten: true,
  },
  {
    table: "view_type_confirmations",
    exported: "viewTypeConfirmations",
    /** What a person confirmed, for which view, and the act that carried it (L-ACT-01). */
    columns: ["view_key", "type", "act_id"],
    rewritten: false,
  },
] as const;

/** Both rewritten tables are scoped to the ingest whose partition they hold. */
const INGEST_SCOPED = ["partition_views", "view_assignments"];

const MIGRATIONS = join(REPO_ROOT, "db", "migrations");
const JOURNAL = join(MIGRATIONS, "meta", "_journal.json");

/** Import a product module by repo-relative path, asserting it exists first. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

type Stage = { bootstrapUrl: string; urlApp: string; tenantScoped: string[] };

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
    return { bootstrapUrl, urlApp: provisioned.urlApp, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl) };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Every column of a table, with the type Postgres holds it as and whether it may be absent. */
async function columns(table: string): Promise<Map<string, { type: string; nullable: boolean }>> {
  const { bootstrapUrl } = await staged();
  const rows = run(
    bootstrapUrl,
    `select column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = ${lit(table)} order by ordinal_position;`,
  );
  expect(rows.length, `the migrated database holds no public.${table} — the stored partition has not landed`).toBeGreaterThan(0);
  return new Map(rows.map((row) => [row[0] ?? "", { type: row[1] ?? "", nullable: (row[2] ?? "") === "YES" }]));
}

describe("AC-3: the stored partition's tables are declared once, migrated, and scoped", () => {
  it("AC-3: exactly one db/migrations/*views-partition*.sql exists, the journal carries its tag, and the posture stands after the hand-written marker", () => {
    const matches = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .filter((name) => name.includes(MIGRATION));
    expect(matches.length, `exactly one db/migrations/*${MIGRATION}*.sql is owed; found ${matches.length === 0 ? "none" : matches.join(", ")}`).toBe(1);

    const tag = (matches[0] ?? "").replace(/\.sql$/, "");
    expect(
      readFileSync(JOURNAL, "utf8").includes(tag),
      `db/migrations/meta/_journal.json carries no entry tagged ${tag}; a migration the journal does not name is a migration the lane never applies`,
    ).toBe(true);

    const sql = readFileSync(join(MIGRATIONS, matches[0] ?? ""), "utf8");
    const marker = sql.indexOf(HANDWRITTEN_MARKER);
    expect(marker, `the migration must carry the line ${JSON.stringify(HANDWRITTEN_MARKER)} once, between the generated half and the hand-written one`).toBeGreaterThanOrEqual(0);
    expect(sql.indexOf(HANDWRITTEN_MARKER, marker + 1), "the hand-written marker stands exactly once").toBe(-1);
    for (const handwritten of ["row level security", "create policy", "grant "]) {
      const at = sql.toLowerCase().indexOf(handwritten);
      expect(at, `the migration states \`${handwritten.trim()}\` — nothing generated declares the seam's posture`).toBeGreaterThanOrEqual(0);
      expect(at > marker, `\`${handwritten.trim()}\` belongs to the hand-written half, after the marker`).toBe(true);
    }
  });

  it("AC-3: src/core/db.ts declares each table once, db/schema/takeoff-views.ts re-exports it, the drift barrel reaches it, and SEAM_SCHEMA carries it", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const area = await productModule<Record<string, unknown>>(SCHEMA_AREA);
    const barrel = await productModule<Record<string, unknown>>(SCHEMA_BARREL);
    const surface = core["SEAM_SCHEMA"] as Record<string, unknown> | undefined;
    expect(surface, `${DB_MODULE} exports SEAM_SCHEMA`).toBeTruthy();

    for (const { table, exported } of TABLES) {
      const declared = core[exported];
      expect(declared, `${DB_MODULE} must export \`${exported}\` for public.${table} — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();
      expect(area[exported], `${SCHEMA_AREA} must NAMED-re-export the same table object — a second declaration is a second home`).toBe(declared);
      // The drift lane generates only from db/schema.ts: a table missing from THAT reachable set
      // makes drizzle-kit write a DROP migration, whatever the area file says.
      expect(barrel[exported], `${SCHEMA_BARREL} must reach ${exported} — the drift lane generates from this barrel and from nothing else`).toBe(declared);
      expect(
        Object.values(surface ?? {}).includes(declared),
        `SEAM_SCHEMA must carry ${table}: a table joins the typed surface by joining that object (B-05), and the live seam suite counts it there`,
      ).toBe(true);
    }
  });

  it("AC-3: each table carries the facts a partition is made of, under the names the partition is read back by", async () => {
    for (const { table, columns: owed } of TABLES) {
      const held = await columns(table);
      for (const name of [TENANT_COLUMN, ...owed]) {
        const column = held.get(name);
        expect(column, `public.${table}.${name} is owed by AC-3 — the acceptance reads a stored partition by these names`).toBeTruthy();
      }
      expect(held.get(TENANT_COLUMN)?.type, `public.${table}.${TENANT_COLUMN} is the workspace's own id`).toBe("uuid");
      expect(held.get(TENANT_COLUMN)?.nullable, `public.${table}.${TENANT_COLUMN} is never absent — an unscoped row belongs to everybody`).toBe(false);
    }

    // The two rewritten tables hold a partition OF one ingest: the rewrite deletes and re-inserts
    // exactly that ingest's rows, which it cannot address without saying which ingest they are for.
    for (const table of INGEST_SCOPED) {
      const held = await columns(table);
      expect(held.get("ingest_id"), `public.${table}.ingest_id says which ingest's partition a row belongs to`).toBeTruthy();
      expect(held.get("ingest_id")?.type, `public.${table}.ingest_id is an ingest's own id`).toBe("uuid");
    }
  });

  it("AC-3: every one of the three is tenant-scoped, wears the posture its peers wear, and names a tenant policy", async () => {
    const { bootstrapUrl, tenantScoped } = await staged();
    const posture = new Map<string, string>();
    for (const row of run(
      bootstrapUrl,
      `select n.nspname || '.' || c.relname, c.relrowsecurity::text || '/' || c.relforcerowsecurity::text
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname = 'public';`,
    )) {
      posture.set(row[0] ?? "", row[1] ?? "");
    }

    const qualified = TABLES.map(({ table }) => `public.${table}`);
    const peers = tenantScoped.filter((peer) => !qualified.includes(peer));
    expect(peers.length, "there are tenant-scoped tables to compare against").toBeGreaterThan(0);

    for (const { table } of TABLES) {
      const own = `public.${table}`;
      expect(tenantScoped, `${own} carries ${TENANT_COLUMN} — a workspace's partition is its own (R-SPINE-004)`).toContain(own);
      // Not spelled here: whatever every other tenant-scoped table wears is what this one wears.
      for (const peer of peers) {
        expect(posture.get(own), `${own} must wear the row-security posture ${peer} wears (SEAM-TENANT)`).toBe(posture.get(peer));
      }

      const forced = run(bootstrapUrl, `select relforcerowsecurity::text from pg_class where oid = ${lit(own)}::regclass;`);
      expect(isTrue(forced[0]?.[0] ?? ""), `${own}: row security is FORCED, so the owner is bound by the scope too (SEAM-TENANT)`).toBe(true);

      const policies = run(
        bootstrapUrl,
        `select polname, coalesce(pg_get_expr(polqual, polrelid), '') || ' ' || coalesce(pg_get_expr(polwithcheck, polrelid), '')
           from pg_policy where polrelid = ${lit(own)}::regclass;`,
      ).map((row) => `${row[0] ?? ""} ${row[1] ?? ""}`);
      expect(policies.length, `${own} carries policies; it carries none`).toBeGreaterThan(0);
      expect(
        policies.some((policy) => policy.includes(GUC_TENANT)),
        `${own} carries a tenant policy judged against the scope the request armed; it carries ${policies.join(" | ") || "none"}`,
      ).toBe(true);
      expect(
        policies.some((policy) => policy.includes(GUC_SYSTEM_REASON)),
        `${own} carries a system-scope policy, and a system read states its reason (SEAM-TENANT)`,
      ).toBe(true);
    }
  });

  it("AC-3: the app role may rewrite a partition and may not rewrite a confirmation", async () => {
    const { bootstrapUrl } = await staged();
    for (const { table, rewritten } of TABLES) {
      const held = run(
        bootstrapUrl,
        `select distinct privilege_type from information_schema.role_table_grants
          where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(ROLE_APP)} order by privilege_type;`,
      ).map((row) => row[0] ?? "");
      for (const needed of ["INSERT", "SELECT"]) {
        expect(held, `${ROLE_APP} writes and reads ${table} — a partition nobody may write is not stored`).toContain(needed);
      }
      expect(
        held.includes("DELETE"),
        rewritten
          ? `${table} is REWRITTEN per ingest (delete and insert in one transaction), so the app role holds a DELETE on it`
          : `${table} records what a person confirmed; a confirmation the app role can take away is not a record of an act (L-ACT-01)`,
      ).toBe(rewritten);
    }
  });

  it("AC-3: nothing points at an append-only ledger — a rewritten table is not a child of one", async () => {
    const { bootstrapUrl } = await staged();
    // The act-immutability case empties `acts` with TRUNCATE, and Postgres refuses to truncate a
    // table another one references (0A000). A partition that is rebuilt per ingest therefore names
    // the ingest and the act by id and points at neither.
    for (const table of INGEST_SCOPED) {
      await columns(table);
      const foreign = run(
        bootstrapUrl,
        `select pg_get_constraintdef(oid) from pg_constraint where conrelid = ${lit(`public.${table}`)}::regclass and contype = 'f';`,
      ).map((row) => row.join(" "));
      for (const ledger of ["ingests", "drawings", "model_calls", "acts"]) {
        expect(
          foreign.filter((definition) => new RegExp(`\\b${ledger}\\b`).test(definition)),
          `public.${table} references public.${ledger}; a table rebuilt per ingest may not be a child of an append-only ledger — the merged act-immutability case dies on 0A000`,
        ).toEqual([]);
      }
    }
  });
});
