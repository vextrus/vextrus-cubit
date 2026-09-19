// SEAM-TENANT: the VALIDATION area's table — the ledger V-GOLDEN records what it proved in
// (R-TO-035: "validation observations recorded as data", AM-11).
//
// The definitions live HERE and are re-exported from `db/schema/validation.ts` for the drift lane.
// `schema.ts` already enumerates this file, so a table added to the group below joins `SEAM_SCHEMA`
// and the seam's typed surface with no shared roster to edit and no other area's file to touch (B-19).
//
// The closed rosters the CHECKs are written from stand here beside the table, exactly as `schema.ts`
// says an area's do: they are the store's own guarantee, so a verdict or a provenance outside them
// cannot be written however it reached the insert, and every reader — the module, the transport
// vocabulary, the band suites — reads the one list rather than a copy of it (B-17, B-19).
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper).

import { ENGINES } from "../offers/law";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Where a graded cell's yardstick came from (L-QTY-06). `HAND_FROM_RENDER` — measured by hand off the
 * rendered drawing; `HAND_FROM_AUTHORED_SOURCE` — computed independently by formula from the authored
 * inputs the drawing was generated from; `INDEPENDENT_HUMAN_TAKEOFF` — a takeoff a person made with no
 * sight of this product's figure.
 *
 * The set is closed because "a number cannot reconcile with the source it was copied from": an
 * observation whose origin cannot be read back proves nothing, so there is no fourth answer and no
 * free-text escape.
 */
export const VALIDATION_PROVENANCES = ["HAND_FROM_RENDER", "HAND_FROM_AUTHORED_SOURCE", "INDEPENDENT_HUMAN_TAKEOFF"] as const;

/** One admitted provenance. */
export type ValidationProvenance = (typeof VALIDATION_PROVENANCES)[number];

/**
 * How a graded cell stood against its yardstick (L-QTY-06's band). `PASS` — every level inside
 * ±3 % under and +0 % over; `UNDER` — some level below the band, a failing observation the lane
 * records rather than reds on; `OVER` — some level above it, which is never a disclosure.
 */
export const VALIDATION_VERDICTS = ["PASS", "UNDER", "OVER"] as const;

/** One recorded verdict. */
export type ValidationVerdict = (typeof VALIDATION_VERDICTS)[number];

/**
 * One graded cell of the band matrix, as the lane proved it (R-TO-035, V-GOLDEN).
 *
 * The row is a claim about a moment: this engine measured this (class, kind) of this fixture against
 * this yardstick, under the rule-set edition, the methods and the converter NAMED HERE. Nothing is
 * derived at read time and nothing is a pointer — an edition retired tomorrow must not silently
 * rewrite what was proved yesterday, so every instrument is CITED by its own digest and the row
 * stays readable forever (L-QTY-06: the citations are what make a PASS mean anything).
 *
 * Append-only in the strong sense: no unique constraint stands on the cell, because restating a cell
 * is another observation and a correction is another observation — the app role holds neither UPDATE
 * nor DELETE, and the trigger pair holds the owner to the same rule (L-ACT-03, the site-fact ledger's
 * reading). A cell whose instruments left force is OUTLIVED: still here, never counted as validated.
 *
 * `observation_id` is minted, and that is not L-REG-04's "zero minted ids": that rule binds derived
 * ROW KEYS. An observation is an appended ledger record like an act, so it is addressed the way
 * `acts` is.
 */
export const validationObservations = pgTable(
  "validation_observations",
  {
    tenantId: uuid("tenant_id").notNull(),
    observationId: uuid("observation_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    /** The fixture the yardstick belongs to (AM-01: two fixtures, never a replacement). */
    fixtureId: text("fixture_id").notNull(),
    engine: text("engine").$type<(typeof ENGINES)[number]>().notNull(),
    class: text("class").notNull(),
    kind: text("kind").notNull(),
    verdict: text("verdict").$type<ValidationVerdict>().notNull(),
    /** The edition in force, as `${name}@${version}` — the words a person reads it back by. */
    rulesetEdition: text("ruleset_edition").notNull(),
    /** That edition's digest — what makes "in force" a comparison rather than a name. */
    editionDigest: text("edition_digest").notNull(),
    /** The methods that produced the cell's lines, hashed over their (ruleId@ruleVersion) pairs. */
    methodHash: text("method_hash").notNull(),
    /** The converter that turned the drawing into geometry, at the version it then was. */
    converterVersion: text("converter_version").notNull(),
    provenance: text("provenance").$type<ValidationProvenance>().notNull(),
    /** Every level the cell was graded at, with its golden, its measured sum and its own verdict. */
    levels: jsonb("levels").$type<readonly { level: string; golden: string; measured: string; verdict: ValidationVerdict }[]>().notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The rosters are the store's, not a writer's memory: an engine, a verdict or a provenance
    // outside its closed enum cannot be written at all, however it reached the insert (B-19).
    check("validation_observations_engine_closed", statement`${table.engine} in (${statement.raw(closedList(ENGINES))})`),
    check("validation_observations_verdict_closed", statement`${table.verdict} in (${statement.raw(closedList(VALIDATION_VERDICTS))})`),
    check("validation_observations_provenance_closed", statement`${table.provenance} in (${statement.raw(closedList(VALIDATION_PROVENANCES))})`),
    // The read every caller takes: one project's cells, by the key the ledger is kept under.
    index("validation_observations_by_cell").on(table.tenantId, table.projectId, table.engine, table.class, table.kind),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const VALIDATION_TABLES = { validationObservations };
