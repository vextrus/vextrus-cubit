// R-SPINE-003's invitations, and their one home (B-17): offering a workspace membership by email,
// the offers that still stand, re-mailing one, withdrawing one, and spending a mailed one to become
// a member. Every caller — a transport, a screen's server action, a suite — reaches these through
// the module's barrel, and every one that MOVES something reaches them through the guarded entry,
// where R-SPINE-006's origin check and the door's allowance are spent first.
//
// The module holds no server import. The token mint, its digest, the address fold and the outbox all
// live one tier up and arrive here as `InvitationPorts` (ARCH-01) — the same way the rate limiter
// already arrives as `admit`.
import type { WorkspaceRole } from "../../../../core/db";
import { requireMembership } from "../read/members";
import { roleHeld } from "../roles/store";
import type { TenancyActor } from "../scope";
import { judgeInvitationClaim, judgeInvitationOffer } from "./law";
import type { InvitationMachinery, InvitationPorts } from "./ports";
import { invitationNotClaimable } from "./refusals";
import {
  accountKey,
  claimInvitation,
  invitationByDigest,
  reissueToken,
  standingInvitation,
  standingInvitations,
  withdrawInvitation,
  workspaceName,
  writeInvitation,
  type InvitationRow,
} from "./store";

export type { InvitationMachinery, InvitationPorts } from "./ports";

/**
 * All a read of an offer needs: a token is looked up by its digest, and nothing about reading one
 * mints, addresses or mails anything. Stated as the slice rather than the whole so a caller that
 * only shows an offer is not obliged to hold a sender it never spends.
 */
type TokenDigest = Pick<InvitationMachinery, "digestToken">;

/** The role an invitation carries when the screen that made it named none (the store's own default). */
const INVITED_ROLE: WorkspaceRole = "MEMBER";

/**
 * One offer of membership that still stands, as a screen renders it. The address is answered as the
 * KEY it is held under, never as a string this module unwrapped: reading a key back is the server's
 * own (I-58, `folded-key.ts`), and the screen that shows a person resolves it there.
 */
export interface PendingInvitation {
  readonly invitationId: string;
  readonly invitedEmailKey: string;
  readonly workspaceRole: WorkspaceRole;
  readonly createdAt: Date;
}

/** What an invitee is being asked to join, as the accept screen names it. */
export interface InvitationOffer {
  readonly invitationId: string;
  readonly tenantId: string;
  readonly workspaceName: string;
  readonly workspaceRole: WorkspaceRole;
}

/** What making or re-mailing an offer answers with — the offer, and that it was mailed. */
export interface InvitationMailed {
  readonly invitationId: string;
  readonly mailed: true;
}

/** What withdrawing an offer answers with. */
export interface InvitationWithdrawn {
  readonly invitationId: string;
  readonly revoked: true;
}

/** What spending an invitation answers with: the membership it bought. */
export interface InvitationClaimed {
  readonly invitationId: string;
  readonly tenantId: string;
  readonly workspaceRole: WorkspaceRole;
  readonly accepted: true;
}

/** The account presenting a mailed token, and the token it presented. */
export interface InvitationClaim {
  readonly userId: string;
  readonly token: string;
}

const pendingOf = (row: InvitationRow): PendingInvitation => ({
  invitationId: row.invitationId,
  invitedEmailKey: row.invitedEmailKey,
  workspaceRole: row.workspaceRole,
  createdAt: row.createdAt,
});

/**
 * The role the acting membership holds, judged as the invitation law judges it (R-SPINE-006), and
 * answered so a caller that must judge a SECOND rank — the rank a standing offer grants — asks the
 * same law again about the same fact rather than reading the roster twice.
 */
async function administering(actor: TenancyActor, offeredRole: WorkspaceRole): Promise<WorkspaceRole> {
  const held = await roleHeld(actor.tenantId, actor.userId);
  judgeInvitationOffer(held, offeredRole);
  // `judgeInvitationOffer` throws on a membership that holds nothing, so past it the role is held.
  return held as WorkspaceRole;
}

/**
 * Offer somebody a membership of this workspace, and mail them the link that spends it.
 *
 * The token is answered by the mint and handed to the sender; only its digest is written down, so a
 * reader of the table can present nothing (the discipline `auth_tokens` already keeps). The address
 * is stored as the fold `users.email` is written through and MAILED as the address itself — a key is
 * not somewhere mail arrives.
 */
export async function createInvitation(
  actor: TenancyActor,
  request: { readonly email: string; readonly role?: WorkspaceRole },
  ports: InvitationPorts,
): Promise<InvitationMailed> {
  const offeredRole = request.role ?? INVITED_ROLE;
  await administering(actor, offeredRole);

  const to = ports.mailedAddress(request.email);
  const token = ports.mintToken();
  const row = await writeInvitation({
    tenantId: actor.tenantId,
    invitedEmailKey: ports.storedKey(request.email),
    workspaceRole: offeredRole,
    tokenHash: ports.digestToken(token),
    invitedBy: actor.userId,
  });

  try {
    await ports.send({ to, token, origin: ports.origin });
  } catch (thrown) {
    // The offer and the mail that carries it are one act. A row left standing behind a mail that
    // never left is an offer nobody can spend — it stands in the panel beside real ones, and the
    // only person who could tell them apart is the invitee, who was never written to. So the write
    // is undone and the workspace is left exactly as it was: the remedy is to invite again, not to
    // guess which of the standing offers was delivered.
    await withdrawInvitation(actor.tenantId, row.invitationId);
    throw thrown;
  }
  return { invitationId: row.invitationId, mailed: true };
}

/**
 * The offers of this workspace that still stand. Seeing who has been asked to join is seeing
 * something about the workspace, so it takes the same standing the roster takes — membership itself
 * (`requireMembership`, which is where that rule already lives) — and a stranger is refused rather
 * than answered with an empty list. Who may MOVE an invitation is a different question, asked below.
 */
export async function pendingInvitations(actor: TenancyActor): Promise<readonly PendingInvitation[]> {
  await requireMembership(actor);
  return (await standingInvitations(actor.tenantId)).map(pendingOf);
}

/**
 * Mail a standing offer again, with a fresh token. The previous link stops working the moment this
 * one is minted: an invitation is one live link at a time, so what a person spends is the newest
 * mail they hold — the same rule every other mailed link in this tree keeps.
 *
 * A resend is the SAME offer with a new secret, so it is judged against the rank that offer grants
 * and not against the rank a fresh offer carries by default. Otherwise an ADMIN could re-issue a
 * live, spendable OWNER-granting link for an offer they could never have minted (R-SPINE-006's
 * granted side: nobody offers a rank above their own) — the promotion the role law refuses, taken
 * through the mail instead.
 *
 * The mail goes BEFORE the token is swapped. The old secret is not held anywhere this function could
 * put it back from, so it does not spend one until the mail is away: an outbox that throws then
 * leaves the previously mailed link alive rather than killing it and delivering nothing in its place.
 */
export async function resendInvitation(
  actor: TenancyActor,
  request: { readonly invitationId: string },
  ports: InvitationPorts,
): Promise<InvitationMailed> {
  const actorRole = await administering(actor, INVITED_ROLE);

  const standing = await standingInvitation(actor.tenantId, request.invitationId);
  if (standing === null) throw invitationNotClaimable({ reason: "the workspace has no such offer standing" });
  judgeInvitationOffer(actorRole, standing.workspaceRole);

  const token = ports.mintToken();
  await ports.send({ to: mailableAddress(standing.invitedEmailKey, ports), token, origin: ports.origin });

  const reissued = await reissueToken(actor.tenantId, request.invitationId, ports.digestToken(token));
  if (reissued === null) throw invitationNotClaimable({ reason: "the offer stopped standing while it was being re-mailed" });
  return { invitationId: reissued.invitationId, mailed: true };
}

/**
 * Withdraw a standing offer, and kill the token with it.
 *
 * Judged against the rank the offer grants, like the resend above: R-SPINE-006 is two-sided, and a
 * pending OWNER grant is an OWNER-rank thing to strip. The direction is benign — withdrawing takes
 * nothing away from anybody who holds it — but an unjudged move is unjudged in both directions, and
 * the rule that says who may move an OWNER-rank offer has one home.
 */
export async function revokeInvitation(actor: TenancyActor, request: { readonly invitationId: string }): Promise<InvitationWithdrawn> {
  const actorRole = await administering(actor, INVITED_ROLE);

  const standing = await standingInvitation(actor.tenantId, request.invitationId);
  if (standing === null) throw invitationNotClaimable({ reason: "the workspace has no such offer standing" });
  judgeInvitationOffer(actorRole, standing.workspaceRole);

  const withdrawn = await withdrawInvitation(actor.tenantId, request.invitationId);
  if (withdrawn === null) throw invitationNotClaimable({ reason: "the workspace has no such offer standing" });
  return { invitationId: withdrawn.invitationId, revoked: true };
}

/**
 * What the account presenting this token is being offered, for the screen that asks them to decide.
 * It judges exactly what accepting judges, so a screen never shows an offer that acceptance would
 * then refuse — and a token that names nothing this account may claim refuses here, in place.
 */
export async function offeredInvitation(claim: InvitationClaim, ports: TokenDigest): Promise<InvitationOffer> {
  const offer = await judgedOffer(claim, ports);
  return {
    invitationId: offer.invitationId,
    tenantId: offer.tenantId,
    workspaceName: await workspaceName(offer.tenantId),
    workspaceRole: offer.workspaceRole,
  };
}

/**
 * Spend a mailed invitation: the offer is claimed and the membership it offered is granted, in one
 * transaction (see `./store.ts`). One user, many tenants — the workspace the invitee already had is
 * untouched, and the one they just joined is theirs to switch to (R-SPINE-002, R-SPINE-003).
 *
 * The claim is judged again here rather than trusted from the screen that showed it: what a screen
 * rendered a moment ago is not what the store holds now, and an invitation withdrawn in between must
 * refuse the accept it was already showing.
 */
export async function acceptInvitation(claim: InvitationClaim, ports: InvitationPorts): Promise<InvitationClaimed> {
  const offer = await judgedOffer(claim, ports);
  const spent = await claimInvitation(offer.invitationId, claim.userId);
  // Between the judgement above and the UPDATE, another browser holding the same link may have spent
  // it. The predicate is what decides, so the loser of that race is answered as the spent offer it
  // now is rather than told it joined something it did not.
  if (spent === null) throw invitationNotClaimable({ reason: "the invitation was spent or withdrawn while it was being accepted" });
  return { invitationId: spent.invitationId, tenantId: spent.tenantId, workspaceRole: spent.workspaceRole, accepted: true };
}

/** The offer a token names, judged against the account presenting it — the whole of the claim law. */
async function judgedOffer(claim: InvitationClaim, ports: TokenDigest): Promise<InvitationRow> {
  const offer = await invitationByDigest(ports.digestToken(claim.token));
  return judgeInvitationClaim(offer, await accountKey(claim.userId));
}

/**
 * The address a standing offer is re-mailed to, read back out of the key it is held under (I-58).
 *
 * A key that carries no address back is a digest — the fold's answer to a value the column could not
 * carry — and there is nowhere to send it. That is not a refusal anybody registered and no browser
 * can produce one, so it is a fault: an unregistered condition travels to the boundary with its
 * recorded id rather than onto a screen as an improvised sentence (ARCH-03, B-21).
 */
function mailableAddress(key: string, ports: InvitationPorts): string {
  const address = ports.addressForKey(key);
  if (address === null) throw new Error("spine.tenancy: the invitation is held under a key that carries no address, so it cannot be re-mailed");
  return address;
}
