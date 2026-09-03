// The persisted half of R-TO-001: one append-only row per ingest, pinning which extractor took
// which geometry out of which bytes (L-CAD-02) and what it counted while doing it.
//
// A record is never rewritten and never replaced: a declared re-ingest writes a new row naming the
// one it supersedes, so a drawing's history reads newest first and every earlier answer stands.
import { desc, eq, forTenant, ingests, isUuid } from "../../../core/db";
import type { SourceScheme } from "../../../core/model";
import type { IngestFacts } from "./facts";

/** Which drawing's ingests are being asked about, in whose workspace. */
export type IngestScope = { tenantId: string; drawingId: string };

/** The extractor identity a record pins (L-CAD-02): who took the geometry, at which parameters. */
export type IngestIdentity = { scheme: SourceScheme; tool: string; toolVersion: string; parameterSetHash: string };

/** One ingest, whole, as a caller reads it back. */
export type IngestRecord = {
  ingestId: string;
  drawingId: string;
  sha256: string;
  jobId: string;
  artifactSha256: string;
  extractor: IngestIdentity;
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
    facts: row.facts as IngestFacts,
    supersedes: row.supersedesIngestId,
    declaredReason: row.declaredReason,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every ingest of one drawing, newest first — the read `ingests_by_drawing` is there for. */
export async function ingestRecords(scope: IngestScope): Promise<IngestRecord[]> {
  if (!isUuid(scope.drawingId)) return [];
  const rows = await forTenant({ tenantId: scope.tenantId }).select().from(ingests).where(eq(ingests.drawingId, scope.drawingId)).orderBy(desc(ingests.createdAt));
  return rows.map(record);
}

/** The drawing's current ingest — the newest of them — or null where it has never been ingested. */
export async function ingestRecordOf(scope: IngestScope): Promise<IngestRecord | null> {
  return (await ingestRecords(scope))[0] ?? null;
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
      facts: entry.facts,
      supersedesIngestId: entry.supersedes,
      declaredReason: entry.declaredReason,
    })
    .onConflictDoNothing({ target: [ingests.tenantId, ingests.jobId] });
}
