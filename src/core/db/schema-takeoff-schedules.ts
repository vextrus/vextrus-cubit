// SEAM-TENANT: the takeoff-schedules area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { SCHEDULE_DEFERRAL_REASONS, type ScheduleDeferralReason } from "../errors";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * The units a schedule's own notation is written in (R-TO-031). Not the bill's canon (L-FRM-06): a
 * drawing states a section in inches or in millimetres, and a pair it stated no unit for keeps none
 * — a number nobody gave a unit to is not an inch (L-MEA-01).
 */
export const SECTION_UNITS = ["in", "mm"] as const;

/** One of the two. */
export type SectionUnit = (typeof SECTION_UNITS)[number];

/** The four zones a rebar column of a schedule reads as (R-TO-031): the main bars, and the ties. */
export const REBAR_ZONES = ["main", "ties", "ties-end", "ties-mid"] as const;

/** One of the four. */
export type RebarZone = (typeof REBAR_ZONES)[number];

/**
 * Why a schedule view defers: the register's own narrowing to the two a schedule defers under, so
 * the column cannot hold a reason nobody registered (Q-07, riskNotes (2)). The list is the refusal
 * register's, and this CHECK is written from it — one vocabulary, two readers (B-17).
 */
export type { ScheduleDeferralReason };

/** The entities one row of the stored partition was read from — never none (L-CAD-03). */
const citedKeys = () => text("source_keys").array().notNull();

/**
 * L-CAD-08's gridless reconstruction: one row per table a SCHEDULE view yielded — the caption it is
 * anchored on, what that caption says, and the row spacing its bands stand at — the fourth stage of
 * R-TO-030's stored partition.
 *
 * The schedule KEY is the caption's own source key: a table anchored on nothing could not be traced
 * back to the drawing, and two tables of one drawing are two captions (L-CAD-03).
 *
 * Rewritten per ingest with the views it was read off, in the same transaction, so the app role
 * holds a DELETE here for the reason it holds one on the views (L-REG-04, R-TO-030).
 */
export const schedules = pgTable(
  "schedules",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    title: text("title").notNull(),
    pitch: doublePrecision("pitch").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "schedules_key", columns: [table.tenantId, table.ingestId, table.scheduleKey] }),
    // The pitch is what the 3.5× stop between rows is measured in, so it is a real spacing: a table
    // whose rows stood no distance apart would be one row (L-CAD-08).
    check("schedules_pitch_positive", statement`${table.pitch} > 0`),
    // The read a drawing's own screen makes: the schedules that stand for it now.
    index("schedules_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * One cell of a reconstructed table: where it stands, what it says verbatim, and the texts it was
 * read from. Row 0 is the header band the columns were taken from (AC-1).
 *
 * The text is the drawing's own — a cell is stored as it was drawn and parsed beside, never instead
 * of, itself, so a reading nobody agrees with can be re-made from what the drawing says (L-CAD-03).
 */
export const scheduleCells = pgTable(
  "schedule_cells",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    rowIndex: integer("row_index").notNull(),
    columnIndex: integer("column_index").notNull(),
    text: text("text").notNull(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "schedule_cells_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.rowIndex, table.columnIndex] }),
    // A cell that cites no entity is a cell nobody can trace back to the drawing (L-CAD-03).
    check("schedule_cells_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("schedule_cells_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * R-TO-031's member-type registry: one row per mark family a schedule names — the normalised mark,
 * the cell's own spelling of it, and the table row it was read from (riskNotes (3)).
 *
 * What a member IS, and never how many stand: the count is placement's answer, read off the layout
 * plans, and a schedule that carried one would be answering a question it was not asked (R-TO-031).
 */
export const memberTypes = pgTable(
  "member_types",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    markText: text("mark_text").notNull(),
    rowIndex: integer("row_index").notNull(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "member_types_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family] }),
    check("member_types_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("member_types_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * One variant of a mark family: the band of floors a schedule column heads, and the section that
 * family carries over it (riskNotes (3)). The band's own words are kept beside the two levels they
 * read as, and the section's own words beside the pair they read as.
 */
export const memberTypeVariants = pgTable(
  "member_type_variants",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    variantKey: text("variant_key").notNull(),
    bandText: text("band_text").notNull(),
    bandFrom: text("band_from"),
    bandTo: text("band_to"),
    sectionText: text("section_text").notNull(),
    sectionWidth: doublePrecision("section_width"),
    sectionDepth: doublePrecision("section_depth"),
    sectionUnit: text("section_unit").$type<SectionUnit>(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "member_type_variants_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family, table.variantKey] }),
    // A unit the drawing did not state is no unit at all; a unit it did state is one of the two.
    check("member_type_variants_section_unit_closed", statement`${table.sectionUnit} is null or ${table.sectionUnit} in (${statement.raw(closedList(SECTION_UNITS))})`),
    check("member_type_variants_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("member_type_variants_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * The rebar a schedule states for one variant, one row per zone its columns name: the cell verbatim,
 * the groups of bars it names, and the centres it states them at.
 *
 * `bars` is jsonb because a cell may name several groups — `4-20Ø+4-16Ø` is two — and a column per
 * group would fix in the store a number the drawing decides (L-QTY-04).
 */
export const rebarZones = pgTable(
  "rebar_zones",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    variantKey: text("variant_key").notNull(),
    zone: text("zone").$type<RebarZone>().notNull(),
    text: text("text").notNull(),
    bars: jsonb("bars").$type<readonly { readonly n: number; readonly diameterMm: number }[]>(),
    spacing: doublePrecision("spacing"),
    spacingUnit: text("spacing_unit").$type<SectionUnit>(),
    spacingBar: doublePrecision("spacing_bar"),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "rebar_zones_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family, table.variantKey, table.zone] }),
    // The roster is closed, so the store closes it: a zone outside the four cannot be written at
    // all, however it reached the insert.
    check("rebar_zones_zone_closed", statement`${table.zone} in (${statement.raw(closedList(REBAR_ZONES))})`),
    check("rebar_zones_spacing_unit_closed", statement`${table.spacingUnit} is null or ${table.spacingUnit} in (${statement.raw(closedList(SECTION_UNITS))})`),
    check("rebar_zones_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("rebar_zones_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * The other answer a SCHEDULE view gives: a view whose bands yielded no table, and one whose table
 * named no member, stand here under a closed reason rather than as a schedule nobody can read
 * (riskNotes (2)). Its own table, because a view that yielded no table has no schedule row to carry
 * the reason on — the exact shape of `grid_deferrals`, which the overlay already knows how to read.
 */
export const scheduleDeferrals = pgTable(
  "schedule_deferrals",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    reason: text("reason").$type<ScheduleDeferralReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "schedule_deferrals_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    // Another stage's reason stored here would render as this stage's, so the CHECK admits the two
    // this stage defers under and nothing else (Q-07).
    check("schedule_deferrals_reason_closed", statement`${table.reason} in (${statement.raw(closedList(SCHEDULE_DEFERRAL_REASONS))})`),
    index("schedule_deferrals_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_SCHEDULES_TABLES = {
  schedules,
  scheduleCells,
  memberTypes,
  memberTypeVariants,
  rebarZones,
  scheduleDeferrals,
};
