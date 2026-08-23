/**
 * `/t/{tenantSlug}/settings` — tenant administration (R-SPINE-003, S-Settings, J-002).
 *
 * The tenant slice of S-Settings: the members list with role management, the invite-by-email
 * form and the pending invitations with resend and revoke, decided in
 * docs/design/s-settings.md. Books, templates and every Project-side pane are later
 * increments.
 *
 * Nothing streams (§6): there is no `loading.tsx` anywhere under `/t`, the guard answers
 * before any byte, and the two lists are read here on the server — which is what makes a
 * changed role survive a reload without the screen holding anything of its own.
 *
 * A MEMBER meets the permission-denied state (Interpretation 1): they hold a membership, so
 * the guard lets them in and the area names the permission they lack rather than pretending
 * the workspace is not there. A non-member still meets the 404, upstream.
 */
import { notFound, redirect } from 'next/navigation';
import './settings.css';
import { TenantAdmin } from './tenant-admin';
import type { InvitationView, MemberView } from './tenant-admin';
import { ten } from '../../strings';
import { administers, listInvitations, listMembers } from '../../../../modules/spine/members';
import { SIGN_IN_PATH, tenantContext } from '../../../../server/session';
import { tenantPath } from '../../../../ui/shell';

/** Where the invitations empty state's action goes — the one thing a reader manages today. */
const SESSIONS_SEGMENT = 'sessions';

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const ctx = { tenantId: context.tenantId, userId: context.session.userId };
  const mayManage = await administers(ctx);

  const members: readonly MemberView[] = mayManage
    ? (await listMembers(ctx)).map((member) => ({
        userId: member.userId,
        email: member.email,
        role: member.role,
        current: member.userId === context.session.userId,
      }))
    : [];
  const invitations: readonly InvitationView[] = mayManage
    ? (await listInvitations(ctx)).map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        createdAt: invitation.createdAt,
      }))
    : [];

  return (
    <div data-testid="tenant-settings">
      <h1 className="tenant-title">{ten('tenant.settings.title')}</h1>
      <p className="tenant-lead">{ten('tenant.settings.lead')}</p>
      <TenantAdmin
        mayManage={mayManage}
        tenantSlug={context.slug}
        sessionsHref={tenantPath(context.slug, SESSIONS_SEGMENT)}
        members={members}
        invitations={invitations}
      />
    </div>
  );
}
