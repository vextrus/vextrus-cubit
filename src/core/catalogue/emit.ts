// L-MEA-04: the catalogue and the `bears` relation are TS consts "emitted as tables by migration
// with a drift stage". This is the emitter — the one place that turns the consts into the tables
// committed under `db/catalogue/`, and the same rendering the drift stage's digest is taken over, so
// the three copies (the consts, the committed tables, the migrated rows) cannot silently disagree.
//
// Run it after changing a const, and commit what it writes:
//
//   pnpm tsx src/core/catalogue/emit.ts
//
// Importing this module writes nothing: the rendering is pure and only a direct invocation touches
// the tree, so a reader of the tables — a test, a later lane — never has a side effect for asking.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { digestOf, filesUnder } from "../../../scripts/lib/digest.mjs";
import { BEARS } from "./bears";
import { WORK_ITEM_CATALOGUE } from "./catalogue";
import { KINDS } from "./kinds";

/** The tables the emitter writes, and the file each is committed under. */
export const CATALOGUE_FILES = ["work-items.json", "bears.json"] as const;

/** One of the emitted tables, named by its file. */
export type CatalogueFile = (typeof CATALOGUE_FILES)[number];

/** Where the tables and their digest are committed, repo-relative. */
export const CATALOGUE_DIR = "db/catalogue";

/** The file the catalogue's content address is recorded in, beside the tables it addresses. */
export const CATALOGUE_DIGEST_FILE = `${CATALOGUE_DIR}/digest.txt`;

/**
 * What identifies a row in each table — the fields the rows are ordered by. A stable order is what
 * makes the digest stable: two emissions of the same consts are the same bytes.
 */
const IDENTITY: Readonly<Record<CatalogueFile, readonly string[]>> = Object.freeze({
  "work-items.json": ["kind"],
  "bears.json": ["class", "kind"],
});

/** One emitted row: the flat record a JSON table and a database row both hold. */
export type CatalogueRow = Readonly<Record<string, string | number>>;

/** A row's sort key: its identity fields, in code-point order of the text they render to. */
function identityOf(file: CatalogueFile, row: CatalogueRow): string {
  return JSON.stringify((IDENTITY[file] ?? []).map((field) => String(row[field])));
}

/** The rows of a table, in the one order the emitter writes them. */
function ordered(file: CatalogueFile, rows: readonly CatalogueRow[]): readonly CatalogueRow[] {
  return [...rows].sort((left, right) => {
    const a = identityOf(file, left);
    const b = identityOf(file, right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * The rows each table holds, read straight off the consts: one work item per kind, and the `bears`
 * relation as it stands. The kind is carried into the work-item row as its own column, because a
 * table has no key but its columns.
 */
export function emittedRows(): Readonly<Record<CatalogueFile, readonly CatalogueRow[]>> {
  return Object.freeze({
    "work-items.json": ordered(
      "work-items.json",
      KINDS.map((kind) => {
        const item = WORK_ITEM_CATALOGUE[kind];
        return {
          kind,
          description: item.description,
          dimension: item.dimension,
          canonicalUnit: item.canonicalUnit,
          documentPrecision: item.documentPrecision,
        };
      }),
    ),
    "bears.json": ordered(
      "bears.json",
      BEARS.map((row) => ({ class: row.class, kind: row.kind })),
    ),
  });
}

/** The text of each table: 2-space JSON with a trailing newline, the form the tree commits. */
export function emittedTables(): Readonly<Record<CatalogueFile, string>> {
  const rows = emittedRows();
  return Object.freeze({
    "work-items.json": `${JSON.stringify(rows["work-items.json"], null, 2)}\n`,
    "bears.json": `${JSON.stringify(rows["bears.json"], null, 2)}\n`,
  });
}

/** The checkout the tables are committed in — three directories up from this module. */
const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

/**
 * Write the tables and record their digest. The digest is the toolchain's one digest function over
 * every file under `db/catalogue` but the record itself (ARCH-02), which is exactly what
 * `scripts/catalogue-drift.mjs` re-takes at the gate.
 */
export function writeCatalogue(): readonly string[] {
  const tables = emittedTables();
  const written: string[] = [];
  mkdirSync(resolve(REPO_ROOT, CATALOGUE_DIR), { recursive: true });
  for (const file of CATALOGUE_FILES) {
    writeFileSync(resolve(REPO_ROOT, CATALOGUE_DIR, file), tables[file], "utf8");
    written.push(`${CATALOGUE_DIR}/${file}`);
  }
  const sources = filesUnder(REPO_ROOT, resolve(REPO_ROOT, CATALOGUE_DIR), (relative) => relative !== CATALOGUE_DIGEST_FILE);
  writeFileSync(resolve(REPO_ROOT, CATALOGUE_DIGEST_FILE), `${digestOf(REPO_ROOT, sources)}\n`, "utf8");
  return [...written, CATALOGUE_DIGEST_FILE];
}

/** Only a direct invocation writes; an import renders and nothing more. */
const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  for (const file of writeCatalogue()) process.stdout.write(`catalogue: wrote ${file}\n`);
}
