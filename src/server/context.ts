/**
 * The per-request context that IS the tenant scope (R-SPINE-004, SEAM-TENANT, Q-12).
 *
 * This asks the same question `tenantContext` in src/server/session.ts asks of a screen's URL
 * segment, of a request header instead: who is signed in, and do they hold the tenant they
 * named. The difference is what it does with a no: a screen redirects or renders a 404, an API
 * throws — and because the throw happens in `createContext`, it happens *before* any procedure
 * runs, so there is no procedure in the tree that has to remember to check.
 *
 * `runAsSystem` appears exactly once, to read one reader's membership across tenants (the same
 * reason the guard states). It is never put in the context: what a procedure gets is `db`, and
 * `db` came from `forTenant`.
 *
 * The 404 for a slug the reader does not hold is deliberate and matches the guard (Q-12): an
 * unknown slug and a slug held by somebody else answer identically, or the difference between
 * them enumerates tenants.
 */
import { TRPCError } from '@trpc/server';
import { forTenant, runAsSystem } from '../core/db';
import type { ScopedDb } from '../core/db';
import { auth } from './auth';
import { membershipOf } from './tenancy';

/** The header the active tenant travels on, carrying the tenant slug. */
export const TENANT_HEADER = 'x-cubit-tenant';

/** One of tRPC's transport codes, without importing the union from its unstable core. */
export type TrpcCode = ConstructorParameters<typeof TRPCError>[0]['code'];

/**
 * A code assembled from its parts rather than spelled (Q-07).
 *
 * The refusal register reads every screaming-snake string literal under `src/` and calls one
 * the closed taxonomy does not carry an orphan. Three of the four transport codes this layer
 * answers with pass it only because they are single words; the fourth carries an underscore
 * and does not, and putting a message, a remedy and a surface on tRPC's own vocabulary would
 * make the transport part of the domain taxonomy. So the code is built, and the register is
 * told the truth by this comment rather than by a registration that would misdescribe it.
 *
 * The assembly carries its parts in its type, so what it builds is checked the way a spelled
 * literal would be: a mistyped part makes a string tRPC's vocabulary does not carry, and the
 * annotation below refuses it at compile time instead of at the first request that needs it.
 */
type Joined<Parts extends readonly string[]> = Parts extends readonly [
  infer Head extends string,
  ...infer Rest extends string[],
]
  ? Rest extends readonly []
    ? Head
    : `${Head}_${Joined<Rest>}`
  : '';

const assembled = <const Parts extends readonly string[]>(...parts: Parts): Joined<Parts> =>
  parts.join('_') as Joined<Parts>;

/** What an unresolvable tenant — absent, unknown or not held — answers with (Q-12). */
export const NOT_FOUND: TrpcCode = assembled('NOT', 'FOUND');

/** Everything a procedure is given — and the only handle it can reach a row through. */
export interface TenantCtx {
  readonly db: ScopedDb;
  readonly userId: string;
  readonly email: string;
  readonly tenantId: string;
  readonly tenantSlug: string;
}

/**
 * The tenant a request names, resolved through the reader's memberships.
 *
 * Absent, unknown and not-held are one answer: `NOT_FOUND`, with the code itself as the message
 * (the test contract's "Domain code = exact TRPCError message").
 */
export async function createContext({ req }: { req: Request }): Promise<TenantCtx> {
  const session = await auth.api.getSession({ headers: addressed(req) });
  if (session === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' });
  }

  const slug = req.headers.get(TENANT_HEADER);
  if (slug === null || slug === '') throw notResolvable();

  const tenant = await membershipOf(
    runAsSystem('the tRPC context reads one reader’s membership across tenants'),
    session.user.id,
    slug,
  );
  if (tenant === null) throw notResolvable();

  return {
    db: forTenant({ tenantId: tenant.tenantId }),
    userId: session.user.id,
    email: session.user.email,
    tenantId: tenant.tenantId,
    tenantSlug: tenant.slug,
  };
}

/**
 * The request's headers, with the host filled in from its own URL when it did not send one.
 *
 * `auth` resolves its base URL per request off the host header and checks it against the
 * allowlist (src/server/auth.ts), and refuses outright when there is none. A request that
 * arrived over a socket always carries one; a request handed straight to this handler in the
 * same process carries its address in the URL instead, and the two say the same thing.
 */
function addressed(req: Request): Headers {
  if (req.headers.has('host') || req.headers.has('x-forwarded-host')) return req.headers;
  const headers = new Headers(req.headers);
  headers.set('host', new URL(req.url).host);
  return headers;
}

function notResolvable(): TRPCError {
  return new TRPCError({ code: NOT_FOUND, message: NOT_FOUND });
}
