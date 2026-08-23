/**
 * `/t` — where a reader who does not yet know their slug is sent (R-SPINE-002).
 *
 * The active tenant is explicit in the URL, but a browser following a verification or magic
 * link cannot know the slug at the moment it asks: the session that carries it is created by
 * the same request. So every callback lands here and this route resolves it, one redirect
 * before `/t/{tenantSlug}`.
 *
 * A link that expired arrives here too — better-auth appends `?error=` to the callback it was
 * given — and, with no session to resolve, becomes §3's refusal on `/sign-in`.
 */
import { redirect } from 'next/navigation';
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
  redirect(query['error'] === undefined ? SIGN_IN : REFUSED);
}
