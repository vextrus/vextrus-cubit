// SEAM-TENANT: the drawing-sets area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { acts } from "./schema-acts";
import { drawings } from "./schema-drawings";
import { index, json, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * R-TO-005's drawing set: a named grouping of a project's drawings, told apart from its siblings by
 * the name a person gave it. The row is a record of a naming that happened and is never rewritten —
 * what the set NAMES lives in `drawing_set_members` beside it, which is a draft.
 */
export const drawingSets = pgTable(
  "drawing_sets",
  {
    tenantId: uuid("tenant_id").notNull(),
    setId: uuid("set_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A project tells its sets apart by name, so the store is what makes SET_NAME_NOT_USABLE true
    // rather than a writer remembering to look first.
    unique("drawing_sets_named_once").on(table.tenantId, table.projectId, table.name),
    // The read the sets index makes: one project's sets, newest first.
    index("drawing_sets_by_project").on(table.tenantId, table.projectId, table.createdAt),
  ],
);

/**
 * Which drawings a set names right now: a draft, edited one subject at a time and derived from by
 * nothing (L-ACT-01 — an act is a write that changes what the machine would derive, and this is not
 * one). A row taken out of it destroys no evidence, because the evidence is the pinned revision.
 */
export const drawingSetMembers = pgTable(
  "drawing_set_members",
  {
    tenantId: uuid("tenant_id").notNull(),
    setId: uuid("set_id")
      .notNull()
      .references(() => drawingSets.setId),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    // Who the draft edit is attributed to. It is provenance for a person reading the store and
    // never evidence: nothing is derived from a draft (I-B), and the record a campaign is measured
    // against is the pinned revision, whose author is the act it names (L-ACT-01).
    addedBy: uuid("added_by").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ name: "drawing_set_members_pk", columns: [table.tenantId, table.setId, table.drawingId] })],
);

/**
 * L-REG-06's pinned set revision: the manifest of (drawing, drawing revision) pairs a pin recorded,
 * content-addressed by the digest of its members in canonical order, naming the act that authored
 * it. Immutable — "mutation is advance, never drift", so a changed membership or a re-revved member
 * yields another row here and never an edit of this one. The digest carries no uniqueness: content
 * addressing means the same content has the same address, and A → B → A is three revisions.
 */
export const drawingSetRevisions = pgTable(
  "drawing_set_revisions",
  {
    tenantId: uuid("tenant_id").notNull(),
    setRevisionId: uuid("set_revision_id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => drawingSets.setId),
    projectId: uuid("project_id").notNull(),
    digest: text("digest").notNull(),
    // `json`, not `jsonb`: the manifest is stored in the canonical order it was addressed in, and
    // jsonb re-orders what it holds.
    manifest: json("manifest").$type<{ drawingId: string; revisionId: string; sha256: string; name: string }[]>().notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The read the set browser makes: one set's pinned revisions, in the order they were pinned.
    index("drawing_set_revisions_by_set").on(table.tenantId, table.setId, table.createdAt),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const DRAWING_SETS_TABLES = {
  drawingSets,
  drawingSetMembers,
  drawingSetRevisions,
};
