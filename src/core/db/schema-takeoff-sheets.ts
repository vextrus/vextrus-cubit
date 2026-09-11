// SEAM-TENANT: the takeoff-sheets area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { DISCIPLINES, type Discipline } from "../sheets/law";
import { acts } from "./schema-acts";
import { drawings } from "./schema-drawings";
import { ingests } from "./schema-takeoff-ingest";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * L-REG-03's confirmed discipline: one append-only row per sheet a person confirmed, naming the act
 * that carried it (L-ACT-01 — the act row and the state change land in one transaction or neither).
 *
 * A confirmation is never a before-image: the machine's proposal is not stored at all, so nothing
 * here overwrites a machine value — the row is the human's own observation, with the act as its
 * basis. `sheet_disciplines_once` is what makes a sheet confirmed once per record; a re-ingest mints
 * a new record and its sheets are unconfirmed again, which is what "drawing-scoped, human-confirmed,
 * fails closed" means when the drawing is read a second time.
 */
export const sheetDisciplines = pgTable(
  "sheet_disciplines",
  {
    tenantId: uuid("tenant_id").notNull(),
    confirmationId: uuid("confirmation_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    ingestId: uuid("ingest_id")
      .notNull()
      .references(() => ingests.ingestId),
    layoutName: text("layout_name").notNull(),
    discipline: text("discipline").$type<Discipline>().notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("sheet_disciplines_discipline_closed", statement`${table.discipline} in (${statement.raw(closedList(DISCIPLINES))})`),
    // One confirmation per sheet of one record: a second confirmation of the same sheet is a
    // competing observation, which L-ACT-01 gives its own path and this increment does not render.
    uniqueIndex("sheet_disciplines_once").on(table.tenantId, table.ingestId, table.layoutName),
    // The read the sheet index makes: one project's confirmations.
    index("sheet_disciplines_by_project").on(table.tenantId, table.projectId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_SHEETS_TABLES = {
  sheetDisciplines,
};
