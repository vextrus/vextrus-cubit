// SEAM-TENANT: the takeoff-views area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import type { ConventionProfile, EntityCensus } from "../rulesets/methods/conventions/resolve";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, json, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * R-TO-030's stored partition, view half: one row per view an ingest's model space was cut into
 * (L-CAD-06). A partition is REBUILT per ingest rather than appended to — the rows are deleted and
 * written again in one transaction — so this is a derived table, not a ledger, and the app role holds
 * a DELETE on it.
 *
 * The key is content-derived and mints nothing (L-REG-04): a view is its class and the source key of
 * the caption that anchors it, so re-deriving the same artifact reproduces the same key multiset. The
 * primary key is that triple rather than a surrogate for the same reason.
 *
 * It references no ledger. The ingest, the drawing and the model call are named by id and pointed at
 * by nothing: a table rebuilt per ingest may not be a child of an append-only table, or emptying one
 * would fail on the constraint this table would add (0A000).
 *
 * The model's reading, where one was asked for, stands BESIDE the view and never in it (L-AI-02):
 * `proposed_type` is what a model proposed for a caption the grammar could not read, `proposed_call_id`
 * the ledger row that proposed it, and `type` stays what the grammar answered until a person confirms
 * otherwise.
 */
/**
 * A view class as a column holds one. L-CAD-06's vocabulary is closed and its law lives in a module
 * core may not import (ARCH-01), so the store is written from the roster the transport declares —
 * the same eleven spellings, read from their one home rather than repeated here (B-17).
 */
type ViewTypeSpelling = (typeof VIEW_TYPE_SPELLINGS)[number];

export const partitionViews = pgTable(
  "partition_views",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    type: text("type").$type<ViewTypeSpelling>().notNull(),
    /** Why the type is what it is, where the grammar read nothing — a registered refusal code. */
    reason: text("reason"),
    /** The caption this view is anchored by, as the drawing states it; empty where none anchors it. */
    caption: text("caption").notNull(),
    /** The source key of the caption's own entity, or null for the view no caption anchors. */
    anchorKey: text("anchor_key"),
    proposedType: text("proposed_type").$type<ViewTypeSpelling>(),
    proposedCallId: uuid("proposed_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "partition_views_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    // The vocabulary is closed, so the store closes it too: a class outside the eleven cannot be
    // written at all, however it reached the insert (L-CAD-06).
    check("partition_views_type_closed", statement`${table.type} in (${statement.raw(closedList(VIEW_TYPE_SPELLINGS))})`),
    check("partition_views_proposed_type_closed", statement`${table.proposedType} in (${statement.raw(closedList(VIEW_TYPE_SPELLINGS))})`),
    // A proposal is a payload and the call that made it, or neither: a proposed class naming no
    // ledger row would be a reading nobody could audit (L-AI-01).
    check("partition_views_proposal_whole", statement`(${table.proposedType} is null) = (${table.proposedCallId} is null)`),
    // The read a screen and the act seam make: one drawing's current partition.
    index("partition_views_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * R-TO-030's stored partition, membership half: which view each model-space original entity landed
 * in. L-CAD-06 — "every model-space original entity belongs to exactly one view" — is this table's
 * primary key, so a partition that assigned an entity twice cannot be written at all.
 *
 * Rewritten per ingest with the views above, in the same transaction, and pointing at no ledger for
 * the same reason.
 */
export const viewAssignments = pgTable(
  "view_assignments",
  {
    tenantId: uuid("tenant_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    entityKey: text("entity_key").notNull(),
    viewKey: text("view_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "view_assignments_entity", columns: [table.tenantId, table.ingestId, table.entityKey] }),
    // The read the partition makes of itself: everything one view holds.
    index("view_assignments_by_view").on(table.tenantId, table.ingestId, table.viewKey),
  ],
);

/**
 * L-CAD-06's human half: what a person confirmed one view to be, and the act that carried it
 * (L-ACT-01 — the act row and the state change land in one transaction or neither).
 *
 * A confirmation is never a before-image and never a rewrite: the grammar's own reading stays in
 * `partition_views.type` and this row stands beside it. It is a record of something a person did, so
 * unlike the two tables above it is append-only and the app role holds no DELETE.
 */
export const viewTypeConfirmations = pgTable(
  "view_type_confirmations",
  {
    tenantId: uuid("tenant_id").notNull(),
    confirmationId: uuid("confirmation_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    type: text("type").$type<ViewTypeSpelling>().notNull(),
    actId: uuid("act_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Closed here for the reason it is closed on the view itself: a person confirms a class of the
    // vocabulary, and nothing else is a class (L-CAD-06).
    check("view_type_confirmations_type_closed", statement`${table.type} in (${statement.raw(closedList(VIEW_TYPE_SPELLINGS))})`),
    // One confirmation per view of one record: a second, disagreeing reading is a competing
    // observation, which L-ACT-01 gives a path of its own rather than a second row here.
    uniqueIndex("view_type_confirmations_once").on(table.tenantId, table.ingestId, table.viewKey),
    // The read the partition makes: what a drawing's views have been confirmed as.
    index("view_type_confirmations_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-CAD-08's convention profile: which layers one drawing carries its linework, outlines, text and
 * dimensions on, and which caption grammars named its views — the second stage of R-TO-030's stored
 * partition.
 *
 * One row per ingest record, rewritten with the views it was read beside and in the same
 * transaction: the profile is a derivation of the artifact, so it is re-derived rather than edited
 * (L-REG-04), and the app role holds a DELETE here for the same reason it holds one on the views.
 *
 * The method that resolved it is stored as (rule id, version) — a derivation whose method is not
 * recorded is one nobody can attribute (L-CAD-08, L-MEA-01). `json`, not `jsonb`: the profile and
 * the census are read back in the order they were derived in, and jsonb re-orders what it holds.
 */
export const conventionProfiles = pgTable(
  "convention_profiles",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleVersion: text("rule_version").notNull(),
    profile: json("profile").$type<ConventionProfile>().notNull(),
    census: json("census").$type<EntityCensus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One profile per ingest, in one workspace: a rebuilt partition replaces the profile of the
    // record it rebuilt rather than standing a second one beside it.
    primaryKey({ name: "convention_profiles_key", columns: [table.tenantId, table.ingestId] }),
    // The read a drawing's own screen makes: the profile that stands for it now.
    index("convention_profiles_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_VIEWS_TABLES = {
  partitionViews,
  viewAssignments,
  viewTypeConfirmations,
  conventionProfiles,
};
