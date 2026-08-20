import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { currentSession } from '../../../server/session';
import { membershipsOf } from '../../../server/tenant';
import { LoadingSkeleton } from '../../../ui/primitives/screen-state';
import { CreateTenantForm } from './form';

/**
 * R-UI-033 — first sign-in lands here: name a tenant, or step into your personal
 * one. The session decides before the response starts (no `loading.tsx` above
 * the check), and the skeleton covers the membership read below it (R-UI-050).
 */
export default async function CreateTenantPage() {
  const session = await currentSession();
  if (session === null) redirect('/sign-in');

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CreateTenant userId={session.user.id} />
    </Suspense>
  );
}

async function CreateTenant({ userId }: { userId: string }) {
  const memberships = await membershipsOf(userId);
  const personal = memberships.find((membership) => membership.kind === 'personal') ?? memberships[0];
  if (personal === undefined) redirect('/sign-in');

  return <CreateTenantForm personalSlug={personal.slug} />;
}
