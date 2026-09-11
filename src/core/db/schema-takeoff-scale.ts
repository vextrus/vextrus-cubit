// SEAM-TENANT: the takeoff-scale area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { FACTOR_MINIMUM, FACTOR_PATTERN, SCALE_RANKS, type ScaleRank } from "../scale/law";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, json, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * L-MEA-05's affirmation act, stored: "Scale is established by affirmation acts, each naming the
 * views it covers (a scale group is the subject set of one act), the rank it stood on and the source
 * keys under it." One row per AFFIRM_SCALE act, carrying the act that wrote it (L-ACT-01: the act row
 * and this row land in one transaction or neither).
 *
 * `view_keys`, `incoming_keys` and `outgoing_keys` are parallel by position: view i moves from
 * `outgoing_keys[i]` to `incoming_keys[i]`, where the outgoing key is the calibration the view stood
 * under before this act or the empty string for none. `observations` holds the QS two-point
 * observations the act stood on (empty below rank 1) in the order they were judged — `json`, not
 * `jsonb`, because jsonb re-orders what it holds. `supersedes` names the affirmation this one
 * re-affirms over, and stands empty until re-affirmation ships.
 *
 * Append-only for the reason `view_type_confirmations` is: a scale somebody affirmed is a fact of
 * the record, superseded by a later act rather than edited (L-ACT-01).
 */
export const scaleAffirmations = pgTable(
  "scale_affirmations",
  {
    tenantId: uuid("tenant_id").notNull(),
    affirmationId: uuid("affirmation_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    rank: text("rank").$type<ScaleRank>().notNull(),
    viewKeys: text("view_keys").array().notNull(),
    incomingKeys: text("incoming_keys").array().notNull(),
    outgoingKeys: text("outgoing_keys").array().notNull(),
    sourceKeys: text("source_keys").array().notNull(),
    observations: json("observations").$type<unknown[]>().notNull(),
    supersedes: uuid("supersedes"),
    actId: uuid("act_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The precedence is closed, so the store closes it: a rank outside the four L-MEA-05 names
    // cannot be written at all, however it reached the insert (B-17: the roster is the law's own).
    check("scale_affirmations_rank_closed", statement`${table.rank} in (${statement.raw(closedList(SCALE_RANKS))})`),
    // The read the scale door makes: every affirmation of one record, newest first.
    index("scale_affirmations_by_ingest").on(table.tenantId, table.ingestId, table.createdAt),
    index("scale_affirmations_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-MEA-05's calibration: one view's factor pair, filed under the content address of what it says —
 * (view key, factorX, factorY) — so the same reading affirmed twice is the same row, and a
 * calibration key on a quantity line names exactly one pair forever.
 *
 * Both factors are 12-place decimal strings in metres per drawing unit, X and Y stored apart and
 * averaged by nothing; the CHECKs are written from the law's own pattern (B-17). Append-only: the
 * act that first filed a calibration is the one it names, and a later act naming the same reading
 * finds the row already there.
 */
export const calibrations = pgTable(
  "calibrations",
  {
    tenantId: uuid("tenant_id").notNull(),
    key: text("key").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    factorX: text("factor_x").notNull(),
    factorY: text("factor_y").notNull(),
    actId: uuid("act_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "calibrations_key", columns: [table.tenantId, table.key] }),
    // A factor is spoken in exactly one rendering, and it is a positive quantity of metres: at
    // least the least factor that rendering speaks, stated in the rendering and read as the
    // number it says (the key needs no CHECK of its own — `calibrationKey` is its one minting home).
    check("calibrations_factor_x_shape", statement`${table.factorX} ~ ${statement.raw(`'${FACTOR_PATTERN}'`)} and ${table.factorX}::numeric >= ${statement.raw(`'${FACTOR_MINIMUM}'`)}::text::numeric`),
    check("calibrations_factor_y_shape", statement`${table.factorY} ~ ${statement.raw(`'${FACTOR_PATTERN}'`)} and ${table.factorY}::numeric >= ${statement.raw(`'${FACTOR_MINIMUM}'`)}::text::numeric`),
    // The read the scale door makes: every calibration of one record.
    index("calibrations_by_ingest").on(table.tenantId, table.ingestId),
    index("calibrations_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_SCALE_TABLES = {
  scaleAffirmations,
  calibrations,
};
