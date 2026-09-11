// SEAM-TENANT: the takeoff-levels area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { STOREY_HEIGHT_BASES, type StoreyHeightBasis } from "../levels/law";
import { acts } from "./schema-acts";
import { projects } from "./schema-projects";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * L-MEA-07's level: "a project-scoped object with a surrogate id; label, ordinal and height are
 * non-identifying".
 *
 * So the identity is `level_id` and nothing else — the label and the ordinal are ordinary columns a
 * later act may move, and the height is not here at all: it is READ, and its readings are the table
 * below (L-REG-02: "storey height, concrete grade, rebar spec are correctable attributes that
 * participate in diffs, never in identity").
 *
 * A level is inserted by an act and repudiated by an act, and by nothing else (L-ACT-01), which is
 * what the two act columns say. `repudiated_act_id` is the whole of "a level with live rows is never
 * deleted, only repudiated": the row stays, its ordinal stays, the register objects that stand on it
 * stay, and the live stack is the levels this column is null for. The app role holds no DELETE here,
 * so that is the store's guarantee rather than this door's habit.
 *
 * No unique constraint over (project, ordinal): inserting mid-stack shifts every live level at or
 * above the proposed ordinal up by one, and a unique index would refuse the shift halfway through
 * for a collision that does not exist at the end of it. The act is the one writer and it takes the
 * project's state lock (SEAM-ACT), so the shift is what keeps the live ordinals distinct.
 */
export const levels = pgTable(
  "levels",
  {
    tenantId: uuid("tenant_id").notNull(),
    levelId: uuid("level_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId),
    label: text("label").notNull(),
    // Physical, and signed: a basement stands below ground (L-MEA-07).
    ordinal: integer("ordinal").notNull(),
    insertedActId: uuid("inserted_act_id")
      .notNull()
      .references(() => acts.actId),
    // Null while the level is live. Set once, by the act that marks it (L-MEA-07).
    repudiatedActId: uuid("repudiated_act_id").references(() => acts.actId),
    insertedAt: timestamp("inserted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The read the stack is answered from: one project's levels, in the order they physically stand.
    index("levels_by_project").on(table.tenantId, table.projectId, table.ordinal),
  ],
);

/**
 * L-MEA-07's storey height, as it is read rather than as it is set: every reading somebody made of
 * one level's height, kept whole and forever.
 *
 * Nothing here is a "current height" — the standing is derived from these rows at read time, because
 * a stored current value is the overwrite R-TO-051 forbids and a silently-picked winner is the
 * resolution L-REG-03 forbids. A reading is superseded only by a later reading under the SAME
 * `reading_key` (level, actor, basis, source key): that is a re-affirmation, and it is the one thing
 * that clears a contest (L-MEA-07). So no unique constraint stands on the key, and the app role holds
 * neither UPDATE nor DELETE: a correction is another row.
 *
 * The derivation travels with the reading (L-REG-01): the value and unit as written, the canonical
 * metres, the factor that carried it and where that factor came from. The canonical unit is not a
 * column — a storey height is a length and the canon's canonical length unit is the metre, so the
 * column says so by name rather than storing a constant beside every row (L-FRM-06).
 *
 * `reading_id` is minted, and that is not L-REG-04's "zero minted ids": that rule binds derived ROW
 * KEYS. A reading is an appended ledger record like an act, so it is addressed the way `acts` is.
 */
export const storeyHeightReadings = pgTable(
  "storey_height_readings",
  {
    tenantId: uuid("tenant_id").notNull(),
    readingId: uuid("reading_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.levelId),
    // What makes two readings the same reading — derived by `readingKey` (L-REG-04), never minted.
    readingKey: text("reading_key").notNull(),
    actorId: uuid("actor_id").notNull(),
    basis: text("basis").$type<StoreyHeightBasis>().notNull(),
    // Null where the reading cites no drawing entity: a height somebody entered is nobody's source key.
    sourceKey: text("source_key"),
    valueAsWritten: text("value_as_written").notNull(),
    unitAsWritten: text("unit_as_written").notNull(),
    canonicalMetres: text("canonical_metres").notNull(),
    factor: text("factor").notNull(),
    factorProvenance: text("factor_provenance").notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A defaulted storey height is barred at the store as well as at the act (L-MEA-07).
    check("storey_height_readings_basis_closed", statement`${table.basis} in (${statement.raw(closedList(STOREY_HEIGHT_BASES))})`),
    // The read a standing is derived from: one level's readings, in the order they were made.
    index("storey_height_readings_by_level").on(table.tenantId, table.levelId, table.readAt),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_LEVELS_TABLES = {
  levels,
  storeyHeightReadings,
};
