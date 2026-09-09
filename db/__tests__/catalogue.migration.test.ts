/**
 * AC-3 (the store's half) — the two catalogue tables a migration seeds, judged against the tables
 * committed under `db/catalogue/` (L-MEA-04, V-DB).
 *
 * The database every case reads is built by the product's own lane (`scripts/db-migrate.mjs`) over
 * the committed migrations, so no migration file is read here: a table standing in that database
 * with those rows in it is the migration, observed. Raw SQL is spoken through psql, never a driver
 * import — SEAM-TENANT's ban binds this file like the rest of the tree.
 *
 * The comparison is between the two copies AC-3 names: the JSON tables committed beside the
 * migration, and the rows the migration actually seeded. Neither side is transcribed here (B-19) —
 * the expected set is whatever `db/catalogue/*.json` holds, and a row is compared by what it says
 * rather than by how it spells a key, so `canonicalUnit` in the table and `canonical_unit` in the
 * column are read as the one row they are.
 *
 * The catalogue is code-owned (L-MEA-04): the runtime role reads it and never writes it, which is
 * the last case here.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, ROLE_APP } from "./support/fixtures";
import { lit, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The committed tables, and the table each is seeded into with the columns AC-3 names. */
const TABLES = [
  { file: "db/catalogue/work-items.json", table: "work_items", columns: ["kind", "description", "canonical_unit", "dimension", "document_precision"] },
  { file: "db/catalogue/bears.json", table: "bears", columns: ["class", "kind"] },
] as const;

/** The writes a code-owned catalogue never admits from the runtime role. */
const WRITES = ["INSERT", "UPDATE", "DELETE"] as const;

type Stage = { bootstrapUrl: string };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** The scratch database, migrated once for the file and addressed as its owner. */
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

/** Does this table stand in the migrated database at all? */
async function holds(table: string): Promise<boolean> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, `select count(*)::text from information_schema.tables where table_schema = 'public' and table_name = ${lit(table)};`)[0]?.[0] === "1";
}

/**
 * One row reduced to what two spellings of it have in common: keys without their case or their
 * separators, values as the text they render to. This is what lets the two copies be compared
 * without the acceptance deciding for the Builder how the JSON table spells a column.
 */
function normalisedRow(row: Record<string, unknown>): string {
  const pairs = Object.entries(row)
    .map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), String(value)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify(pairs);
}

const rowSet = (rows: readonly Record<string, unknown>[]): string[] => rows.map(normalisedRow).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** The rows a committed catalogue table holds. */
function committedRows(file: string): Record<string, unknown>[] {
  const path = join(REPO_ROOT, file);
  expect(existsSync(path), `${file} is missing from the tree — the catalogue tables are not emitted yet`).toBe(true);
  // white-box: AC-3 — the committed JSON table is one of the three copies the criterion says must
  // agree, so it is read as DATA and compared with the rows the migration seeded. No source text is
  // judged here: the migration itself is observed only through the database it built.
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  expect(Array.isArray(parsed), `${file} is a list of rows`).toBe(true);
  return parsed as Record<string, unknown>[];
}

/** The rows a migrated table holds, read as JSON so a description carrying a separator is still one row. */
async function seededRows(table: string, columns: readonly string[]): Promise<Record<string, unknown>[]> {
  const { bootstrapUrl } = await staged();
  const projection = columns.map((column) => `"${column}"`).join(", ");
  const text = run(bootstrapUrl, `select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (select ${projection} from public.${table}) t;`)[0]?.[0] ?? "[]";
  return JSON.parse(text) as Record<string, unknown>[];
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

describe("AC-3: the migrated catalogue is the committed catalogue", () => {
  for (const { file, table, columns } of TABLES) {
    it(`AC-3: public.${table} stands in the migrated database`, async () => {
      expect(await holds(table), `public.${table} is missing — no migration named *catalogue* has landed it yet`).toBe(true);
    });

    it(`AC-3: public.${table} holds exactly the rows ${file} holds`, async () => {
      expect(await holds(table), `public.${table} is missing — no migration named *catalogue* has landed it yet`).toBe(true);
      const committed = committedRows(file);
      expect(committed.length, `${file} carries at least one row to seed`).toBeGreaterThan(0);
      expect(
        await seededRows(table, columns),
        `the migration seeds public.${table} from the same catalogue the tree commits — a third copy that disagrees is the drift V-VERIFY exists to catch`,
      ).toHaveLength(committed.length);
      expect(
        rowSet(await seededRows(table, columns)),
        `every row of ${file} is a row of public.${table}, and public.${table} holds no other`,
      ).toEqual(rowSet(committed));
    });

    it(`AC-3: ${ROLE_APP} reads public.${table} and never writes it`, async () => {
      expect(await holds(table), `public.${table} is missing — no migration named *catalogue* has landed it yet`).toBe(true);
      const held = await privilegesOf(table, ROLE_APP);

      expect(held, `${ROLE_APP} reads the catalogue at runtime`).toContain("SELECT");
      for (const write of WRITES) {
        expect(held, `${ROLE_APP} does not ${write} public.${table} — the catalogue is code-owned, and a migration is the only thing that moves it (L-MEA-04)`).not.toContain(
          write,
        );
      }
    });
  }
});
