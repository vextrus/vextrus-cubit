// SEAM-TENANT: the DOCS area's tables — what an issued document is recorded as (R-SPINE-040, AM-11).
//
// The definitions live HERE and are re-exported from `db/schema/docs.ts` for the drift lane.
// `schema.ts` already enumerates this file, so a table added to the group below joins `SEAM_SCHEMA`
// and the seam's typed surface with no shared roster to edit and no other area's file to touch (B-19).
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper).

import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * One issued document (R-SPINE-040). The bytes are NOT here: they go through SEAM-STORAGE, addressed
 * by the sha256 of themselves, and `sha256` is both the address and the row's statement of which
 * bytes this issue was. The row is everything a reader needs to say what the document was rendered
 * UNDER and would need to render it again — the digest of the payload it was made from, the renderer
 * pin, the hash of every face it embedded, the taxonomy version and the acts it stood on (L-FMT-03).
 *
 * Issues are a chain, not a history table: each is `version` n of its kind on its project, and the
 * one it replaces names it in `superseded_by`. Both writes happen in ONE transaction, so a reader
 * never sees two live issues of a kind or a supersession pointing at a row that was rolled back.
 *
 * No foreign key to the act log: `act_ids` records what the document was rendered under at the moment
 * it was issued, and a document is evidence — it must still state what it stood on even if a later
 * act is repudiated. A constraint would make the record of the past depend on the present (L-ACT-01).
 */
export const documents = pgTable(
  "documents",
  {
    tenantId: uuid("tenant_id").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    kind: text("kind").notNull(),
    version: integer("version").notNull(),
    /** The sha256 of the PDF's own bytes: the storage address and the document's identity (R-SPINE-021). */
    sha256: text("sha256").notNull(),
    /** The sha256 of the canonical payload the document was rendered from (R-SPINE-040). */
    payloadDigest: text("payload_digest").notNull(),
    /** The renderer, as AM-08 pins it: command, version and digest, as the manifest stated them. */
    rendererPin: text("renderer_pin").notNull(),
    /** Every embedded face against the sha256 of its bytes — what makes the render reproducible. */
    fontHashes: jsonb("font_hashes").$type<Record<string, string>>().notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    actIds: uuid("act_ids").array().notNull(),
    issuedBy: uuid("issued_by").notNull(),
    /** The issue that replaced this one, once one has; the newest issue is superseded by nothing. */
    supersededBy: uuid("superseded_by"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A project holds ONE document of a kind at a version. Two writers racing to issue the next
    // version both compute the same number, and this is what refuses the second of them — the count
    // is derived from what is stored, so the store must be the thing that arbitrates it.
    unique("documents_one_version_per_kind").on(table.projectId, table.kind, table.version),
    // The listing is per project, newest first (R-SPINE-040), and that is the shape read here.
    index("documents_by_project").on(table.tenantId, table.projectId, table.version),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const DOCS_TABLES = {
  documents,
};
