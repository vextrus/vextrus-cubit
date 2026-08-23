/**
 * `/magic-link` — a sign-in link, sent to an address (R-SPINE-001).
 *
 * The answer is the same whether or not the account exists, and an address with no account
 * mints nothing: §4, and better-auth's `disableSignUp`. §3: a spent link comes back here.
 */
import { redirect } from 'next/navigation';
import { AuthScreen, CARD } from '../auth-screen';
import { signedInLanding } from '../../../server/session';
import { aus } from '../strings';

export const metadata = { title: aus('auth.magic.title') };

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const landing = await signedInLanding();
  if (landing !== null) redirect(landing);
  const query = await searchParams;
  return <AuthScreen kind={CARD.magic} refused={query['error'] !== undefined} />;
}
