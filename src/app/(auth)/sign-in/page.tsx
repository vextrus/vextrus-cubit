/**
 * `/sign-in` — email and password (R-SPINE-001).
 *
 * §3: an expired or already-used *verification* link lands here, because this is the screen
 * that can mint a new one; the query says so and the card renders the refusal above its form.
 */
import { redirect } from 'next/navigation';
import { AuthScreen } from '../auth-screen';
import { CARD } from '../cards';
import { linkRefusal } from '../link-refusal';
import { signedInLanding } from '../../../server/session';
import { aus } from '../strings';

export const metadata = { title: aus('auth.signIn.title') };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const landing = await signedInLanding();
  if (landing !== null) redirect(landing);
  const query = await searchParams;
  const refusal = linkRefusal(query, '/sign-in');
  if (refusal.canonical !== null) redirect(refusal.canonical);
  return <AuthScreen kind={CARD.signIn} refused={refusal.refused} />;
}
