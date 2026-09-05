/**
 * The three tables a drawing set is held in, as the store holds them (R-TO-005, L-REG-06,
 * SEAM-TENANT, V-DB): their one home in `src/core/db.ts`, their re-export through the schema tree
 * the drift lane generates from, the migration and journal append that land them, and the posture
 * each of them lands under — a set and its pinned revisions are ledgers, its membership is a draft.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree.
 *
 * B-19: no schema is transcribed. The immutability belt is derived by COMPARISON against the act
 * log's own — the ledger this tree already treats as its most consequential — so an increment that
 * changes how a belt is installed changes these cases with it, and the privileges are graded as the
 * retention property they encode rather than as a roster somebody typed twice.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { lit, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The one home of every cubit table (SEAM-TENANT), and the tree drizzle-kit reads them back from. */
const DB_MODULE = "src/core/db.ts";
const SCHEMA_BARREL = "db/schema.ts";
const SCHEMA_AREA = "db/schema/drawing-sets.ts";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const MIGRATION = "drawing-sets";

/** The tables the increment's interfaces name, under the exports that declare them. */
const TABLES: readonly { table: string; declared: string }[] = [
  { table: "drawing_sets", declared: "drawingSets" },
  { table: "drawing_set_members", declared: "drawingSetMembers" },
  { table: "drawing_set_revisions", declared: "drawingSetRevisions" },
];

/**
 * Which of them are ledgers. A set and each revision pinned on it are records of something that
 * happened and never change afterwards (L-REG-06: mutation is advance, never drift); the membership
 * between pins is a draft nothing is derived from (I-B), so the runtime may take a row of it away.
 */
const LEDGERS: readonly string[] = ["drawing_sets", "drawing_set_revisions"];
const DRAFT = "drawing_set_members";

/** The ledger whose belt every other ledger's is compared against (L-ACT-01's act log). */
const ACT_LOG = "acts";

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

/** The functions a table's own triggers fire — what "wears the same belt" is compared by. */
async function triggerFunctionsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct p.proname
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_proc p on p.oid = t.tgfoid
      where not t.tgisinternal and n.nspname = 'public' and c.relname = ${lit(table)}
      order by 1;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

/** The constraint definitions of one kind a table carries. */
async function constraintsOf(table: string, kind: "p" | "u" | "f" | "c"): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select pg_get_constraintdef(oid)
       from pg_constraint
      where conrelid = ${lit(`public.${table}`)}::regclass and contype = ${lit(kind)}
      order by conname;`,
  ).map((row) => row[0] ?? "");
}

describe("the drawing-set tables are declared, re-exported and migrated", () => {
  it(`exactly one db/migrations/*${MIGRATION}*.sql exists and the journal carries its tag`, () => {
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
    const area = await productModule<Record<string, unknown>>(SCHEMA_AREA);
    const barrel = await productModule<Record<string, unknown>>(SCHEMA_BARREL);

    for (const { declared } of TABLES) {
      const table = core[declared];
      expect(table, `${DB_MODULE} must export \`${declared}\` — every cubit table has one home (SEAM-TENANT, ARCH-02)`).toBeTruthy();
      expect(area[declared], `${SCHEMA_AREA} must NAMED-re-export the same table object — a second declaration is a second home`).toBe(table);
      // The drift lane generates only from db/schema.ts: a table missing from THAT reachable set
      // makes drizzle-kit write a DROP migration, whatever the area file says.
      expect(barrel[declared], `${SCHEMA_BARREL} must reach ${declared} — the drift lane generates from this barrel and from nothing else`).toBe(table);
    }
  });

  it("each table is tenant-scoped, so the posture every peer wears binds it too", async () => {
    const { tenantScoped } = await staged();
    for (const { table } of TABLES) {
      expect(tenantScoped, `public.${table} carries ${TENANT_COLUMN} — a workspace's sets are its own (R-SPINE-004)`).toContain(`public.${table}`);
    }
  });

  it("a set and its pinned revisions are evidence; the membership between pins is a draft", async () => {
    for (const table of LEDGERS) {
      expect(
        await privilegesOf(table, ROLE_APP),
        `${ROLE_APP} reads and adds ${table} and takes nothing away — a pinned revision never changes (L-REG-06: mutation is advance, never drift)`,
      ).toEqual(["INSERT", "SELECT"]);
    }
    expect(
      await privilegesOf(DRAFT, ROLE_APP),
      `${ROLE_APP} may add and remove a ${DRAFT} row and never rewrite one — membership is a draft edited by single-subject toggles (I-B)`,
    ).toEqual(["DELETE", "INSERT", "SELECT"]);
  });

  it("both ledgers wear the act log's own immutability belt, and the draft wears none of it", async () => {
    const belt = await triggerFunctionsOf(ACT_LOG);
    expect(belt.length, `public.${ACT_LOG} wears the owner-proof belt these tables are compared against — with none there is nothing to compare`).toBeGreaterThan(0);

    for (const table of LEDGERS) {
      expect(
        await triggerFunctionsOf(table),
        `public.${table} fires every trigger the act log fires — the most consequential ledger never wears stronger belts than the record a campaign is measured against (L-ACT-03's class)`,
      ).toEqual(expect.arrayContaining(belt));
    }
    const draft = await triggerFunctionsOf(DRAFT);
    expect(
      belt.filter((fired) => draft.includes(fired)),
      `public.${DRAFT} wears no append-only belt: a draft is edited, and a row taken out of it is not evidence destroyed (I-B)`,
    ).toEqual([]);
  });

  it("a set is named once per project, a membership is one row per (set, drawing), and a revision cites its act", async () => {
    const unique = [...(await constraintsOf("drawing_sets", "u")), ...(await constraintsOf("drawing_sets", "p"))];
    expect(
      unique.some((definition) => definition.includes(TENANT_COLUMN) && definition.includes("project_id") && definition.includes("name")),
      "a project's sets are named apart from one another: (tenant_id, project_id, name) is unique, so SET_NAME_NOT_USABLE is a property of the store and not of a writer remembering to look",
    ).toBe(true);

    const membership = await constraintsOf("drawing_set_members", "p");
    expect(membership.length, "public.drawing_set_members carries a primary key").toBe(1);
    for (const column of [TENANT_COLUMN, "set_id", "drawing_id"]) {
      expect(membership[0], `a drawing is in a set once: the key is (${TENANT_COLUMN}, set_id, drawing_id)`).toContain(column);
    }

    const members = await constraintsOf("drawing_set_members", "f");
    expect(members.some((definition) => definition.includes("drawing_sets")), "a membership points at the set it belongs to").toBe(true);
    expect(members.some((definition) => definition.includes("drawings")), "and at a drawing the store holds").toBe(true);

    const revisions = await constraintsOf("drawing_set_revisions", "f");
    expect(
      revisions.some((definition) => definition.includes(ACT_LOG)),
      "a pinned revision names the act that authored it — an immutable record with no author is not a record (L-ACT-01)",
    ).toBe(true);
    expect(revisions.some((definition) => definition.includes("drawing_sets")), "and the set it is a revision of").toBe(true);
  });

  it("the read a set browser makes is indexed: one set's revisions, newest first", async () => {
    const { bootstrapUrl } = await staged();
    const indexes = run(
      bootstrapUrl,
      `select indexdef from pg_indexes where schemaname = 'public' and tablename = 'drawing_set_revisions';`,
    ).map((row) => row[0] ?? "");
    expect(
      indexes.some((definition) => definition.includes(TENANT_COLUMN) && definition.includes("set_id") && definition.includes("created_at")),
      "the browser reads one set's pinned revisions in the order they were pinned, and the store is asked that way",
    ).toBe(true);
  });
});
