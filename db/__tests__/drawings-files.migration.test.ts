/**
 * The upload seam's three tables as the store holds them (R-SPINE-020, R-SPINE-021, SEAM-TENANT):
 * their one home in `src/core/db.ts`, their re-export through the schema tree the drift lane
 * generates from, the migration and journal append that land them, and the posture they land under.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: no schema is transcribed. The row-security posture is derived by COMPARISON against every
 * other tenant-scoped table the catalogue reports, so an increment that tightens the posture tightens
 * these cases with it, and the privileges are graded as the retention property they encode —
 * drawings are evidence, so nothing may take one away — rather than as a roster of grants.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { isTrue, lit, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT), and the tree drizzle-kit reads them back from. */
const DB_MODULE = "src/core/db.ts";
const SCHEMA_BARREL = "db/schema.ts";
const SCHEMA_DRAWINGS = "db/schema/drawings.ts";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const MIGRATION = "drawings-files";

/** The three tables the seam's interfaces name, and what each of them is for. */
const TABLES = ["files", "drawings", "uploads"] as const;

/**
 * Which of them are evidence. R-SPINE-021 retains every revision forever, so the app role may add a
 * row and read it and do nothing else; an upload session is a transfer in progress rather than a
 * record of one, and its acknowledged offset moves while the bytes arrive.
 */
const EVIDENCE: readonly string[] = ["files", "drawings"];

const MIGRATIONS = join(REPO_ROOT, "db", "migrations");
const JOURNAL = join(MIGRATIONS, "meta", "_journal.json");

async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

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

/** Every column of a table, with the type Postgres holds it as. */
async function columns(table: string): Promise<{ name: string; type: string }[]> {
  const { bootstrapUrl } = await staged();
  const rows = run(
    bootstrapUrl,
    `select column_name, data_type
       from information_schema.columns
      where table_schema = 'public' and table_name = ${lit(table)}
      order by ordinal_position;`,
  );
  expect(rows.length, `the migrated database holds no public.${table} — the seam's table has not landed`).toBeGreaterThan(0);
  return rows.map((row) => ({ name: row[0] ?? "", type: row[1] ?? "" }));
}

/** The privileges a role holds on a table, as the catalogue reports them. */
async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)}
      order by privilege_type;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

describe("the upload seam's tables are declared, re-exported and migrated", () => {
  it("exactly one db/migrations/*drawings-files*.sql exists and the journal carries its tag", () => {
    const matches = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .filter((name) => name.includes(MIGRATION));
    expect(matches.length, `exactly one db/migrations/*${MIGRATION}*.sql is owed; found ${matches.length === 0 ? "none" : matches.join(", ")}`).toBe(1);

    const tag = (matches[0] ?? "").replace(/\.sql$/, "");
    expect(
      readFileSync(JOURNAL, "utf8").includes(tag),
      `db/migrations/meta/_journal.json carries no entry tagged ${tag}; a migration the journal does not name is a migration the lane never applies`,
    ).toBe(true);
  });

  it("src/core/db.ts declares each table once, and the schema tree the drift lane reads re-exports it", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const area = await productModule<Record<string, unknown>>(SCHEMA_DRAWINGS);
    const barrel = await productModule<Record<string, unknown>>(SCHEMA_BARREL);

    for (const table of TABLES) {
      const declared = core[table];
      expect(declared, `${DB_MODULE} must export \`${table}\` — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();
      expect(area[table], `${SCHEMA_DRAWINGS} must NAMED-re-export the same table object — a second declaration is a second home`).toBe(declared);
      // The drift lane generates only from db/schema.ts: a table missing from THAT reachable set
      // makes drizzle-kit write a DROP migration, whatever db/schema/drawings.ts says.
      expect(barrel[table], `${SCHEMA_BARREL} must reach ${table} — the drift lane generates from this barrel and from nothing else`).toBe(declared);
    }
  });

  it("each table is tenant-scoped and wears the row-security posture its peers wear", async () => {
    const { bootstrapUrl, tenantScoped } = await staged();
    const posture = new Map<string, { enabled: boolean; forced: boolean }>();
    for (const row of run(
      bootstrapUrl,
      `select n.nspname || '.' || c.relname, c.relrowsecurity::text, c.relforcerowsecurity::text
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname = 'public';`,
    )) {
      posture.set(row[0] ?? "", { enabled: isTrue(row[1] ?? ""), forced: isTrue(row[2] ?? "") });
    }

    const scoping = new Set(
      run(
        bootstrapUrl,
        `select distinct n.nspname || '.' || c.relname
           from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
          where coalesce(pg_get_expr(p.polqual, p.polrelid), '') like ${lit(`%${GUC_TENANT}%`)}
             or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like ${lit(`%${GUC_TENANT}%`)};`,
      ).map((row) => row[0] ?? ""),
    );

    for (const table of TABLES) {
      const qualified = `public.${table}`;
      expect(tenantScoped, `${qualified} carries ${TENANT_COLUMN} — a workspace's drawings are its own (R-SPINE-004)`).toContain(qualified);
      // The posture is not spelled here: it is whatever the peers already wear.
      const peers = tenantScoped.filter((peer) => !TABLES.some((own) => peer === `public.${own}`));
      expect(peers.length, "there are tenant-scoped tables to compare against").toBeGreaterThan(0);
      for (const peer of peers) {
        expect(posture.get(qualified), `${qualified} must wear the row-security posture ${peer} wears (SEAM-TENANT)`).toStrictEqual(posture.get(peer));
      }
      expect(scoping.has(qualified), `${qualified} carries no policy reading ${GUC_TENANT}; every table it is scoped beside does`).toBe(true);
    }
  });

  it("stored content and drawings are evidence: the app role can add and read them, and nothing else", async () => {
    for (const table of EVIDENCE) {
      const held = await privilegesOf(table, ROLE_APP);
      expect(held, `${ROLE_APP} reads and adds ${table} (R-SPINE-020)`).toEqual(["INSERT", "SELECT"]);
    }
    const sessions = await privilegesOf("uploads", ROLE_APP);
    expect(
      sessions,
      "an upload session's acknowledged offset and its ending move while the bytes arrive, so the app role may change it — and still take nothing away (R-SPINE-021)",
    ).toEqual(["INSERT", "SELECT", "UPDATE"]);
  });

  it("content is addressed by its digest, and a drawing points at content the store holds", async () => {
    const { bootstrapUrl } = await staged();
    const keys = run(
      bootstrapUrl,
      `select conname, pg_get_constraintdef(oid)
         from pg_constraint
        where conrelid = 'public.files'::regclass and contype = 'p';`,
    ).map((row) => row.slice(1).join("|"));
    expect(keys.length, "public.files carries a primary key").toBe(1);
    for (const column of [TENANT_COLUMN, "sha256"]) {
      expect(keys[0], `the address of a stored content is (${TENANT_COLUMN}, sha256): one row per distinct content per workspace`).toContain(column);
    }

    const foreign = run(
      bootstrapUrl,
      `select pg_get_constraintdef(oid)
         from pg_constraint
        where conrelid = 'public.drawings'::regclass and contype = 'f';`,
    ).map((row) => row.join("|"));
    expect(
      foreign.some((definition) => definition.includes("files") && definition.includes("sha256") && definition.includes(TENANT_COLUMN)),
      `public.drawings must point at public.files by (${TENANT_COLUMN}, sha256) — "detected and linked, not re-stored" is a property of the schema, not of a writer remembering to check`,
    ).toBe(true);

    const digest = (await columns("files")).find((column) => column.name === "sha256");
    expect(digest?.type, "a content address is text — 64 lowercase hex characters, as the storage seam spells it").toMatch(/text|char/);
  });
});
