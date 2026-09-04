// SEAM-CAD's job half (R-TO-001): one ingest, run — fetch the bytes SEAM-STORAGE holds, one
// invocation of the `cad/` CLI, one content-addressed artifact and one append-only record of what
// was taken. The door that accepts the request and the scope question it asks live in ./request;
// this file is the only importer of the CLI client, and the worker's composition root is the only
// caller of it (ARCH-01) — the app's module graph never holds the process boundary.
//
// The store this handler reads bytes from and writes the artifact to arrives as a dependency: a
// module reaches core and its own module only (ARCH-01), so the composition root that holds the
// app's Storage is src/worker, and nothing here re-reads where objects live (B-17).
import { REFUSALS } from "../../../core/errors";
import { refusal } from "../../../core/faults/refusal-marker";
import type { JobPayloads, JobProgress } from "../../../core/jobs";
import type { Storage } from "../../../core/storage";
import { ingestDrawing } from "./cli";
import { factsOf } from "./facts";
import { ingestRecordOf, ingestRecordOfJob, writeIngestRecord } from "./records";
import { drawingInScope, isIngestable } from "./request";

/** The steps the pipeline records, in the order it takes them (R-TO-001). */
const STEP_FETCHED = "fetched";
const STEP_EXTRACTED = "extracted";
const STEP_STORED = "stored";
const STEP_RECORDED = "recorded";

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
