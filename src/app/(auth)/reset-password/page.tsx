/**
 * `/reset-password` — two phases on one route, split by the `token` query param (§4).
 *
 * *Request* (no token) asks for the address and sends a link; *Set* (`?token=`) takes the new
 * password. The reset mail's own callback lands on this route with the token, so the two
 * phases are one address a person can bookmark and one screen a journey can follow.
 *
 * §1's redirect applies to both phases: "a signed-in visitor to any of the four screens is
 * redirected to /t/{activeTenantSlug}", and both phases are on one of the four. The argument
 * for exempting the set-password phase — somebody who followed a reset link while a session
 * happened to be open still means to set a password — is a reasonable one, but it is an
 * argument against a committed Design Decision rather than a reading of it, and CLAUDE.md
 * grades a deviation as a defect whatever its reasoning. A reader in that position signs out
 * and opens the link again; the token is not spent by the redirect, so it is still there.
 */
import { redirect } from 'next/navigation';
import { AuthScreen } from '../auth-screen';
import { CARD } from '../cards';
import { linkRefusal } from '../link-refusal';
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

  const landing = await signedInLanding();
  if (landing !== null) redirect(landing);

  if (token === undefined) {
    const refusal = linkRefusal(query, '/reset-password');
    if (refusal.canonical !== null) redirect(refusal.canonical);
    return <AuthScreen kind={CARD.resetRequest} refused={refusal.refused} />;
  }
  return <AuthScreen kind={CARD.resetSet} token={token} />;
}
