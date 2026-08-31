// The `invitations` rows this module offers, spends and withdraws, and the one place it speaks to
// the store about them (B-17). Nothing outside the tenancy module names this table.
//
// Every statement runs under a recorded system reason, for the reason `roles/store.ts` records: an
// invitation is not tenant-scoped state a tenant handle may write. The offer is made to somebody who
// holds no membership of the workspace yet, and it is SPENT by an account that is a stranger to that
// workspace at the moment it spends it — so a tenant-scoped handle could not see the row it is
// claiming, and the migration's policies admit the write under a named system reason and refuse
// every tenant-scoped one (SEAM-TENANT).
import {
  and,
  asc,
  eq,
  invitations,
  isNull,
  memberships,
  runAsSystem,
  tenants,
  users,
  isUuid,
  type WorkspaceRole,
} from "../../../../core/db";

const OFFER_REASON = "R-SPINE-003 tenancy: making, listing or withdrawing a workspace's offers of membership";
const CLAIM_REASON = "R-SPINE-003 tenancy: spending a mailed invitation, and granting the membership it offered";

/** One invitation row, as this module reads it back. */
export interface InvitationRow {
  readonly invitationId: string;
  readonly tenantId: string;
  readonly invitedEmailKey: string;
  readonly workspaceRole: WorkspaceRole;
  readonly createdAt: Date;
  readonly consumedAt: Date | null;
  readonly revokedAt: Date | null;
}

/** The columns every read of the table answers with, stated once. */
const COLUMNS = {
  invitationId: invitations.invitationId,
  tenantId: invitations.tenantId,
  invitedEmailKey: invitations.invitedEmailKey,
  workspaceRole: invitations.workspaceRole,
  createdAt: invitations.createdAt,
  consumedAt: invitations.consumedAt,
  revokedAt: invitations.revokedAt,
} as const;

/** Write the offer down, and answer the row it became. */
export async function writeInvitation(offer: {
  tenantId: string;
  invitedEmailKey: string;
  workspaceRole: WorkspaceRole;
  tokenHash: string;
  invitedBy: string;
}): Promise<InvitationRow> {
  const written = await runAsSystem(OFFER_REASON).insert(invitations).values(offer).returning(COLUMNS);
  const row = written[0];
  if (row === undefined) throw new Error("spine.tenancy: the invitation was not written");
  return row;
}

/**
 * The offers of this workspace that still stand — neither accepted nor withdrawn — oldest first, and
 * settled by the invitation's own id so two made in the same instant still answer one order.
 */
export async function standingInvitations(tenantId: string): Promise<readonly InvitationRow[]> {
  if (!isUuid(tenantId)) return [];
  return runAsSystem(OFFER_REASON)
    .select(COLUMNS)
    .from(invitations)
    .where(and(eq(invitations.tenantId, tenantId), isNull(invitations.consumedAt), isNull(invitations.revokedAt)))
    .orderBy(asc(invitations.createdAt), asc(invitations.invitationId));
}

/**
 * One standing offer of this workspace. Scoped by tenant as well as by id: an invitation named from
 * another workspace's screen is one this workspace has not made, and it answers as the invitation it
 * is not rather than as somebody else's row.
 */
export async function standingInvitation(tenantId: string, invitationId: string): Promise<InvitationRow | null> {
  if (!isUuid(tenantId) || !isUuid(invitationId)) return null;
  const found = await runAsSystem(OFFER_REASON)
    .select(COLUMNS)
    .from(invitations)
    .where(
      and(
        eq(invitations.tenantId, tenantId),
        eq(invitations.invitationId, invitationId),
        isNull(invitations.consumedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .limit(1);
  return found[0] ?? null;
}

/**
 * Withdraw one standing offer and kill the token with it. Written as a conditional UPDATE rather
 * than a read and then a write, so two owners withdrawing the same invitation cannot both be told
 * they did it — the first claims the row and the second is answered as the offer it no longer is.
 */
export async function withdrawInvitation(tenantId: string, invitationId: string): Promise<InvitationRow | null> {
  if (!isUuid(tenantId) || !isUuid(invitationId)) return null;
  const withdrawn = await runAsSystem(OFFER_REASON)
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.tenantId, tenantId),
        eq(invitations.invitationId, invitationId),
        isNull(invitations.consumedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .returning(COLUMNS);
  return withdrawn[0] ?? null;
}

/**
 * A fresh token for an offer that already stands — what a resend hands the invitee. The digest is
 * replaced rather than added to: an invitation is one live link at a time, so the link a resend
 * mails is the only one that can still be spent, and a link read out of an older mail is spent as
 * far as this table is concerned.
 */
export async function reissueToken(tenantId: string, invitationId: string, tokenHash: string): Promise<InvitationRow | null> {
  if (!isUuid(tenantId) || !isUuid(invitationId)) return null;
  const reissued = await runAsSystem(OFFER_REASON)
    .update(invitations)
    .set({ tokenHash })
    .where(
      and(
        eq(invitations.tenantId, tenantId),
        eq(invitations.invitationId, invitationId),
        isNull(invitations.consumedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .returning(COLUMNS);
  return reissued[0] ?? null;
}

/**
 * The invitation a token names, whatever workspace it belongs to and whatever state it is in.
 *
 * It is deliberately unscoped by tenant: the account presenting the token holds no membership of the
 * inviting workspace yet — that is the whole point of an invitation — so there is no workspace to
 * scope the read by. What decides whether it may be spent is the claim law, not this read.
 */
export async function invitationByDigest(tokenHash: string): Promise<InvitationRow | null> {
  const found = await runAsSystem(CLAIM_REASON).select(COLUMNS).from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
  return found[0] ?? null;
}

/** The key `users.email` holds this account under, or null when the account names nobody (I-58). */
export async function accountKey(userId: string): Promise<string | null> {
  if (!isUuid(userId)) return null;
  const found = await runAsSystem(CLAIM_REASON).select({ emailKey: users.email }).from(users).where(eq(users.userId, userId)).limit(1);
  return found[0]?.emailKey ?? null;
}

/** What a workspace is called, for the screen that asks somebody to join it. */
export async function workspaceName(tenantId: string): Promise<string> {
  if (!isUuid(tenantId)) return "";
  const found = await runAsSystem(CLAIM_REASON).select({ name: tenants.name }).from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
  return found[0]?.name ?? "";
}

/**
 * Spend the invitation and grant the membership it offered, in one transaction.
 *
 * The invitation is claimed by the UPDATE's own predicate — `consumed_at` still null — so two
 * browsers racing one mailed link cannot both be granted, and the second is answered as the spent
 * offer it now is. The membership is written inside the same transaction: a token marked spent
 * without the membership it bought would be an invitation nobody can ever claim again.
 *
 * `on conflict do nothing` because a membership already held is the same end state this door was
 * asked for. It is not a second grant and it changes no role: an account that already belongs to the
 * workspace keeps the role it already holds.
 */
export async function claimInvitation(invitationId: string, userId: string): Promise<InvitationRow | null> {
  return runAsSystem(CLAIM_REASON).transaction(async (tx) => {
    const claimed = await tx
      .update(invitations)
      .set({ consumedAt: new Date() })
      .where(and(eq(invitations.invitationId, invitationId), isNull(invitations.consumedAt), isNull(invitations.revokedAt)))
      .returning(COLUMNS);
    const row = claimed[0];
    if (row === undefined) return null;
    await tx
      .insert(memberships)
      .values({ tenantId: row.tenantId, userId, workspaceRole: row.workspaceRole })
      .onConflictDoNothing();
    return row;
  });
}
