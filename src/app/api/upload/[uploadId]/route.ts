// GET and PATCH /api/upload/{uploadId} — the resumable half of R-SPINE-020. The probe answers what
// the server holds, which is what a client resumes from after an interruption; the PATCH offers one
// chunk from that point and is acknowledged, refused, or — on the last byte — answered with what the
// whole transfer amounted to.
//
// The offset travels in the `Upload-Offset` header and the bytes are the body: a chunk is raw bytes,
// never a form field, so nothing between the browser and the seam re-encodes a drawing.
import { randomUUID } from "node:crypto";
import { reportFault } from "../../../../core/faults/report";
import { appendChunk, isRefused, uploadStatus } from "../../../../modules/spine/uploads";
import { admitForUpload, isRefusedAdmission, json, refusalAnswer } from "../answers";

/** A transfer is live state; nothing about this route may be built or cached. */
export const dynamic = "force-dynamic";

/** The routes the fault seam records these handlers' failures under (ARCH-03). */
const PROBE_ROUTE = "GET /api/upload/{uploadId}";
const CHUNK_ROUTE = "PATCH /api/upload/{uploadId}";

/** The header a chunk states its own offset in (test contract). */
const OFFSET_HEADER = "upload-offset";

/** What a caller is told when the chunk states no offset this door can read. */
const NOT_AN_OFFSET = "a chunk states the offset it continues from in the Upload-Offset header";

/** The address segment, as Next hands it over. */
type Context = { params: Promise<{ uploadId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { uploadId } = await context.params;
  try {
    const admission = await admitForUpload(request, uploadId);
    if (isRefusedAdmission(admission)) return refusalAnswer(admission.refusal);

    const probed = await uploadStatus({ actor: admission.actor, uploadId });
    if (isRefused(probed)) return refusalAnswer(probed.refusal, probed.receivedBytes);
    return json(probed, 200);
  } catch (failure) {
    // The caller asked a lawful question and our side could not answer it: recorded first, and the
    // id of the record is what they are given (ARCH-03, B-21).
    const { faultId } = reportFault({ requestId: uploadId, actor: "upload", route: PROBE_ROUTE, cause: failure });
    return json({ faultId }, 500);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const { uploadId } = await context.params;
  try {
    const admission = await admitForUpload(request, uploadId);
    if (isRefusedAdmission(admission)) return refusalAnswer(admission.refusal);

    const stated = request.headers.get(OFFSET_HEADER);
    const offset = stated === null ? Number.NaN : Number(stated);
    if (!Number.isSafeInteger(offset) || offset < 0) return json({ error: NOT_AN_OFFSET }, 400);

    const bytes = new Uint8Array(await request.arrayBuffer());
    const advanced = await appendChunk({ actor: admission.actor, uploadId, offset, bytes });
    if (isRefused(advanced)) return refusalAnswer(advanced.refusal, advanced.receivedBytes);
    return json(advanced, 200);
  } catch (failure) {
    const { faultId } = reportFault({ requestId: uploadId === "" ? randomUUID() : uploadId, actor: "upload", route: CHUNK_ROUTE, cause: failure });
    return json({ faultId }, 500);
  }
}
