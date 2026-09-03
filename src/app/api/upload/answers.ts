// What the upload doors answer with, in one place for both of them (ARCH-02): the session behind a
// request, the workspace membership that admits it, a registered refusal under the status the test
// contract gives it, and a fault id for the failures that are ours.
//
// The three unhappy paths stay three different answers (ARCH-03, B-21): a request carrying no live
// session is SIGNED_OUT; a request naming a project or an upload of a workspace the session holds no
// membership in is WORKSPACE_PERMISSION_NOT_HELD; a failure of ours is recorded at the fault seam and
// answered with its id, never with a refusal that would blame the caller.
import { REFUSALS } from "../../../core/errors";
import { workspaceOfProject, workspaceOfUpload, type UploadActor, type UploadRefusalCode } from "../../../modules/spine/uploads";
import { resolveSession, SESSION_COOKIE } from "../../../server/auth/session";
import { holdsWorkspace } from "../../../server/shell/workspace";

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

/** A JSON answer, uncached: an upload's state is never the same twice. */
export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * A refusal, as the register holds it (R-SPINE-062) — message and remedy included, so the client
 * renders the registered copy rather than one the transport wrote. `receivedBytes` rides along where
 * the refusal has a resumption point to name.
 */
export function refusalAnswer(code: UploadRefusalCode, receivedBytes?: number): Response {
  const body = receivedBytes === undefined ? { refusal: REFUSALS[code] } : { refusal: REFUSALS[code], receivedBytes };
  return json(body, STATUS[code]);
}

/** The marker a body this door cannot read carries, so a handler tells it from an outage of ours. */
const UNREADABLE_BODY = "unreadableBody";

/**
 * The request's body as JSON. A body that is not JSON is the caller's mistake, not a failure of
 * ours, so it is raised wearing a marker the handler reads rather than being reported as an outage
 * (ARCH-03) — the shape `refusal-marker` takes for refusals, spelled here for the one caller error
 * a transport can meet before any door has judged anything.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  try {
    return JSON.parse(text) as unknown;
  } catch (failure) {
    throw Object.assign(new Error("the request body is not JSON"), { [UNREADABLE_BODY]: true, cause: failure });
  }
}

/** Was this failure a body the door could not read? */
export function isUnreadableBody(failure: unknown): boolean {
  return typeof failure === "object" && failure !== null && (failure as Record<string, unknown>)[UNREADABLE_BODY] === true;
}

/** Did an admission refuse? */
export function isRefusedAdmission(admission: Admission): admission is { refusal: UploadRefusalCode } {
  return "refusal" in admission;
}

/** The session token this request presents, or null when it presents none. */
function presentedToken(request: Request): string | null {
  const jar = request.headers.get("cookie") ?? "";
  for (const pair of jar.split(";")) {
    const at = pair.indexOf("=");
    if (at < 0) continue;
    if (pair.slice(0, at).trim() !== SESSION_COOKIE) continue;
    const token = pair.slice(at + 1).trim();
    return token === "" ? null : token;
  }
  return null;
}

/** The account this request is made by, or null when no live session stands behind it (R-SPINE-001). */
async function userOf(request: Request): Promise<string | null> {
  const token = presentedToken(request);
  if (token === null) return null;
  return (await resolveSession(token))?.userId ?? null;
}

/**
 * The actor a request may act as in the workspace an address belongs to. Existence and membership are
 * deliberately one answer: telling a stranger that a project exists but is not theirs tells them
 * something about somebody else's workspace (Q-12).
 */
async function admit(request: Request, workspace: () => Promise<string | null>): Promise<Admission> {
  const userId = await userOf(request);
  if (userId === null) return { refusal: "SIGNED_OUT" };
  const tenantId = await workspace();
  if (tenantId === null || !(await holdsWorkspace(userId, tenantId))) return { refusal: "WORKSPACE_PERMISSION_NOT_HELD" };
  return { actor: { tenantId, userId } };
}

/** Who may open an upload against this project. */
export async function admitForProject(request: Request, projectId: string): Promise<Admission> {
  return admit(request, async () => workspaceOfProject(projectId));
}

/** Who may probe or continue this upload session. */
export async function admitForUpload(request: Request, uploadId: string): Promise<Admission> {
  return admit(request, async () => workspaceOfUpload(uploadId));
}
