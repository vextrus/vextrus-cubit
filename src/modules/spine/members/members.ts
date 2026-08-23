/**
 * The members list, role management and removal (R-SPINE-003).
 *
 * Two handles, both SEAM-TENANT's: the memberships, the acts and the invitations are one
 * tenant's rows and travel on `forTenant`, while the addresses behind them are `users` rows,
 * which carry no tenant at all (R-SPINE-002) and have only the system arm of a policy. So the
 * join is done here, in the module, rather than in SQL across two scopes — the same shape
 * `src/server/session.ts` uses for the guard's own read, with the reason stated in the call.
 *
 * Removal's refusal is the clause itself: "remove member (refused while the member holds acts
 * on open campaigns: `MEMBER_HAS_ACTS`)". At M0 nothing can close a campaign, so an act on an
 * open campaign is an act whose `campaign_ref` is set (docs/design/s-settings.md
 * Interpretation 7); the read below is that predicate and a later campaign-bearing increment
 * refines it here.
 */
import { runAsSystem } from '../../../core/db';
import { assertAdmin, scopedTo } from './access';
import type { AdminContext } from './access';
import { operators } from './operators';
import { refused } from './refusals';
import { roleCode, roleName } from './roles';
import type { TenantRole } from './roles';

/** One membership, as a caller and the screen read it. */
export interface TenantMember {
  readonly userId: string;
  readonly email: string;
  readonly role: TenantRole;
}

/**
 * Every membership in the tenant with its role, membership `createdAt` ascending — so the
 * founder reads first and the list never reshuffles under the reader (design §2).
 */
export async function listMembers(ctx: AdminContext): Promise<readonly TenantMember[]> {
  const memberships = await scopedTo(ctx).query.tenantMemberships.findMany({
    columns: { userId: true, role: true },
    orderBy: (row, { asc }) => [asc(row.createdAt)],
  });
  if (memberships.length === 0) return [];

  const people = await runAsSystem(
    'the members list joins each membership to the address it is about',
  ).query.users.findMany({
    columns: { id: true, email: true },
    where: (row, { inArray }) =>
      inArray(
        row.id,
        memberships.map((membership) => membership.userId),
      ),
  });
  const byId = new Map(people.map((person) => [person.id, person.email]));

  // Joined in the memberships' order rather than the users': the read above is what fixes
  // which member is first, and a database is free to return the rows of an `in` any way.
  return memberships.flatMap((membership) => {
    const email = byId.get(membership.userId);
    return email === undefined
      ? []
      : [{ userId: membership.userId, email, role: roleCode(membership.role) }];
  });
}

/** Move a member to another role in the closed set. */
export async function setMemberRole(
  ctx: AdminContext,
  args: { readonly userId: string; readonly role: string },
): Promise<void> {
  await assertAdmin(ctx);
  const db = scopedTo(ctx);
  const { and, eq } = operators(db);
  const memberships = db._.fullSchema.tenantMemberships;
  await db
    .update(memberships)
    .set({ role: roleName(args.role) })
    .where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.userId, args.userId)));
}

/**
 * Remove a member, unless they hold an act on an open campaign — in which case nothing is
 * written at all: the predicate is read before the delete, so a refusal leaves the membership
 * and the ledger exactly as they were, and the row stays listed (R-UI-050's partial rule).
 */
export async function removeMember(
  ctx: AdminContext,
  args: { readonly userId: string },
): Promise<void> {
  await assertAdmin(ctx);
  const db = scopedTo(ctx);

  const held = await db.query.acts.findFirst({
    columns: { id: true },
    where: (row, { and, eq, isNotNull }) =>
      and(eq(row.actorId, args.userId), isNotNull(row.campaignRef)),
  });
  if (held !== undefined) throw refused('MEMBER_HAS_ACTS');

  const { and, eq } = operators(db);
  const memberships = db._.fullSchema.tenantMemberships;
  await db
    .delete(memberships)
    .where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.userId, args.userId)));
}
