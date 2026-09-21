/**
 * THE SIGNED OBJECT DOOR — `GET /storage/v1/<tenant>/<sha256>?expires=&signature=` (R-SPINE-021,
 * R-SPINE-022, Q-12, AM-11 §2).
 *
 * SEAM-STORAGE mints signed download URLs under `/storage/v1/…` (src/core/storage/index.ts) and the
 * thumbnail pipeline hands one to every sheet card; the viewer's raster background is drawn from the
 * same tiers. This is the door that answers them: a session, the one authorize() for the workspace
 * the link names, the seam's own verification of the link, and the bytes whole under the content
 * type the bytes declare. Existence and membership are one answer to an outsider (Q-12): the
 * workspace guard is asked before the store is.
 *
 * It is the document door's shape (src/app/api/documents/[id]/route.ts) with one difference: a
 * document is named by its row and the seam's link is rebuilt from the row's address, while an
 * object's link IS the seam's link, so it is verified as presented.
 */
import { z } from "zod";
import { REFUSALS } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { appStorage } from "@/core/storage/app";
import { authorize } from "@/server/authorize";
import { json, routeHandler } from "@/server/call";

export const dynamic = "force-dynamic";

const ROUTE = "GET /storage/v1/[tenant]/[address]";

const ACTOR = "storage";

const STATUS = Object.freeze({
  SIGNED_OUT: 401,
  WORKSPACE_PERMISSION_NOT_HELD: 403,
  RASTER_URL_INVALID: 403,
  RASTER_URL_EXPIRED: 410,
  RASTER_NOT_FOUND: 404,
} satisfies Readonly<Record<string, number>>);

const NOT_A_LINK = "an object is asked for as /storage/v1/<workspace uuid>/<sha256 hex>?expires=<seconds>&signature=<hex>";

const ASKED = z.object({
  address: z.object({
    tenant: z.string().uuid(NOT_A_LINK),
    address: z.string().regex(/^[0-9a-f]{64}$/u, NOT_A_LINK),
    expires: z.string().regex(/^\d+$/u, NOT_A_LINK),
    signature: z.string().regex(/^[0-9a-f]+$/u, NOT_A_LINK),
  }),
});

/** The image formats a tier is rendered in, told by the bytes themselves; anything else is bytes. */
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const JPEG_SIGNATURE = [255, 216, 255] as const;

function contentTypeOf(bytes: Uint8Array): string {
  const opens = (signature: readonly number[]): boolean => signature.every((byte, index) => bytes[index] === byte);
  if (opens(PNG_SIGNATURE)) return "image/png";
  if (opens(JPEG_SIGNATURE)) return "image/jpeg";
  return "application/octet-stream";
}

function refusalAnswer(code: keyof typeof STATUS): Response {
  return json({ refusal: REFUSALS[code] }, STATUS[code]);
}

function statedHere(failure: unknown): keyof typeof STATUS | null {
  const code = refusalCodeOf(failure);
  return code !== null && Object.hasOwn(STATUS, code) ? (code as keyof typeof STATUS) : null;
}

function objectAnswer(bytes: Uint8Array): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": contentTypeOf(bytes),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export const GET = routeHandler({ route: ROUTE, actor: ACTOR, schema: ASKED, sentence: NOT_A_LINK }, async ({ input, context }) => {
  const { tenant, address, expires, signature } = input.address;
  try {
    if (context.session === null) return refusalAnswer("SIGNED_OUT");

    const admitted = await authorize({ userId: context.session.userId, tenantId: tenant });
    if (!admitted.authorized) return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");

    const storage = appStorage();
    // The link as the seam mints it, rebuilt from the parts the statement read — the same shape
    // `sign` writes, so `verify` judges exactly what was presented and nothing a caller could add.
    const vouched = storage.verify(`/storage/v1/${tenant}/${address}?expires=${expires}&signature=${signature}`);
    if (!vouched.ok) return refusalAnswer(vouched.reason === "expired" ? "RASTER_URL_EXPIRED" : "RASTER_URL_INVALID");

    const bytes = await storage.get(vouched.tenantId, vouched.sha256);
    if (bytes === null) return refusalAnswer("RASTER_NOT_FOUND");

    return objectAnswer(bytes);
  } catch (failure) {
    const stated = statedHere(failure);
    if (stated !== null) return refusalAnswer(stated);
    throw failure;
  }
});
