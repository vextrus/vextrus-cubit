/**
 * Public acceptance for the emitted catalogue tables: AC-3's tree-side half — the deterministic
 * serialization, the committed JSON it must byte-equal, the migration that lands the same rows, and
 * the digest that arms V-VERIFY's `catalogue-drift` stage. (The rows Postgres actually holds are
 * judged live in `db/__tests__/catalogue-tables.live.test.ts`.)
 *
 * The JSON is read for content, not for column names it might reasonably choose differently: a row
 * is matched by the values it carries, so the serialization's shape stays the Builder's to pick
 * while its content stays the consts', exactly.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { BEARS_JSON, CATALOGUE_DIGEST, CATALOGUE_JSON, REPO_ROOT, flatValues, loadBears, loadCatalogue, loadEmit, loadKinds, stringRoster, type CatalogueEntry } from "./support/wire";

const MIGRATIONS = join(REPO_ROOT, "db", "migrations");
const DRIFT_SCRIPT = join("scripts", "catalogue-drift.mjs");

/** The two tables the test contract names, and the columns each must land. */
const CATALOGUE_TABLE = "work_item_catalogue";
const BEARS_TABLE = "bears";

/** A committed file's exact bytes. */
function bytesOf(relative: string): Buffer {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is not committed — emitCatalogueTables() has no recorded output to be judged against`).toBe(true);
  return readFileSync(absolute);
}

/** Whatever the emission parses to, read as a list of rows: an array of rows, or an object of them. */
function rowsOf(text: string, what: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (thrown) {
    throw new Error(`${what} is not valid JSON`, { cause: thrown });
  }
  if (Array.isArray(parsed)) return parsed;
  expect(parsed, `${what} is a list of rows, or an object whose values are rows`).toBeTypeOf("object");
  return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({ key, value }));
}

/** How many rows carry every one of these values somewhere inside them? */
function rowsCarrying(rows: readonly unknown[], values: readonly unknown[]): number {
  return rows.filter((row) => {
    const carried = flatValues(row);
    return values.every((value) => carried.includes(value));
  }).length;
}

describe("AC-3: the catalogue is emitted deterministically and committed", () => {
  test("AC-3: emitCatalogueTables() answers the two serializations and answers them identically twice", async () => {
    const { emitCatalogueTables } = await loadEmit();
    const first = emitCatalogueTables();
    const second = emitCatalogueTables();
    expect(typeof first.catalogue, "emitCatalogueTables().catalogue is a string").toBe("string");
    expect(typeof first.bears, "emitCatalogueTables().bears is a string").toBe("string");
    expect(first.catalogue.length, "the catalogue serialization is not empty").toBeGreaterThan(0);
    expect(first.bears.length, "the bears serialization is not empty").toBeGreaterThan(0);
    expect(second, "emitCatalogueTables() is deterministic — two calls in one process answer the same bytes").toEqual(first);
  });

  test("AC-3: db/catalogue/catalogue.json and db/catalogue/bears.json byte-equal the emission", async () => {
    const { emitCatalogueTables } = await loadEmit();
    const emitted = emitCatalogueTables();
    expect(bytesOf(CATALOGUE_JSON).equals(Buffer.from(emitted.catalogue, "utf8")), `${CATALOGUE_JSON} must be exactly what emitCatalogueTables().catalogue answers`).toBe(true);
    expect(bytesOf(BEARS_JSON).equals(Buffer.from(emitted.bears, "utf8")), `${BEARS_JSON} must be exactly what emitCatalogueTables().bears answers`).toBe(true);
  });

  test("AC-3: the emitted catalogue carries exactly one row per kind, holding that kind's entry", async () => {
    const { KINDS } = await loadKinds();
    const { CATALOGUE } = await loadCatalogue();
    const { emitCatalogueTables } = await loadEmit();
    const rows = rowsOf(emitCatalogueTables().catalogue, "the catalogue emission");
    const kinds = stringRoster(KINDS, "KINDS");
    expect(rows.length, "the catalogue emission holds one row per kind").toBe(kinds.length);
    for (const kind of kinds) {
      const entry = CATALOGUE[kind] as CatalogueEntry | undefined;
      expect(entry, `CATALOGUE has no entry for ${kind}`).toBeTypeOf("object");
      if (entry === undefined) continue;
      expect(rowsCarrying(rows, [kind, entry.description, entry.unit, entry.dimension, entry.precision]), `the catalogue emission must carry exactly one row holding ${kind} and its description, unit, dimension and precision`).toBe(1);
    }
  });

  test("AC-3: the emitted bears table carries exactly one row per (element class, kind) pair", async () => {
    const { BEARS } = await loadBears();
    const { emitCatalogueTables } = await loadEmit();
    const rows = rowsOf(emitCatalogueTables().bears, "the bears emission");
    const pairs = Object.entries(BEARS).flatMap(([elementType, kinds]) => (kinds as readonly string[]).map((kind) => [elementType, kind] as const));
    expect(pairs.length, "BEARS relates at least one class to a kind").toBeGreaterThan(0);
    expect(rows.length, "the bears emission holds one row per (element class, kind) pair").toBe(pairs.length);
    for (const [elementType, kind] of pairs) {
      expect(rowsCarrying(rows, [elementType, kind]), `the bears emission must carry exactly one row holding ${elementType} and ${kind}`).toBe(1);
    }
  });

  test("AC-3: a db/migrations/*catalogue*.sql lands both tables and inserts into them", () => {
    expect(existsSync(MIGRATIONS), "db/migrations is missing").toBe(true);
    const named = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql") && file.toLowerCase().includes("catalogue"));
    expect(named.length, "no db/migrations/*catalogue*.sql exists — the catalogue and bears tables are landed by migration").toBeGreaterThan(0);
    const sql = named.map((file) => readFileSync(join(MIGRATIONS, file), "utf8")).join("\n").toLowerCase();
    expect(sql, `the catalogue migration must create ${CATALOGUE_TABLE}`).toContain(CATALOGUE_TABLE);
    expect(sql, `the catalogue migration must create ${BEARS_TABLE}`).toContain(BEARS_TABLE);
    expect(sql, "the catalogue migration inserts the rows of the consts").toContain("insert into");
  });

  test("AC-3: the catalogue-drift stage is armed and exits 0 against the recorded digest", () => {
    const digest = bytesOf(CATALOGUE_DIGEST).toString("utf8").trim();
    expect(digest, `${CATALOGUE_DIGEST} records the digest the drift stage prints for the committed catalogue`).not.toBe("");

    const run = spawnSync(process.execPath, [DRIFT_SCRIPT], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    expect(run.status, `node ${DRIFT_SCRIPT} must exit 0 inside pnpm verify:\n${output}`).toBe(0);
    expect(output, `the drift stage must report the committed catalogue matching ${CATALOGUE_DIGEST}, not skip it`).toContain(digest);
  });
});
