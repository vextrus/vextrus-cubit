/**
 * `/reset-password` — two phases on one route, split by the `token` query param (§4).
 *
 * *Request* (no token) asks for the address and sends a link; *Set* (`?token=`) takes the new
 * password. The reset mail's own callback lands on this route with the token, so the two
 * phases are one address a person can bookmark and one screen a journey can follow.
 *
 * A signed-in visitor is sent to their tenant only in the request phase: somebody who
 * followed a reset link while a session happened to be open still means to set a password.
 */
import { redirect } from 'next/navigation';
import { AuthScreen } from '../auth-screen';
import { CARD } from '../cards';
import { signedInLanding } from '../../../server/session';
import { aus } from '../strings';

export const metadata = { title: aus('auth.reset.title') };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = query['token'];
  const token = typeof raw === 'string' && raw !== '' ? raw : undefined;

  if (token === undefined) {
    const landing = await signedInLanding();
    if (landing !== null) redirect(landing);
    return <AuthScreen kind={CARD.resetRequest} refused={query['error'] !== undefined} />;
  }
  return <AuthScreen kind={CARD.resetSet} token={token} />;
}
