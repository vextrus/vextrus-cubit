// SEAM-TENANT: the takeoff-walls area's tables — the walls and openings the wall lane reads off an
// architect's plan (s-takeoff I-593), stored beside the placements they stand for.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` (scripts/eslint/rules/no-db-outside-seam.mjs).
// `db/schema/takeoff-walls.ts` is where drizzle-kit reads these back out of.
//
// Both tables are rows of the SAME stored partition as `placements`: rewritten per ingest in the
// partition's one transaction, keyed by the placement key the wall or opening stands under, so a
// re-derivation of the same artifact writes the same rows (L-REG-04, R-TO-030).
import { UNITS, dimensionOf } from "../units/canon";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { boolean, check, doublePrecision, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** The canon's units of length: what a wall's thickness and length are carried in (B-07). */
const LENGTH_UNITS = UNITS.filter((unit) => dimensionOf(unit) === "LENGTH");

/**
 * One brick wall the wall lane placed (I-593): the axis it runs along, in the drawing's own
 * coordinates, and the two readings its brickwork is measured from — the thickness the WALL TYPES row
 * states, as written and cited to its cell (s-schedules I-508), and the length its faces run, measured
 * off the plan on the placement lattice and cited to the lines that draw it (L-QTY-01, L-QTY-03). The
 * sheet its plan was captioned on is kept beside it, because the discipline a person confirmed for that
 * sheet is the discipline the wall is sighted under (L-REG-03).
 *
 * Every figure is a READING and not a number — the value as read, beside its unit — so nothing is
 * converted on the way to the gate (B-07).
 */
export const wallRuns = pgTable(
  "wall_runs",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    placementKey: text("placement_key").notNull(),
    viewKey: text("view_key").notNull(),
    family: text("family").notNull(),
    layoutName: text("layout_name"),
    fromX: doublePrecision("from_x").notNull(),
    fromY: doublePrecision("from_y").notNull(),
    toX: doublePrecision("to_x").notNull(),
    toY: doublePrecision("to_y").notNull(),
    thicknessValue: text("thickness_value").notNull(),
    thicknessUnit: text("thickness_unit").notNull(),
    thicknessSourceKeys: text("thickness_source_keys").array().notNull(),
    lengthValue: text("length_value").notNull(),
    lengthUnit: text("length_unit").notNull(),
    lengthSourceKeys: text("length_source_keys").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "wall_runs_key", columns: [table.tenantId, table.ingestId, table.placementKey] }),
    // A length is carried in a unit of length, drawn from the canon's own roster (B-07, B-19).
    check("wall_runs_thickness_unit_closed", statement`${table.thicknessUnit} in (${statement.raw(closedList(LENGTH_UNITS))})`),
    check("wall_runs_length_unit_closed", statement`${table.lengthUnit} in (${statement.raw(closedList(LENGTH_UNITS))})`),
    // A reading nothing in the drawing answers for is no reading (L-QTY-03).
    check("wall_runs_thickness_cited", statement`cardinality(${table.thicknessSourceKeys}) >= 1`),
    check("wall_runs_length_cited", statement`cardinality(${table.lengthSourceKeys}) >= 1`),
    // The read the measure setup makes: one drawing's walls.
    index("wall_runs_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * One opening the wall lane placed in a wall's gap (I-591): the wall it stands in, the gap it
 * fills along that wall's axis, the tag that named it, and whether the width its plan's schedule
 * states was set against the gap — a row stating no unit for its size cannot be (s-schedules I-506).
 */
export const wallOpenings = pgTable(
  "wall_openings",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    placementKey: text("placement_key").notNull(),
    hostPlacementKey: text("host_placement_key").notNull(),
    viewKey: text("view_key").notNull(),
    mark: text("mark").notNull(),
    tagKey: text("tag_key").notNull(),
    layoutName: text("layout_name"),
    fromX: doublePrecision("from_x").notNull(),
    fromY: doublePrecision("from_y").notNull(),
    toX: doublePrecision("to_x").notNull(),
    toY: doublePrecision("to_y").notNull(),
    width: text("width").notNull(),
    checked: boolean("checked").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "wall_openings_key", columns: [table.tenantId, table.ingestId, table.placementKey] }),
    // The read the measure setup makes: one drawing's openings, joined to the walls they stand in.
    index("wall_openings_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to this
 * file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_WALLS_TABLES = {
  wallRuns,
  wallOpenings,
};
