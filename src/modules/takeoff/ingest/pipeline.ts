// SEAM-CAD's orchestration (R-TO-001): one door in, one job per drawing, one invocation of the
// `cad/` CLI, one content-addressed artifact and one append-only record of what was taken.
//
// A re-ingest is declared or it does not happen (L-CAD-02): a second undeclared request for a
// drawing that has been ingested is answered with the record it already has and runs nothing, and a
// declared one stands under a key of its own naming the record it supersedes. Drift is what a
// pipeline that re-ran itself quietly would be.
//
// The store this handler reads bytes from and writes the artifact to arrives as a dependency: a
// module reaches core and its own module only (ARCH-01), so the composition root that holds the
// app's Storage is src/worker, and nothing here re-reads where objects live (B-17).
import { drawings, eq, forTenant, isUuid, type AcceptedFormat } from "../../../core/db";
import { REFUSALS } from "../../../core/errors";
import { refusal } from "../../../core/faults/refusal-marker";
import { enqueue, type JobKind, type JobPayloads, type JobProgress } from "../../../core/jobs";
import type { Storage } from "../../../core/storage";
import { ingestDrawing, type IngestFormat } from "./cli";
import { factsOf } from "./facts";
import { ingestRecordOf, ingestRecordOfJob, writeIngestRecord } from "./records";
import type { IngestRefusalCode } from "./refusals";

/** The kind this seam's work runs under, bound to SEAM-JOBS' roster rather than re-spelled (B-17). */
export const INGEST_KIND = "ingest" satisfies JobKind;

/** The formats this lane hands to `cad/`; the others are other extractors' ground (out of scope). */
const INGESTABLE_FORMATS = ["dxf", "dwg"] as const satisfies readonly AcceptedFormat[];

/** The steps the pipeline records, in the order it takes them (R-TO-001). */
const STEP_FETCHED = "fetched";
const STEP_EXTRACTED = "extracted";
const STEP_STORED = "stored";
const STEP_RECORDED = "recorded";

/** Somebody asking for a drawing's geometry to be taken; `declared` is what makes a re-ingest lawful. */
export type IngestRequest = { tenantId: string; drawingId: string; requestedBy: string; declared?: { reason: string } };

/** What the door answers when it accepted the request: the job it enqueued, or the record that stands. */
export type IngestRequested = { jobId: string | null; ingestId: string | null; deduplicated: boolean };

/** What the door answers when it did not: a registered code, and nothing enqueued (R-SPINE-062). */
export type IngestRefused = { refusal: IngestRefusalCode };

/** The key one drawing's ingest stands under; a declared re-ingest names the record it supersedes. */
export function ingestJobKey(tenantId: string, drawingId: string, supersedes: string | null): string {
  const key = `${INGEST_KIND}:${tenantId}:${drawingId}`;
  return supersedes === null ? key : `${key}:${supersedes}`;
}

/** Is this a format `cad/` has a lane for? */
function isIngestable(format: AcceptedFormat): format is IngestFormat {
  return (INGESTABLE_FORMATS as readonly string[]).includes(format);
}

/** A reason somebody really gave: blank is not a declaration, so it is not a re-ingest (AC-5). */
function declaredReason(request: IngestRequest): string | null {
  const reason = request.declared?.reason ?? "";
  return reason.trim() === "" ? null : reason;
}

/** The drawing as this workspace sees it, or null where its scope holds no such drawing. */
async function drawingInScope(tenantId: string, drawingId: string): Promise<{ sha256: string; format: AcceptedFormat } | null> {
  if (!isUuid(drawingId)) return null;
  const rows = await forTenant({ tenantId })
    .select({ sha256: drawings.sha256, format: drawings.format })
    .from(drawings)
    .where(eq(drawings.drawingId, drawingId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Ask for a drawing's geometry to be taken (R-TO-001's one door).
 *
 * The workspace scope decides what may be asked for at all: a drawing this scope cannot see is not
 * this scope's to run, and the answer says so with the same code every other named-workspace door
 * answers (R-SPINE-004). A format no extractor of this lane reads is refused by name rather than
 * enqueued to be refused later, so nothing is spent on a sheet nobody could have read.
 */
export async function requestIngest(request: IngestRequest): Promise<IngestRequested | IngestRefused> {
  const drawing = await drawingInScope(request.tenantId, request.drawingId);
  if (drawing === null) return { refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code };
  if (!isIngestable(drawing.format)) return { refusal: REFUSALS.SHEET_NOT_INGESTABLE.code };

  const scope = { tenantId: request.tenantId, drawingId: request.drawingId };
  const held = await ingestRecordOf(scope);
  const reason = declaredReason(request);
  // Undeclared, and already ingested: the drawing is answered with the record it has. Re-running the
  // extractor on the same bytes would mint a second key multiset for one drawing revision, which is
  // the drift L-CAD-02 forbids.
  if (held !== null && reason === null) return { jobId: null, ingestId: held.ingestId, deduplicated: true };

  // A reason given where nothing has been ingested yet supersedes nothing: it is the first ingest,
  // and a record naming a superseded id no row carries would be a record of something that never
  // happened.
  const declared = held !== null && reason !== null ? { reason, supersedes: held.ingestId } : null;
  const payload: JobPayloads["ingest"] = {
    tenantId: request.tenantId,
    drawingId: request.drawingId,
    requestedBy: request.requestedBy,
    declared,
  };
  const enqueued = await enqueue(INGEST_KIND, payload, { key: ingestJobKey(request.tenantId, request.drawingId, declared?.supersedes ?? null) });
  return { jobId: enqueued.jobId, ingestId: null, deduplicated: enqueued.deduplicated };
}

/**
 * One ingest, run: fetch the bytes SEAM-STORAGE holds, run `cad/` over them once in the attempt's
 * own temp dir, put the artifact at its own address, and record what was taken (R-TO-001).
 *
 * Idempotent per job, twice over: an attempt that finds the row its job already wrote answers it
 * rather than writing a second, and `ingests_job_once` refuses one underneath. A sheet the extractor
 * could not read ends the job refused with the registered code — an answer, never a fault, and it
 * leaves neither record nor artifact behind (ARCH-03, B-21).
 */
export async function runIngestJob(payload: JobPayloads["ingest"], progress: JobProgress, deps: { storage: Storage }): Promise<void> {
  const { tenantId, drawingId } = payload;
  const scope = { tenantId, drawingId };
  if ((await ingestRecordOfJob(tenantId, progress.jobId)) !== null) return;

  const drawing = await drawingInScope(tenantId, drawingId);
  // The door judged both of these before it enqueued anything; a job that reaches here with either
  // of them untrue was enqueued past the door, and it is answered rather than retried.
  if (drawing === null) throw refusal(REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code, `drawing ${drawingId} is not a drawing this workspace holds`);
  if (!isIngestable(drawing.format)) throw refusal(REFUSALS.SHEET_NOT_INGESTABLE.code, `${drawing.format} is not a format the cad extractor reads`);

  const bytes = await deps.storage.get(tenantId, drawing.sha256);
  // Bytes a row points at that the store does not hold are an outage of ours, not the sheet's
  // fault: the record and the object were written together, so one without the other is ours to
  // answer for (ARCH-03).
  if (bytes === null) throw new Error(`the store holds no object at ${drawing.sha256} for drawing ${drawingId} (SEAM-STORAGE)`);
  await progress.step(STEP_FETCHED);

  // An undeclared job that finds a record does nothing: a queue can deliver a job the door accepted
  // before another one recorded the same drawing, and running twice undeclared is drift (L-CAD-02).
  if (payload.declared === null && (await ingestRecordOf(scope)) !== null) return;

  const outcome = await ingestDrawing(bytes, drawing.format, { tempDir: progress.tempDir });
  if (!outcome.ok) throw refusal(outcome.refusal, outcome.detail);

  const identity = outcome.graph.ingest;
  await progress.step(STEP_EXTRACTED, {
    tool: identity.tool,
    tool_version: identity.tool_version,
    parameter_set_hash: identity.parameter_set_hash,
  });

  const { sha256: artifactSha256 } = await deps.storage.put(tenantId, outcome.artifact);
  await progress.step(STEP_STORED);

  await writeIngestRecord({
    tenantId,
    drawingId,
    sha256: drawing.sha256,
    jobId: progress.jobId,
    artifactSha256,
    extractor: {
      scheme: identity.scheme,
      tool: identity.tool,
      toolVersion: identity.tool_version,
      parameterSetHash: identity.parameter_set_hash,
    },
    facts: factsOf(outcome.graph),
    supersedes: payload.declared?.supersedes ?? null,
    declaredReason: payload.declared?.reason ?? null,
  });
  await progress.step(STEP_RECORDED);
}
