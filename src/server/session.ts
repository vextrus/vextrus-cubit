/**
 * The guard every screen asks the same question of (R-SPINE-002, S-Auth §6, Q-12).
 *
 * "Guard first, before any byte" is the Design Decision's rule, and it is why there is no
 * `loading.tsx` anywhere under `/t`: a skeleton above a guard makes Next answer 200 with a
 * shell and stream the redirect after it, which hands a page's chrome to somebody who was
 * about to be sent away.
 *
 * The 404 a non-member meets is deliberate (Interpretation 4): naming the permission and its
 * holder would confirm to a stranger that the tenant exists, which is exactly the enumeration
 * Q-12 forbids. A slug nobody holds and a slug this reader does not hold answer identically.
 */
import { headers } from 'next/headers';
import { runAsSystem } from '../core/db';
import { auth } from './auth';
import { activeTenantSlugFor, membershipOf, membershipsFor } from './tenancy';

/** Where a signed-in reader belongs, and where `/t` sends them. */
export const TENANT_ENTRY_PATH = '/t';

/** The card screens' way out when somebody who is already signed in opens one. */
export const SIGN_IN_PATH = '/sign-in';

export interface SignedIn {
  readonly userId: string;
  readonly sessionToken: string;
  readonly activeTenantSlug: string | null;
  /** The address the account signs in with — the shell's user slot shows it (shell.md §3). */
  readonly email: string;
}

/** The session behind this request, or null. Reads the request's own cookies, so it is dynamic. */
export async function currentSession(): Promise<SignedIn | null> {
  const found = await auth.api.getSession({ headers: await headers() });
  if (found === null) return null;
  const carried = (found.session as { activeTenantSlug?: string | null }).activeTenantSlug;
  return {
    userId: found.user.id,
    sessionToken: found.session.token,
    activeTenantSlug: carried ?? null,
    email: found.user.email,
  };
}

/**
 * The workspaces this reader may switch to (R-UI-030's tenant switcher).
 *
 * It is a read of the reader's own memberships across tenants — the same question
 * `signedInLanding` asks — so it runs as the system, like the guard beside it.
 */
export async function readerMemberships(
  session: SignedIn,
): Promise<readonly { slug: string; name: string }[]> {
  return await membershipsFor(
    runAsSystem('the tenant switcher lists one reader’s memberships across tenants'),
    session.userId,
  );
}

/**
 * `/t/{slug}` for a signed-in reader, or null for everybody else — what the four public
 * screens use to send somebody who is already in (§1's "redirected (303)").
 */
export async function signedInLanding(): Promise<string | null> {
  const session = await currentSession();
  if (session === null) return null;
  const slug =
    session.activeTenantSlug ??
    (await activeTenantSlugFor(runAsSystem('the reader’s own memberships'), session.userId));
  return slug === null ? null : `${TENANT_ENTRY_PATH}/${slug}`;
}

export interface TenantContext {
  readonly session: SignedIn;
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
}

/**
 * The `/t/{tenantSlug}` guard's whole answer: `'signed-out'` for no session, `'not-found'`
 * for a slug this reader does not hold (or that nobody holds), and the tenant otherwise.
 */
export async function tenantContext(slug: string): Promise<TenantContext | 'signed-out' | 'not-found'> {
  const session = await currentSession();
  if (session === null) return 'signed-out';
  const tenant = await membershipOf(
    runAsSystem('the /t guard reads one reader’s membership across tenants'),
    session.userId,
    slug,
  );
  if (tenant === null) return 'not-found';
  return { session, tenantId: tenant.tenantId, name: tenant.name, slug: tenant.slug };
}
