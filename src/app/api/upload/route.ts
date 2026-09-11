// POST /api/upload — R-SPINE-020's door: a signed-in member of a project's workspace opens an
// upload session for one declared file, and is told where to send its bytes and how much of it at a
// time. Nothing is stored here; what the client declares — the name, the size and its own sha256 —
// is what the seam judges the arriving bytes against once they arrive.
import { z } from "zod";
import { createUpload, isRefused } from "@/modules/spine/uploads";
import { json, routeHandler } from "@/server/call";
import { admitForProject, isRefusedAdmission, refusalAnswer } from "./answers";

/** Every session is opened against live state; nothing about this route may be built or cached. */
export const dynamic = "force-dynamic";

/** The route the fault seam records this handler's failures under (ARCH-03). */
const ROUTE = "POST /api/upload";

/** A content address as the seam spells one: 64 lowercase hex characters, and nothing else. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/;

/** What a caller is told when the body is not the shape this door takes. */
const NOT_THE_SHAPE = "an upload is opened with a projectId, a name, a size and a sha256";

/**
 * The body this door takes, read by the one reading this tier has (`@/server/call`). A request that
 * is not this shape is not a refusal of anything the product could have done — it is a caller error,
 * answered as the registered REQUEST_MALFORMED at 400, and no session is opened for it.
 *
 * The size is a safe integer because a file's length is counted in whole bytes and JSON's number is
 * not: a declared size past `Number.MAX_SAFE_INTEGER` is a number the seam could not compare the
 * arriving bytes against.
 */
const OPEN = z.object({
  body: z.object({
    projectId: z.string(),
    name: z.string().refine((stated) => stated.trim() !== "", { error: NOT_THE_SHAPE }),
    size: z.number().int().nonnegative().safe(),
    sha256: z.string().regex(ADDRESS_SHAPE, { error: NOT_THE_SHAPE }),
  }),
});

/**
 * The door itself. The statement is read before anything else, so a body this door cannot read is
 * answered as the caller error it is rather than reaching the seam — and the session it would have
 * been judged under is resolved once, by the wrapper, and handed here on the context (R-SPINE-001).
 * A caller with a session it may not use learns only that, and learns nothing about which projects
 * exist (Q-12).
 */
export const POST = routeHandler({ route: ROUTE, actor: "upload", schema: OPEN, reads: "json", sentence: NOT_THE_SHAPE }, async ({ input, context }) => {
  const draft = input.body;
  const admission = await admitForProject(context.session?.userId ?? null, draft.projectId);
  if (isRefusedAdmission(admission)) return refusalAnswer(admission.refusal);

  const opened = await createUpload({ actor: admission.actor, projectId: draft.projectId, name: draft.name, size: draft.size, sha256: draft.sha256 });
  if (isRefused(opened)) return refusalAnswer(opened.refusal, opened.receivedBytes);
  return json({ uploadId: opened.uploadId, receivedBytes: opened.receivedBytes, chunkBytes: opened.chunkBytes }, 201);
});
