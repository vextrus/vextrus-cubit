/**
 * `/t` — where a reader who does not yet know their slug is sent (R-SPINE-002).
 *
 * The active tenant is explicit in the URL, but a browser following a verification or magic
 * link cannot know the slug at the moment it asks: the session that carries it is created by
 * the same request. So every callback lands here and this route resolves it, one redirect
 * before `/t/{tenantSlug}`.
 *
 * A link that expired arrives here too — better-auth appends `?error=` to the callback it was
 * given — and, with no session to resolve, becomes §3's refusal on `/sign-in`. A verification
 * link that was already used is the one spent link that says nothing on its way back (its
 * token is a stateless JWT, so the reply is a plain redirect to the callback); it is
 * recognised by the mark its callback carries instead.
 */
import { redirect } from 'next/navigation';
import { VERIFY_CALLBACK_PARAM, VERIFY_CALLBACK_VALUE } from '../../server/auth-policy';
import { signedInLanding } from '../../server/session';

const SIGN_IN = '/sign-in';
const REFUSED = '/sign-in?error=link-expired';

export default async function TenantEntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const landing = await signedInLanding();
  if (landing !== null) redirect(landing);
  const query = await searchParams;
  const spent =
    query['error'] !== undefined || query[VERIFY_CALLBACK_PARAM] === VERIFY_CALLBACK_VALUE;
  redirect(spent ? REFUSED : SIGN_IN);
}
