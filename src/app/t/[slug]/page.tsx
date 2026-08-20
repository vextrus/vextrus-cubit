import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { currentSession } from '../../../server/session';
import { resolveTenant, roleIn } from '../../../server/tenant';
import { RefusalState } from '../../../ui/patterns/refusal-state';
import { LoadingSkeleton } from '../../../ui/primitives/screen-state';
import { strings } from '../../../ui/strings/tenant';

/**
 * R-SPINE-002 / D-01 — the active tenant is explicit in the URL. `/t/{slug}` is
 * live; `/t/{slug}/p/{code}` is reserved for the increment that brings projects.
 *
 * A tenant you do not belong to is refused in place with its code and remedy, not
 * redirected away and not silently rendered empty (R-UI-020, R-UI-050).
 *
 * Who is asking is settled before the response starts, so a caller with no
 * session gets a 307 rather than a streamed shell of a tenant's home; the
 * skeleton (R-UI-050) covers the tenant lookup below the check, which is why
 * this route has no `loading.tsx`.
 */
export default async function TenantHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await currentSession();
  if (session === null) redirect('/sign-in');

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <TenantHome slug={slug} userId={session.user.id} />
    </Suspense>
  );
}

async function TenantHome({ slug, userId }: { slug: string; userId: string }) {
  const tenant = await resolveTenant(slug);
  const role = tenant === null ? null : await roleIn(tenant.tenantId, userId);

  if (tenant === null || role === null) {
    return (
      <div className="page">
        <section className="panel">
          <h1>{strings.homeTitle}</h1>
          <RefusalState
            code="TENANT_ACCESS_DENIED"
            remedyHref="/create-tenant"
            remedyLabel={strings.createSubmit}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="panel" data-testid="tenant-home">
        <div className="auth-heading">
          <h1>{tenant.name}</h1>
          <p className="auth-lede">{strings.homeSlugLabel}</p>
          <p className="slug" data-testid="tenant-slug">
            {tenant.slug}
          </p>
        </div>

        <div className="empty">
          <span className="row-title">{strings.homeEmptyTitle}</span>
          <span>{strings.homeEmptyLede}</span>
          <span>{strings.homeEmptyAction}</span>
        </div>

        <p className="auth-footer">
          <a className="link" href="/account/sessions">
            {strings.homeSessions}
          </a>
        </p>
      </section>
    </div>
  );
}
