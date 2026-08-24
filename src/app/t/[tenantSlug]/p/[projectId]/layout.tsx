/**
 * The `/t/{tenantSlug}/p/{projectId}` segment's layout — the shell, with a project open
 * (docs/design/s-project-settings-… Interpretation 5).
 *
 * Everything the chrome says differently on a project route is decided here, because this is
 * the first layout that knows which project the URL names: the breadcrumb's middle crumb, the
 * pane label it ends on, and the project switcher's trigger. `rail-nav-projects` stays the
 * marked item — a project is where the Projects area leads — and the shell derives that from
 * the URL alone.
 *
 * Interpretation 6: a project of another workspace is not a row the tenant-scoped read can
 * see, so it answers `null` and this layout 404s — the same answer an unknown project id gets,
 * which is what keeps the URL from telling a stranger which ids exist (Q-12).
 */
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { TenantFrame } from '../../tenant-frame';
import { ten } from '../../../strings';
import { projectContext, readProject } from '../../../../../modules/spine/projects';
import { SIGN_IN_PATH, tenantContext } from '../../../../../server/session';

export default async function ProjectSegmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const ctx = projectContext({ tenantId: context.tenantId, userId: context.session.userId });
  const project = await readProject(ctx, { projectId });
  if (project === null) notFound();

  return (
    <TenantFrame
      tenantSlug={tenantSlug}
      project={{
        name: project.name,
        href: `/t/${context.slug}/p/${project.id}/settings/project`,
      }}
      paneLabels={{
        project: ten('project.settings.nav.project'),
        participants: ten('project.settings.nav.participants'),
        ruleset: ten('project.settings.nav.ruleset'),
      }}
    >
      {children}
    </TenantFrame>
  );
}
