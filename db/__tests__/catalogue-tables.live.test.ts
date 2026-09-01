/**
 * Live acceptance for the emitted catalogue tables (L-MEA-04, V-VERIFY): AC-3's database half —
 * the migration lands `work_item_catalogue` and `bears`, and what Postgres holds is row-for-row the
 * consts, neither short of them nor beyond them.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree. The consts are loaded by absolute path, so a module the Builder has not written
 * yet fails as an assertion naming the file rather than killing collection at transform time.
 *
 * Agreement is asked of Postgres rather than transcribed here: the expected rows are handed over as
 * a VALUES list and the two directions of `EXCEPT` are what comes back, so a missing row and a row
 * nobody declared are both named, and the counts are compared beside it because `EXCEPT` de-dups.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { ROLE_APP } from "./support/fixtures";
import { count, ident, lit, psql, run, scalar } from "./support/live-sql";

const ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS = join(ROOT, "db", "migrations");

/** The two tables the test contract names, and their columns. */
const CATALOGUE_TABLE = "work_item_catalogue";
const CATALOGUE_COLUMNS = ["kind", "description", "canonical_unit", "dimension", "rounding_precision"] as const;
const BEARS_TABLE = "bears";
const BEARS_COLUMNS = ["element_type", "kind"] as const;

/** The consts the tables must agree with, at their declared homes. */
const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";
const BEARS_MODULE = "src/core/catalogue/bears.ts";
const KINDS_MODULE = "src/core/catalogue/kinds.ts";

interface CatalogueEntry {
  description: string;
  unit: string;
  dimension: string;
  precision: number;
}

/** A product module, asserted to exist before it is imported. */
async function productModule<T>(relative: string): Promise<T> {
  const absolute = join(ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

let scratch: ScratchDb | undefined;

/** The scratch database, provisioned once and memoised — a failure here is every case's failure. */
let pending: Promise<ScratchDb> | undefined;
const database = (): Promise<ScratchDb> =>
  (pending ??= (async (): Promise<ScratchDb> => {
    scratch = await provisionScratchDb();
    return scratch;
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** The rows CATALOGUE declares, in the shape the table holds them. */
async function catalogueRows(): Promise<string[][]> {
  const { CATALOGUE } = await productModule<{ CATALOGUE: Record<string, CatalogueEntry> }>(CATALOGUE_MODULE);
  const { KINDS } = await productModule<{ KINDS: readonly string[] }>(KINDS_MODULE);
  expect(KINDS.length, "KINDS must not be empty — an empty roster makes this comparison vacuous").toBeGreaterThan(0);
  return [...KINDS].map((kind) => {
    const entry = CATALOGUE[kind];
    expect(entry, `CATALOGUE has no entry for ${kind}`).toBeTypeOf("object");
    return [kind, entry?.description ?? "", entry?.unit ?? "", entry?.dimension ?? "", String(entry?.precision ?? "")];
  });
}

/** The (element class, kind) pairs BEARS declares. */
async function bearsRows(): Promise<string[][]> {
  const { BEARS } = await productModule<{ BEARS: Record<string, readonly string[]> }>(BEARS_MODULE);
  const pairs = Object.entries(BEARS).flatMap(([elementType, kinds]) => kinds.map((kind) => [elementType, kind]));
  expect(pairs.length, "BEARS must relate at least one class to a kind").toBeGreaterThan(0);
  return pairs;
}

/** A VALUES list of the declared rows, every column cast so `EXCEPT` compares like with like. */
function valuesList(rows: readonly string[][], casts: readonly string[]): string {
  return rows.map((row) => `(${row.map((value, column) => `cast(${lit(value)} as ${casts[column] ?? "text"})`).join(", ")})`).join(",\n         ");
}

/** What the table holds and what the consts declare, each side's surplus named by its first column. */
function disagreements(url: string, table: string, columns: readonly string[], rows: readonly string[][], casts: readonly string[]): string[] {
  const projection = columns.map((column) => ident(column)).join(", ");
  const answered = run(
    url,
    `with expected(${projection}) as (
       values ${valuesList(rows, casts)}
     ),
     held as (select ${projection} from ${ident(table)})
     select 'the table is missing the row for ' || ${ident(columns[0] ?? "kind")} from (select * from expected except select * from held) as short
     union all
     select 'the table holds a row nothing declares, for ' || ${ident(columns[0] ?? "kind")} from (select * from held except select * from expected) as extra;`,
  );
  return answered.map((row) => row.join(" "));
}

describe("AC-3: the catalogue and bears tables hold exactly what the consts declare", () => {
  it("AC-3: a db/migrations/*catalogue*.sql lands both tables with their declared columns and keys", async () => {
    const named = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql") && file.toLowerCase().includes("catalogue"));
    expect(named.length, "no db/migrations/*catalogue*.sql exists — the two tables are landed by migration").toBeGreaterThan(0);
    const sql = named.map((file) => readFileSync(join(MIGRATIONS, file), "utf8")).join("\n");
    expect(sql.length, "the catalogue migration is not empty").toBeGreaterThan(0);

    const { urlMigrate } = await database();
    for (const [table, columns] of [
      [CATALOGUE_TABLE, CATALOGUE_COLUMNS],
      [BEARS_TABLE, BEARS_COLUMNS],
    ] as const) {
      const exists = count(urlMigrate, `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relname = ${lit(table)} and c.relkind = 'r' and n.nspname not in ('pg_catalog', 'information_schema');`);
      expect(exists, `the migration must create the base table ${table}`).toBe(1);
      const held = run(urlMigrate, `select column_name from information_schema.columns where table_name = ${lit(table)} order by 1;`).map((row) => row[0]);
      for (const column of columns) {
        expect(held, `${table} must carry the column ${column}`).toContain(column);
      }
    }

    const cataloguePk = run(urlMigrate, `select a.attname from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = any(k.conkey) where c.relname = ${lit(CATALOGUE_TABLE)} and k.contype = 'p' order by 1;`).map((row) => row[0]);
    expect(cataloguePk, `${CATALOGUE_TABLE}'s primary key is the kind`).toEqual(["kind"]);

    const bearsPk = run(urlMigrate, `select a.attname from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = any(k.conkey) where c.relname = ${lit(BEARS_TABLE)} and k.contype = 'p' order by 1;`).map((row) => row[0]);
    expect(bearsPk, `${BEARS_TABLE}'s primary key is (element_type, kind)`).toEqual([...BEARS_COLUMNS].sort());
  });

  it("AC-3: work_item_catalogue holds exactly the rows of CATALOGUE", async () => {
    const { urlMigrate } = await database();
    const rows = await catalogueRows();
    const found = disagreements(urlMigrate, CATALOGUE_TABLE, CATALOGUE_COLUMNS, rows, ["text", "text", "text", "text", "int"]);
    expect(found, found.join("\n")).toEqual([]);
    expect(count(urlMigrate, `select count(*) from ${ident(CATALOGUE_TABLE)};`), `${CATALOGUE_TABLE} holds one row per kind and no duplicate`).toBe(rows.length);
  });

  it("AC-3: bears holds exactly the (element class, kind) pairs of BEARS", async () => {
    const { urlMigrate } = await database();
    const rows = await bearsRows();
    const found = disagreements(urlMigrate, BEARS_TABLE, BEARS_COLUMNS, rows, ["text", "text"]);
    expect(found, found.join("\n")).toEqual([]);
    expect(count(urlMigrate, `select count(*) from ${ident(BEARS_TABLE)};`), `${BEARS_TABLE} holds one row per declared pair and no duplicate`).toBe(rows.length);
  });

  it("AC-3: the runtime role can read both tables — the catalogue is reference data the product measures against", async () => {
    const { urlApp } = await database();
    for (const table of [CATALOGUE_TABLE, BEARS_TABLE]) {
      const read = psql(urlApp, `select count(*) from ${ident(table)};`);
      expect(read.ok, `${ROLE_APP} must be able to read ${table} (SQLSTATE ${read.sqlstate ?? "none"}):\n${read.stderr.slice(-600)}`).toBe(true);
      expect(Number(scalar(urlApp, `select count(*) from ${ident(table)};`)), `${table} answers the runtime role with the rows it holds`).toBeGreaterThan(0);
    }
  });
});
