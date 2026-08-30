/**
 * Public acceptance for inc-011-projects AC-1 (R-SPINE-010, SEAM-TENANT, V-DB): the `projects`
 * table — its one home in `src/core/db.ts`, its re-export through the schema tree the drift lane
 * generates from, its migration and journal append, and the posture and columns it lands under.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: no schema is transcribed. The RLS posture is derived by COMPARISON — every tenant-scoped
 * table the catalogue already knows about is asked what it wears, and `projects` is required to
 * wear the same — so an increment that later tightens the posture tightens this case with it. The
 * column set is graded as coverage of the fields R-SPINE-010 names, never as a roster: a later
 * increment adding a column must not redden this file.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_TENANT } from "./support/fixtures";
import { isTrue, lit, run } from "./support/live-sql";

/* ------------------------------------------------------------------ *
 * The names this suite asserts against. Every one is a literal the increment states in public — the
 * module homes from its interfaces, the five building types and the fields from AC-1's reading of
 * R-SPINE-010 — so nothing an assertion leans on is hidden from the Builder (B-12).
 *
 * NOTE FOR THE BUILDER: product modules are loaded by absolute path, so the `@/*` tsconfig alias is
 * never resolved inside them — keep imports between `src/` files relative, as `src/core/db.ts` does.
 * ------------------------------------------------------------------ */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT). */
const DB_MODULE = "src/core/db.ts";
/** What drizzle-kit generates from — db/schema.ts → db/schema/index.ts → the per-area file. */
const SCHEMA_BARREL = "db/schema.ts";
const SCHEMA_PROJECTS = "db/schema/projects.ts";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const PROJECTS_MIGRATION = "projects";
/** The table it lands, named by the increment's interfaces (`export const projects`). */
const PROJECTS_TABLE = "projects";

/** AC-1 closes the building type over exactly these five. */
const BUILDING_TYPES = ["residential", "commercial", "mixed", "industrial", "infrastructure"] as const;

/**
 * The fields R-SPINE-010 names, each with the shape of a column that would hold it. The pattern is
 * deliberately loose — this file grades COVERAGE, not a column-naming convention, and a schema that
 * spells `site_address` or `address_line` satisfies the clause identically.
 */
interface FieldMatcher {
  readonly field: string;
  readonly column: RegExp;
}
const RSPINE010_FIELDS: readonly FieldMatcher[] = [
  { field: "name", column: /(^|_)name$/ },
  { field: "code", column: /code/ },
  { field: "client", column: /client/ },
  { field: "site address", column: /address/ },
  { field: "district", column: /district/ },
  { field: "building type", column: /building.*type|type.*building/ },
  { field: "storeys", column: /storey/ },
  { field: "target GFA (m²)", column: /gfa|floor.*area/ },
  { field: "notes", column: /note/ },
];

/** AC-1's "archived marker", and the two timestamps beside it. */
const ARCHIVED_MARKER = /archiv/;
const CREATED_AT = /created/;
const UPDATED_AT = /updated/;

/** Import a product module by repo-relative path, asserting it exists first (the red we want). */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  let abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  if (statSync(abs).isDirectory()) {
    const barrel = ["index.ts", "index.tsx", "index.mts"].map((file) => join(abs, file)).find((file) => existsSync(file));
    expect(barrel, `${relative} is a directory with no index barrel`).toBeTruthy();
    abs = barrel ?? abs;
  }
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

const MIGRATIONS = join(REPO_ROOT, "db", "migrations");
const JOURNAL = join(MIGRATIONS, "meta", "_journal.json");

/** The qualified name every catalogue read below is about. */
const QUALIFIED = `public.${PROJECTS_TABLE}`;

/* ------------------------------------------------------------------ the migration, as a file */

function migrationFiles(): string[] {
  return existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")) : [];
}

/* ------------------------------------------------------------------ the migrated database */

type Stage = {
  bootstrapUrl: string;
  /** Every base table the catalogue reports carrying tenant_id — the denominator, not a list. */
  tenantScoped: string[];
};

let scratch: ScratchDb | undefined;
/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
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

/** Every column of the table, in declaration order, with the type Postgres holds it as. */
async function columns(): Promise<{ name: string; type: string }[]> {
  const { bootstrapUrl } = await staged();
  const rows = run(
    bootstrapUrl,
    `select column_name, data_type
       from information_schema.columns
      where table_schema = 'public' and table_name = ${lit(PROJECTS_TABLE)}
      order by ordinal_position;`,
  );
  expect(rows.length, `the migrated database holds no ${QUALIFIED} — AC-1's table has not landed`).toBeGreaterThan(0);
  return rows.map((row) => ({ name: row[0] ?? "", type: row[1] ?? "" }));
}

/** The one column that holds a field R-SPINE-010 names, refused as absent when nothing matches. */
async function columnFor(pattern: RegExp, field: string): Promise<{ name: string; type: string }> {
  const all = await columns();
  const matched = all.filter((column) => pattern.test(column.name));
  expect(
    matched.length,
    `R-SPINE-010 names "${field}", and no column of ${QUALIFIED} answers ${String(pattern)}. Its columns are: ${all.map((column) => `${column.name} ${column.type}`).join(", ")}`,
  ).toBeGreaterThan(0);
  return matched[0] ?? { name: "", type: "" };
}

/* ------------------------------------------------------------------ the cases */

describe("AC-1: the projects table is declared, re-exported and migrated", () => {
  it("AC-1: exactly one db/migrations/*projects*.sql exists and the journal carries its tag", () => {
    const matches = migrationFiles().filter((name) => name.includes(PROJECTS_MIGRATION));
    expect(
      matches.length,
      `exactly one db/migrations/*${PROJECTS_MIGRATION}*.sql is owed; found ${matches.length === 0 ? "none" : matches.join(", ")}`,
    ).toBe(1);

    expect(existsSync(JOURNAL), "drizzle's migration journal is part of the migration lane").toBe(true);
    const journal = readFileSync(JOURNAL, "utf8");
    const tag = (matches[0] ?? "").replace(/\.sql$/, "");
    expect(
      journal.includes(tag),
      `db/migrations/meta/_journal.json carries no entry tagged ${tag}; a migration the journal does not name is a migration the lane never applies`,
    ).toBe(true);
  });

  it("AC-1: src/core/db.ts exports the table and the schema tree the drift lane reads re-exports it", async () => {
    const core = await productModule<Record<string, unknown>>(DB_MODULE);
    const table = core[PROJECTS_TABLE];
    expect(table, `${DB_MODULE} must export \`${PROJECTS_TABLE}\` — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();

    const area = await productModule<Record<string, unknown>>(SCHEMA_PROJECTS);
    expect(
      area[PROJECTS_TABLE],
      `${SCHEMA_PROJECTS} must NAMED-re-export the same table object src/core/db.ts declares — a second declaration is a second home`,
    ).toBe(table);

    // The drift lane generates only from db/schema.ts: a table missing from THAT reachable set makes
    // drizzle-kit write a DROP migration, whatever db/schema/projects.ts says.
    const barrel = await productModule<Record<string, unknown>>(SCHEMA_BARREL);
    expect(
      barrel[PROJECTS_TABLE],
      `${SCHEMA_BARREL} must reach the table (through db/schema/index.ts) — the drift lane generates from this barrel and from nothing else`,
    ).toBe(table);
  });

  it("AC-1: projects is tenant-scoped and wears the same FORCE RLS posture as every other tenant-scoped table", async () => {
    const { bootstrapUrl, tenantScoped } = await staged();
    expect(
      tenantScoped,
      `${QUALIFIED} must carry tenant_id — R-SPINE-004 scopes a workspace's rows, and the live suite's denominator is the catalogue's own answer`,
    ).toContain(QUALIFIED);

    const posture = new Map<string, { enabled: boolean; forced: boolean }>();
    for (const row of run(
      bootstrapUrl,
      `select n.nspname || '.' || c.relname, c.relrowsecurity::text, c.relforcerowsecurity::text
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname = 'public';`,
    )) {
      posture.set(row[0] ?? "", { enabled: isTrue(row[1] ?? ""), forced: isTrue(row[2] ?? "") });
    }

    // The posture is not spelled here: it is whatever the peers already wear, so a later increment
    // that tightens it tightens this case with it.
    const peers = tenantScoped.filter((table) => table !== QUALIFIED);
    expect(peers.length, "there are tenant-scoped tables to compare against").toBeGreaterThan(0);
    for (const peer of peers) {
      const owed = posture.get(peer);
      expect(owed, `the catalogue reports no row-security posture for ${peer}`).toBeTruthy();
      expect(
        posture.get(QUALIFIED),
        `${QUALIFIED} must wear the row-security posture ${peer} wears — the same belt, or the table is scoped by convention only (SEAM-TENANT)`,
      ).toStrictEqual(owed);
    }

    const reading = new Set(
      run(
        bootstrapUrl,
        `select distinct n.nspname || '.' || c.relname
           from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
          where coalesce(pg_get_expr(p.polqual, p.polrelid), '') like ${lit(`%${GUC_TENANT}%`)}
             or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like ${lit(`%${GUC_TENANT}%`)};`,
      ).map((row) => row[0] ?? ""),
    );
    expect(
      reading.has(QUALIFIED),
      `${QUALIFIED} carries no policy reading ${GUC_TENANT}; the tables it is scoped beside all do (${[...reading].join(", ")})`,
    ).toBe(true);
  });

  it("AC-1: every field R-SPINE-010 names has a column, beside an archived marker and both timestamps", async () => {
    for (const { field, column } of RSPINE010_FIELDS) await columnFor(column, field);

    const storeys = await columnFor(/storey/, "storeys");
    expect(storeys.type, `storeys is a count of floors, so ${storeys.name} holds a whole number`).toMatch(/int|numeric|decimal/);

    const gfa = await columnFor(/gfa|floor.*area/, "target GFA (m²)");
    expect(gfa.type, `AC-1 stores target GFA in m², so ${gfa.name} holds a number rather than prose`).toMatch(/numeric|decimal|double|real|int/);

    const archived = await columnFor(ARCHIVED_MARKER, "an archived marker");
    expect(
      archived.type,
      `AC-4 flips ${archived.name} without deleting anything, so it is a marker — a boolean, or the timestamp at which it was set`,
    ).toMatch(/bool|timestamp/);

    for (const [pattern, what] of [
      [CREATED_AT, "created"],
      [UPDATED_AT, "updated"],
    ] as const) {
      const stamp = await columnFor(pattern, `the ${what} timestamp`);
      expect(stamp.type, `${stamp.name} is a timestamp`).toMatch(/timestamp/);
    }
  });

  it("AC-1: the building type is CHECK-closed over exactly the five R-SPINE-010 names", async () => {
    const { bootstrapUrl } = await staged();
    const buildingType = await columnFor(/building.*type|type.*building/, "building type");

    const checks = run(
      bootstrapUrl,
      `select conname, pg_get_constraintdef(oid)
         from pg_constraint
        where conrelid = ${lit(QUALIFIED)}::regclass and contype = 'c';`,
    ).map((row) => ({ name: row[0] ?? "", definition: row.slice(1).join("|") }));

    const closing = checks.filter((check) => check.definition.includes(buildingType.name));
    expect(
      closing.length,
      `AC-1 closes ${buildingType.name} with a CHECK; ${QUALIFIED} carries ${checks.length === 0 ? "no check constraint at all" : `checks over ${checks.map((check) => check.name).join(", ")}`}`,
    ).toBeGreaterThan(0);

    const offered = new Set(closing.flatMap((check) => [...check.definition.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? "")));
    expect(
      [...offered].sort(),
      `the CHECK over ${buildingType.name} must admit exactly the five building types R-SPINE-010 names and nothing else; it reads ${closing.map((check) => check.definition).join(" ; ")}`,
    ).toStrictEqual([...BUILDING_TYPES].sort());
  });
});
