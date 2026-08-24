/**
 * `/t/{tenantSlug}/projects` — the Projects area (docs/design/s-home.md §4, R-UI-031).
 *
 * Deep-linkable by a fresh GET and reachable from the rail, which is the same thing: the URL is
 * the source of truth and this route is what it names. The region below is S-Home's, verbatim
 * and by the same test ids (§4); what is this route's own is the area heading and the locked
 * `tenant.projects.empty.*` copy of its empty state, whose action now leads to the create form.
 *
 * The guard runs here as well as in the segment layout: a client-side rail navigation does not
 * re-run the layout, and a session that ended while the shell was on screen has to meet the
 * guard on the next request rather than be handed an area.
 */
import { notFound, redirect } from 'next/navigation';
import { ProjectsArea } from './projects-area';
import { SIGN_IN_PATH, tenantContext } from '../../../../../server/session';

export default async function TenantProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  return <ProjectsArea context={context} searchParams={await searchParams} />;
}
