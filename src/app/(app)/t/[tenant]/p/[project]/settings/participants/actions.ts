"use server";
// What the participants screen asks the server to do: L-ACT-02's pair, and nothing else. Each one
// names the act seam and answers with what the seam answered — a registered refusal is carried back
// to the screen that asked, never turned into a fault and never swallowed (ARCH-03, B-21).
//
// The actor is derived here and never taken from the form: `participantsActorFor` is the one place
// that turns a session and a project into a scoped actor, and the transport reaches the same seam
// through the same helper (B-17, ARCH-02).
import { revalidatePath } from "next/cache";
import { commit, consequenceDigest, isRole, preview, type AssignParticipantRoleInput, type Consequence } from "../../../../../../../../core/acts";
import { REFUSALS, type RefusalCode } from "../../../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../../../core/faults/refusal-marker";
import { participantsActorFor } from "../../../../../../../../server/routers/spine";
import { presentedSessionToken } from "../../../../../../../../server/shell/session";
import { sessionOf } from "../../../../../../../../server/shell/resolve";
import { participantsRoute } from "./route-address";

const ASSIGN_PARTICIPANT_ROLE = "ASSIGN_PARTICIPANT_ROLE" as const;

/** The assignment a submission states: who, which role, and which way it moves. */
export interface AssignRequest {
  projectId: string;
  subjectUserId: string;
  role: string;
  direction: "GRANT" | "WITHDRAW";
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

export async function previewAssignRole(request: AssignRequest): Promise<PreviewAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { previewed: false, refusal: "SIGNED_OUT" };
  try {
    const actor = await participantsActorFor(session.userId, request.projectId, ASSIGN_PARTICIPANT_ROLE);
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  } catch (thrown) {
    return { previewed: false, refusal: refused(thrown) };
  }
}

export async function commitAssignRole(request: AssignRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { committed: false, refusal: "SIGNED_OUT" };
  try {
    const actor = await participantsActorFor(session.userId, request.projectId, ASSIGN_PARTICIPANT_ROLE);
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    // The committed act IS the answer, and the screen shows it by re-reading: the roster and the
    // history are what moved, and both are server-rendered from the ledgers the act just appended to.
    revalidatePath(participantsRoute(actor.tenantId, request.projectId));
    return { committed: true, actId: written.actId };
  } catch (thrown) {
    return { committed: false, refusal: refused(thrown) };
  }
}

/**
 * The submission read into the shape the seam declares. The role arrives from a chip group a caller
 * can post anything through, and a role the closed enum does not hold bundles nothing — so it is
 * judged here rather than reaching the seam as a string nobody can act on (L-ACT-03).
 */
function actInput(request: AssignRequest): AssignParticipantRoleInput {
  if (!isRole(request.role)) throw new Error(`"${request.role}" is not a role — roles are the closed set a human picks from (L-ACT-03)`);
  return {
    type: ASSIGN_PARTICIPANT_ROLE,
    projectId: request.projectId,
    subjectUserId: request.subjectUserId,
    role: request.role,
    direction: request.direction,
  };
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
