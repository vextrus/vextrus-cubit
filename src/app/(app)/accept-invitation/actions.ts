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
//
// The door is opened through the one server-call seam (`@/server/call`): it reads what the screen
// stated against the schema below, resolves the presented session ONCE, and carries a registered
// refusal back as this screen's own answer — a submission carrying no token is answered REQUEST_MALFORMED
// rather than spending an allowance on a move nobody could make.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RefusalCode } from "@/core/errors";
import { guardTenancyMutation, type TenancyActor, type TenancyRequest } from "@/modules/spine/tenancy";
import { invitationMachinery } from "@/server/auth/invitation-mail";
import { admitAttempt } from "@/server/auth/rate-limit";
import { serverCall } from "@/server/call";
import { originFactsFromHeaders } from "@/server/context";

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

/** What the accept screen may state: the token the mailed link carried, and nothing else. */
const ACCEPTED: z.ZodType<AcceptInvitationRequest> = z.object({ token: z.string() });

const accepting = serverCall(
  ACCEPTED,
  async (request, session): Promise<AcceptAnswer> => {
    // The workspace half of the actor is meaningless for this move and is stated as the account's own
    // — the invitation home reads the joined workspace out of the token, never out of this field.
    const actor: TenancyActor = { tenantId: "", userId: session.userId };
    const answered = await guarded({ actor, identity: session.userId, ...originFactsFromHeaders(await headers()) } satisfies TenancyRequest, {
      kind: "acceptInvitation",
      token: request.token,
    });
    return { accepted: true, tenantId: "tenantId" in answered ? answered.tenantId : "" };
  },
  (refusal): AcceptAnswer => {
    // A session that ended mid-action is not a refusal this screen can resolve in place: the way back
    // in is the door, which is where the layout above sends a sessionless request too (I-57).
    if (refusal === "SIGNED_OUT") redirect("/sign-in");
    return { accepted: false, refusal };
  },
);

export async function acceptInvitationAction(request: AcceptInvitationRequest): Promise<AcceptAnswer> {
  return accepting(request);
}
