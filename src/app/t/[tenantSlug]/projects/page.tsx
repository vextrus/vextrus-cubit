/**
 * `/t/{tenantSlug}/projects` — the Projects area (docs/design/shell.md §4, R-UI-031).
 *
 * Deep-linkable by a fresh GET and reachable from the rail, which is the same thing: the URL
 * is the source of truth and this route is what it names. No projects table exists at M0, so
 * the area is its teaching empty state and nothing else (R-UI-033).
 *
 * The guard runs here as well as in the segment layout: a client-side rail navigation does not
 * re-run the layout, and a session that ended while the shell was on screen has to meet the
 * guard on the next request rather than be handed an area.
 */
import { notFound, redirect } from 'next/navigation';
import { ProjectsEmptyState } from './projects-empty';
import { ten } from '../../strings';
import { SIGN_IN_PATH, tenantContext } from '../../../../server/session';

export default async function TenantProjectsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  return (
    <div data-testid="tenant-projects">
      <h1 className="tenant-title">{ten('tenant.projects.title')}</h1>
      <div className="tenant-home-empty">
        <ProjectsEmptyState />
      </div>
    </div>
  );
}
