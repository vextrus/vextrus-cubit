import { redirect } from 'next/navigation';
import { currentSession } from '../../../server/session';
import { membershipsOf } from '../../../server/tenant';
import { CreateTenantForm } from './form';

/** R-UI-033 — first sign-in lands here: name a tenant, or step into your personal one. */
export default async function CreateTenantPage() {
  const session = await currentSession();
  if (session === null) redirect('/sign-in');

  const memberships = await membershipsOf(session.user.id);
  const personal = memberships.find((membership) => membership.kind === 'personal') ?? memberships[0];
  if (personal === undefined) redirect('/sign-in');

  return <CreateTenantForm personalSlug={personal.slug} />;
}
