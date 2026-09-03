// POST /api/upload — R-SPINE-020's door: a signed-in member of a project's workspace opens an
// upload session for one declared file, and is told where to send its bytes and how much of it at a
// time. Nothing is stored here; what the client declares — the name, the size and its own sha256 —
// is what the seam judges the arriving bytes against once they arrive.
import { randomUUID } from "node:crypto";
import { reportFault } from "../../../core/faults/report";
import { createUpload, isRefused } from "../../../modules/spine/uploads";
import { admitForProject, isRefusedAdmission, isUnreadableBody, json, readJsonBody, refusalAnswer } from "./answers";

/** Every session is opened against live state; nothing about this route may be built or cached. */
export const dynamic = "force-dynamic";

/** The route the fault seam records this handler's failures under (ARCH-03). */
const ROUTE = "POST /api/upload";

/** The body this door takes (test contract), once it has been read as the shape it must be. */
interface OpenRequest {
  projectId: string;
  name: string;
  size: number;
  sha256: string;
}

/** A content address as the seam spells one: 64 lowercase hex characters, and nothing else. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/;

/**
 * The body as the contract states it, or null when what arrived is not that shape. A request that is
 * not the shape is not a refusal of anything the product could have done — it is a caller error,
 * answered as one, and no session is opened for it.
 */
function openRequestOf(body: unknown): OpenRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { projectId, name, size, sha256 } = body as Record<string, unknown>;
  if (typeof projectId !== "string" || typeof name !== "string" || typeof sha256 !== "string") return null;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) return null;
  if (name.trim() === "" || !ADDRESS_SHAPE.test(sha256)) return null;
  return { projectId, name, size, sha256 };
}

/** What a caller is told when the body is not the shape this door takes. */
const NOT_THE_SHAPE = "an upload is opened with a projectId, a name, a size and a sha256";

export async function POST(request: Request): Promise<Response> {
  try {
    const draft = openRequestOf(await readJsonBody(request));
    // The session is judged before the body: a caller with no session learns that, and learns
    // nothing about which projects exist (Q-12).
    const admission = await admitForProject(request, draft?.projectId ?? "");
    if (isRefusedAdmission(admission)) return refusalAnswer(admission.refusal);
    if (draft === null) return json({ error: NOT_THE_SHAPE }, 400);

    const opened = await createUpload({ actor: admission.actor, projectId: draft.projectId, name: draft.name, size: draft.size, sha256: draft.sha256 });
    if (isRefused(opened)) return refusalAnswer(opened.refusal, opened.receivedBytes);
    return json({ uploadId: opened.uploadId, receivedBytes: opened.receivedBytes, chunkBytes: opened.chunkBytes }, 201);
  } catch (failure) {
    // Two different failures, told apart before either is answered (ARCH-03, B-21): a body this door
    // cannot read is the caller's mistake and no outage of ours, while anything else happened on our
    // side and is recorded at the fault seam before the caller is given its id.
    if (isUnreadableBody(failure)) return json({ error: NOT_THE_SHAPE }, 400);
    const { faultId } = reportFault({ requestId: randomUUID(), actor: "upload", route: ROUTE, cause: failure });
    return json({ faultId }, 500);
  }
}
