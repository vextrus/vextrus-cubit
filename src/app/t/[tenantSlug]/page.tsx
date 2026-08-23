/**
 * `/t/{tenantSlug}` — the signed-in landing (S-Auth §6, R-SPINE-002).
 *
 * Guard first, before any byte: no session is a 3xx to `/sign-in`, a slug this reader holds
 * no membership in is a 404, and only a member gets the page. The slug is under the h1 in
 * mono because it is the identifier the URL speaks, and the one real next action at M0 is the
 * session list — the projects R-UI-033 teaches arrive with the project screens.
 */
import { notFound, redirect } from 'next/navigation';
import { TenantBar } from '../tenant-bar';
import { NavEmptyState } from '../nav-empty-state';
import { ten } from '../strings';
import { SIGN_IN_PATH, tenantContext } from '../../../server/session';

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  return (
    <div className="tenant-shell">
      <TenantBar tenantName={context.name} slug={context.slug} />
      <main className="tenant-main" data-testid="tenant-home">
        <h1 className="tenant-title">{context.name}</h1>
        <p className="tenant-slug">{context.slug}</p>
        <div className="tenant-home-empty">
          <NavEmptyState
            title={ten('tenant.home.empty.title')}
            teach={ten('tenant.home.empty.teach')}
            actionLabel={ten('tenant.home.empty.action')}
            href={`/t/${context.slug}/sessions`}
          />
        </div>
      </main>
    </div>
  );
}
