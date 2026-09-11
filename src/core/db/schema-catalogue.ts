// SEAM-TENANT: the catalogue area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { KINDS, type Kind } from "../catalogue/kinds";
import { DIMENSIONS, type Dimension, UNITS, type Unit } from "../units/canon";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/**
 * L-MEA-04's work-item catalogue, as the store's copy of it: per kind, what is measured of it, in
 * which dimension, in that dimension's canonical unit, to how many places a document writes it.
 *
 * The catalogue is code-owned: `src/core/catalogue/catalogue.ts` is the original, the tables under
 * `db/catalogue/` are its emission, and a migration is the only thing that moves these rows — which
 * is why the runtime role reads this table and holds no privilege that writes it. Every column that
 * draws on a closed roster is closed over that roster's own spelling here (B-17).
 */
export const workItems = pgTable(
  "work_items",
  {
    kind: text("kind").$type<Kind>().primaryKey(),
    description: text("description").notNull(),
    canonicalUnit: text("canonical_unit").$type<Unit>().notNull(),
    dimension: text("dimension").$type<Dimension>().notNull(),
    documentPrecision: integer("document_precision").notNull(),
  },
  (table) => [
    check("work_items_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    check("work_items_dimension_closed", statement`${table.dimension} in (${statement.raw(closedList(DIMENSIONS))})`),
    check("work_items_unit_closed", statement`${table.canonicalUnit} in (${statement.raw(closedList(UNITS))})`),
    // A precision is a number of places, so it is a count and never a negative one (L-FMT-02).
    check("work_items_precision_not_negative", statement`${table.documentPrecision} >= 0`),
  ],
);

/**
 * L-MEA-04's `bears` relation: class × kind, what an element class lawfully bears. A class that
 * bears no kind is absent from this table and DECLARED in the unborne set beside the consts — the
 * store holds the relation, and the code holds the reason a class is missing from it.
 */
export const bears = pgTable(
  "bears",
  {
    class: text("class").$type<ElementType>().notNull(),
    kind: text("kind")
      .$type<Kind>()
      .notNull()
      .references(() => workItems.kind),
  },
  (table) => [
    // One row per pair: a class bears a kind or it does not, and saying so twice says nothing more.
    primaryKey({ name: "bears_key", columns: [table.class, table.kind] }),
    check("bears_class_closed", statement`${table.class} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const CATALOGUE_TABLES = {
  workItems,
  bears,
};
