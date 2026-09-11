// SEAM-TENANT: the takeoff-rasters area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { RASTER_TIERS, type RasterTier, drawings } from "./schema-drawings";
import { ingests } from "./schema-takeoff-ingest";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * R-SPINE-022's rendered sheets: one row per (ingest, layout, tier), naming the address SEAM-STORAGE
 * holds that raster's bytes at and the size they were rendered to.
 *
 * A raster is evidence of what a revision looked like, so the table is append-only like the record
 * it hangs off: a re-render of the same sheet at the same tier finds the row it already wrote rather
 * than replacing it, which is what `sheet_rasters_once` is for. The dimensions carry no range CHECK
 * — a canvas of no pixels is a renderer's mistake, and the seam answers for it where a refusal can
 * be given rather than by aborting a job at the store (ARCH-03).
 */
export const sheetRasters = pgTable(
  "sheet_rasters",
  {
    tenantId: uuid("tenant_id").notNull(),
    rasterId: uuid("raster_id").primaryKey().defaultRandom(),
    ingestId: uuid("ingest_id")
      .notNull()
      .references(() => ingests.ingestId),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    jobId: text("job_id").notNull(),
    layoutName: text("layout_name").notNull(),
    tier: text("tier").$type<RasterTier>().notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("sheet_rasters_tier_closed", statement`${table.tier} in (${statement.raw(closedList(RASTER_TIERS))})`),
    // One raster per sheet per tier per record, however many attempts render it (SEAM-JOBS).
    uniqueIndex("sheet_rasters_once").on(table.tenantId, table.ingestId, table.layoutName, table.tier),
    // The read the sheet index makes: one drawing's rasters.
    index("sheet_rasters_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_RASTERS_TABLES = {
  sheetRasters,
};
