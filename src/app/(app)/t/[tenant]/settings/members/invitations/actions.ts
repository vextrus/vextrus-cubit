"use server";
// What the invitations panel asks the server to do: R-SPINE-003's three invitation moves and nothing
// else. Each one authenticates, names the facts the guard judges, and hands request and move to the
// module's one guarded entry — origin, allowance and the invitation law are judged there, in the
// order R-SPINE-006 states, and a guard of this seam's own would be a second opinion about a
// question that has one (B-17, ARCH-02).
//
// A registered refusal is carried back to the panel that asked, which renders it in place; anything
// else is a fault and travels on to the boundary with its recorded id, never onto the screen as a
// sentence nobody registered (ARCH-03, B-21).
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { REFUSALS, type RefusalCode } from "../../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../../core/faults/refusal-marker";
import { guardTenancyMutation, type TenancyActor, type TenancyMutation, type TenancyRequest } from "../../../../../../../modules/spine/tenancy";
import { invitationMachinery } from "../../../../../../../server/auth/invitation-mail";
import { admitAttempt } from "../../../../../../../server/auth/rate-limit";
import { originFactsFromHeaders } from "../../../../../../../server/context";
import { presentedSessionToken } from "../../../../../../../server/shell/session";
import { sessionOf } from "../../../../../../../server/shell/resolve";
import { membersRoute } from "../route-address";

/** The door this screen's mutations spend, as `AUTH_RATE_LIMITS` names it (R-SPINE-006). */
const TENANCY_DOOR = "tenancyAdmin" as const;

/**
 * The guarded entry, bound once to the shipped limiter and the shipped invitation machinery — the
 * same binding every other tenant-administration seam makes, so every move this deployment carries
 * out spends the one allowance and is judged by the same three steps in the same order.
 */
const guarded = guardTenancyMutation({
  admit: (identity: string) => admitAttempt(TENANCY_DOOR, identity),
  invitations: invitationMachinery,
});

/** What a move answered: it landed, or the registered refusal that stopped it. */
export type InvitationsAnswer = { moved: true } | { moved: false; refusal: RefusalCode };

/**
 * The workspace a submission is about — the one the address it was made from names (R-UI-031). It is
 * stated rather than derived because a person belongs to many workspaces and this screen is one of
 * them; it grants nothing, because the invitation law reads the acting member's role in that
 * workspace out of the store and refuses a caller who holds none (R-SPINE-006).
 */
export interface InviteRequest {
  tenantId: string;
  email: string;
}

/** The standing offer a submission names, in the workspace it was made from. */
export interface InvitationRequest {
  tenantId: string;
  invitationId: string;
}

export async function inviteMemberAction(request: InviteRequest): Promise<InvitationsAnswer> {
  return move(request.tenantId, { kind: "createInvitation", email: request.email });
}

export async function resendInvitationAction(request: InvitationRequest): Promise<InvitationsAnswer> {
  return move(request.tenantId, { kind: "resendInvitation", invitationId: request.invitationId });
}

export async function revokeInvitationAction(request: InvitationRequest): Promise<InvitationsAnswer> {
  return move(request.tenantId, { kind: "revokeInvitation", invitationId: request.invitationId });
}

/**
 * One move, from the session to the guarded entry and back. The committed move is answered by
 * re-reading: the pending list is what changed, and it is server-rendered from the store the guard
 * just wrote to.
 */
async function move(tenantId: string, mutation: TenancyMutation): Promise<InvitationsAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  // A session that ended mid-action is not a refusal this screen can resolve in place: the way back
  // in is the door, which is where the layout above sends a sessionless request too (I-57).
  if (session === null) redirect("/sign-in");

  const actor: TenancyActor = { tenantId, userId: session.userId };
  try {
    await guarded(await requestFor(actor, session.userId), mutation);
  } catch (thrown) {
    return { moved: false, refusal: refused(thrown) };
  }
  revalidatePath(membersRoute(tenantId));
  return { moved: true };
}

/**
 * What the guarded entry is told about the request beside the move itself. Neither half of the actor
 * is taken from the submission: the account is the one the session resolved to, and the origin facts
 * come from the one seam that derives them — `src/server/context.ts` — so the mailed link is built
 * on what this deployment states it answers at and never on a header a caller wrote (R-SPINE-001).
 */
async function requestFor(actor: TenancyActor, identity: string): Promise<TenancyRequest> {
  return { actor, identity, ...originFactsFromHeaders(await headers()) };
}

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back to the panel that asked; anything else is a fault, and re-throwing it is what puts it
 * on the error boundary with a recorded id rather than on this screen as an improvised sentence.
 */
function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}
