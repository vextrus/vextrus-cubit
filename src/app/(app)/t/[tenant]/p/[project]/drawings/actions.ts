"use server";
// What the sheet index asks the server to do: the two machine requests a stored drawing sets off, and
// L-ACT-02's pair for the act it renders. Each one names the seam and answers with what the seam
// answered — a registered refusal is carried back to the screen that asked, never turned into a
// fault and never swallowed (ARCH-03, B-21).
//
// The actor is derived here and never taken from the form: `projectActorFor` is the one place that
// turns a session and a project into a workspace-scoped actor, and the transport reaches the same
// seam through the same helper (B-17, ARCH-02).
import { revalidatePath } from "next/cache";
import { commit, consequenceDigest, preview, type ConfirmDisciplineInput, type Consequence, type OfferedGroupKey } from "../../../../../../../core/acts";
import { REFUSALS, type RefusalCode } from "../../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../../core/faults/refusal-marker";
import { isDiscipline } from "../../../../../../../core/sheets";
import { workspaceOfProject } from "../../../../../../../modules/spine/uploads";
import { requestIngest } from "../../../../../../../modules/takeoff/ingest";
import { requestThumbnails } from "../../../../../../../modules/takeoff/thumbnails";
import { projectActorFor } from "../../../../../../../server/routers/spine";
import { sessionOf } from "../../../../../../../server/shell/resolve";
import { presentedSessionToken } from "../../../../../../../server/shell/session";
import { holdsWorkspace } from "../../../../../../../server/shell/workspace";
import { drawingsRoute } from "./route-address";

/** The act this screen renders, and the permission L-ACT-03 makes it move. */
const CONFIRM_DISCIPLINE = "CONFIRM_DISCIPLINE" as const;
const MEASURE = "MEASURE" as const;

/** What a confirmation asks for: which project, and which offered group of it. */
export interface ConfirmRequest {
  projectId: string;
  group: OfferedGroupKey;
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * What one asked-for job amounted to: the job carrying it, or none because there was nothing to do.
 *
 * A request the seam refused answers with its registered code rather than an absence: silence about
 * a drawing that will never be read is exactly what R-UI-020 forbids, so the code travels back to the
 * screen that asked and is rendered there.
 */
export interface RequestedJob {
  jobId: string | null;
  deduplicated: boolean;
  refusal: RefusalCode | null;
}

/** The same, said of one drawing of a batch. */
export interface RequestedSheets extends RequestedJob {
  drawingId: string;
}

/**
 * Ask for every stored drawing to be read (R-TO-001). The upload queue calls this as each row
 * reaches `stored`, so a drawing is read the moment the product holds it.
 *
 * A drawing already read answers `deduplicated`, which is the normal answer and reports nothing: the
 * ingest seam is idempotent per drawing, and asking twice never mints a second record.
 */
export async function requestSheetsFor(request: { projectId: string; drawingIds: string[] }): Promise<RequestedSheets[]> {
  const held = await workspaceFor(request.projectId);
  if ("refusal" in held) return request.drawingIds.map((drawingId) => ({ drawingId, jobId: null, deduplicated: false, refusal: held.refusal }));

  const asked: RequestedSheets[] = [];
  for (const drawingId of request.drawingIds) {
    const answer = await requestIngest({ tenantId: held.tenantId, drawingId, requestedBy: held.userId });
    // A refused request enqueued nothing, so it adds no timeline step (I-88) — but it is carried back
    // under its own code, because a drawing that will never be read may not be answered with silence.
    asked.push({
      drawingId,
      jobId: "jobId" in answer ? answer.jobId : null,
      deduplicated: "deduplicated" in answer ? answer.deduplicated : false,
      refusal: "refusal" in answer ? answer.refusal : null,
    });
  }
  return asked;
}

/**
 * Ask for a drawing's sheets to be drawn (R-SPINE-022). The worker chains this itself once a record
 * lands — a closed tab must not leave a record without pictures — so the normal answer here is
 * `deduplicated: true`, and the screen asks only to learn the job id its timeline follows (I-88).
 */
export async function requestThumbnailsFor(request: { projectId: string; drawingId: string }): Promise<RequestedJob> {
  const held = await workspaceFor(request.projectId);
  if ("refusal" in held) return { jobId: null, deduplicated: false, refusal: held.refusal };
  const answer = await requestThumbnails({ tenantId: held.tenantId, drawingId: request.drawingId, requestedBy: held.userId });
  return {
    jobId: "jobId" in answer ? answer.jobId : null,
    deduplicated: "deduplicated" in answer ? answer.deduplicated : false,
    refusal: "refusal" in answer ? answer.refusal : null,
  };
}

export async function previewConfirmDiscipline(request: ConfirmRequest): Promise<PreviewAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { previewed: false, refusal: "SIGNED_OUT" };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, CONFIRM_DISCIPLINE, MEASURE);
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  } catch (thrown) {
    return { previewed: false, refusal: refused(thrown) };
  }
}

export async function commitConfirmDiscipline(request: ConfirmRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { committed: false, refusal: "SIGNED_OUT" };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, CONFIRM_DISCIPLINE, MEASURE);
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    // The committed act IS the answer, and the screen shows it by re-reading: the confirmed cards and
    // the emptied group are both server-rendered from the ledger the act just appended to.
    revalidatePath(drawingsRoute(actor.tenantId, request.projectId));
    return { committed: true, actId: written.actId };
  } catch (thrown) {
    return { committed: false, refusal: refused(thrown) };
  }
}

/**
 * The workspace a project belongs to and the account asking, or the registered code that says why
 * neither stands. It is never taken from the caller: a tenant id on a form field is a value the
 * caller wrote.
 */
async function workspaceFor(projectId: string): Promise<{ tenantId: string; userId: string } | { refusal: RefusalCode }> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { refusal: REFUSALS.SIGNED_OUT.code };
  const tenantId = await workspaceOfProject(projectId);
  if (tenantId === null || !(await holdsWorkspace(session.userId, tenantId))) return { refusal: REFUSALS.WORKSPACE_PERMISSION_NOT_HELD.code };
  return { tenantId, userId: session.userId };
}

/**
 * The submission read into the shape the seam declares. The discipline arrives from a chip group a
 * caller can post anything through, and one the closed enum does not hold names no group the project
 * offers — so it is judged here rather than reaching the seam as a string nobody can act on.
 */
function actInput(request: ConfirmRequest): ConfirmDisciplineInput {
  const group = request.group;
  if (!isDiscipline(group.discipline)) throw new Error(`"${String(group.discipline)}" is not a discipline — the roster R-TO-004 names is closed`);
  return { type: CONFIRM_DISCIPLINE, projectId: request.projectId, group };
}

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back; anything else is a fault, and re-throwing it is what puts it on the error boundary
 * with a recorded fault id rather than on this screen as a sentence nobody registered (ARCH-03).
 */
function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  // A marker carrying a code the register does not hold is not a refusal the product can answer
  // with, so it travels as what it is (R-SPINE-062, B-06).
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}
