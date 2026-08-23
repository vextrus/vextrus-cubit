/**
 * The identity spine's one auth instance (R-SPINE-001, R-SPINE-002, Q-12).
 *
 * better-auth 1.7.1 over the inc-001 tenant seam. Four decisions are worth stating, because
 * each of them is a clause rather than a preference:
 *
 *   1. **The adapter's handle is `runAsSystem`.** FORCEd row-level security binds the table
 *      owner too, so a connection nobody scoped sees nothing — and identity is genuinely not
 *      one tenant's: a user may belong to many (R-SPINE-002), and an address that has no
 *      account yet belongs to none. The five identity tables carry a system-only policy; the
 *      one table that carries a tenant, `tenant_memberships`, carries both arms.
 *
 *   2. **Ids are uuids.** The adapter reports `supportsUUIDs` for pg, and
 *      `advanced.database.generateId: 'uuid'` is what makes better-auth stop minting ids of
 *      its own and let `gen_random_uuid()` fill the column the migration declares.
 *
 *   3. **The active tenant is in the session** (R-SPINE-002: "explicit in the URL … and in
 *      the session"). It is a real column, written when the session row is created, and it
 *      is also lifted to the top of `/api/auth/get-session`'s JSON so a reader does not have
 *      to know better-auth's envelope to find it.
 *
 *   4. **Rate limiting is on, explicitly** (Q-12: "auth rate limits tested"). better-auth
 *      arms its limiter only in production by default; a limit that a dev run does not
 *      enforce is a limit nobody notices losing. The custom rules widen the library's very
 *      tight defaults (three sign-ins per ten seconds) to something a real person and a
 *      journey can both live inside, while staying far under the twenty consecutive attempts
 *      Q-12 says must produce a 429.
 */
import { createHash, randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession, magicLink } from 'better-auth/plugins';
import { runAsSystem } from '../core/db';
import { MIN_PASSWORD_LENGTH } from './auth-policy';
import { sendAuthMail } from './mail';
import { activeTenantSlugFor, ensurePersonalTenant } from './tenancy';

/**
 * Q-12, "no secrets in repo": outside production the secret is an obviously-insecure
 * constant rather than anything credential-shaped, so nobody can mistake it for one that
 * leaked. It is scoped to non-production *by the condition in `authSecret()`*, because a
 * published constant that signs a real deployment's session tokens, verification JWTs and
 * reset tokens lets anyone holding this repository mint a session for any account.
 */
const INSECURE_DEV_SECRET = 'cubit-insecure-dev-secret-do-not-use-in-production';

/**
 * The key everything this instance signs is signed with (Q-12).
 *
 * `BETTER_AUTH_SECRET` is the only source anyone should use, and the only one a deployment
 * that means it will have. The two fallbacks below exist because better-auth issues no
 * warning when a secret *was* supplied, so a forgotten variable would otherwise boot
 * silently:
 *
 *   - outside production, the obviously-insecure constant, stable so a dev session survives
 *     a reload and unmistakable if it ever turns up in a real deployment;
 *   - in production, a value derived from `DATABASE_URL` — never published here, stable
 *     across a restart and across every worker process `next start` may fork (a per-boot
 *     random would sign a token one process could not verify), and loudly announced. It is
 *     a stopgap that keeps a misconfigured deploy from signing with a constant this file
 *     spells out; it is not a substitute for the variable.
 *
 * With neither — a production process with no database either, which cannot serve a request
 * anyway, and `next build`, which signs nothing — it is a fresh random value per process.
 * Never the published constant: whatever this module is being loaded for, it is not a
 * development run.
 */
function authSecret(): string {
  const named = process.env['BETTER_AUTH_SECRET'];
  if (named !== undefined && named.trim() !== '') return named;
  if (process.env['NODE_ENV'] !== 'production') return INSECURE_DEV_SECRET;

  const deployment = process.env['DATABASE_URL'];
  if (deployment === undefined || deployment.trim() === '') return randomBytes(32).toString('hex');
  console.warn(
    'BETTER_AUTH_SECRET is unset in production. Signing with a value derived from ' +
      'DATABASE_URL; every session, verification and reset token is invalidated the moment ' +
      'that URL changes. Set BETTER_AUTH_SECRET.',
  );
  return createHash('sha256').update(`cubit:auth-secret:${deployment}`).digest('hex');
}

/**
 * How this deployment resolves the client behind a request, which is what the rate limiter
 * keys its buckets on (Q-12).
 *
 * Measured on this tree: `next start` *does* fill `x-forwarded-for` from the socket's
 * remote address when the request carries none (next/dist/server/base-server.js), so the
 * limiter already keys per client rather than into one shared bucket — twenty wrong
 * passwords from one address meet a 429 while a second address is still answered. What it
 * cannot do on its own is tell that header apart from one the client wrote itself, so a
 * deployment that puts a proxy in front names it: `BETTER_AUTH_TRUSTED_PROXIES` (IPs or
 * CIDR ranges) makes better-auth walk the forwarded chain from the right to the first hop
 * it does not trust, and `BETTER_AUTH_IP_HEADERS` names the header if it is not the
 * standard one.
 */
function ipAddressConfig(): { ipAddressHeaders?: string[]; trustedProxies?: string[] } {
  const list = (named: string | undefined): string[] | undefined => {
    if (named === undefined || named.trim() === '') return undefined;
    const entries = named
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
    return entries.length === 0 ? undefined : entries;
  };
  const headers = list(process.env['BETTER_AUTH_IP_HEADERS']);
  const proxies = list(process.env['BETTER_AUTH_TRUSTED_PROXIES']);
  return {
    ...(headers === undefined ? {} : { ipAddressHeaders: headers }),
    ...(proxies === undefined ? {} : { trustedProxies: proxies }),
  };
}

/** Where a screen sends anyone whose tenant it does not yet know: `/t` resolves the slug. */
export const TENANT_ENTRY_PATH = '/t';

/** Where the reset link lands, so `/reset-password?token=…` renders the set-password phase. */
const RESET_RETURN_PATH = '/reset-password';

/** The window every custom rule shares: a minute is what `auth.error.rateLimited` promises. */
const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Anything without a rule of its own. Generous: the tight rules are the ones that matter. */
const RATE_LIMIT_DEFAULT_MAX = 200;

/**
 * Wrong passwords per minute per client. Low enough that twenty consecutive attempts always
 * meet a 429 (Q-12), high enough that one journey signing in as several people does not.
 */
const SIGN_IN_ATTEMPTS_PER_WINDOW = 15;

/** The link-minting endpoints. A link is cheap to ask for and expensive to send. */
const LINK_REQUESTS_PER_WINDOW = 20;

/** C-07: the addresses this product answers on when nobody has named another. */
const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1:*', 'localhost:*', '[::1]:*'];

/** The hosts a request may claim to have been addressed to, and whose origins are trusted. */
function allowedHosts(): string[] {
  const named = process.env['BETTER_AUTH_ALLOWED_HOSTS'];
  if (named === undefined || named.trim() === '') return [...LOOPBACK_HOSTS];
  return named
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host !== '');
}

/** The seam's handle: one per process, and the only way this module reaches a row. */
const database = runAsSystem('better-auth: identity is not scoped to one tenant');

export const auth = betterAuth({
  appName: 'Cubit',
  database: drizzleAdapter(database, { provider: 'pg', usePlural: true }),
  secret: authSecret(),
  advanced: { database: { generateId: 'uuid' }, ipAddress: ipAddressConfig() },

  /**
   * Where this process is being reached, decided per request (Q-12).
   *
   * The app answers on a different address in every lane — 3210 in dev, 3211 for the e2e
   * build, a free port for whatever probes that build afterwards — so a base URL fixed at
   * boot would be wrong in two of the three, and better-auth's fallback (the URL Next hands
   * it) normalises the host to `localhost` whatever the browser actually typed. That split
   * matters: a verification link addressed to a host the browser is not on sets its session
   * cookie somewhere the reader never goes back to.
   *
   * So the host is read off the request itself and checked against an allowlist, which is
   * also what tells better-auth which `Origin` headers to trust. The default is loopback,
   * because loopback is the whole of M0's world (C-07); a deployment with a name of its own
   * names it in `BETTER_AUTH_ALLOWED_HOSTS`.
   */
  baseURL: { allowedHosts: allowedHosts(), protocol: 'auto' },

  emailAndPassword: {
    enabled: true,
    // R-SPINE-001: "sign-up/sign-in with verification". An unverified account can be created
    // and can ask for a new link; it cannot hold a session.
    requireEmailVerification: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthMail('reset', user.email, url);
    },
  },

  emailVerification: {
    // The sign-up path mints the tenant itself and then asks for the mail, so better-auth
    // does not also send one; a signed-in-again attempt on an unverified account does.
    sendOnSignUp: false,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthMail('verify', user.email, url);
    },
  },

  session: {
    additionalFields: {
      activeTenantSlug: { type: 'string', required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // R-SPINE-002 says *every* user gets a personal tenant. Sign-up goes through
        // createUserWithPersonalTenant; this catches every other door into `users`.
        after: async (user) => {
          await ensurePersonalTenant(database, { id: user.id, email: user.email, name: user.name });
        },
      },
    },
    session: {
      create: {
        before: async (session) => ({
          data: {
            ...session,
            activeTenantSlug: await activeTenantSlugFor(database, session.userId),
          },
        }),
      },
    },
  },

  rateLimit: {
    enabled: true,
    window: RATE_LIMIT_WINDOW_SECONDS,
    max: RATE_LIMIT_DEFAULT_MAX,
    customRules: {
      '/sign-in/email': {
        window: RATE_LIMIT_WINDOW_SECONDS,
        max: SIGN_IN_ATTEMPTS_PER_WINDOW,
      },
      '/sign-up/email': { window: RATE_LIMIT_WINDOW_SECONDS, max: LINK_REQUESTS_PER_WINDOW },
      '/sign-in/magic-link': { window: RATE_LIMIT_WINDOW_SECONDS, max: LINK_REQUESTS_PER_WINDOW },
      '/magic-link/verify': { window: RATE_LIMIT_WINDOW_SECONDS, max: LINK_REQUESTS_PER_WINDOW },
      '/send-verification-email': {
        window: RATE_LIMIT_WINDOW_SECONDS,
        max: LINK_REQUESTS_PER_WINDOW,
      },
      '/request-password-reset': {
        window: RATE_LIMIT_WINDOW_SECONDS,
        max: LINK_REQUESTS_PER_WINDOW,
      },
    },
  },

  plugins: [
    magicLink({
      // AC-3 / risk note (4): a link asked for by an address with no account signs nobody in
      // and mints nothing — no user, and therefore no personal tenant.
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await sendAuthMail('magic-link', email, url);
      },
    }),
    // Last, so it wraps the session every other plugin has finished composing.
    customSession(async ({ user, session }) => {
      const carried = (session as { activeTenantSlug?: string | null }).activeTenantSlug;
      const activeTenantSlug =
        carried === undefined || carried === null
          ? await activeTenantSlugFor(database, session.userId)
          : carried;
      return { user, session, activeTenantSlug };
    }),
  ],
});

export { RESET_RETURN_PATH };
