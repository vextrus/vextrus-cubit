"use server";
// What the accept screen asks the server to do: spend the mailed token, and nothing else. It
// authenticates, names the facts the guard judges, and hands request and move to the module's one
// guarded entry — origin, allowance and the invitation law are judged there, in the order
// R-SPINE-006 states, and a guard of this seam's own would be a second opinion about a question that
// has one (B-17, ARCH-02).
//
// The workspace being joined is not stated by the submission and could not be: the account spending
// the offer holds no membership of it yet. The token names it, and the invitation home reads it from
// there (R-SPINE-001: never a value the caller wrote).
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { REFUSALS, type RefusalCode } from "../../../core/errors";
import { refusalCodeOf } from "../../../core/faults/refusal-marker";
import { guardTenancyMutation, type TenancyActor, type TenancyRequest } from "../../../modules/spine/tenancy";
import { invitationMachinery } from "../../../server/auth/invitation-mail";
import { admitAttempt } from "../../../server/auth/rate-limit";
import { originFactsFromHeaders } from "../../../server/context";
import { presentedSessionToken } from "../../../server/shell/session";
import { sessionOf } from "../../../server/shell/resolve";

/** The door this move spends, as `AUTH_RATE_LIMITS` names it (R-SPINE-006). */
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

/** What the move answered: the workspace now held, or the registered refusal that stopped it. */
export type AcceptAnswer = { accepted: true; tenantId: string } | { accepted: false; refusal: RefusalCode };

/** What the screen submits: the token the mailed link carried, and nothing else. */
export interface AcceptInvitationRequest {
  token: string;
}

export async function acceptInvitationAction(request: AcceptInvitationRequest): Promise<AcceptAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  // A session that ended mid-action is not a refusal this screen can resolve in place: the way back
  // in is the door, which is where the layout above sends a sessionless request too (I-57).
  if (session === null) redirect("/sign-in");

  // The workspace half of the actor is meaningless for this move and is stated as the account's own
  // — the invitation home reads the joined workspace out of the token, never out of this field.
  const actor: TenancyActor = { tenantId: "", userId: session.userId };
  try {
    const answered = await guarded({ actor, identity: session.userId, ...originFactsFromHeaders(await headers()) } satisfies TenancyRequest, {
      kind: "acceptInvitation",
      token: request.token,
    });
    return { accepted: true, tenantId: "tenantId" in answered ? answered.tenantId : "" };
  } catch (thrown) {
    return { accepted: false, refusal: refused(thrown) };
  }
}

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back to the screen that asked; anything else is a fault, and re-throwing it is what puts
 * it on the error boundary with a recorded id rather than on this screen as an improvised sentence.
 */
function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}
