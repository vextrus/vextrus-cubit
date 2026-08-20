import { redirect } from 'next/navigation';
import { currentSession } from '../../server/session';
import { membershipsOf } from '../../server/tenant';

/**
 * The URL is the source of truth (R-UI-031), so `/` holds no state of its own —
 * it decides where you belong and sends you there. Onboarding is finished when
 * you have made a tenant, not when you have dismissed a banner (R-UI-033).
 */
export default async function HomePage() {
  const session = await currentSession();
  if (session === null) redirect('/sign-in');

  const memberships = await membershipsOf(session.user.id);
  const team = memberships.find((membership) => membership.kind === 'team');
  if (team === undefined) redirect('/create-tenant');

  redirect(`/t/${team.slug}`);
}
