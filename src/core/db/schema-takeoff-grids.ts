// SEAM-TENANT: the takeoff-grids area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import type { RefusalCode } from "../errors";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, doublePrecision, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** The two families a grid bubble sorts into (L-CAD-07): the letters and the numerals. */
export const GRID_FAMILIES = ["letter", "numeral"] as const;

/** One of the two. */
export type GridFamily = (typeof GRID_FAMILIES)[number];

/** The world axes a family georeferences along — a drawing's own plane has these two (L-CAD-07). */
export const GRID_AXES = ["x", "y"] as const;

/** One of the two. */
export type GridAxis = (typeof GRID_AXES)[number];

/**
 * L-CAD-07's grid backbone: one row per lawful bubble of a layout-plan view — the family it sorts
 * into, the label it carries, the world axis its family georeferences along and where along that
 * axis it stands — the third stage of R-TO-030's stored partition.
 *
 * The bubble's ring and its text are both named, because a georeference nobody can trace back to the
 * two entities it was read from is a reading nobody can audit (L-CAD-03).
 *
 * `min_spacing` is the whole VIEW's minimum grid spacing, written on every row of that view: the
 * placement constants that read it are content-scaled shares of it (L-MEA-01), so a row that carried
 * no spacing would be a row placement could not scale by. It is a distance, and the CHECK says so.
 *
 * Rewritten per ingest with the views it was read off, in the same transaction, so the app role
 * holds a DELETE here for the reason it holds one on the views (L-REG-04).
 */
export const grids = pgTable(
  "grids",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    family: text("family").$type<GridFamily>().notNull(),
    label: text("label").notNull(),
    axis: text("axis").$type<GridAxis>().notNull(),
    position: doublePrecision("position").notNull(),
    bubbleKey: text("bubble_key").notNull(),
    labelKey: text("label_key").notNull(),
    minSpacing: doublePrecision("min_spacing").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One axis per bubble of one record, in one workspace: a bubble is read once, and a rebuilt
    // partition replaces the rows of the record it rebuilt rather than standing a second set beside
    // them (L-REG-04, R-TO-030).
    primaryKey({ name: "grids_key", columns: [table.tenantId, table.ingestId, table.bubbleKey] }),
    // Both vocabularies are closed, so the store closes them: a family or an axis outside the two
    // L-CAD-07 names cannot be written at all, however it reached the insert.
    check("grids_family_closed", statement`${table.family} in (${statement.raw(closedList(GRID_FAMILIES))})`),
    check("grids_axis_closed", statement`${table.axis} in (${statement.raw(closedList(GRID_AXES))})`),
    // A spacing placement scales a share by is a real distance: zero or less is not one (L-MEA-01).
    check("grids_min_spacing_positive", statement`${table.minSpacing} > 0`),
    // The read a drawing's own overlay makes: the grid that stands for it now.
    index("grids_by_drawing").on(table.tenantId, table.drawingId),
    // And the read placement makes: one view's whole backbone.
    index("grids_by_view").on(table.tenantId, table.ingestId, table.viewKey),
  ],
);

/**
 * Why a layout plan georeferences as deferred: a code of the register, narrowed to the ones a grid
 * defers under, so the column cannot hold a reason nobody registered (Q-07, L-CAD-07).
 */
export type GridDeferralReason = Extract<RefusalCode, "GRID_NO_BUBBLE_EVIDENCE">;

/**
 * L-CAD-07's other answer: a layout plan the drawing offered no lawful bubble evidence for
 * georeferences as DEFERRED, under a code from the register, rather than as a guessed grid — "a view
 * without lawful bubble evidence georeferences as deferred".
 *
 * One row per view of one record, rewritten with the axes beside it in the same transaction.
 */
export const gridDeferrals = pgTable(
  "grid_deferrals",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    reason: text("reason").$type<GridDeferralReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "grid_deferrals_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    index("grid_deferrals_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_GRIDS_TABLES = {
  grids,
  gridDeferrals,
};
