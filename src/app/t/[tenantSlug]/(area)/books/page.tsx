/**
 * `/t/{tenantSlug}/books` — the Books area (docs/design/shell.md §4).
 *
 * A book prices a project's measured work, so with no projects there is nothing to price and
 * the next action is one area to the left: the empty state says so and takes the reader there
 * (R-UI-033). Guarded here as well as in the layout, for the reason the Projects area states.
 */
import { notFound, redirect } from 'next/navigation';
import { AreaEmptyState } from '../area-empty-state';
import { ten } from '../../../strings';
import { SIGN_IN_PATH, tenantContext } from '../../../../../server/session';
import { RAIL_AREAS, tenantPath } from '../../../../../ui/shell';

export default async function TenantBooksPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  return (
    <div data-testid="tenant-books">
      <h1 className="tenant-title">{ten('tenant.books.title')}</h1>
      <div className="tenant-home-empty">
        <AreaEmptyState
          title={ten('tenant.books.empty.title')}
          teach={ten('tenant.books.empty.teach')}
          actionLabel={ten('tenant.books.empty.action')}
          href={tenantPath(context.slug, RAIL_AREAS[0])}
        />
      </div>
    </div>
  );
}
