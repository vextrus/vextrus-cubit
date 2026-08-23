/**
 * The invitation lifecycle (R-SPINE-003: "invite by email (pending invitations, resend,
 * revoke)").
 *
 * Revoking keeps the row (docs/design/s-settings.md Interpretation 5): the status leaves
 * `pending` and the invitation leaves the list, but history is not deleted — which is why the
 * app role holds UPDATE on this table and not DELETE. Resending sends the *same* invitation
 * again: a further row in the outbox, not a second invitation.
 *
 * Accepting an invitation — linking the invited address to a membership — is a later
 * increment; today the invited person creates an account with the invited address.
 */
import { assertAdmin, scopedTo } from './access';
import type { AdminContext } from './access';
import { sendInvitationMail } from './mail';
import { operators } from './operators';
import { refused } from './refusals';
import { mayAssign, roleCode, roleName } from './roles';
import type { TenantRole } from './roles';

/** The one status the screen lists, and the one either act may be performed on. */
const PENDING = 'pending';

/** Where a revoked invitation goes. The row stays; it is no longer awaiting an answer. */
const REVOKED = 'revoked';

/** One invitation, as a caller and the screen read it. */
export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly role: TenantRole;
  readonly status: string;
  /** When it was sent, as an ISO instant — the row renders it in the reader's own zone (§4). */
  readonly createdAt: string;
}

interface StoredInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly createdAt: Date;
}

function shape(row: StoredInvitation): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: roleCode(row.role),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The pending invitations, `createdAt` ascending, so a new one lands last (design §4). */
export async function listInvitations(ctx: AdminContext): Promise<readonly Invitation[]> {
  const rows = await scopedTo(ctx).query.invitations.findMany({
    columns: { id: true, email: true, role: true, status: true, createdAt: true },
    where: (row, { eq }) => eq(row.status, PENDING),
    orderBy: (row, { asc }) => [asc(row.createdAt)],
  });
  return rows.map(shape);
}

/** The pending invitation this act is about, or the refusal that it is not pending. */
async function pendingInvitation(ctx: AdminContext, invitationId: string): Promise<Invitation> {
  const row = await scopedTo(ctx).query.invitations.findFirst({
    columns: { id: true, email: true, role: true, status: true, createdAt: true },
    where: (candidate, { eq }) => eq(candidate.id, invitationId),
  });
  if (row === undefined || row.status !== PENDING) throw refused('INVITATION_NOT_PENDING');
  return shape(row);
}

/** Invite an address, and land its mail in the outbox. */
export async function inviteMember(
  ctx: AdminContext,
  args: { readonly email: string; readonly role: string },
): Promise<Invitation> {
  const role = roleName(args.role);
  // The same rule the role control obeys: OWNER is the owner's to give (`mayAssign`), and an
  // invitation is how a role is handed out to someone who is not here yet.
  const actor = await assertAdmin(ctx);
  if (!mayAssign(actor, role)) throw refused('NOT_TENANT_ADMIN');
  const db = scopedTo(ctx);
  const table = db._.fullSchema.invitations;

  const [written] = await db
    .insert(table)
    .values({
      tenantId: ctx.tenantId,
      email: args.email.trim().toLowerCase(),
      role,
      invitedBy: ctx.userId,
      status: PENDING,
    })
    .returning({
      id: table.id,
      email: table.email,
      role: table.role,
      status: table.status,
      createdAt: table.createdAt,
    });
  if (written === undefined) throw new Error('the invitation was not written');

  const invitation = shape(written);
  await sendInvitationMail(ctx, invitation);
  return invitation;
}

/** Send the same invitation again — a further mail, and no second invitation. */
export async function resendInvitation(
  ctx: AdminContext,
  args: { readonly invitationId: string },
): Promise<Invitation> {
  await assertAdmin(ctx);
  const invitation = await pendingInvitation(ctx, args.invitationId);
  await sendInvitationMail(ctx, invitation);
  return invitation;
}

/** Take an invitation out of the pending list, keeping the row it was (Interpretation 5). */
export async function revokeInvitation(
  ctx: AdminContext,
  args: { readonly invitationId: string },
): Promise<Invitation> {
  await assertAdmin(ctx);
  const invitation = await pendingInvitation(ctx, args.invitationId);

  const db = scopedTo(ctx);
  const { and, eq } = operators(db);
  const table = db._.fullSchema.invitations;
  await db
    .update(table)
    .set({ status: REVOKED })
    .where(and(eq(table.tenantId, ctx.tenantId), eq(table.id, invitation.id)));

  return { ...invitation, status: REVOKED };
}
