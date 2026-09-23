// GET /api/documents/{id} — the one door an issued document is downloaded through (R-SPINE-040,
// R-SPINE-021, Q-12, AM-11 §2).
//
// The segment names the ROW, and the query carries the workspace the bytes were stored under and the
// expiry and signature SEAM-STORAGE minted for them (`documentDownloadUrl`). The address the
// signature covers is the document's own sha256, which is read off the row rather than off the URL —
// so a caller can rewrite the id it names but never the bytes it gets.
//
// The questions are asked in the order they stop being answerable in (AM-11 §2). A statement this
// door cannot read is answered first, by the one reading this tier has, so a client with a mangled
// link is told that rather than told to sign in (REQUEST_MALFORMED, 400). Then: is anybody signed in
// (401), is that person a member of the workspace this link names (403) — and only inside that
// workspace is anything about the document itself decided, so a stranger holding a leaked link learns
// nothing at all about it (Q-12). What the link then earns is decided in core, beside the shard that
// registers the codes (`readSignedDocument`); what this file adds is the HTTP status each is spoken
// under, and the headers the artefact travels in.
//
// The statuses are this door's own and not `refusalStatus`'s. The tier-wide table is a translation of
// the taxonomy for every door at once and gives an unmapped code the 400 floor; a download link has
// HTTP names for exactly what happened to it — 410 for one that has aged out, 404 for a document this
// workspace never issued — and a reader that is not our screen should hear them.
import { z } from "zod";
import { and, documents, eq, forTenant, projects, type TenantTx } from "@/core/db";
import { documentUnder, readSignedDocument } from "@/core/documents/store";
import { REFUSALS } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { dhakaDateParts, formatDate, formatUserFigure } from "@/core/format";
import { appStorage } from "@/core/storage/app";
import { authorize } from "@/server/authorize";
import { json, routeHandler } from "@/server/call";
import { strings } from "@/ui/strings";

/** A document is served from live storage under a live session; nothing here may be cached or built. */
export const dynamic = "force-dynamic";

/** The route the fault seam records this handler's failures under (ARCH-03). */
const ROUTE = "GET /api/documents/[id]";

/** Who a failure is attributed to when no session stood behind the request. */
const ACTOR = "documents";

/** The refusals this door answers, each under the status HTTP already has a name for. */
const STATUS = Object.freeze({
  SIGNED_OUT: 401,
  WORKSPACE_PERMISSION_NOT_HELD: 403,
  // A link that does not check out was not minted here — the same "not yours" the guard above says.
  DOCUMENT_URL_INVALID: 403,
  // Gone, and known to have been here: a link that WAS good and aged out is exactly 410's meaning.
  DOCUMENT_URL_EXPIRED: 410,
  DOCUMENT_NOT_FOUND: 404,
} satisfies Readonly<Record<string, number>>);

/** What a caller is told when the address is not one this door reads at all. */
const NOT_A_LINK = "a document is asked for as /api/documents/<id>?tenant=<uuid>&expires=<seconds>&signature=<hex>";

/**
 * What the address states, read once by the one reading this tier has (`@/server/call`). Every part
 * is judged as the text it travels as: an expiry read through `Number` would take a blank string for
 * zero, and a signature is compared as text by the seam that minted it.
 */
const ASKED = z.object({
  address: z.object({
    id: z.string().uuid(NOT_A_LINK),
    tenant: z.string().uuid(NOT_A_LINK),
    expires: z.string().regex(/^\d+$/u, NOT_A_LINK),
    signature: z.string().regex(/^[0-9a-f]+$/u, NOT_A_LINK),
  }),
});

/** A registered refusal, carried whole so a client renders the register's own copy (R-SPINE-062). */
function refusalAnswer(code: keyof typeof STATUS): Response {
  return json({ refusal: REFUSALS[code] }, STATUS[code]);
}

/**
 * Is this failure one of the refusals this door has a status for?
 *
 * The table above is this door's own, and a door may have only ONE answer per code. `routeHandler`
 * answers a refusal that arrives as a THROW through the tier-wide table, which holds no DOCUMENT_*
 * entry and would give the 400 floor — so the same code would be 410 when it was returned and 400
 * when it was raised. Nothing under this door throws them today; this is what keeps that true.
 */
function statedHere(failure: unknown): keyof typeof STATUS | null {
  const code = refusalCodeOf(failure);
  return code !== null && Object.hasOwn(STATUS, code) ? (code as keyof typeof STATUS) : null;
}

/**
 * What a file is called, in words (s-bbs I-535): the project's name, the kind as S-Documents says it
 * (`documents_kind_<kind>`, s-documents I-260 — so a draft is never called a bill in a file name,
 * AM-05), which issue of it this is, and the day it was issued in the document's zone —
 * `Sattva Court — Bar schedule v1 — 24 Sep 2026.pdf`. Read from the row and its project, never from
 * the URL. A kind S-Documents has no words for is named by its key, as that screen names it.
 */
async function fileNameOf(tx: TenantTx, row: { tenantId: string; id: string; projectId: string; kind: string; version: number }): Promise<string> {
  const [held] = await tx
    .select({ project: projects.name, issuedAt: documents.issuedAt })
    .from(documents)
    .innerJoin(projects, eq(projects.projectId, documents.projectId))
    .where(and(eq(documents.tenantId, row.tenantId), eq(documents.id, row.id)))
    .limit(1);
  const kind = (strings as Readonly<Record<string, string>>)[`documents_kind_${row.kind.replaceAll("-", "_")}`] ?? row.kind;
  const issue = `v${formatUserFigure(String(row.version))}`;
  const parts = held === undefined ? [kind, issue] : [held.project, `${kind} ${issue}`, formatDate(dhakaDateParts(held.issuedAt))];
  return `${parts.join(" — ")}.pdf`;
}

/**
 * The `Content-Disposition` a file in words travels under (RFC 6266): the words themselves in the
 * UTF-8 `filename*` parameter, percent-encoded so nothing in a project's name can end the header early,
 * and beside it the plain `filename` an older client falls back to, reduced to the alphabet a quoted
 * parameter may hold — the dash of the words read as a hyphen, anything else outside it as a hyphen.
 */
function dispositionOf(name: string): string {
  const plain = name.replace(/[—–]/gu, "-").replace(/[^A-Za-z0-9 ._()-]/gu, "-");
  const encoded = encodeURIComponent(name).replace(/['()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${plain}"; filename*=UTF-8''${encoded}`;
}

/**
 * The document itself. It is named for the project, the kind and the issue it is, in words, and
 * marked private: one workspace's document is its own, and nothing between this door and the person
 * who asked may keep a copy of it.
 */
function documentAnswer(bytes: Uint8Array, name: string): Response {
  // The view is copied into a buffer of its own: a `Response` body is bytes that are not shared, and
  // the stored artefact's view carries no such promise.
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": dispositionOf(name),
      "cache-control": "private, no-store",
    },
  });
}

export const GET = routeHandler({ route: ROUTE, actor: ACTOR, schema: ASKED, sentence: NOT_A_LINK }, async ({ input, context }) => {
  const { id, tenant, expires, signature } = input.address;
  try {
    if (context.session === null) return refusalAnswer("SIGNED_OUT");

    // Membership of the workspace the link names, before anything about the document is decided. A
    // person outside this workspace is told only that, whatever the link turns out to be worth (Q-12).
    const admitted = await authorize({ userId: context.session.userId, tenantId: tenant });
    if (!admitted.authorized) return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");

    // The row first, because the address the signature covers is the row's and not the URL's. An id
    // this workspace holds no document under is an absence — and one only a member can observe.
    const found = await forTenant({ tenantId: tenant }).transaction(async (tx) => {
      const row = await documentUnder(tx, tenant, id);
      return row === null ? null : { row, name: await fileNameOf(tx, row) };
    });
    if (found === null) return refusalAnswer("DOCUMENT_NOT_FOUND");

    const read = await readSignedDocument(appStorage(), { tenantId: tenant, sha256: found.row.sha256, expires, signature });
    if (!read.ok) return refusalAnswer(read.refusal);

    return documentAnswer(read.bytes, found.name);
  } catch (failure) {
    const stated = statedHere(failure);
    if (stated !== null) return refusalAnswer(stated);
    throw failure;
  }
});
