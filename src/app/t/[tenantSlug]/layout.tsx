/**
 * The `/t/{tenantSlug}` segment's layout — the guard, and then the shell (R-UI-030).
 *
 * Every area under this segment renders inside one persistent frame, so the frame is composed
 * here once rather than by each page: a rail that keeps its collapse across a navigation, a
 * breadcrumb that follows the URL, and a top bar that does not blink between areas.
 *
 * The guard answers before any byte, and there is no `loading.tsx` beside this file or
 * anywhere below it (Design Decision Interpretation 4): a skeleton above the guard makes Next
 * answer 200 with the shell and stream the redirect after it, which hands a stranger the chrome
 * of a workspace they are about to be sent away from.
 *
 * Client-side navigation between areas does not re-run this layout's guard, which is why each
 * area page guards for itself as well — the session can end while the rail is still on screen.
 */
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '../../../ui/shell';
import { SIGN_IN_PATH, readerMemberships, tenantContext } from '../../../server/session';
import { ten } from '../strings';

export default async function TenantSegmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const memberships = await readerMemberships(context.session);

  return (
    <AppShell
      tenantName={context.name}
      slug={context.slug}
      memberships={memberships}
      accountEmail={context.session.email}
      signOutLabel={ten('tenant.signOut')}
      // Sessions is an area with no rail item, so its crumb comes from the segment's own
      // table rather than from the rail's labels (Interpretation 7).
      areaLabels={{ sessions: ten('tenant.sessions.title') }}
    >
      {children}
    </AppShell>
  );
}
