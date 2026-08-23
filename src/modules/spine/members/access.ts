/**
 * Who is acting, and whether they may (P-ADMIN, R-SPINE-003).
 *
 * Every exported function of this module takes the same first argument: the tenant whose rows
 * are in question and the member asking for them. That pair is what a SEAM-TENANT handle is
 * taken for — the scope, and the person the scope is on behalf of — and it is why a MEMBER's
 * write can be refused at the seam rather than only in the screen that offered them the
 * button (docs/design/s-settings.md Interpretation 1).
 *
 * Reads are not guarded here: viewing requires a membership, the guard above already proved
 * one, and the screen renders the permission-denied state for a MEMBER (§6). What the seam
 * refuses is the writes.
 */
import { forTenant } from '../../../core/db';
import type { ScopedDb } from '../../../core/db';
import { refused } from './refusals';
import { ADMIN_ROLE_NAMES } from './roles';
import type { TenantRoleName } from './roles';

/** The tenant whose administration this is, and the member administering it. */
export interface AdminContext {
  readonly tenantId: string;
  readonly userId: string;
}

/** The handle every row of this module travels on. */
export function scopedTo(ctx: AdminContext): ScopedDb {
  return forTenant({ tenantId: ctx.tenantId });
}

/** The acting member's role in this tenant, or null when they hold no membership in it. */
export async function actingRole(ctx: AdminContext): Promise<TenantRoleName | null> {
  const membership = await scopedTo(ctx).query.tenantMemberships.findFirst({
    columns: { role: true },
    where: (row, { eq }) => eq(row.userId, ctx.userId),
  });
  return membership === undefined ? null : (membership.role as TenantRoleName);
}

/** Whether this member administers the tenant — what the screen asks before it renders. */
export async function administers(ctx: AdminContext): Promise<boolean> {
  const role = await actingRole(ctx);
  return role !== null && ADMIN_ROLE_NAMES.includes(role);
}

/** The same question, as the seam answers it before a write: `NOT_TENANT_ADMIN` or nothing. */
export async function assertAdmin(ctx: AdminContext): Promise<void> {
  if (!(await administers(ctx))) throw refused('NOT_TENANT_ADMIN');
}
