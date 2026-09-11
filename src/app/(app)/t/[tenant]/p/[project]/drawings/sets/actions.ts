"use server";
// What the two sets screens ask the server to do: the two draft writes a set's membership is edited
// by, and L-ACT-02's pair for the act that pins it. Each one names the seam and answers with what the
// seam answered — a registered refusal is carried back to the screen that asked, never turned into a
// fault and never swallowed (ARCH-03, B-21).
//
// Every door is opened through the one server-call seam (`@/server/call`): it reads what the screen
// stated against the schemas below, resolves the presented session ONCE for the action, and carries
// a registered refusal back in this screen's own answer shape — a submission that is not the shape a
// door is asked in is answered REQUEST_MALFORMED rather than thrown across the action boundary.
//
// The workspace is derived here and never taken from the form: `projectActorFor` is the one place
// that turns a session and a project into a workspace-scoped actor, so a tenant id a caller posted
// decides nothing (B-17, ARCH-02). A request naming a workspace other than the project's own is
// answered as the denial it is.
//
// Nothing here revalidates a path: both these routes are server-rendered on demand, and the screens
// answer a write by standing at the address again — a new set at its own, a pinned revision by
// reading the set afresh — so what a person then sees is a fresh render of the ledger and never a
// cached one.
import { z } from "zod";
import { commit, consequenceDigest, permissionsHeld, preview, type Consequence, type PinDrawingSetInput } from "@/core/acts";
import { forTenant } from "@/core/db";
import { REFUSALS, type RefusalCode } from "@/core/errors";
import { createSet as createSetInModule, setOf, toggleMember as toggleMemberInModule } from "@/modules/takeoff/sets";
import type { AuthSession } from "@/server/auth/session";
import { serverCall } from "@/server/call";
import { projectActorFor } from "@/server/routers/spine";

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

/** What the two sets screens may state at these four doors. */
const SET_ADDRESS = { tenantId: z.string(), projectId: z.string() };
const NAMED: z.ZodType<CreateSetRequest> = z.object({ ...SET_ADDRESS, name: z.string() });
const TOGGLED: z.ZodType<ToggleMemberRequest> = z.object({ ...SET_ADDRESS, setId: z.string(), drawingId: z.string() });
const PINNED: z.ZodType<PinRequest> = z.object({ ...SET_ADDRESS, setId: z.string() });
const COMMITTED = z.object({ ...SET_ADDRESS, setId: z.string(), consequenceDigest: z.string() });

const naming = serverCall(
  NAMED,
  async (request, session): Promise<CreateSetAnswer> => {
    const standing = await pinStanding(request, session);
    if ("refusal" in standing) return { created: false, refusal: standing.refusal };
    const answered = await createSetInModule(standing.scope, { userId: standing.userId }, request.name);
    if (!answered.created) return { created: false, refusal: answered.refusal };
    return { created: true, setId: answered.setId };
  },
  (refusal): CreateSetAnswer => ({ created: false, refusal }),
);

const toggling = serverCall(
  TOGGLED,
  async (request, session): Promise<ToggleMemberAnswer> => {
    const standing = await pinStanding(request, session);
    if ("refusal" in standing) return { toggled: false, refusal: standing.refusal };
    const answered = await toggleMemberInModule(standing.scope, request.setId, request.drawingId, { userId: standing.userId });
    if (!answered.toggled) return { toggled: false, refusal: answered.refusal };
    return { toggled: true, member: answered.member };
  },
  (refusal): ToggleMemberAnswer => ({ toggled: false, refusal }),
);

const previewing = serverCall(
  PINNED,
  async (request, session): Promise<PreviewPinAnswer> => {
    const actor = await projectActorFor(session.userId, request.projectId, PIN_DRAWING_SET, PIN_SET);
    const consequence = await preview(actor, pinning(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  },
  (refusal): PreviewPinAnswer => ({ previewed: false, refusal }),
);

const committing = serverCall(
  COMMITTED,
  async (request, session): Promise<CommitPinAnswer> => {
    const actor = await projectActorFor(session.userId, request.projectId, PIN_DRAWING_SET, PIN_SET);
    const written = await commit(actor, pinning(request), request.consequenceDigest);
    // The pinned revision IS the answer, and the screen shows it by re-reading: it is server-read
    // from the ledger the act just appended to.
    const view = await setOf({ tenantId: actor.tenantId, projectId: request.projectId }, request.setId);
    const pinned = view?.revisions[0];
    if (pinned === undefined) {
      throw new Error(`${PIN_DRAWING_SET} committed act ${written.actId} but the set stands at no pinned revision — the act row and its state change land together or neither (L-ACT-01)`);
    }
    return { committed: true, actId: written.actId, setRevisionId: pinned.setRevisionId, digest: pinned.digest };
  },
  (refusal): CommitPinAnswer => ({ committed: false, refusal }),
);

export async function createSet(request: CreateSetRequest): Promise<CreateSetAnswer> {
  return naming(request);
}

export async function toggleMember(request: ToggleMemberRequest): Promise<ToggleMemberAnswer> {
  return toggling(request);
}

export async function previewPin(request: PinRequest): Promise<PreviewPinAnswer> {
  return previewing(request);
}

export async function commitPin(request: PinRequest & { consequenceDigest: string }): Promise<CommitPinAnswer> {
  return committing(request);
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
 * The session is the one the server-call seam resolved for this action, so it is read once however
 * many doors an action passes through (R-SPINE-001). The tenant id the request carries is compared
 * against the project's own rather than trusted: a caller that names another workspace is answered
 * with the denial, not served under it. A registered refusal raised under here needs no catch of its
 * own — the seam that opened the door carries it back in the screen's answer shape (ARCH-03).
 */
async function pinStanding(request: SetsRequest, session: AuthSession): Promise<{ scope: { tenantId: string; projectId: string }; userId: string } | { refusal: RefusalCode }> {
  const actor = await projectActorFor(session.userId, request.projectId, null, PIN_SET);
  if (actor.tenantId !== request.tenantId) return { refusal: REFUSALS.PERMISSION_NOT_HELD.code };
  const held = await forTenant(actor).transaction(async (tx) => (await permissionsHeld(tx, request.projectId, actor.userId)).has(PIN_SET));
  if (!held) return { refusal: REFUSALS.PERMISSION_NOT_HELD.code };
  return { scope: { tenantId: actor.tenantId, projectId: request.projectId }, userId: actor.userId };
}
