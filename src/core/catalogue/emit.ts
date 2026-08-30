// L-MEA-04: the catalogue and the `bears` relation, serialized as the tables the database holds.
//
// The consts above are the source; Postgres holds a copy, and a copy is only safe while something
// can prove it is still a copy. That is what this emission is for: it is the one rendering of the
// two consts into rows, the migration inserts exactly these rows, `db/catalogue/*.json` records
// them, and V-VERIFY's `catalogue-drift` stage digests that record — so a kind added to the enum
// without re-recording the tables fails the gate rather than reaching a document.
//
// Determinism is the whole contract of this file: same source, same bytes, on any machine and in
// any order the objects were written in. Rows are therefore sorted by their primary key, compared
// by code point — the tree's locale machinery has one caller and it is not this one (LAW-FMT).
import { BEARS } from "./bears";
import { CATALOGUE } from "./catalogue";

/** One `work_item_catalogue` row, keyed as the table's columns are. */
export type CatalogueRow = {
  kind: string;
  description: string;
  canonical_unit: string;
  dimension: string;
  rounding_precision: number;
};

/** One `bears` row: a class, and a kind it lawfully bears. */
export type BearsRow = {
  element_type: string;
  kind: string;
};

/** Code-point order, so the emission does not depend on a locale or on declaration order. */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** The catalogue as rows, one per kind, ordered by kind. */
export function catalogueTableRows(): CatalogueRow[] {
  return Object.entries(CATALOGUE)
    .map(([kind, entry]) => ({
      kind,
      description: entry.description,
      canonical_unit: entry.unit,
      dimension: entry.dimension,
      rounding_precision: entry.precision,
    }))
    .sort((left, right) => byCodePoint(left.kind, right.kind));
}

/** The relation as rows, one per (class, kind) pair, ordered by class then kind. */
export function bearsTableRows(): BearsRow[] {
  return Object.entries(BEARS)
    .flatMap(([elementType, kinds]) => (kinds ?? []).map((kind) => ({ element_type: elementType, kind })))
    .sort((left, right) => byCodePoint(left.element_type, right.element_type) || byCodePoint(left.kind, right.kind));
}

/**
 * The two serializations, byte for byte as `db/catalogue/catalogue.json` and `db/catalogue/bears.json`
 * hold them: two-space JSON with a trailing newline, so the committed files are ordinary text a
 * reviewer reads and a diff shows one changed row at a time.
 */
export function emitCatalogueTables(): { catalogue: string; bears: string } {
  return {
    catalogue: `${JSON.stringify(catalogueTableRows(), null, 2)}\n`,
    bears: `${JSON.stringify(bearsTableRows(), null, 2)}\n`,
  };
}
