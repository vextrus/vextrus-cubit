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
  desc,
  eq,
  invitations,
  isNull,
  memberships,
  runAsSystem,
  tenants,
  users,
  isUuid,
  type WorkspaceRole,
} from "@/core/db";

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
 * The offers of this workspace that still stand — neither accepted nor withdrawn — NEWEST first, and
 * settled by the invitation's own id so two made in the same instant still answer one order.
 *
 * Newest first because the offer a person has just made is the one they are looking for: the panel
 * is read straight after a submission far more often than it is read as a queue, and a list that put
 * the newest at the bottom would scroll the answer out from under them.
 */
export async function standingInvitations(tenantId: string): Promise<readonly InvitationRow[]> {
  if (!isUuid(tenantId)) return [];
  return runAsSystem(OFFER_REASON)
    .select(COLUMNS)
    .from(invitations)
    .where(and(eq(invitations.tenantId, tenantId), isNull(invitations.consumedAt), isNull(invitations.revokedAt)))
    .orderBy(desc(invitations.createdAt), desc(invitations.invitationId));
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
 * The one still-claimable invitation a token names, or none.
 *
 * It is deliberately unscoped by tenant: the account presenting the token holds no membership of the
 * inviting workspace yet — that is the whole point of an invitation — so there is no workspace to
 * scope the read by.
 *
 * `token_hash` is indexed and NOT unique (see the schema's own note), so "the row carrying this
 * digest" is a claim about the data rather than a constraint the store keeps. Taking whichever row
 * the planner reached first would spend an arbitrary one of however many carry it — in whichever
 * workspace, at whatever rank. A digest that names two live offers names neither: there is no
 * answering it without choosing for the person, so it answers nothing and the claim law refuses the
 * presented token as the offer it does not unambiguously name. Rows already spent or withdrawn are
 * not in the running at all, so a re-mailed collision resolves as soon as one of them is settled.
 */
export async function invitationByDigest(tokenHash: string): Promise<InvitationRow | null> {
  const claimable = await runAsSystem(CLAIM_REASON)
    .select(COLUMNS)
    .from(invitations)
    .where(and(eq(invitations.tokenHash, tokenHash), isNull(invitations.consumedAt), isNull(invitations.revokedAt)))
    .limit(2);
  return claimable.length === 1 ? (claimable[0] ?? null) : null;
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

/** What spending an offer actually did: the offer, whether it admitted anybody, and to what rank. */
export interface ClaimedInvitation {
  readonly invitation: InvitationRow;
  /** Whether the membership insert wrote a row — false when the account already belonged. */
  readonly membershipGranted: boolean;
  /** The role the account HOLDS in the workspace afterwards, which is not always the one offered. */
  readonly workspaceRole: WorkspaceRole;
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
 * workspace keeps the role it already holds — so what is ANSWERED is what happened rather than what
 * was offered. A caller told it now holds the offered rank while the store still holds the rank it
 * had is being told something untrue about itself, and the accept screen would show it.
 *
 * Spending the offer spends the SECRET, so every other offer still standing on the same digest is
 * withdrawn with it, in the same transaction: the digest is the whole credential a mailed link
 * carries, and a credential that has been presented and spent may not still open a second door.
 * That is also what keeps `invitationByDigest` answerable — a digest names one claimable offer or
 * none, and settling one of a collision settles it.
 */
export async function claimInvitation(invitationId: string, userId: string): Promise<ClaimedInvitation | null> {
  return runAsSystem(CLAIM_REASON).transaction(async (tx) => {
    const claimed = await tx
      .update(invitations)
      .set({ consumedAt: new Date() })
      .where(and(eq(invitations.invitationId, invitationId), isNull(invitations.consumedAt), isNull(invitations.revokedAt)))
      .returning({ ...COLUMNS, tokenHash: invitations.tokenHash });
    const claimedRow = claimed[0];
    if (claimedRow === undefined) return null;
    const { tokenHash, ...row } = claimedRow;

    // The claimed row carries `consumed_at` by now, so the same predicate that names "still
    // claimable" names exactly the OTHER offers standing on the spent digest.
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitations.tokenHash, tokenHash), isNull(invitations.consumedAt), isNull(invitations.revokedAt)));

    const granted = await tx
      .insert(memberships)
      .values({ tenantId: row.tenantId, userId, workspaceRole: row.workspaceRole })
      .onConflictDoNothing()
      .returning({ workspaceRole: memberships.workspaceRole });

    const written = granted[0];
    if (written !== undefined) return { invitation: row, membershipGranted: true, workspaceRole: written.workspaceRole };

    // The insert wrote nothing, so a membership was already there; the role it carries is the role
    // this account holds, and it is read rather than assumed to be the one the offer named.
    const standing = await tx
      .select({ workspaceRole: memberships.workspaceRole })
      .from(memberships)
      .where(and(eq(memberships.tenantId, row.tenantId), eq(memberships.userId, userId)))
      .limit(1);
    const held = standing[0];
    if (held === undefined) throw new Error("spine.tenancy: the invitation was claimed but no membership stands for the account that claimed it");
    return { invitation: row, membershipGranted: false, workspaceRole: held.workspaceRole };
  });
}
