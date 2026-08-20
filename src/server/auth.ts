import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { nextCookies } from 'better-auth/next-js';
import { authDatabase, sql, tables } from '../core/db';
import { env } from '../core/env';
import { REFUSALS } from '../core/errors';
import { sendMail } from './mail';
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
   * R-SPINE-002 / AC-12 — the personal tenant is minted *in the user-create
   * transaction*, and there is no code here that does it.
   *
   * A hook after the insert is a second write, on a second connection, in a
   * second role: two transactions, with a window between them in which a crash
   * leaves an account with nowhere to stand — the state the clause forbids by
   * naming a transaction. The mint is therefore a trigger on `user`
   * (db/migrations/0003), which runs inside the inserting transaction itself.
   * Nothing to compensate, nothing to misreport: if the tenant cannot be minted
   * the insert never happened.
   */

  /**
   * AC-17 — 10 requests per 60 s per IP on the password sign-in.
   *
   * Only the endpoints named here depart from better-auth's own limits: a
   * catch-all would silently take the library's tight defaults off the senders
   * (3 per 60 s on the reset and verification mailers) and turn them into this
   * instance's general limit, which is a hundred mails a minute at any address
   * somebody cares to name. Nothing in the contract asked for that.
   *
   * `/sign-up/email` is the one relaxation, and it is a relaxation of the burst
   * only: the default is 3 per 10 s — up to 18 in a minute — where this allows
   * 10 in a minute however they arrive. The e2e suite signs up several accounts
   * back to back from one address (127.0.0.1), and so does an office.
   *
   * Everything not named keeps its default: 3 per 10 s under `/sign-in`,
   * `/sign-up` and `/change-…`, 3 per 60 s on the senders, and this instance's
   * general 100 per 60 s elsewhere.
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
      // the rule AC-17 names, by its exact path
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 10 },
      // a magic link is a mail sent to an address, so it is held to the same
      // ration as the other senders rather than to `/sign-in`'s burst rule
      '/sign-in/magic-link': { window: 60, max: 3 },
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
 * AC-25 — signing up again with an address that already has an account refuses
 * in place, by name.
 *
 * better-auth answers a duplicate sign-up with a fabricated success and writes
 * nothing: it declines to say who holds an account here. A sign-up screen is not
 * where that silence belongs — it leaves the reader waiting for a mail nobody
 * sent, which is the dead end R-UI-020 forbids. The duplicate is refused here,
 * before better-auth answers, in the shape its client already reads.
 *
 * Magic link keeps the silence (`sendMagicLink` above): asking for a way in must
 * never be an oracle, because anyone may ask for any address. A sign-up is the
 * one screen where the person is claiming the address as their own.
 *
 * Returns the refusal, or null to let better-auth handle the request.
 */
/**
 * The address a sign-up request is claiming, however the request spells itself.
 * Our screen posts JSON; a plain HTML form posts `application/x-www-form-urlencoded`,
 * and better-auth accepts both — so a guard that reads only JSON is a guard the
 * other encoding walks straight past. The clone leaves the request's own body
 * unread for better-auth.
 */
async function fieldIn(request: Request, field: string): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('json')) {
      const body = (await request.clone().json()) as Record<string, unknown>;
      const value = body[field];
      return typeof value === 'string' ? value : null;
    }
    if (contentType.includes('form-urlencoded') || contentType.includes('form-data')) {
      const value = (await request.clone().formData()).get(field);
      return typeof value === 'string' ? value : null;
    }
  } catch {
    // not a shape we can read — better-auth refuses it by name
    return null;
  }

  return null;
}

async function addressIn(request: Request): Promise<string | null> {
  return fieldIn(request, 'email');
}

/**
 * R-UI-020 — the sign-up screen marks the name required, and every form here
 * carries `noValidate`, so that promise is the server's to keep: the browser
 * hands a blank name straight over. It is not a cosmetic field — the personal
 * tenant minted in the user-create transaction takes the account's name
 * (db/migrations/0003), so a blank one mints a tenant with no name and no
 * address anybody typed. The claim is refused in place, by the name the
 * create-tenant screen already refuses an underivable address with.
 *
 * Returns the refusal, or null to let better-auth handle the request.
 */
export async function unnamedSignUp(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith('/sign-up/email')) return null;

  const name = await fieldIn(request, 'name');
  if (name !== null && name.trim().length > 0) return null;

  return Response.json(
    { code: REFUSALS.TENANT_NAME_UNREADABLE.code, message: REFUSALS.TENANT_NAME_UNREADABLE.message },
    { status: 422 },
  );
}

export async function duplicateSignUp(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith('/sign-up/email')) return null;

  const email = await addressIn(request);
  if (email === null || !(await accountExists(email))) return null;

  return Response.json(
    { code: REFUSALS.AUTH_EMAIL_TAKEN.code, message: REFUSALS.AUTH_EMAIL_TAKEN.message },
    { status: 422 },
  );
}

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
