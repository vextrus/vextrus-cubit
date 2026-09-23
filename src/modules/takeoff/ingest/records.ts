// The persisted half of R-TO-001: one append-only row per ingest, pinning which extractor took
// which geometry out of which bytes (L-CAD-02) and what it counted while doing it.
//
// A record is never rewritten and never replaced: a declared re-ingest writes a new row naming the
// one it supersedes, so a drawing's history reads newest first and every earlier answer stands.
import { desc, eq, forTenant, ingests, isUuid, type TenantTx } from "@/core/db";
import type { SourceScheme } from "@/core/model";
import type { IngestFacts } from "./facts";

/** Which drawing's ingests are being asked about, in whose workspace. */
export type IngestScope = { tenantId: string; drawingId: string };

/** The extractor identity a record pins (L-CAD-02): who took the geometry, at which parameters. */
export type IngestIdentity = { scheme: SourceScheme; tool: string; toolVersion: string; parameterSetHash: string };

/**
 * The vectoriser's identity where the same pages also minted RASTER_TRACE keys beside a PDF's own —
 * the second identity L-CAD-02 pins "per scheme" (I-518). Null wherever no traced key was minted.
 */
export type TraceIdentity = { tool: string; toolVersion: string; parameterSetHash: string };

/** One ingest, whole, as a caller reads it back. */
export type IngestRecord = {
  ingestId: string;
  drawingId: string;
  sha256: string;
  jobId: string;
  artifactSha256: string;
  extractor: IngestIdentity;
  trace: TraceIdentity | null;
  facts: IngestFacts;
  supersedes: string | null;
  declaredReason: string | null;
  createdAt: string;
};

/** What one finished ingest lays down. */
export type IngestEntry = {
  tenantId: string;
  drawingId: string;
  sha256: string;
  jobId: string;
  artifactSha256: string;
  extractor: IngestIdentity;
  trace: TraceIdentity | null;
  facts: IngestFacts;
  supersedes: string | null;
  declaredReason: string | null;
};

/** The row as the store holds it, before it is read as a record. */
type IngestRow = typeof ingests.$inferSelect;

/** A stored row, as the seam publishes it. */
function record(row: IngestRow): IngestRecord {
  return {
    ingestId: row.ingestId,
    drawingId: row.drawingId,
    sha256: row.sha256,
    jobId: row.jobId,
    artifactSha256: row.artifactSha256,
    extractor: {
      scheme: row.extractorScheme,
      tool: row.extractorTool,
      toolVersion: row.extractorToolVersion,
      parameterSetHash: row.extractorParameterSetHash,
    },
    trace: traceOf(row),
    facts: row.facts as IngestFacts,
    supersedes: row.supersedesIngestId,
    declaredReason: row.declaredReason,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The vectoriser's identity a row pins, or null — the CHECK holds the three columns whole or absent. */
function traceOf(row: IngestRow): TraceIdentity | null {
  if (row.traceTool === null || row.traceToolVersion === null || row.traceParameterSetHash === null) return null;
  return { tool: row.traceTool, toolVersion: row.traceToolVersion, parameterSetHash: row.traceParameterSetHash };
}

/**
 * Every ingest of one drawing, newest first — the read `ingests_by_drawing` is there for.
 *
 * The order is TOTAL. `created_at` alone leaves two records written in one transaction — a re-ingest
 * and the supersession it wrote, a backfill — in whichever order the planner reached them, and
 * "the current record" is the first row of this list: it would then change between two reads of the
 * same rows. The record id settles it, descending like the clock it tie-breaks.
 */
export async function ingestRecords(scope: IngestScope): Promise<IngestRecord[]> {
  if (!isUuid(scope.drawingId)) return [];
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => ingestRecordsIn(tx, scope));
}

/**
 * The same list, read on a transaction the caller holds — for a reader that must see the state an
 * act's own write lands in (L-ACT-02). One query, and `ingestRecords` is it on a transaction of its
 * own, so "which record is current" has one answer wherever it is asked (B-17).
 */
export async function ingestRecordsIn(tx: TenantTx, scope: IngestScope): Promise<IngestRecord[]> {
  if (!isUuid(scope.drawingId)) return [];
  const rows = await tx.select().from(ingests).where(eq(ingests.drawingId, scope.drawingId)).orderBy(desc(ingests.createdAt), desc(ingests.ingestId));
  return rows.map(record);
}

/** The drawing's current ingest — the newest of them — or null where it has never been ingested. */
export async function ingestRecordOf(scope: IngestScope): Promise<IngestRecord | null> {
  return (await ingestRecords(scope))[0] ?? null;
}

/** The drawing's current ingest, read on the caller's transaction. */
export async function ingestRecordIn(tx: TenantTx, scope: IngestScope): Promise<IngestRecord | null> {
  return (await ingestRecordsIn(tx, scope))[0] ?? null;
}

/** The record one job wrote, or null where that job has written none — what makes a retry idempotent. */
export async function ingestRecordOfJob(tenantId: string, jobId: string): Promise<IngestRecord | null> {
  const rows = await forTenant({ tenantId }).select().from(ingests).where(eq(ingests.jobId, jobId)).limit(1);
  const row = rows[0];
  return row === undefined ? null : record(row);
}

/**
 * Lay one ingest down. The row is written at most once per job whatever the queue does with the
 * attempt: `ingests_job_once` is the belt, and a second attempt of one job finds the row it already
 * wrote rather than adding to the drawing's history (SEAM-JOBS: every job idempotent on its key).
 */
export async function writeIngestRecord(entry: IngestEntry): Promise<void> {
  const db = forTenant({ tenantId: entry.tenantId });
  await db
    .insert(ingests)
    .values({
      tenantId: entry.tenantId,
      drawingId: entry.drawingId,
      sha256: entry.sha256,
      jobId: entry.jobId,
      artifactSha256: entry.artifactSha256,
      extractorScheme: entry.extractor.scheme,
      extractorTool: entry.extractor.tool,
      extractorToolVersion: entry.extractor.toolVersion,
      extractorParameterSetHash: entry.extractor.parameterSetHash,
      traceTool: entry.trace?.tool ?? null,
      traceToolVersion: entry.trace?.toolVersion ?? null,
      traceParameterSetHash: entry.trace?.parameterSetHash ?? null,
      facts: entry.facts,
      supersedesIngestId: entry.supersedes,
      declaredReason: entry.declaredReason,
    })
    .onConflictDoNothing({ target: [ingests.tenantId, ingests.jobId] });
}
