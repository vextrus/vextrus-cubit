/**
 * `/sign-up` — create an account, and with it a personal tenant (R-SPINE-001, R-SPINE-002).
 *
 * A signed-in visitor has no business here: §1 sends them to the tenant they are already in.
 */
import { redirect } from 'next/navigation';
import { AuthScreen } from '../auth-screen';
import { CARD } from '../cards';
import { signedInLanding } from '../../../server/session';
import { aus } from '../strings';

export const metadata = { title: aus('auth.signUp.title') };

export default async function SignUpPage() {
  const landing = await signedInLanding();
  if (landing !== null) redirect(landing);
  return <AuthScreen kind={CARD.signUp} />;
}
