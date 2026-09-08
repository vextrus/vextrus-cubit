// L-MEA-04: the catalogue and the `bears` relation are TS consts "emitted as tables by migration
// with a drift stage". This is the emitter — the one place that turns the consts into the tables
// committed under `db/catalogue/`, and the same rendering the drift stage's digest is taken over, so
// the three copies (the consts, the committed tables, the migrated rows) cannot silently disagree.
//
// The rendering is all that lives here, and it is pure: no file system, no argv, no reach out of
// `src/**` into the toolchain (ARCH-01, ARCH-02). A layer above may read a table without dragging a
// build tool into a client-reachable module, and importing this module writes nothing.
//
// Writing what it renders is a maintenance tool rather than product code, so it stands outside the
// layered tree. Run it after changing a const, and commit what it writes:
//
//   pnpm tsx tests/catalogue/emit-catalogue.ts
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

