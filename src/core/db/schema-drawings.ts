// SEAM-TENANT: the drawings area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/*
 * R-SPINE-020's upload rosters live beside the tables whose CHECKs are written from them: the three
 * columns below close on these lists, and the upload seam types its answers by the same ones
 * (re-exported from src/modules/spine/uploads/index.ts, which is where a caller reads them). One
 * home, read by both (ARCH-02, B-17).
 */

/** R-SPINE-020's roster, in the order the accepts line names them. */
export const ACCEPTED_FORMATS = ["dwg", "dxf", "pdf", "png", "jpg", "tiff"] as const;

/** One of the six formats a drawing arrives in, as a type. */
export type AcceptedFormat = (typeof ACCEPTED_FORMATS)[number];

/** Is this one of the six? Asked wherever a format arrives as text — a stored row, a query answer. */
export function isAcceptedFormat(value: string): value is AcceptedFormat {
  return (ACCEPTED_FORMATS as readonly string[]).includes(value);
}

/**
 * Where an upload session stands: taking bytes, ended with its content stored, or ended refused.
 * The set is closed because the column's CHECK is written from it — a session in no state at all is
 * a session nothing can answer for.
 */
export const UPLOAD_STATES = ["open", "stored", "refused"] as const;

/** One of the three, as a type. */
export type UploadState = (typeof UPLOAD_STATES)[number];

/**
 * What a scanner said about some bytes (R-SPINE-020's hook point). `skipped` is the honest answer of
 * an installation with no scanner wired: it is recorded on the stored file so nothing unscanned is
 * ever read back as clean.
 */
export const SCAN_VERDICTS = ["clean", "infected", "skipped"] as const;

/** One verdict, as a type. */
export type ScanVerdict = (typeof SCAN_VERDICTS)[number];

/**
 * R-SPINE-022's three zoom tiers, smallest first: the sheet index's thumbnail, the viewer's
 * preview and the full-page raster. The roster lives here because the `sheet_rasters` CHECK is
 * written from it and the raster seam types its answers by the same list (re-exported from
 * src/modules/takeoff/thumbnails, which is where a caller reads it) — one home, read by both
 * (ARCH-02, B-17). The pixels each tier is rendered at belong to the renderer, not to the store.
 */
export const RASTER_TIERS = ["thumb", "preview", "full"] as const;

/** One zoom tier, as a type. */
export type RasterTier = (typeof RASTER_TIERS)[number];

/** R-SPINE-020's ceiling: 500 MB per file, in bytes. */
export const UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

/** The chunk an upload session takes at a time, in bytes. */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * R-SPINE-020's stored content, addressed by what it is: one row per distinct content a workspace
 * holds, keyed by the tenant and the sha256 of the bytes. A second upload of identical bytes finds
 * this row and links it rather than storing the content again, which is why the digest is the key
 * and not a column beside one.
 *
 * `scan_verdict` is recorded rather than implied: an installation with no scanner wired answers
 * `skipped`, and a file nobody scanned must never read back as one somebody passed (Q-12).
 */
export const files = pgTable(
  "files",
  {
    tenantId: uuid("tenant_id").notNull(),
    sha256: text("sha256").notNull(),
    byteLength: integer("byte_length").notNull(),
    format: text("format").$type<AcceptedFormat>().notNull(),
    scanVerdict: text("scan_verdict").$type<ScanVerdict>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.sha256] }),
    check("files_format_closed", statement`${table.format} in (${statement.raw(closedList(ACCEPTED_FORMATS))})`),
    check("files_scan_verdict_closed", statement`${table.scanVerdict} in (${statement.raw(closedList(SCAN_VERDICTS))})`),
    check("files_byte_length_counted", statement`${table.byteLength} >= 0`),
  ],
);

/**
 * One drawing per presented file (R-SPINE-020): the name it arrived under — a member path out of a
 * `.zip` or a dropped folder's relative path, verbatim, because which folder a sheet came out of is
 * drawing information — pointing at the content it is made of.
 *
 * Two drawings of one content are two rows against one `files` row: the composite foreign key is
 * what makes "detected and linked, not re-stored" a property of the schema rather than of a writer
 * remembering to check.
 */
export const drawings = pgTable(
  "drawings",
  {
    tenantId: uuid("tenant_id").notNull(),
    drawingId: uuid("drawing_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    sha256: text("sha256").notNull(),
    name: text("name").notNull(),
    format: text("format").$type<AcceptedFormat>().notNull(),
    uploadedBy: uuid("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "drawings_content",
      columns: [table.tenantId, table.sha256],
      foreignColumns: [files.tenantId, files.sha256],
    }),
    check("drawings_format_closed", statement`${table.format} in (${statement.raw(closedList(ACCEPTED_FORMATS))})`),
    // The read every drawing surface makes: one project's drawings, newest first.
    index("drawings_by_project").on(table.tenantId, table.projectId, table.createdAt),
  ],
);

/**
 * A transfer in progress (R-SPINE-020's resumable half): what was declared when the session opened,
 * how many bytes have been acknowledged since, and how it ended. `received_bytes` is the resumption
 * point a probe answers with — the server's own count of what it holds, never the client's.
 */
export const uploads = pgTable(
  "uploads",
  {
    tenantId: uuid("tenant_id").notNull(),
    uploadId: uuid("upload_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    declaredSize: integer("declared_size").notNull(),
    declaredSha256: text("declared_sha256").notNull(),
    receivedBytes: integer("received_bytes").notNull().default(0),
    state: text("state").$type<UploadState>().notNull().default("open"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("uploads_state_closed", statement`${table.state} in (${statement.raw(closedList(UPLOAD_STATES))})`),
    // A session never takes more than it was opened for, and never fewer than none: the offset a
    // client resumes from is a position inside the file it declared.
    check("uploads_received_within_declared", statement`${table.receivedBytes} >= 0 and ${table.receivedBytes} <= ${table.declaredSize}`),
    check("uploads_declared_size_counted", statement`${table.declaredSize} >= 0 and ${table.declaredSize} <= ${statement.raw(String(UPLOAD_MAX_BYTES))}`),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const DRAWINGS_TABLES = {
  files,
  drawings,
  uploads,
};
