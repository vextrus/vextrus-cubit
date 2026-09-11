// SEAM-TENANT: the takeoff-placements area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { EXPANSION_DEFERRAL_REASONS, type ExpansionDeferralReason } from "../errors";
import { acts } from "./schema-acts";
import { levels } from "./schema-takeoff-levels";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, doublePrecision, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Why a view's vertical members expand over no level: the register's own narrowing to the two the
 * expansion stage stands a view under (Q-07, L-CAD-07). One vocabulary, two readers (B-17).
 */
export type { ExpansionDeferralReason };

/**
 * L-CAD-07's placement: one row per member a layout-plan view places — the fifth stage of R-TO-030's
 * stored partition.
 *
 * The key is L-REG-04's placement key (`view key | mark | quantised point`), derived by `placementKey`
 * and never minted here, so a re-derivation of the same artifact writes the same rows. The mark is
 * the dotless-uppercase normalisation the label rule compares on, and `mark_text` keeps the drawing's
 * own spelling beside it (L-CAD-03: a reading never replaces what was drawn).
 *
 * The outline it was read off and the mark that anchored it are both named, because a placement
 * nobody can trace back to the two entities it was read from is a reading nobody can audit
 * (L-CAD-03). `member_family` names the schedule family of the same record whose family is this mark,
 * and is null where the record's schedules name none — a join, never a constant (R-TO-031).
 *
 * Rewritten per ingest with the views it was read off, in the same transaction, so the app role holds
 * a DELETE here for the reason it holds one on the views (L-REG-04, R-TO-030).
 */
export const placements = pgTable(
  "placements",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    placementKey: text("placement_key").notNull(),
    viewKey: text("view_key").notNull(),
    mark: text("mark").notNull(),
    markText: text("mark_text").notNull(),
    elementType: text("element_type").$type<ElementType>().notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    // The nearest axis of each family of the view's own backbone, or null where the family carries
    // none: a grid reference is read off the grid, never invented (L-CAD-07).
    gridLetter: text("grid_letter"),
    gridNumeral: text("grid_numeral"),
    outlineKey: text("outline_key").notNull(),
    markKey: text("mark_key").notNull(),
    memberFamily: text("member_family"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One placement per key of one record: the key IS the identity, and a rebuilt partition replaces
    // the rows of the record it rebuilt rather than standing a second set beside them (L-REG-04).
    primaryKey({ name: "placements_key", columns: [table.tenantId, table.ingestId, table.placementKey] }),
    // The class roster is the catalogue's and it is closed, so the store closes it: a class outside
    // it cannot be written at all, however it reached the insert (R-TO-032).
    check("placements_element_type_closed", statement`${table.elementType} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    // The read a drawing's own overlay makes: the placements that stand for it now.
    index("placements_by_drawing").on(table.tenantId, table.drawingId),
    // And the read the expansion makes: one view's placements.
    index("placements_by_view").on(table.tenantId, table.ingestId, table.viewKey),
  ],
);

/**
 * Why a view's vertical members stand on no level: the sixth stage's own answer, one row per view
 * that deferred, under a code of the register (L-CAD-07, Q-07). Its own table for the reason
 * `grid_deferrals` is its own: a view that expanded over nothing has no row of its own to carry the
 * reason on.
 *
 * Rewritten per ingest with the placements it was read off, in the same transaction.
 */
export const expansionDeferrals = pgTable(
  "expansion_deferrals",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    reason: text("reason").$type<ExpansionDeferralReason>().notNull(),
    // The two ends of the range the view STATED, kept as the labels the caption wrote them as, so a
    // person reading the deferral can see which endpoint the stack does not carry (L-CAD-07). Null
    // where the caption stated no range at all — there are no endpoints to name (L-REG-01, B-07).
    fromLabel: text("from_label"),
    toLabel: text("to_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "expansion_deferrals_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    // Another stage's reason stored here would render as this stage's, so the CHECK admits the two
    // this stage defers under and nothing else (Q-07).
    check("expansion_deferrals_reason_closed", statement`${table.reason} in (${statement.raw(closedList(EXPANSION_DEFERRAL_REASONS))})`),
    index("expansion_deferrals_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * The seventh stage's answer: the level stack a drawing's sections STATE, read into a table of its
 * own and never into `levels` — "the machine proposes a stack, never a level" (L-ACT-03: authoring a
 * level stack is a human's act). A person confirms the whole stack as one `INSERT_LEVEL`.
 *
 * The storey height is the distance to the level above, kept as the drawing's own words beside the
 * unit they were written in (L-REG-01, B-07); the topmost level of a section states none. Each row
 * cites the level mark it was read off (L-CAD-03).
 *
 * Rewritten per ingest with the views it was read off, in the same transaction.
 */
export const proposedLevels = pgTable(
  "proposed_levels",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    label: text("label").notNull(),
    ordinal: integer("ordinal").notNull(),
    elevation: doublePrecision("elevation").notNull(),
    heightAsWritten: text("height_as_written"),
    heightUnit: text("height_unit"),
    markKey: text("mark_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "proposed_levels_key", columns: [table.tenantId, table.ingestId, table.markKey] }),
    // A height is stated with the unit it was written in or not at all: a number nobody gave a unit
    // to is not a metre (L-MEA-01, B-07).
    check("proposed_levels_height_stated_with_unit", statement`num_nonnulls(${table.heightAsWritten}, ${table.heightUnit}) <> 1`),
    index("proposed_levels_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-CAD-07's authored range: the one-to-many expansion a person stated for a view whose caption did
 * not (`AUTHOR_TYPICAL_RANGE`). One row per act, naming the view it was authored for, the two levels
 * it runs between by surrogate id (L-REG-02) and the act that authored it (L-ACT-01).
 *
 * Not a stage's row and never rewritten by one: this is a human's statement about a view, and a
 * rebuild reads it rather than replacing it — which is why the app role holds no DELETE here.
 */
export const typicalRanges = pgTable(
  "typical_ranges",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    viewKey: text("view_key").notNull(),
    fromLevelId: uuid("from_level_id")
      .notNull()
      .references(() => levels.levelId),
    toLevelId: uuid("to_level_id")
      .notNull()
      .references(() => levels.levelId),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One authored range per view of one project: a second statement about one view would leave the
    // expansion two ranges to resolve, and a resolver that picked one would be guessing (L-CAD-07).
    primaryKey({ name: "typical_ranges_key", columns: [table.tenantId, table.projectId, table.viewKey] }),
    index("typical_ranges_by_project").on(table.tenantId, table.projectId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_PLACEMENTS_TABLES = {
  placements,
  expansionDeferrals,
  proposedLevels,
  typicalRanges,
};
