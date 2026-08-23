'use server';

/**
 * The five acts of tenant administration, as server actions (R-SPINE-003, S-Settings §3, §4).
 *
 * Each one guards for itself. A client component's call is a request like any other — the
 * session can end, the reader's role can be taken away, and the slug in the URL is whatever
 * the browser said — so every act re-derives the tenant context from the cookie rather than
 * trusting an id the page was rendered with. The seam then asks the second question, "may
 * this member administer", and answers `NOT_TENANT_ADMIN` if not.
 *
 * The answer is a value, never an exception: a refusal is something the screen renders in
 * place with its code and remedy (R-UI-020, §5), and a request that never completed is the
 * error line (§6). Both are outcomes the reader is shown, so both come back as data.
 */
import {
  inviteMember,
  removeMember,
  resendInvitation,
  revokeInvitation,
  setMemberRole,
} from '../../../../modules/spine/members';
import type { Invitation } from '../../../../modules/spine/members';
import { refusalCodeOf } from '../../../../modules/spine/members';
import type { TenantAdminCode } from '../../../../modules/spine/members';
import { tenantContext } from '../../../../server/session';

/** What an act answers with: it worked, it was refused by code, or it did not complete. */
export type ActOutcome<T = undefined> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: TenantAdminCode }
  | { readonly ok: false; readonly code: null };

/** The act's own work, given the context the guard proved. */
type Act<T> = (ctx: { tenantId: string; userId: string }) => Promise<T>;

/**
 * Guard, act, and turn whatever happened into one of the three outcomes. A refusal keeps its
 * code; anything else is the error line — a reader cannot act on a stack trace, and a code
 * nobody registered must never reach them as if it were a refusal (R-UI-020).
 */
async function perform<T>(tenantSlug: string, act: Act<T>): Promise<ActOutcome<T>> {
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out' || context === 'not-found') return { ok: false, code: null };
  try {
    return { ok: true, value: await act({ tenantId: context.tenantId, userId: context.session.userId }) };
  } catch (error: unknown) {
    return { ok: false, code: refusalCodeOf(error) };
  }
}

export async function inviteMemberAction(
  tenantSlug: string,
  email: string,
  role: string,
): Promise<ActOutcome<Invitation>> {
  return perform(tenantSlug, (ctx) => inviteMember(ctx, { email, role }));
}

export async function resendInvitationAction(
  tenantSlug: string,
  invitationId: string,
): Promise<ActOutcome<undefined>> {
  return perform(tenantSlug, async (ctx) => {
    await resendInvitation(ctx, { invitationId });
    return undefined;
  });
}

export async function revokeInvitationAction(
  tenantSlug: string,
  invitationId: string,
): Promise<ActOutcome<undefined>> {
  return perform(tenantSlug, async (ctx) => {
    await revokeInvitation(ctx, { invitationId });
    return undefined;
  });
}

export async function setMemberRoleAction(
  tenantSlug: string,
  userId: string,
  role: string,
): Promise<ActOutcome<undefined>> {
  return perform(tenantSlug, async (ctx) => {
    await setMemberRole(ctx, { userId, role });
    return undefined;
  });
}

export async function removeMemberAction(
  tenantSlug: string,
  userId: string,
): Promise<ActOutcome<undefined>> {
  return perform(tenantSlug, async (ctx) => {
    await removeMember(ctx, { userId });
    return undefined;
  });
}
