// GET /api/exports/{id} — the one door a built export is fetched through (R-SPINE-041, R-SPINE-021).
//
// The address is the artefact's own content address, and the link is the storage seam's own signature
// re-addressed here (`exportDownloadUrl`): there is no second HMAC and no second secret, so a link
// this installation did not sign verifies nowhere (Q-12).
//
// The questions are asked in the order they stop being answerable in, and each has its own answer
// (ARCH-03, B-21): no live session is SIGNED_OUT at 401; a caller the guard does not admit to the
// workspace the URL names is WORKSPACE_PERMISSION_NOT_HELD at 403 — asked BEFORE the signature, so a
// stranger holding a leaked link learns nothing about somebody else's artefacts; a link this
// installation did not sign is EXPORT_URL_INVALID at 403 and one whose hour has passed
// EXPORT_URL_EXPIRED at 410, because an expiry is a link that WAS good and is a different fact from a
// forgery; an address this workspace stored nothing at is EXPORT_NOT_FOUND at 404; an unreadable
// statement is REQUEST_MALFORMED at 400, which the one reading answers before any of this. A failure
// of ours is recorded at the fault seam and answered with its id, and nothing is swallowed.
//
// The admission is `authorize()`'s, as every entry point's is (AM-11 §2). It is asked about the
// workspace the URL names and nothing narrower: an export belongs to a workspace, not to a project —
// a bill is composed of the whole of one — so membership is the standing this door reads.
import { z } from "zod";
import { EXPORT_KINDS, MIME_OF_KIND, readSignedExport, type ExportKind } from "@/core/exports";
import { REFUSALS } from "@/core/errors";
import { appStorage } from "@/core/storage/app";
import { authorize } from "@/server/authorize";
import { json, routeHandler } from "@/server/call";

/** An artefact is served from live storage under a live session; nothing here may be built or cached. */
export const dynamic = "force-dynamic";

/** The route the fault seam records this handler's failures under (ARCH-03). */
const ROUTE = "GET /api/exports/[id]";

/**
 * The status each refusal this door can answer is given — the closed table the goal states.
 *
 * It is spelled here rather than read from the tier's own floor because three of the five are this
 * door's: `@/server/call`'s table knows the codes every door answers, and a table that answered a
 * dead link and a forged one alike would collapse two different facts into one number (Q-12).
 */
const STATUS: Readonly<Record<"SIGNED_OUT" | "WORKSPACE_PERMISSION_NOT_HELD" | "EXPORT_URL_INVALID" | "EXPORT_URL_EXPIRED" | "EXPORT_NOT_FOUND", number>> = Object.freeze({
  SIGNED_OUT: 401,
  WORKSPACE_PERMISSION_NOT_HELD: 403,
  EXPORT_URL_INVALID: 403,
  EXPORT_URL_EXPIRED: 410,
  EXPORT_NOT_FOUND: 404,
});

/** What a caller is told when the address is not a signed link to an artefact at all. */
const NOT_A_LINK = "an export is fetched at /api/exports/<sha256>?tenant=<uuid>&kind=xlsx|csv&expires=<seconds>&signature=<hex>";

/** An artefact's address, as the seam and the storage below it both spell one. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/u;

/**
 * What the address states, read once by the one reading this tier has (`@/server/call`). Every part
 * is judged as the text it is: `expires` stays a string all the way to `verify`, because the
 * signature covers the digits that were signed and a re-rendered number is not those digits.
 */
const ASKED = z.object({
  address: z.object({
    id: z.string().regex(ADDRESS_SHAPE, NOT_A_LINK),
    tenant: z.uuid(NOT_A_LINK),
    kind: z.enum(EXPORT_KINDS, NOT_A_LINK),
    expires: z.string().regex(/^\d+$/u, NOT_A_LINK),
    signature: z.string().regex(/^[0-9a-f]+$/u, NOT_A_LINK),
  }),
});

/** A registered refusal, carried whole so the client renders the register's copy (R-SPINE-062). */
function refusalAnswer(code: keyof typeof STATUS): Response {
  return json({ refusal: REFUSALS[code] }, STATUS[code]);
}

/**
 * The artefact itself. It is served as an attachment under its own address, and never cached by
 * anything in between: one workspace's bill is not a public object, whatever the link it came on
 * (Q-12).
 */
function artefactAnswer(bytes: Uint8Array, sha256: string, kind: ExportKind): Response {
  // The bytes as their own buffer: a platform body is an `ArrayBuffer`-backed view, and the stored
  // artefact arrives as a view whose backing buffer the types leave open.
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": MIME_OF_KIND[kind],
      "content-disposition": `attachment; filename="${sha256}.${kind}"`,
      "cache-control": "private, no-store",
      "content-length": String(bytes.byteLength),
    },
  });
}

export const GET = routeHandler({ route: ROUTE, actor: "exports", schema: ASKED, sentence: NOT_A_LINK }, async ({ input, context }) => {
  const { id, tenant, kind, expires, signature } = input.address;
  if (context.session === null) return refusalAnswer("SIGNED_OUT");

  // Membership of the workspace the URL names, from the one guard. A link is evidence of nothing
  // about who is holding it, so this is asked before the signature is read at all.
  const admitted = await authorize({ userId: context.session.userId, tenantId: tenant });
  if (!admitted.authorized) return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");

  // The link and the bytes it addresses are the seam's own question, answered beside the shard that
  // registers the three codes: this door only says what status each of them is served with.
  const read = await readSignedExport(appStorage(), { tenantId: tenant, sha256: id, expires, signature });
  if (!read.ok) return refusalAnswer(read.refusal);
  return artefactAnswer(read.bytes, id, kind);
});
