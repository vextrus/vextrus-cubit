// SEAM-TENANT: the manual area's tables (S-Measure, docs/design/s-measure.md), with the closed rosters
// their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { CONDITION_COLOURS, CONDITION_HATCHES, HAND_LEVEL_SLOT, MANUAL_GEOMETRIES, type ConditionColour, type ConditionHatch, type ManualGeometry, type RecipeKind, type RecipeReading } from "../manual/law";
import { UNITS, type Unit } from "../units/canon";
import { acts } from "./schema-acts";
import { drawingSetRevisions } from "./schema-drawing-sets";
import { projects } from "./schema-projects";
import { registerObjects } from "./schema-register";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, foreignKey, index, json, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** The lawful-null slots a hand measurement may stand in (I-377): the one the manual law names, never UNRESOLVED (I-368). */
const HAND_LEVEL_SLOTS = [HAND_LEVEL_SLOT] as const;

/**
 * A condition (R-TO-041, I-374): a project's named recipe — what a QS measures with. Authoring one is
 * not an act: it changes nothing the machine derives until a measurement cites it, and the
 * measurement snapshots the recipe as applied, so a later edit here never re-derives a standing
 * measurement. It is project data written behind `authorize(MEASURE)` through its own door (S5).
 *
 * `condition_id` is minted, and that is not L-REG-04's "zero minted ids": that rule binds derived ROW
 * KEYS, and a condition is authored data a person names — it never enters a register key (I-378).
 *
 * A condition is taken out of the chest by being RETIRED, never deleted: a measurement cites the
 * condition it was applied from, and that citation stays readable.
 */
export const conditions = pgTable(
  "conditions",
  {
    tenantId: uuid("tenant_id").notNull(),
    conditionId: uuid("condition_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId),
    name: text("name").notNull(),
    geometry: text("geometry").$type<ManualGeometry>().notNull(),
    elementClass: text("element_class").$type<ElementType>().notNull(),
    // The kinds the recipe measures, each with the manual method's rule id, and the attribute readings
    // it applies — `json`, not `jsonb`, because this is what a person authored, in the order they
    // authored it.
    kinds: json("kinds").$type<readonly RecipeKind[]>().notNull(),
    readings: json("readings").$type<readonly RecipeReading[]>().notNull(),
    colour: text("colour").$type<ConditionColour>().notNull(),
    hatch: text("hatch").$type<ConditionHatch>().notNull(),
    authoredBy: uuid("authored_by").notNull(),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull().defaultNow(),
    retiredBy: uuid("retired_by"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [
    check("conditions_geometry_closed", statement`${table.geometry} in (${statement.raw(closedList(MANUAL_GEOMETRIES))})`),
    check("conditions_element_class_closed", statement`${table.elementClass} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("conditions_colour_closed", statement`${table.colour} in (${statement.raw(closedList(CONDITION_COLOURS))})`),
    check("conditions_hatch_closed", statement`${table.hatch} in (${statement.raw(closedList(CONDITION_HATCHES))})`),
    check("conditions_name_stated", statement`length(btrim(${table.name})) > 0`),
    // Retired by somebody, at some moment — both or neither.
    check("conditions_retired_whole", statement`(${table.retiredAt} is null) = (${table.retiredBy} is null)`),
    // A condition is a condition OF one project in one workspace: the key a measurement's citation is
    // bound through, so a citation can name no other project's condition and no other workspace's —
    // a foreign key is checked past row-level security, so the tenant must be in the key (I-496).
    unique("conditions_scoped_key").on(table.tenantId, table.projectId, table.conditionId),
    // One standing condition per name in a project: a chest that held two "75 CC blinding" would be a
    // chest whose hotkeys and legend could not tell them apart (R-TO-041).
    uniqueIndex("conditions_standing_name_once").on(table.tenantId, table.projectId, table.name).where(statement`${table.retiredAt} is null`),
    // The read the chest makes: one project's conditions, in the order they were authored.
    index("conditions_by_project").on(table.tenantId, table.projectId, table.authoredAt),
  ],
);

/**
 * A hand measurement (R-TO-040, I-373 … I-387): what one RECORD_MANUAL_MEASUREMENT act recorded — the
 * register row it stands at, the recipe as applied, the geometry as the act judged it, and the view,
 * scale and unit it was measured in. One row per register object, keyed by the object's own key
 * inside its revision, so the markless key (I-378) is the identity here too.
 *
 * Append-only, owner-proof (L-ACT-01): an edit is a NEW measurement that supersedes this one and
 * repudiates its register row in the same transaction (I-379); a delete is REPUDIATE. Nothing here is
 * ever rewritten, and `supersedes` names the object key a measurement succeeded.
 *
 * The points are stored exactly (I-385): each coordinate in its own decimal spelling, with the basis
 * the act re-derived for it and the source keys it reproduced on (I-387). The figure is the exact
 * figure the act previewed, in the unit the view is drawn in (I-386).
 */
export const manualMeasurements = pgTable(
  "manual_measurements",
  {
    tenantId: uuid("tenant_id").notNull(),
    setRevisionId: uuid("set_revision_id")
      .notNull()
      .references(() => drawingSetRevisions.setRevisionId),
    objectKey: text("object_key").notNull(),
    projectId: uuid("project_id").notNull(),
    // A measurement is a human act and nothing else (L-ACT-01, L-ACT-03's MEASURE).
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    // Where it was traced: the drawing revision, the record read, the sheet (whose name is the space
    // the points are in), the partition's own key for the view, and the register's key for it.
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    layoutName: text("layout_name").notNull(),
    partitionViewKey: text("partition_view_key").notNull(),
    viewKey: text("view_key").notNull(),
    // The recipe as applied (I-374): provenance by id where it came from the chest, and the recipe whole.
    conditionId: uuid("condition_id"),
    conditionName: text("condition_name").notNull(),
    geometry: text("geometry").$type<ManualGeometry>().notNull(),
    elementClass: text("element_class").$type<ElementType>().notNull(),
    kinds: json("kinds").$type<readonly RecipeKind[]>().notNull(),
    readings: json("readings").$type<readonly RecipeReading[]>().notNull(),
    // The level it stands on: a live level's surrogate, or the FOUNDATION slot — exactly one (I-377).
    levelId: uuid("level_id"),
    levelSlot: text("level_slot"),
    // The traced geometry as the act judged it, exact (I-385, I-387) — `json`, kept in the order drawn.
    traced: json("traced").$type<unknown>().notNull(),
    // The exact figure previewed, and the units it and the points are in (I-386).
    figure: json("figure").$type<unknown>().notNull(),
    drawnUnit: text("drawn_unit").$type<Unit>().notNull(),
    figureUnit: text("figure_unit").$type<Unit>().notNull(),
    calibrationKey: text("calibration_key").notNull(),
    // The object key this measurement succeeds (I-379), or null for a first measurement.
    supersedes: text("supersedes"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One measurement per register object inside one revision: the markless key is the identity (I-378).
    primaryKey({ name: "manual_measurements_key", columns: [table.tenantId, table.setRevisionId, table.objectKey] }),
    // A measurement is OF a register row — the one its act registered in the same transaction.
    foreignKey({
      columns: [table.tenantId, table.setRevisionId, table.objectKey],
      foreignColumns: [registerObjects.tenantId, registerObjects.setRevisionId, registerObjects.objectKey],
      name: "manual_measurements_object_fk",
    }),
    // The condition it was applied from, where it came from the chest: one of THIS project's, in this
    // workspace (I-374, I-496). A null id cites nothing and is checked against nothing.
    foreignKey({
      columns: [table.tenantId, table.projectId, table.conditionId],
      foreignColumns: [conditions.tenantId, conditions.projectId, conditions.conditionId],
      name: "manual_measurements_condition_fk",
    }),
    check("manual_measurements_geometry_closed", statement`${table.geometry} in (${statement.raw(closedList(MANUAL_GEOMETRIES))})`),
    check("manual_measurements_element_class_closed", statement`${table.elementClass} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("manual_measurements_drawn_unit_closed", statement`${table.drawnUnit} in (${statement.raw(closedList(UNITS))})`),
    check("manual_measurements_figure_unit_closed", statement`${table.figureUnit} in (${statement.raw(closedList(UNITS))})`),
    check("manual_measurements_level_slot_closed", statement`${table.levelSlot} is null or ${table.levelSlot} in (${statement.raw(closedList(HAND_LEVEL_SLOTS))})`),
    check("manual_measurements_level_stated_once", statement`num_nonnulls(${table.levelId}, ${table.levelSlot}) = 1`),
    check("manual_measurements_condition_named", statement`length(btrim(${table.conditionName})) > 0`),
    // The reads the guards and the book make: one revision's measurements, in the order recorded.
    index("manual_measurements_by_revision").on(table.tenantId, table.setRevisionId, table.recordedAt),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const MANUAL_TABLES = {
  conditions,
  manualMeasurements,
};
