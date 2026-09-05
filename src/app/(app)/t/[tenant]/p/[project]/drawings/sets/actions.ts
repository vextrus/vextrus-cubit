"use server";
// What the two sets screens ask the server to do: the two draft writes a set's membership is edited
// by, and L-ACT-02's pair for the act that pins it. Each one names the seam and answers with what the
// seam answered — a registered refusal is carried back to the screen that asked, never turned into a
// fault and never swallowed (ARCH-03, B-21).
//
// The workspace is derived here and never taken from the form: `projectActorFor` is the one place
// that turns a session and a project into a workspace-scoped actor, so a tenant id a caller posted
// decides nothing (B-17, ARCH-02). A request naming a workspace other than the project's own is
// answered as the denial it is.
import { revalidatePath } from "next/cache";
import { commit, consequenceDigest, permissionsHeld, preview, type Consequence, type PinDrawingSetInput } from "../../../../../../../../core/acts";
import { forTenant } from "../../../../../../../../core/db";
import { REFUSALS, type RefusalCode } from "../../../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../../../core/faults/refusal-marker";
import { createSet as createSetInModule, setOf, toggleMember as toggleMemberInModule } from "../../../../../../../../modules/takeoff/sets";
import { projectActorFor } from "../../../../../../../../server/routers/spine";
import { sessionOf } from "../../../../../../../../server/shell/resolve";
import { presentedSessionToken } from "../../../../../../../../server/shell/session";
import { setRoute, setsRoute } from "./route-address";

/** The act these screens render, and the permission L-ACT-03 makes it move. */
const PIN_DRAWING_SET = "PIN_DRAWING_SET" as const;
const PIN_SET = "PIN_SET" as const;

/** What a set is asked for, and what a door on it is asked for. */
export interface SetsRequest {
  tenantId: string;
  projectId: string;
}

export interface CreateSetRequest extends SetsRequest {
  name: string;
}

export interface ToggleMemberRequest extends SetsRequest {
  setId: string;
  drawingId: string;
}

export interface PinRequest extends SetsRequest {
  setId: string;
}

/** What naming a set answered: the set it made, or the registered code that stopped it. */
export type CreateSetAnswer = { created: true; setId: string } | { created: false; refusal: RefusalCode };

/** What a toggle answered: whether the drawing is now a member, or why the draft did not move. */
export type ToggleMemberAnswer = { toggled: true; member: boolean } | { toggled: false; refusal: RefusalCode };

/** What a preview answered: what the pin would record and the digest that binds it, or the refusal. */
export type PreviewPinAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act, the revision it pinned and its address, or the refusal. */
export type CommitPinAnswer = { committed: true; actId: string; setRevisionId: string; digest: string } | { committed: false; refusal: RefusalCode };

export async function createSet(request: CreateSetRequest): Promise<CreateSetAnswer> {
  const standing = await pinStanding(request);
  if ("refusal" in standing) return { created: false, refusal: standing.refusal };
  const answered = await createSetInModule(standing.scope, { userId: standing.userId }, request.name);
  if (!answered.created) return { created: false, refusal: answered.refusal };
  // The new set standing open is the answer, and the index behind it has grown a row: both are
  // server-read, so the path they are read at is revalidated before the screen navigates.
  revalidatePath(setsRoute(standing.scope.tenantId, request.projectId));
  return { created: true, setId: answered.setId };
}

export async function toggleMember(request: ToggleMemberRequest): Promise<ToggleMemberAnswer> {
  const standing = await pinStanding(request);
  if ("refusal" in standing) return { toggled: false, refusal: standing.refusal };
  const answered = await toggleMemberInModule(standing.scope, request.setId, request.drawingId, { userId: standing.userId });
  if (!answered.toggled) return { toggled: false, refusal: answered.refusal };
  revalidatePath(setRoute(standing.scope.tenantId, request.projectId, request.setId));
  return { toggled: true, member: answered.member };
}

export async function previewPin(request: PinRequest): Promise<PreviewPinAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { previewed: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, PIN_DRAWING_SET, PIN_SET);
    const consequence = await preview(actor, pinning(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  } catch (thrown) {
    return { previewed: false, refusal: refused(thrown) };
  }
}

export async function commitPin(request: PinRequest & { consequenceDigest: string }): Promise<CommitPinAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { committed: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, PIN_DRAWING_SET, PIN_SET);
    const written = await commit(actor, pinning(request), request.consequenceDigest);
    // The pinned revision IS the answer, and the screen shows it by re-reading: it is server-read
    // from the ledger the act just appended to.
    const view = await setOf({ tenantId: actor.tenantId, projectId: request.projectId }, request.setId);
    const pinned = view?.revisions[0];
    if (pinned === undefined) {
      throw new Error(`${PIN_DRAWING_SET} committed act ${written.actId} but the set stands at no pinned revision — the act row and its state change land together or neither (L-ACT-01)`);
    }
    revalidatePath(setRoute(actor.tenantId, request.projectId, request.setId));
    revalidatePath(setsRoute(actor.tenantId, request.projectId));
    return { committed: true, actId: written.actId, setRevisionId: pinned.setRevisionId, digest: pinned.digest };
  } catch (thrown) {
    return { committed: false, refusal: refused(thrown) };
  }
}

/** The pin, in the shape the seam declares: the set key, and nothing a caller could widen it with. */
function pinning(request: PinRequest): PinDrawingSetInput {
  return { type: PIN_DRAWING_SET, projectId: request.projectId, setId: request.setId };
}

/**
 * The workspace this project belongs to and the account asking, once it is settled that the account
 * may pin here — the standing the two draft doors are gated on (I-96: a draft is written straight,
 * so the permission the pin needs is checked at the door rather than by the act seam).
 *
 * The tenant id the request carries is compared against the project's own rather than trusted: a
 * caller that names another workspace is answered with the denial, not served under it.
 */
async function pinStanding(request: SetsRequest): Promise<{ scope: { tenantId: string; projectId: string }; userId: string } | { refusal: RefusalCode }> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, null, PIN_SET);
    if (actor.tenantId !== request.tenantId) return { refusal: REFUSALS.PERMISSION_NOT_HELD.code };
    const held = await forTenant(actor).transaction(async (tx) => (await permissionsHeld(tx, request.projectId, actor.userId)).has(PIN_SET));
    if (!held) return { refusal: REFUSALS.PERMISSION_NOT_HELD.code };
    return { scope: { tenantId: actor.tenantId, projectId: request.projectId }, userId: actor.userId };
  } catch (thrown) {
    return { refusal: refused(thrown) };
  }
}

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back; anything else is a fault, and re-throwing it is what puts it on the error boundary
 * with a recorded fault id rather than on this screen as a sentence nobody registered (ARCH-03).
 */
function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}
