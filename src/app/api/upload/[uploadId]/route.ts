// GET and PATCH /api/upload/{uploadId} — the resumable half of R-SPINE-020. The probe answers what
// the server holds, which is what a client resumes from after an interruption; the PATCH offers one
// chunk from that point and is acknowledged, refused, or — on the last byte — answered with what the
// whole transfer amounted to.
//
// The offset travels in the `Upload-Offset` header and the bytes are the body: a chunk is raw bytes,
// never a form field, so nothing between the browser and the seam re-encodes a drawing.
import { z } from "zod";
import { REFUSALS } from "@/core/errors";
import { appendChunk, isRefused, uploadStatus, UPLOAD_CHUNK_BYTES } from "@/modules/spine/uploads";
import { json, routeHandler } from "@/server/call";
import { admitForUpload, isRefusedAdmission, refusalAnswer } from "../answers";

/** A transfer is live state; nothing about this route may be built or cached. */
export const dynamic = "force-dynamic";

/** The routes the fault seam records these handlers' failures under (ARCH-03). */
const PROBE_ROUTE = "GET /api/upload/{uploadId}";
const CHUNK_ROUTE = "PATCH /api/upload/{uploadId}";

/** What a caller is told when the chunk states no offset this door can read. */
const NOT_AN_OFFSET = "a chunk states the offset it continues from in the Upload-Offset header";

/** What a probe states: the session it is about, and nothing else — the address is the question. */
const PROBED = z.object({ address: z.object({ uploadId: z.string() }) });

/**
 * What a chunk states, read by the one reading this tier has (`@/server/call`): the session it
 * continues, and the offset it continues from. The offset travels in the `Upload-Offset` header
 * (test contract) and the bytes are the body, so the body is NOT read here — a chunk is raw bytes,
 * never a statement, and the door takes them off the request itself a piece at a time.
 *
 * The offset is judged as text rather than by `Number`, which reads a blank header as zero and would
 * acknowledge a chunk at the start of a transfer that stated no offset at all.
 */
const CHUNKED = z.object({
  address: z.object({ uploadId: z.string() }),
  header: z.object({
    "upload-offset": z
      .string()
      .regex(/^\d+$/, { error: NOT_AN_OFFSET })
      // A byte count past what a JSON number counts exactly is a place no transfer ever stood, and
      // an offset that cannot be compared is no offset (the seam judges it as a whole number).
      .refine((stated) => Number.isSafeInteger(Number(stated)), { error: NOT_AN_OFFSET }),
  }),
});

/**
 * The chunk's bytes, or null when the caller sent more than a chunk carries. The ceiling is judged
 * before the memory is spent, not after: a stated length over it is refused unread, and a body that
 * states no length is taken a piece at a time and abandoned the moment it passes the ceiling. A door
 * that buffered first would let one signed-in caller decide how much of the server's memory to hold
 * (Q-12).
 */
async function chunkWithin(request: Request, ceiling: number): Promise<Uint8Array | null> {
  const stated = Number(request.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(stated) && stated > ceiling) return null;

  const body = request.body;
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const pieces: Uint8Array[] = [];
  let held = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    held += value.length;
    if (held > ceiling) {
      await reader.cancel();
      return null;
    }
    pieces.push(value);
  }

  const chunk = new Uint8Array(held);
  let at = 0;
  for (const piece of pieces) {
    chunk.set(piece, at);
    at += piece.length;
  }
  return chunk;
}

/**
 * The probe. The session behind the request is resolved once by the wrapper and handed over on the
 * context; the admission below is the workspace question, which is the door's own (Q-12).
 */
export const GET = routeHandler({ route: PROBE_ROUTE, actor: "upload", schema: PROBED }, async ({ input, context }) => {
  const { uploadId } = input.address;
  const admission = await admitForUpload(context.session?.userId ?? null, uploadId);
  if (isRefusedAdmission(admission)) return refusalAnswer(admission.refusal);

  const probed = await uploadStatus({ actor: admission.actor, uploadId });
  if (isRefused(probed)) return refusalAnswer(probed.refusal, probed.receivedBytes);
  return json(probed, 200);
});

/** One chunk, offered from the point the server reports and acknowledged, refused, or completed. */
export const PATCH = routeHandler({ route: CHUNK_ROUTE, actor: "upload", schema: CHUNKED, sentence: NOT_AN_OFFSET }, async ({ input, request, context }) => {
  const { uploadId } = input.address;
  const offset = Number(input.header["upload-offset"]);
  const admission = await admitForUpload(context.session?.userId ?? null, uploadId);
  if (isRefusedAdmission(admission)) return refusalAnswer(admission.refusal);

  const bytes = await chunkWithin(request, UPLOAD_CHUNK_BYTES);
  if (bytes === null) {
    // A body over the chunk ceiling says nothing about the declared file: telling a 20 MB drawing
    // that it is larger than 500 MB is a sentence the product does not mean, and its remedy —
    // split the set — cannot be acted on (R-SPINE-062, ARCH-03). What this caller has to correct
    // is the chunk, so it is answered under the code whose remedy is exactly that: resume from the
    // point the server reports, in chunks of the size the session was opened with.
    const probed = await uploadStatus({ actor: admission.actor, uploadId });
    if (isRefused(probed)) return refusalAnswer(probed.refusal, probed.receivedBytes);
    return refusalAnswer(REFUSALS.UPLOAD_NOT_RESUMABLE.code, probed.receivedBytes);
  }

  const advanced = await appendChunk({ actor: admission.actor, uploadId, offset, bytes });
  if (isRefused(advanced)) return refusalAnswer(advanced.refusal, advanced.receivedBytes);
  return json(advanced, 200);
});
