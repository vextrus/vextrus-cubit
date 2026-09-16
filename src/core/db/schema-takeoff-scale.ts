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
import { bigserial, check, index, json, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    // The store's own write order. `created_at` is `now()`, which is fixed for a transaction, so two
    // affirmations written in one act carry ONE instant and a random surrogate would then decide
    // which of them a view stands under — an answer that moves between reads of the same rows. The
    // sequence is handed out in the order the rows are written, and that is the order they are read
    // back in (L-MEA-05, L-REG-04).
    appendSeq: bigserial("append_seq", { mode: "number" }).notNull(),
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
 *
 * The row carries WHAT IT SAYS and nothing else. A record-scoped column — the project, the drawing,
 * the record or the act — is not covered by the content address, so the first act to file a reading
 * would stamp its own record on a row every later act naming the same reading shares, and a second
 * record would read somebody else's name off its own calibration. Which record a view stands
 * calibrated under is `scale_affirmations`' to say, and it says it (L-MEA-05).
 */
export const calibrations = pgTable(
  "calibrations",
  {
    tenantId: uuid("tenant_id").notNull(),
    key: text("key").notNull(),
    viewKey: text("view_key").notNull(),
    factorX: text("factor_x").notNull(),
    factorY: text("factor_y").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "calibrations_key", columns: [table.tenantId, table.key] }),
    // A factor is spoken in exactly one rendering, and it is a positive quantity of metres: at
    // least the least factor that rendering speaks, stated in the rendering and read as the
    // number it says (the key needs no CHECK of its own — `calibrationKey` is its one minting home).
    check("calibrations_factor_x_shape", statement`${table.factorX} ~ ${statement.raw(`'${FACTOR_PATTERN}'`)} and ${table.factorX}::numeric >= ${statement.raw(`'${FACTOR_MINIMUM}'`)}::text::numeric`),
    check("calibrations_factor_y_shape", statement`${table.factorY} ~ ${statement.raw(`'${FACTOR_PATTERN}'`)} and ${table.factorY}::numeric >= ${statement.raw(`'${FACTOR_MINIMUM}'`)}::text::numeric`),
    // The reads that scoped calibrations by record go with the columns they were over: a calibration
    // is reached by the keys the affirmations of a record name, which is the primary key itself.
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
