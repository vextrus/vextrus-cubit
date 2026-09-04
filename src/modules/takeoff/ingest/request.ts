// SEAM-CAD's request half (R-TO-001): the one door a screen's server action, a route or a
// transport asks through, and the scope question every door of the takeoff seam asks (B-17).
//
// It holds no client of the `cad/` CLI on purpose. The process boundary lives in ./cli and is
// crossed only by ./pipeline's job, which the worker's composition root runs — so a screen that
// asks for an ingest never carries the spawn into the app's module graph (ARCH-01). That is not a
// nicety: the bundler traces a server module's filesystem reach, and a client that resolves the
// checkout from its own path made the tracer walk the whole tree and die on `cad/.venv` — an
// interpreter symlink uv leaves behind that points outside the root. The request half reaches the
// database and the queue and nothing on disk.
//
// A re-ingest is declared or it does not happen (L-CAD-02): a second undeclared request for a
// drawing that has been ingested is answered with the record it already has and runs nothing, and a
// declared one stands under a key of its own naming the record it supersedes. Drift is what a
// pipeline that re-ran itself quietly would be.
import { drawings, eq, forTenant, isUuid, type AcceptedFormat } from "../../../core/db";
import { REFUSALS } from "../../../core/errors";
import { enqueue, type JobKind, type JobPayloads } from "../../../core/jobs";
import { ingestRecordOf } from "./records";
import type { IngestRefusalCode } from "./refusals";

/** The kind this seam's work runs under, bound to SEAM-JOBS' roster rather than re-spelled (B-17). */
export const INGEST_KIND = "ingest" satisfies JobKind;

/** The formats this lane hands to the CLI (R-TO-001's DXF and DWG). */
export type IngestFormat = "dxf" | "dwg";

/** The formats this lane hands to `cad/`; the others are other extractors' ground (out of scope). */
const INGESTABLE_FORMATS = ["dxf", "dwg"] as const satisfies readonly IngestFormat[];

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
export function isIngestable(format: AcceptedFormat): format is IngestFormat {
  return (INGESTABLE_FORMATS as readonly string[]).includes(format);
}

/** A reason somebody really gave: blank is not a declaration, so it is not a re-ingest (AC-5). */
function declaredReason(request: IngestRequest): string | null {
  const reason = request.declared?.reason ?? "";
  return reason.trim() === "" ? null : reason;
}

/**
 * The drawing as this workspace sees it, or null where its scope holds no such drawing. Published
 * because "is this drawing this workspace's to act on" has one answer for the whole takeoff seam:
 * every door that names a drawing asks it here rather than each keeping a query of its own (B-17).
 */
export async function drawingInScope(tenantId: string, drawingId: string): Promise<{ sha256: string; format: AcceptedFormat } | null> {
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
