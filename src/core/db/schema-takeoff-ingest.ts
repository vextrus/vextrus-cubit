// SEAM-TENANT: the takeoff-ingest area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { INGESTED_SCHEMES, TRACED_BESIDE } from "../entitygraph/schema";
import type { SourceScheme } from "../model";
import { drawings } from "./schema-drawings";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, json, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * The schemes an ingest record may name as its extractor's, read from the one list the EntityGraph
 * mirror admits as an artifact's own `ingest.scheme` — L-CAD-02's closed set, whole (R-TO-002 reads a
 * vector PDF under PDF_OBJECT, R-TO-003 a scan under RASTER_TRACE). The column below closes on it, so
 * a record can only ever name a scheme some artifact could have pinned, and never a spelling of one
 * (B-19).
 */
const SCHEMES_CLOSED = INGESTED_SCHEMES satisfies readonly SourceScheme[];

/**
 * R-TO-001's ingest record: which extractor, at which version and parameter set, took which
 * geometry out of which bytes, and what it counted while doing it (L-CAD-02 pins the identity a
 * source key is scoped to).
 *
 * The identity is pinned PER SCHEME (L-CAD-02: "version + parameter-set hash per scheme", I-518).
 * `extractor_*` is the extractor that read the file and the scheme it minted; `trace_*` is the
 * vectoriser's, present only where the same pages also minted RASTER_TRACE keys beside PDF_OBJECT
 * ones (R-TO-003's mixed page) — all three or none, and only beside a PDF's, which the CHECK holds.
 *
 * It is evidence, so it is append-only and a re-ingest never replaces one: a declared re-ingest
 * writes a new row naming the row it supersedes and the reason it was asked for, and a first ingest
 * names neither. Whether those two go together is judged at the seam, where a refusal can be
 * answered, rather than by a CHECK that could only abort a job.
 *
 * `facts` is `json` and not `jsonb`: the counters are read back in the artifact's own order, and
 * jsonb re-orders the keys of every object it stores.
 */
export const ingests = pgTable(
  "ingests",
  {
    tenantId: uuid("tenant_id").notNull(),
    ingestId: uuid("ingest_id").primaryKey().defaultRandom(),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    sha256: text("sha256").notNull(),
    jobId: text("job_id").notNull(),
    artifactSha256: text("artifact_sha256").notNull(),
    extractorScheme: text("extractor_scheme").$type<SourceScheme>().notNull(),
    extractorTool: text("extractor_tool").notNull(),
    extractorToolVersion: text("extractor_tool_version").notNull(),
    extractorParameterSetHash: text("extractor_parameter_set_hash").notNull(),
    traceTool: text("trace_tool"),
    traceToolVersion: text("trace_tool_version"),
    traceParameterSetHash: text("trace_parameter_set_hash"),
    facts: json("facts").$type<Readonly<Record<string, unknown>>>().notNull(),
    supersedesIngestId: uuid("supersedes_ingest_id"),
    declaredReason: text("declared_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("ingests_extractor_scheme_closed", statement`${table.extractorScheme} in (${statement.raw(closedList(SCHEMES_CLOSED))})`),
    // A second identity is a whole identity or none, and it rides only beside a PDF's (I-518).
    check(
      "ingests_trace_identity_whole",
      statement`(${table.traceTool} is null and ${table.traceToolVersion} is null and ${table.traceParameterSetHash} is null) or (${table.traceTool} is not null and ${table.traceToolVersion} is not null and ${table.traceParameterSetHash} is not null and ${table.extractorScheme} = ${statement.raw(closedList([TRACED_BESIDE]))})`,
    ),
    // One job writes one record, however many times its attempt runs (SEAM-JOBS' idempotence).
    uniqueIndex("ingests_job_once").on(table.tenantId, table.jobId),
    // The read every ingest history makes: one drawing's records, newest first.
    index("ingests_by_drawing").on(table.tenantId, table.drawingId, table.createdAt),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_INGEST_TABLES = {
  ingests,
};
