/**
 * The signed-in frame, composed once and rendered by the two segment layouts that need it
 * (R-UI-030, docs/design/shell.md §1–§5).
 *
 * There are two because the chrome differs: the areas under `/t/{slug}` are the rail's own
 * three plus the session list, while `/t/{slug}/p/{projectId}/…` opens a project, and
 * docs/design/s-project-settings-… Interpretation 5 makes the breadcrumb, the rail mark and
 * the project switcher say so. A layout is handed the dynamic params of the segments *above*
 * it and no deeper, so a single layout at `/t/{tenantSlug}` cannot know which project is open;
 * the project's own layout can, and passes it here. Route groups keep both URLs exactly where
 * R-UI-031 fixed them.
 */
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '../../../ui/shell';
import type { OpenProject } from '../../../ui/shell';
import { SIGN_IN_PATH, readerMemberships, tenantContext } from '../../../server/session';
import { ten } from '../strings';

export interface TenantFrameProps {
  readonly tenantSlug: string;
  /** The project the URL names, when it names one (Interpretation 5). */
  readonly project?: OpenProject | undefined;
  /** URL tail → crumb, for the panes a project route ends on. */
  readonly paneLabels?: Readonly<Record<string, string>> | undefined;
  readonly children: ReactNode;
}

export async function TenantFrame({
  tenantSlug,
  project,
  paneLabels,
  children,
}: TenantFrameProps) {
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
      project={project}
      paneLabels={paneLabels}
      // Sessions is an area with no rail item, so its crumb comes from the segment's own
      // table rather than from the rail's labels (shell.md Interpretation 7).
      areaLabels={{ sessions: ten('tenant.sessions.title') }}
    >
      {children}
    </AppShell>
  );
}
