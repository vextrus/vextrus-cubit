// What the upload doors answer with, in one place for both of them (ARCH-02): the workspace
// membership that admits a request, and a registered refusal under the status the test contract
// gives it. Who is asking is no longer asked here — the one server-call seam (`@/server/call`)
// resolves the presented session once per request and hands it to the door, which hands the account
// it named to the admission below; a second resolution here would be a second answer to a question
// R-SPINE-001 gives one answer to.
//
// The three unhappy paths stay three different answers (ARCH-03, B-21): a request carrying no live
// session is SIGNED_OUT; a request naming a project or an upload of a workspace the session holds no
// membership in is WORKSPACE_PERMISSION_NOT_HELD; a failure of ours is recorded at the fault seam and
// answered with its id, never with a refusal that would blame the caller.
import { REFUSALS } from "@/core/errors";
import { workspaceOfProject, workspaceOfUpload, type UploadActor, type UploadRefusalCode } from "@/modules/spine/uploads";
import { json } from "@/server/call";
import { holdsWorkspace } from "@/server/shell/workspace";

/** The status each registered refusal is answered under (test contract). Total, so none is guessed. */
const STATUS: Readonly<Record<UploadRefusalCode, number>> = Object.freeze({
  SIGNED_OUT: 401,
  WORKSPACE_PERMISSION_NOT_HELD: 403,
  FILE_TOO_LARGE: 413,
  FORMAT_NOT_ACCEPTED: 415,
  DIGEST_MISMATCH: 409,
  UPLOAD_NOT_RESUMABLE: 409,
  SCAN_REJECTED: 422,
});

/** Who is asking, or the registered reason they are not being answered. */
export type Admission = { actor: UploadActor } | { refusal: UploadRefusalCode };

/**
 * A refusal, as the register holds it (R-SPINE-062) — message and remedy included, so the client
 * renders the registered copy rather than one the transport wrote. `receivedBytes` rides along where
 * the refusal has a resumption point to name.
 */
export function refusalAnswer(code: UploadRefusalCode, receivedBytes?: number): Response {
  const body = receivedBytes === undefined ? { refusal: REFUSALS[code] } : { refusal: REFUSALS[code], receivedBytes };
  return json(body, STATUS[code]);
}

/** Did an admission refuse? */
export function isRefusedAdmission(admission: Admission): admission is { refusal: UploadRefusalCode } {
  return "refusal" in admission;
}

/**
 * The actor a request may act as in the workspace an address belongs to. Existence and membership are
 * deliberately one answer: telling a stranger that a project exists but is not theirs tells them
 * something about somebody else's workspace (Q-12).
 */
async function admit(userId: string | null, workspace: () => Promise<string | null>): Promise<Admission> {
  if (userId === null) return { refusal: "SIGNED_OUT" };
  const tenantId = await workspace();
  if (tenantId === null || !(await holdsWorkspace(userId, tenantId))) return { refusal: "WORKSPACE_PERMISSION_NOT_HELD" };
  return { actor: { tenantId, userId } };
}

/** Who may open an upload against this project. */
export async function admitForProject(userId: string | null, projectId: string): Promise<Admission> {
  return admit(userId, async () => workspaceOfProject(projectId));
}

/** Who may probe or continue this upload session. */
export async function admitForUpload(userId: string | null, uploadId: string): Promise<Admission> {
  return admit(userId, async () => workspaceOfUpload(uploadId));
}
