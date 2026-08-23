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
import { assertAdminOn, scopedTo } from './access';
import type { AdminContext } from './access';
import { operators } from './operators';
import { refused } from './refusals';
import { mayAssign, roleCode, roleName } from './roles';
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

/**
 * Move a member to another role in the closed set.
 *
 * The membership is read before it is written, in the transaction that writes it: an UPDATE
 * matching no row resolves as happily as one that changed something, and the screen would
 * announce a change that never happened to a member another administrator had just removed.
 *
 * `expectedRole` is the caller saying which role they were shown — L-ACT-02's carried
 * Consequence, when the caller is the act pair. Reading the role and then writing it are two
 * statements, so a check made before the UPDATE decides nothing: the guard is the UPDATE's own
 * `where`, which Postgres re-evaluates against the row it locked, so a role another
 * administrator moved in between matches nothing and this call writes nothing. Callers with no
 * Consequence to carry (the settings screen's server action) omit it and the write is
 * unconditional, exactly as before.
 */
export async function setMemberRole(
  ctx: AdminContext,
  args: { readonly userId: string; readonly role: string; readonly expectedRole?: string },
): Promise<void> {
  const role = roleName(args.role);
  const expected = args.expectedRole === undefined ? undefined : roleName(args.expectedRole);
  const db = scopedTo(ctx);
  const { and, eq } = operators(db);
  const memberships = db._.fullSchema.tenantMemberships;

  await db.transaction(async (tx) => {
    const actor = await assertAdminOn(tx, ctx);
    if (!mayAssign(actor, role)) throw refused('NOT_TENANT_ADMIN');

    const held = await tx.query.tenantMemberships.findFirst({
      columns: { userId: true },
      where: (row, { eq: is }) => is(row.userId, args.userId),
    });
    if (held === undefined) {
      throw new Error(`no membership in this tenant holds the user ${args.userId}`);
    }

    const moved = await tx
      .update(memberships)
      .set({ role })
      .where(
        and(
          eq(memberships.tenantId, ctx.tenantId),
          eq(memberships.userId, args.userId),
          expected === undefined ? undefined : eq(memberships.role, expected),
        ),
      )
      .returning({ userId: memberships.userId });

    // The row is there — the read above found it — so nothing matching means the guard did:
    // the role is no longer the one the caller carried in.
    if (expected !== undefined && moved.length === 0) {
      throw new Error(`the membership of ${args.userId} no longer holds "${expected}"`);
    }
  });
}

/**
 * Remove a member, unless they hold an act on an open campaign — in which case nothing is
 * written at all: the predicate is read before the delete, so a refusal leaves the membership
 * and the ledger exactly as they were, and the row stays listed (R-UI-050's partial rule).
 *
 * Guard, predicate and delete share one transaction, because on separate handles they are
 * separate transactions on separate connections: an act written for this member between the
 * predicate and the delete would go unseen and the membership would go anyway — exactly what
 * `MEMBER_HAS_ACTS` exists to prevent.
 */
export async function removeMember(
  ctx: AdminContext,
  args: { readonly userId: string },
): Promise<void> {
  const db = scopedTo(ctx);
  const { and, eq } = operators(db);
  const memberships = db._.fullSchema.tenantMemberships;

  await db.transaction(async (tx) => {
    await assertAdminOn(tx, ctx);

    const held = await tx.query.acts.findFirst({
      columns: { id: true },
      where: (row, { and: both, eq: is, isNotNull }) =>
        both(is(row.actorId, args.userId), isNotNull(row.campaignRef)),
    });
    if (held !== undefined) throw refused('MEMBER_HAS_ACTS');

    await tx
      .delete(memberships)
      .where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.userId, args.userId)));
  });
}
