import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { nextCookies } from 'better-auth/next-js';
import { authDatabase, eq, sql, tables } from '../core/db';
import { env } from '../core/env';
import { REFUSALS } from '../core/errors';
import { sendMail } from './mail';
import { mintPersonalTenant } from './tenant';
import { strings } from '../ui/strings/auth';

/**
 * R-SPINE-001 — email + password with verification, magic-link sign-in, password
 * reset, sessions with a device list and revoke, and a rate-limited sign-in.
 *
 * The links better-auth mails all point back through `/api/auth/…`, which then
 * redirects to one of our screens. We rewrite the `callbackURL` inside the send
 * callbacks rather than trusting whatever the browser asked for: where a
 * verification lands is the server's decision, not the client's.
 */

/** Where each mailed link puts the person once better-auth has done its part. */
const LANDING = {
  verified: '/verify-email?verified=1',
  reset: '/reset-password',
  magicLink: '/',
  magicLinkFailed: '/magic-link',
} as const;

function withCallback(url: string, callbackURL: string, errorCallbackURL?: string): string {
  const link = new URL(url);
  link.searchParams.set('callbackURL', callbackURL);
  // a link that no longer works lands somewhere that says so, not on a screen
  // that pretends nothing happened (R-UI-020)
  if (errorCallbackURL !== undefined) link.searchParams.set('errorCallbackURL', errorCallbackURL);
  return link.toString();
}

/**
 * This machine spells itself two ways: `BETTER_AUTH_URL` names 127.0.0.1 (C-07)
 * while Next's own banner invites you to `http://localhost:3210`. Both name this
 * process, so both are trusted; a sign-in must not refuse because of which
 * spelling of loopback the browser happened to use.
 */
function loopbackOrigins(baseUrl: string): string[] {
  const url = new URL(baseUrl);
  const twin = { localhost: '127.0.0.1', '127.0.0.1': 'localhost' }[url.hostname];
  if (twin === undefined) return [url.origin];

  const other = new URL(url);
  other.hostname = twin;
  return [url.origin, other.origin];
}

/** The identity tables are the auth role's; an unfinished sign-up is undone there. */
async function forgetUser(id: string): Promise<void> {
  await authDatabase().delete(tables.user).where(eq(tables.user.id, id));
}

/** Addresses are matched the way better-auth stores them: case does not identify. */
function sameAddress(email: string) {
  return sql`lower(${tables.user.email}) = ${email.trim().toLowerCase()}`;
}

/** Whether an address already belongs to somebody. */
async function accountExists(email: string): Promise<boolean> {
  const rows = await authDatabase()
    .select({ id: tables.user.id })
    .from(tables.user)
    .where(sameAddress(email))
    .limit(1);
  return rows.length > 0;
}

export const auth = betterAuth({
  appName: 'VEXTRUS CUBIT',
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: loopbackOrigins(env.BETTER_AUTH_URL),

  database: drizzleAdapter(authDatabase(), {
    provider: 'pg',
    schema: {
      user: tables.user,
      session: tables.session,
      account: tables.account,
      verification: tables.verification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    // an unverified address refuses in place with AUTH_EMAIL_NOT_VERIFIED
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 12,
    // a reset is what you do when the password is not yours alone any more:
    // every other device loses its session with it
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendMail({
        to: user.email,
        subject: strings.mailResetSubject,
        kind: 'reset',
        url: withCallback(url, LANDING.reset),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      sendMail({
        to: user.email,
        subject: strings.mailVerifySubject,
        kind: 'verify',
        url: withCallback(url, LANDING.verified),
      });
    },
  },

  /**
   * R-SPINE-002 — the personal tenant is minted as the user is created. The hook
   * runs on the same request as the insert and writes both tenant rows in one
   * statement, so an account never exists without somewhere to stand.
   */
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await mintPersonalTenant({ id: user.id, name: user.name, email: user.email });
          } catch {
            // An account never exists without somewhere to stand: if the tenant
            // cannot be minted after all, the row written a moment ago goes with
            // it and the screen refuses by name rather than showing a 500.
            await forgetUser(user.id);
            throw new APIError('CONFLICT', {
              code: 'TENANT_SLUG_TAKEN',
              message: REFUSALS.TENANT_SLUG_TAKEN.message,
            });
          }
        },
      },
    },
  },

  /**
   * AC-17 — 10 requests per 60 s per IP on the password sign-in.
   *
   * Every other endpoint carries this instance's general limit, declared here
   * rather than inherited: better-auth's own defaults are 3 requests per 10 s on
   * anything under `/sign-in`, `/sign-up` and `/change-…`, and 3 per 60 s on the
   * reset and verification senders. Nothing in the contract asks for those, and
   * they refuse legitimate traffic — a suite driving sign-ups back to back, or an
   * office behind one address — with a refusal the caller never asked for. The
   * limit the contract names is the tight one; the rest are rate-limited, not
   * throttled to three.
   *
   * Known limitation: this storage is in-memory and therefore per-process
   * (docs/atlas/foundation.md).
   */
  rateLimit: {
    enabled: true,
    storage: 'memory',
    window: 60,
    max: 100,
    customRules: {
      // first match wins, so the named rule is declared before the catch-all
      '/sign-in/email': { window: 60, max: 10 },
      '/**': { window: 60, max: 100 },
    },
  },

  plugins: [
    magicLink({
      /**
       * R-SPINE-001 names magic link as a way of signing *in*. Left to itself the
       * plugin mints an account for whatever address follows a link, so a stranger
       * — or anyone who guessed an address — would arrive as a new user with no
       * password and a verified flag nobody earned.
       */
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        // An address with no account is not mailed a way in. The screen says
        // "sent" either way (below), so the form is never an oracle for who
        // holds an account here.
        if (!(await accountExists(email))) return;

        sendMail({
          to: email,
          subject: strings.mailMagicLinkSubject,
          kind: 'magic-link',
          url: withCallback(url, LANDING.magicLink, LANDING.magicLinkFailed),
        });
      },
    }),
    // must stay last: it forwards Set-Cookie into Next's cookie store
    nextCookies(),
  ],
});

/**
 * The claims better-auth signs into a verification link. Reading them here is a
 * look, not a check: the signature is better-auth's to verify a moment later.
 */
interface VerificationClaims {
  email?: unknown;
  updateTo?: unknown;
}

function addressInVerificationLink(token: string): string | null {
  const [, payload] = token.split('.');
  if (payload === undefined) return null;

  let claims: VerificationClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as VerificationClaims;
  } catch {
    // not a shape we can read — better-auth refuses it by name
    return null;
  }

  // a change-of-address link proves something else and is not ours to spend
  if (typeof claims.email !== 'string' || claims.updateTo !== undefined) return null;
  return claims.email;
}

/**
 * AC-11 — a verification link works once.
 *
 * better-auth's token is a signed JWT it never spends: an address that is already
 * verified sends the same link straight on to the success landing, for as long as
 * the token lives. A link whose address is already proven is refused here instead,
 * in place and by name, before better-auth answers (R-UI-020).
 *
 * Returns the refusal's redirect, or null to let better-auth handle the request.
 */
export async function replayedVerification(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith('/verify-email')) return null;

  const token = url.searchParams.get('token');
  if (token === null) return null;

  const email = addressInVerificationLink(token);
  if (email === null) return null;

  const rows = await authDatabase()
    .select({ verified: tables.user.emailVerified })
    .from(tables.user)
    .where(sameAddress(email))
    .limit(1);
  if (rows[0]?.verified !== true) return null;

  // the landing the link itself names, resolved the way better-auth resolves its
  // own, and carrying better-auth's own error spelling
  const landing = new URL(url.searchParams.get('callbackURL') ?? LANDING.verified, env.BETTER_AUTH_URL);
  landing.searchParams.set('error', 'TOKEN_EXPIRED');
  return Response.redirect(landing.toString(), 302);
}

/** better-auth revokes by session token; a token never reaches the browser as markup. */
export async function revokeSessionById(sessionId: string, headers: Headers): Promise<void> {
  const sessions = await auth.api.listSessions({ headers });
  const target = sessions.find((session) => session.id === sessionId);
  if (target === undefined) return;
  await auth.api.revokeSession({ body: { token: target.token }, headers });
}
