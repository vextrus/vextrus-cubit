/**
 * Support for the sweep's database-lane suites (AC-1): one migrated scratch database, the shared
 * probe seeder's rows in it, and the product's own store doors opened against it.
 *
 * Nothing here transcribes a schema. The tables are found by the derivation `db/__tests__` already
 * publishes, the columns of a staged row are read off the row the seeder wrote, and a table's key
 * column is asked of the catalogue — so a column an area adds tomorrow rides along with no edit
 * (B-19). Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds these files
 * like the rest of the tree, and the product's doors are reached through the seam's own handle.
 */
import { expect } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, TENANT_ALPHA, TENANT_COLUMN } from "../../../../../db/__tests__/support/fixtures";
import { deriveTenantScopedTables, ensureRowsForTenants, ident, lit, run, seedTenants, withSession, type TableRef } from "../../../../../db/__tests__/support/live-sql";

/** The reason every read and every staged write below is recorded under (SEAM-TENANT). */
export const REASON = "test: judge the sweep's ledgers and constraints against a migrated store";

/** One row as psql hands it back: every column, as text or null. */
export type Row = Record<string, string | null>;

/** What a staged database offers a case: the urls, the workspace, and the tables it seeded. */
export type Stage = {
  readonly urlMigrate: string;
  readonly urlApp: string;
  readonly tenantId: string;
  readonly tables: ReadonlyMap<string, TableRef>;
};

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Give the scratch database back. Called from each suite's `afterAll`. */
export async function closeStage(): Promise<void> {
  await scratch?.drop();
  scratch = undefined;
  staging = undefined;
}

/**
 * The migrated database, seeded once and shared by every case of a file. Lazy and memoised, so a
 * failure here fails the cases rather than skipping them.
 */
export function staged(tables: readonly string[]): Promise<Stage> {
  return (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const tenantId = tenantIds[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");

    const scoped = new Map(deriveTenantScopedTables(provisioned.urlMigrate).map((table) => [table.table, table]));
    const wanted = tables.map((name) => scoped.get(name)).filter((table): table is TableRef => table !== undefined);
    expect(
      wanted.map((table) => table.table).sort(),
      `the migrated database holds every table these cases are about, tenant-scoped: ${[...tables].sort().join(", ")}`,
    ).toEqual([...tables].sort());
    // A probe row per table, parents and all, so each case has a real row to copy and compare with.
    ensureRowsForTenants(provisioned.urlMigrate, wanted, [tenantId]);
    // The seam builds its pool from `DATABASE_URL` when it is first asked for one (SEAM-TENANT), so
    // the product's own doors below open against this scratch database and no other.
    process.env["DATABASE_URL"] = provisioned.urlApp;

    return { urlMigrate: provisioned.urlMigrate, urlApp: provisioned.urlApp, tenantId, tables: new Map(wanted.map((table) => [table.table, table])) };
  })());
}

/** One statement or script, run as the migration role under the audit reason. */
export function asSystem(stage: Stage, script: string): string[][] {
  return run(stage.urlMigrate, withSession({ [GUC_SYSTEM_REASON]: REASON }, script));
}

/** Every column of one table, in catalogue order. */
export function columnsOf(stage: Stage, table: string): string[] {
  return asSystem(stage, `select attname from pg_attribute where attrelid = ${lit(`public.${table}`)}::regclass and attnum > 0 and not attisdropped order by attnum;`).map((row) => String(row[0] ?? ""));
}

/** Every index of one table, by name. */
export function indexesOf(stage: Stage, table: string): string[] {
  return asSystem(stage, `select indexname from pg_indexes where schemaname = 'public' and tablename = ${lit(table)} order by indexname;`).map((row) => String(row[0] ?? ""));
}

/** One table's CHECK constraints, as the database itself renders them. */
export function checksOf(stage: Stage, table: string): { name: string; definition: string }[] {
  return asSystem(
    stage,
    `select conname, pg_get_constraintdef(oid) from pg_constraint where contype = 'c' and conrelid = ${lit(`public.${table}`)}::regclass order by conname;`,
  ).map((row) => ({ name: String(row[0] ?? ""), definition: String(row[1] ?? "") }));
}

/** The single column a table's primary key is on, or "" where the key is composite. */
export function keyColumnOf(stage: Stage, table: string): string {
  const columns = asSystem(
    stage,
    `select a.attname from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'p' and c.conrelid = ${lit(`public.${table}`)}::regclass order by a.attnum;`,
  ).map((row) => String(row[0] ?? ""));
  return columns.length === 1 ? (columns[0] as string) : "";
}

/** Every row of one table belonging to the staged workspace, as JSON. */
export function rowsOf(stage: Stage, table: string): Row[] {
  const text =
    asSystem(
      stage,
      `select coalesce(json_agg(row_to_json(t) order by t::text), '[]'::json)::text from (select * from ${ident(table)} where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)}::uuid) t;`,
    )[0]?.[0] ?? "[]";
  return JSON.parse(text) as Row[];
}

/** The one row the seeder staged for a table — the template every copy below is written from. */
export function templateOf(stage: Stage, table: string): Row {
  const rows = rowsOf(stage, table);
  expect(rows.length, `the probe seeder staged a ${table} row for this workspace to copy`).toBeGreaterThan(0);
  return rows[0] as Row;
}

/**
 * One statement that copies the workspace's staged row of a table, with the named columns stated
 * differently. The copy is made IN SQL — `insert … select` off the row itself — so every column
 * keeps its own type and nothing round-trips a json array or a jsonb detail through a string (B-19).
 *
 * The append sequence is the store's to hand out and is never copied. A single-column key the store
 * defaults is left out too, unless the caller states one.
 */
export function copyStatement(stage: Stage, table: string, overrides: Readonly<Record<string, string | null>>): string {
  const key = keyColumnOf(stage, table);
  const skipped = new Set(["append_seq", ...(key !== "" && !Object.hasOwn(overrides, key) ? [key] : [])]);
  const columns = columnsOf(stage, table).filter((column) => !skipped.has(column));
  const chosen = columns.map((column) => {
    if (!Object.hasOwn(overrides, column)) return ident(column);
    const value = overrides[column];
    return value === null || value === undefined ? "null" : lit(value);
  });
  return `insert into ${ident(table)} (${columns.map(ident).join(", ")})
            select ${chosen.join(", ")} from ${ident(table)}
             where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)}::uuid
             order by ${ident(columns[0] as string)} limit 1;`;
}

/**
 * Write copies of a table's staged row INSIDE ONE TRANSACTION, in the order given.
 *
 * One transaction is the whole point: `now()` is fixed for its duration, so every row written here
 * carries one instant and nothing but the store's own write order can say which came last.
 */
export function appendInOneTransaction(stage: Stage, table: string, overrides: readonly Readonly<Record<string, string>>[]): void {
  asSystem(stage, `begin;\n${overrides.map((override) => copyStatement(stage, table, override)).join("\n")}\ncommit;`);
}

/** The same copy, on its own, answering what the store refused it with — or "" where it landed. */
export function copyRow(stage: Stage, table: string, overrides: Readonly<Record<string, string | null>>): string {
  try {
    asSystem(stage, copyStatement(stage, table, overrides));
    return "";
  } catch (failure) {
    return String((failure as Error).message ?? failure);
  }
}

/**
 * Offer a row to a table's CHECK constraints ALONE, and answer what refused it — or "" where it was
 * accepted.
 *
 * The row is offered to a temporary table made `like` the real one `including constraints`, so the
 * CHECKs judging it are the shipped table's own while the keys and indexes that would refuse a
 * second copy of a row for being a second copy are not in the way. What is being asked is what the
 * CHECK says about a row, and nothing else (B-19).
 */
export function offerToChecks(stage: Stage, table: string, overrides: Readonly<Record<string, string | null>>): string {
  const columns = columnsOf(stage, table).filter((column) => column !== "append_seq");
  const chosen = columns.map((column) => {
    if (!Object.hasOwn(overrides, column)) return ident(column);
    const value = overrides[column];
    return value === null || value === undefined ? "null" : lit(value);
  });
  const script = `create temp table check_probe (like public.${ident(table)} including constraints including defaults) on commit drop;
    insert into check_probe (${columns.map(ident).join(", ")})
         select ${chosen.join(", ")} from public.${ident(table)}
          where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)}::uuid limit 1;`;
  try {
    const written = asSystem(stage, `begin;\n${script}\nselect count(*)::text from check_probe;\ncommit;`);
    expect(written.at(-1)?.[0], `${table} held a row for this offer to be built from`).toBe("1");
    return "";
  } catch (failure) {
    return String((failure as Error).message ?? failure);
  }
}
