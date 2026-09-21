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
import { bigint, check, foreignKey, index, integer, json, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * One answer's judgment, as a System One model states it beside the answer (L-AI-01, AS-05 amendment
 * proposal): the primitive it was asked as, the value it answered, and how the probability stood
 * behind it. A Choice or a Score carries a `confidence` of its own; a Noul's probability IS its
 * judgment, so its `confidence` is that probability spelled once more, and a provider that states no
 * such figure leaves each null rather than inventing one.
 */
export type AnswerJudgmentRecord = {
  readonly type: "choice" | "noul" | "score";
  readonly value: string | number | null;
  readonly confidence: number | null;
  readonly probabilities: Readonly<Record<string, number>> | null;
};

/**
 * What a model said about its own answer, kept beside the call it belongs to. `provider` is the
 * model as the provider REPORTED it — a versioned id under the alias the request pinned — and
 * `confidence` is the weakest of the answers', because a call whose one question was uncertain is
 * an uncertain call: it is the figure the per-question calibration line reads. Declared here rather
 * than in the model seam because the column is built from it and the seam takes its type from this
 * declaration (the `SheetReadingRecord` precedent), so the two cannot drift (B-17).
 */
export type ModelJudgmentRecord = {
  readonly provider: string | null;
  readonly confidence: number | null;
  readonly answers: Readonly<Record<string, AnswerJudgmentRecord>>;
};

/**
 * How a person's later act settled a model's proposal (L-AI-02: a proposal becomes an offer, a
 * reading for disposition or a classification held until confirmed — and what the person then did
 * is the labeled outcome the calibration line is read over). CONFIRMED: taken as proposed.
 * OVERRULED: taken with the person's own value in its place. REPUDIATED: turned down. AFFIRMED: the
 * proposal was corroborated by a second, agreeing reading a person entered.
 *
 * The roster lives here because the CHECK below is built from it, and the seam re-exports it
 * (the `DISPOSITIONS` precedent, B-17).
 */
export const MODEL_OUTCOMES = ["CONFIRMED", "OVERRULED", "REPUDIATED", "AFFIRMED"] as const;

/** One outcome, drawn from the closed roster above. */
export type ModelOutcome = (typeof MODEL_OUTCOMES)[number];

/**
 * The model-call ledger (L-AI-01): one row per call to a model, whether it was proposed or refused,
 * with the request hash it was made under, the transport it went over and what it spent. Every call
 * is recorded, so the row is written before the outcome is known to anyone else — a refusal is a
 * ledger row too, carrying the code that explains it.
 *
 * The cost is stored beside the token counts rather than derived at read time: a rate can be
 * re-baselined, and what a call cost when it was made is a fact about that call.
 *
 * `question` names the closed question the call put (the request's own `question`, never hashed:
 * the same evidence asked under a renamed question is the same request), and `judgment` is what the
 * model said about its answer. Both are nullable because the ledger predates them and a call made
 * through the generative provider states neither.
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
    question: text("question"),
    // `json`, not `jsonb`: a judgment is shown back in the order its answers were asked, and jsonb
    // re-orders what it holds (the `sheet_understanding_dispositions.proposed` precedent).
    judgment: json("judgment").$type<ModelJudgmentRecord>(),
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
 * The outcome column of the ledger, kept beside it (L-AI-01, L-AI-02): what a person later did with
 * a proposed call, one append-only row per judgment. It is a sibling table and not a column of
 * `model_calls` because the ledger is never rewritten — an outcome arrives after the row it is about,
 * and the belt refuses an UPDATE — and because one call may be judged more than once (a reading
 * accepted, then a second person's repudiation): a later outcome is a newer row, and reads take the
 * newest per call.
 *
 * `act_id` names the act that carried the judgment where one did (a confirmation, a corroboration);
 * a disposition is a record and not an act (L-ACT-01), so it names none. `actor_user_id` is
 * provenance for a reader of the store — the evidence a signature rests on is the act seam's.
 */
export const modelCallOutcomes = pgTable(
  "model_call_outcomes",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    outcomeId: uuid("outcome_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    callId: uuid("call_id").notNull(),
    // The question the call put, copied from the call at write time so the per-question read
    // needs no join back to the ledger: a call's question never changes after the row is written.
    question: text("question").notNull(),
    outcome: text("outcome").$type<ModelOutcome>().notNull(),
    actId: uuid("act_id"),
    actorUserId: uuid("actor_user_id").notNull(),
    // `clock_timestamp()`, not `now()`: two outcomes recorded inside one transaction would
    // otherwise carry the same instant.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(statement`clock_timestamp()`),
    // The order rows were recorded in — what "newest per call" means when two share an instant.
    // GENERATED ALWAYS: a writer that could supply it could reorder the history.
    recordedSeq: bigint("recorded_seq", { mode: "number" }).generatedAlwaysAsIdentity(),
  },
  (table) => [
    check("model_call_outcomes_closed", statement`${table.outcome} in (${statement.raw(closedList(MODEL_OUTCOMES))})`),
    // The call an outcome judges is one this tenant made: composite, because a foreign key on
    // `call_id` alone is checked with row security bypassed and would accept another workspace's
    // call id (SEAM-TENANT; the `sheet_understanding_dispositions_call_fk` precedent).
    foreignKey({
      columns: [table.tenantId, table.callId],
      foreignColumns: [modelCalls.tenantId, modelCalls.callId],
      name: "model_call_outcomes_call_fk",
    }),
    // The read the calibration line makes: one project's outcomes, by question.
    index("model_call_outcomes_by_question").on(table.tenantId, table.projectId, table.question),
    // The read the ledger panel makes: how this call was judged, newest first.
    index("model_call_outcomes_by_call").on(table.tenantId, table.callId, table.recordedSeq),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const MODEL_TABLES = {
  modelCalls,
  modelFixtures,
  modelCallOutcomes,
};
