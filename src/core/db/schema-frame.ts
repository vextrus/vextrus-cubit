// SEAM-TENANT: the FRAME area's tables — empty until M3 writes them (AM-11).
//
// M3's frame rail declares its tables HERE, and re-exports them from `db/schema/frame.ts` for the drift
// lane. `schema.ts` already enumerates this file, so a table added to the group below joins
// `SEAM_SCHEMA` and the seam's typed surface with no shared roster to edit and no other area's file to
// touch (B-19).
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper).

import { QUANTITY_BASES, type QuantityBasis } from "../offers/law";
import { UNITS, type Unit } from "../units/canon";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, json, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * L-MEA-09's run: what one beam or tie-beam placement measures along its own axis, and what adjoins
 * each of its two sides — the reading the placement stage takes off the drawing, stored beside the
 * placement it was read for.
 *
 * "Beams measure clear between support faces and below the slab soffit" (L-MEA-09), so the two halves
 * of that sentence are the two halves of this row: `clear_*` is the drawn axis less what the members
 * supporting its ends own and less every stretch inside a slab opening it crosses, and `side_a_*` /
 * `side_b_*` are the slab thicknesses adjoining it, which the rail turns into the owned depth. Each is
 * a READING and not a number: the value as it was read, the unit it was read in, the basis it stands
 * on and the entities it was read from (L-REG-01, L-QTY-01, L-QTY-03).
 *
 * A side is nullable because a drawing that adjoins a slab and states no thickness has said nothing
 * to read — the rail keeps the row with that variable omitted under `SLAB_THICKNESS_UNSTATED` rather
 * than defaulting a figure nobody drew (L-QTY-02). `clear` is nullable for the same reason.
 *
 * Rewritten per ingest with the placements it was read off, in the same transaction, so the app role
 * holds a DELETE here for the reason it holds one on the placements (L-REG-04, R-TO-030).
 */
export const placementRuns = pgTable(
  "placement_runs",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    placementKey: text("placement_key").notNull(),
    clearValue: text("clear_value"),
    clearUnit: text("clear_unit").$type<Unit>(),
    clearBasis: text("clear_basis").$type<QuantityBasis>(),
    clearSourceKeys: json("clear_source_keys").$type<readonly string[]>(),
    sideAValue: text("side_a_value"),
    sideAUnit: text("side_a_unit").$type<Unit>(),
    sideABasis: text("side_a_basis").$type<QuantityBasis>(),
    sideASourceKeys: json("side_a_source_keys").$type<readonly string[]>(),
    sideBValue: text("side_b_value"),
    sideBUnit: text("side_b_unit").$type<Unit>(),
    sideBBasis: text("side_b_basis").$type<QuantityBasis>(),
    sideBSourceKeys: json("side_b_source_keys").$type<readonly string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One run per placement of one record: the placement key IS the identity, and a rebuilt partition
    // replaces the rows of the record it rebuilt rather than standing a second set beside them
    // (L-REG-04).
    primaryKey({ name: "placement_runs_key", columns: [table.tenantId, table.ingestId, table.placementKey] }),
    // A reading is stated whole or not at all: a number nobody gave a unit or a basis to is not a
    // measurement (L-QTY-01, B-07). `num_nonnulls` is 0 for an unread reading and 3 for a read one.
    check("placement_runs_clear_stated_whole", statement`num_nonnulls(${table.clearValue}, ${table.clearUnit}, ${table.clearBasis}) in (0, 3)`),
    check("placement_runs_side_a_stated_whole", statement`num_nonnulls(${table.sideAValue}, ${table.sideAUnit}, ${table.sideABasis}) in (0, 3)`),
    check("placement_runs_side_b_stated_whole", statement`num_nonnulls(${table.sideBValue}, ${table.sideBUnit}, ${table.sideBBasis}) in (0, 3)`),
    // The unit and basis rosters are the canon's and the offer law's, and both are closed: a unit or
    // a basis outside them cannot be written at all, however it reached the insert (B-07, L-QTY-01).
    check("placement_runs_clear_unit_closed", statement`${table.clearUnit} is null or ${table.clearUnit} in (${statement.raw(closedList(UNITS))})`),
    check("placement_runs_side_a_unit_closed", statement`${table.sideAUnit} is null or ${table.sideAUnit} in (${statement.raw(closedList(UNITS))})`),
    check("placement_runs_side_b_unit_closed", statement`${table.sideBUnit} is null or ${table.sideBUnit} in (${statement.raw(closedList(UNITS))})`),
    check("placement_runs_clear_basis_closed", statement`${table.clearBasis} is null or ${table.clearBasis} in (${statement.raw(closedList(QUANTITY_BASES))})`),
    check("placement_runs_side_a_basis_closed", statement`${table.sideABasis} is null or ${table.sideABasis} in (${statement.raw(closedList(QUANTITY_BASES))})`),
    check("placement_runs_side_b_basis_closed", statement`${table.sideBBasis} is null or ${table.sideBBasis} in (${statement.raw(closedList(QUANTITY_BASES))})`),
    // The read the measure setup makes: one drawing's runs.
    index("placement_runs_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const FRAME_TABLES = { placementRuns };
