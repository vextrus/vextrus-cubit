// SEAM-TENANT: the ai area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import type { Discipline } from "../sheets/law";
import { modelCalls } from "./schema-model";
import { tenants } from "./schema-tenants";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { bigint, check, foreignKey, index, json, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * How a person answered a model's reading of a sheet (R-AI-001): they took it, they took it with
 * edits, or they turned it down. The roster lives here because the CHECK below is built from it and
 * core cannot import `src/modules` (ARCH-01) — the same reason `WORKSPACE_ROLES` and `UPLOAD_STATES`
 * live here; the AI module re-exports it, so the column and the door speak one list (B-17).
 */
export const DISPOSITIONS = ["accepted", "edited", "rejected"] as const;

/** One disposition, drawn from the closed roster above. */
export type Disposition = (typeof DISPOSITIONS)[number];

/**
 * The reading a disposition was made about, as the column carries it (R-AI-001's number, title,
 * discipline and view captions). It is stated here rather than imported because the shape's own home
 * is `src/modules/ai/sheet-understanding`, which core may not name (ARCH-01); that module takes its
 * `SheetReading` from this declaration rather than restating it, so the two cannot drift.
 */
export type SheetReadingRecord = {
  readonly number: string | null;
  readonly title: string;
  readonly discipline: Discipline;
  readonly captions: readonly string[];
};

/**
 * R-AI-001's last sentence: "every proposal accepted/edited/rejected is recorded". One append-only
 * row per disposition, keyed by the ledger's own `call_id`, so what a person did with a reading is
 * answerable from the call that proposed it (L-AI-01's ledger is the other half).
 *
 * It is a record and not an act (L-ACT-01): a disposition changes nothing the machine would derive —
 * confirming a discipline is CONFIRM_DISCIPLINE, an act of its own, which writes `sheet_disciplines`.
 * Nothing here does. The reading is stored twice over where it was edited: `proposed` is what the
 * model said and `resolved` what the person settled on, because an edit that overwrote the proposal
 * would destroy the evidence the disposition is about.
 *
 * `json`, not `jsonb`: a reading is shown back in the order its fields are named, and jsonb re-orders
 * what it holds. A later disposition of the same call is a newer row, never an edit of this one —
 * reads take newest-first.
 */
export const sheetUnderstandingDispositions = pgTable(
  "sheet_understanding_dispositions",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    dispositionId: uuid("disposition_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    callId: uuid("call_id").notNull(),
    sheetId: text("sheet_id").notNull(),
    disposition: text("disposition").$type<Disposition>().notNull(),
    proposed: json("proposed").$type<SheetReadingRecord>().notNull(),
    resolved: json("resolved").$type<SheetReadingRecord>(),
    // Who dispositioned it. Provenance for a person reading the store, like `drawing_sets.created_by`
    // — the evidence a signature would rest on is the act seam's, and no act is performed here.
    actorUserId: uuid("actor_user_id").notNull(),
    // `clock_timestamp()`, not `now()`: `now()` is the transaction's start, so two dispositions made
    // inside one transaction would carry the same instant.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(statement`clock_timestamp()`),
    // The order rows were recorded in, which is what "newest-first" means when two of them share an
    // instant — a clock has a resolution and a sequence does not. GENERATED ALWAYS: it is the store's
    // own count of what it accepted, and a writer that could supply it could reorder the history.
    recordedSeq: bigint("recorded_seq", { mode: "number" }).generatedAlwaysAsIdentity(),
  },
  (table) => [
    check("sheet_understanding_dispositions_closed", statement`${table.disposition} in (${statement.raw(closedList(DISPOSITIONS))})`),
    // An edit is the only disposition that settles on a reading of its own; taking a proposal or
    // turning it down resolves nothing. The store says so too, because this table is reachable by
    // writers that are not the module's door.
    check("sheet_understanding_dispositions_resolved_iff_edited", statement`(${table.resolved} is not null) = (${table.disposition} = 'edited')`),
    // The call a disposition answers is one this tenant made: the key is composite because a foreign
    // key on `call_id` alone is checked with row security bypassed and would accept another
    // workspace's call id (SEAM-TENANT), as `acts_actor_participates_fk` is composite for the same
    // reason. It is the store's own statement of what `recordDisposition` checks before it writes.
    foreignKey({
      columns: [table.tenantId, table.callId],
      foreignColumns: [modelCalls.tenantId, modelCalls.callId],
      name: "sheet_understanding_dispositions_call_fk",
    }),
    // The read R-AI-005's surfaces make: one project's dispositions, newest first.
    index("sheet_understanding_dispositions_by_project").on(table.tenantId, table.projectId, table.createdAt, table.recordedSeq),
    // The read a sheet card makes: how this proposal was answered.
    index("sheet_understanding_dispositions_by_call").on(table.tenantId, table.callId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const AI_TABLES = {
  sheetUnderstandingDispositions,
};
