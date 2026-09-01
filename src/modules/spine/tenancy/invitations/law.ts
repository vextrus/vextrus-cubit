// Who may offer a workspace membership, and when a mailed offer may still be spent (R-SPINE-003,
// R-SPINE-006). Both questions are asked of the store's own facts — the actor's role as the store
// holds it, the invitation row as the store holds it — never of anything a caller sent.
//
// The ranking itself is `../roles/rank`, which is where the roster's order already lives: an
// invitation grants a role, so "may this person grant it?" is the same question `assignWorkspaceRole`
// asks on the granted side, and asking it twice in two ways would be two answers (B-17).
import type { WorkspaceRole } from "../../../../core/db";
import { workspacePermissionNotHeld } from "../refusals";
import { mayAdminister, outranks } from "../roles/rank";
import { invitationNotClaimable } from "./refusals";
import type { InvitationRow } from "./store";

/**
 * R-SPINE-006's two-sided guard, on the side an invitation has: a member who does not administer the
 * workspace may offer nobody a membership of it, and nobody offers a rank above their own — an
 * invitation an ADMIN could mint at OWNER would be a promotion the role law refuses, taken through
 * the mail instead.
 *
 * A role the actor does not hold at all is the same answer as a role they may not grant: both are
 * "the acting membership does not carry this move", which is what the registered entry says.
 */
export function judgeInvitationOffer(actorRole: WorkspaceRole | null, offeredRole: WorkspaceRole): void {
  if (actorRole === null || !mayAdminister(actorRole)) throw workspacePermissionNotHeld({});
  if (outranks(offeredRole, actorRole)) throw workspacePermissionNotHeld({});
}

/**
 * May this account spend this invitation? The four ways the answer is no are one answer
 * (INVITATION_NOT_CLAIMABLE), for the reason the registered entry states: telling them apart would
 * tell whoever holds the token which of them it is.
 *
 *   - no invitation was ever minted for the token presented;
 *   - the offer has already been accepted;
 *   - the offer was withdrawn;
 *   - the offer was addressed to a different key than the one this account is held under.
 *
 * The address comparison is on the FOLDED key both sides are written through (I-58), so an
 * invitation and the account that eventually spends it are matched the way the store matches an
 * account to itself — never on a raw string a browser sent.
 */
export function judgeInvitationClaim(offer: InvitationRow | null, accountKey: string | null): InvitationRow {
  if (offer === null) throw invitationNotClaimable({ reason: "no invitation stands for the token presented" });
  if (offer.consumedAt !== null) throw invitationNotClaimable({ reason: "the invitation has already been accepted" });
  if (offer.revokedAt !== null) throw invitationNotClaimable({ reason: "the invitation was withdrawn" });
  if (accountKey === null || accountKey !== offer.invitedEmailKey) {
    throw invitationNotClaimable({ reason: "the invitation was addressed to another key than the one this account is held under" });
  }
  return offer;
}
