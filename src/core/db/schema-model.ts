// SEAM-TENANT: the model area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { MODEL_IDS } from "../model-ledger.types";
import { tenants } from "./schema-tenants";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, integer, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * The model-call ledger (L-AI-01): one row per call to a model, whether it was proposed or refused,
 * with the request hash it was made under, the transport it went over and what it spent. Every call
 * is recorded, so the row is written before the outcome is known to anyone else — a refusal is a
 * ledger row too, carrying the code that explains it.
 *
 * The cost is stored beside the token counts rather than derived at read time: a rate can be
 * re-baselined, and what a call cost when it was made is a fact about that call.
 */
export const modelCalls = pgTable(
  "model_calls",
  {
    callId: uuid("call_id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    projectId: uuid("project_id").notNull(),
    modelId: text("model_id").notNull(),
    requestHash: text("request_hash").notNull(),
    transport: text("transport").notNull(),
    outcome: text("outcome").notNull(),
    refusalCode: text("refusal_code"),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    // Money, as an exact decimal: numeric, never a binary float (L-AI-01 attributes tokens to a
    // tenant, and an attribution that rounds attributes something else).
    attributedCost: numeric("attributed_cost").notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The id a call was pinned to is one of the closed const's (AS-05): the column is closed over
    // the same roster the seam pins from, so the ledger cannot hold a call nobody can bill.
    check("model_calls_model_id_closed", statement`${table.modelId} in (${statement.raw(closedList(MODEL_IDS))})`),
    check("model_calls_transport_closed", statement`${table.transport} in ('live', 'fixture')`),
    check("model_calls_outcome_closed", statement`${table.outcome} in ('proposed', 'refused')`),
    // A refused call says which refusal it was, and a proposed one names none: nothing refused it.
    check("model_calls_refusal_code_iff_refused", statement`(${table.refusalCode} is not null) = (${table.outcome} = 'refused')`),
    // A call spends a whole, non-negative number of tokens — the same judgement `modelCallCost`
    // makes at the seam's edge, made again by the column, because the ledger is a table other
    // writers reach and a negative count would subtract from a tenant's attribution.
    check("model_calls_tokens_counted", statement`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0`),
    // Money the ledger can add up. `numeric` also admits 'NaN' and the infinities, and sum()
    // spreads either across every row of the tenant — one such row would make per-project spend
    // unanswerable rather than wrong by itself. NaN sorts above every number, so the upper bound
    // shuts it out along with 'Infinity'.
    check("model_calls_cost_is_money", statement`${table.attributedCost} >= 0 and ${table.attributedCost} < 'Infinity'::numeric`),
    // The read R-AI-005's surfaces make: one tenant's spend, gathered by project.
    index("model_calls_by_project").on(table.tenantId, table.projectId),
    // The key a tenant-scoped child points at (SEAM-TENANT). `call_id` is unique by itself, but a
    // foreign key naming it alone would accept a row of one workspace pointing at another's call:
    // referential checks run with row security bypassed, so only the composite key states "a call
    // this tenant made", and only it keeps the constraint from answering whether another workspace
    // made a given call. The precedent is `acts_actor_participates_fk`.
    unique("model_calls_call_per_tenant").on(table.tenantId, table.callId),
  ],
);

/**
 * The fixture registry (L-AI-01): which recorded fixture answers a given request hash, per tenant.
 * The digest rather than the fixture — what is replayed is held where fixtures are held, and this
 * table is the registry that says a request hash has one and which one it is.
 */
export const modelFixtures = pgTable(
  "model_fixtures",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    requestHash: text("request_hash").notNull(),
    fixtureDigest: text("fixture_digest").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.requestHash] })],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const MODEL_TABLES = {
  modelCalls,
  modelFixtures,
};
