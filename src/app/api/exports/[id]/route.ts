// GET /api/exports/{sha256} — the one door a built export is downloaded through (R-SPINE-041,
// R-SPINE-021, Q-12).
//
// The address is content: the segment is the sha256 of the bytes, and the query carries the
// workspace they were stored under, the kind they travel as, and the expiry and signature
// SEAM-STORAGE minted for them (`exportDownloadUrl`). Nothing about the artefact is looked up by a
// name somebody chose, so there is no listing to guess at and no id to enumerate.
//
// The questions are asked in the order they stop being answerable in (AM-11 §2). A statement this
// door cannot read is answered first, by the one reading this tier has, so a client with a mangled
// link is told that rather than told to sign in (REQUEST_MALFORMED, 400). Then: is anybody signed in
// (401), is that person a member of the workspace this link names (403), and only then is the link
// itself judged — a stranger holding a leaked link learns nothing about whether it was a good one
// (Q-12). The three answers the link can earn are decided in core, beside the shard that registers
// them (`readSignedExport`); what this file adds is the HTTP status each is spoken under.
//
// The statuses are this door's own and not `refusalStatus`'s. The tier-wide table is a translation
// of the taxonomy for every door at once and gives an unmapped code the 400 floor; a download link
// has HTTP names for exactly what happened to it — 410 for one that has aged out, 404 for an address
// nothing stands at — and a reader that is not our screen should hear them.
import { z } from "zod";
import { MIME_OF_KIND, EXPORT_KINDS, readSignedExport, type ExportKind } from "@/core/exports";
import { REFUSALS } from "@/core/errors";
import { appStorage } from "@/core/storage/app";
import { authorize } from "@/server/authorize";
import { json, routeHandler } from "@/server/call";

/** An artefact is served from live storage under a live session; nothing here may be cached or built. */
export const dynamic = "force-dynamic";

/** The route the fault seam records this handler's failures under (ARCH-03). */
const ROUTE = "GET /api/exports/[id]";

/** Who a failure is attributed to when no session stood behind the request. */
const ACTOR = "exports";

/** The refusals this door answers, each under the status HTTP already has a name for. */
const STATUS = Object.freeze({
  SIGNED_OUT: 401,
  WORKSPACE_PERMISSION_NOT_HELD: 403,
  // A link that does not check out was not minted here — the same "not yours" the guard above says.
  EXPORT_URL_INVALID: 403,
  // Gone, and known to have been here: a link that WAS good and aged out is exactly 410's meaning.
  EXPORT_URL_EXPIRED: 410,
  EXPORT_NOT_FOUND: 404,
} satisfies Readonly<Record<string, number>>);

/** What a caller is told when the address is not one this door reads at all. */
const NOT_A_LINK = "a download is asked for as /api/exports/<sha256>?tenant=<uuid>&kind=<xlsx|csv>&expires=<seconds>&signature=<hex>";

/**
 * What the address states, read once by the one reading this tier has (`@/server/call`). Every part
 * is judged as the text it travels as: an expiry read through `Number` would take a blank string for
 * zero, and a signature is compared as text by the seam that minted it.
 */
const ASKED = z.object({
  address: z.object({
    id: z.string().regex(/^[0-9a-f]{64}$/u, NOT_A_LINK),
    tenant: z.string().uuid(NOT_A_LINK),
    kind: z.enum(EXPORT_KINDS, { error: NOT_A_LINK }),
    expires: z.string().regex(/^\d+$/u, NOT_A_LINK),
    signature: z.string().regex(/^[0-9a-f]+$/u, NOT_A_LINK),
  }),
});

/** A registered refusal, carried whole so a client renders the register's own copy (R-SPINE-062). */
function refusalAnswer(code: keyof typeof STATUS): Response {
  return json({ refusal: REFUSALS[code] }, STATUS[code]);
}

/**
 * The artefact itself. It is named by its own address and marked private: an export is one
 * workspace's evidence, and nothing between this door and the person who asked may keep a copy.
 */
function artefactAnswer(bytes: Uint8Array, sha256: string, kind: ExportKind): Response {
  // The view is copied into a buffer of its own: a `Response` body is bytes that are not shared, and
  // the stored artefact's view carries no such promise.
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": MIME_OF_KIND[kind],
      "content-disposition": `attachment; filename="${sha256}.${kind}"`,
      "cache-control": "private, no-store",
    },
  });
}

export const GET = routeHandler({ route: ROUTE, actor: ACTOR, schema: ASKED, sentence: NOT_A_LINK }, async ({ input, context }) => {
  const { id, tenant, kind, expires, signature } = input.address;
  if (context.session === null) return refusalAnswer("SIGNED_OUT");

  // Membership of the workspace the link names, before the link is judged. A person who is not in
  // this workspace is told only that, whatever the link turns out to be worth (Q-12).
  const admitted = await authorize({ userId: context.session.userId, tenantId: tenant });
  if (!admitted.authorized) return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");

  const read = await readSignedExport(appStorage(), { tenantId: tenant, sha256: id, expires, signature });
  if (!read.ok) return refusalAnswer(read.refusal);
  return artefactAnswer(read.bytes, id, kind);
});
