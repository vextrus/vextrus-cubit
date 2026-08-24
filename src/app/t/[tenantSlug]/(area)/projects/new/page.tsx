/**
 * `/t/{tenantSlug}/projects/new` — the create form (docs/design/s-home.md §4, §5,
 * Interpretation 2).
 *
 * The projects area, with the Dialog already open: a fresh GET renders the grid behind it and
 * the form in front of it, which is what makes the form deep-linkable without becoming a page
 * with nothing behind it. Every path to creation navigates here, and every way out of the
 * Dialog navigates back.
 */
import { notFound, redirect } from 'next/navigation';
import { CreateProjectDialog } from '../create-dialog';
import { ProjectsArea } from '../projects-area';
import { SIGN_IN_PATH, tenantContext } from '../../../../../../server/session';

export default async function NewProjectPage({
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

  return (
    <>
      <ProjectsArea context={context} searchParams={await searchParams} />
      <CreateProjectDialog tenantSlug={context.slug} />
    </>
  );
}
