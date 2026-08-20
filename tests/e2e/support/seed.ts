/**
 * The e2e fixture set (AC-13). scripts/seed.mjs plants exactly this into the
 * scratch DB cubit_e2e before Playwright starts; journeys read it from here so
 * a fixture never drifts between the seeder and the assertions.
 */

export const FIXTURE_USERS = {
  owner: {
    name: 'Acme Owner',
    email: 'owner@e2e.cubit.test',
    password: 'E2e!Owner#2026',
    role: 'OWNER',
  },
  member: {
    name: 'Acme Member',
    email: 'member@e2e.cubit.test',
    password: 'E2e!Member#2026',
    role: 'MEMBER',
  },
} as const;

export const FIXTURE_TENANTS = {
  /** owner is OWNER, member is MEMBER */
  acme: { slug: 'acme' },
  /** owned by member — the tenant `owner` must never be able to reach */
  rival: { slug: 'rival' },
} as const;

/**
 * Accounts a journey creates for itself. The e2e run builds a fresh scratch DB
 * every time, so these are fixed strings: fixed strings keep the committed
 * Linux screenshots pixel-stable.
 */
export const JOURNEY_USERS = {
  j000: {
    name: 'Zero Journey',
    email: 'j000@e2e.cubit.test',
    password: 'E2e!Zero#2026',
    tenantName: 'Zero Works',
  },
  j001: {
    name: 'One Journey',
    email: 'j001@e2e.cubit.test',
    password: 'E2e!One#2026',
    newPassword: 'E2e!OneReset#2026',
  },
} as const;

export const REFUSAL_CODES = {
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  emailNotVerified: 'AUTH_EMAIL_NOT_VERIFIED',
  tokenExpired: 'AUTH_TOKEN_EXPIRED',
  rateLimited: 'AUTH_RATE_LIMITED',
  tenantAccessDenied: 'TENANT_ACCESS_DENIED',
  tenantSlugTaken: 'TENANT_SLUG_TAKEN',
} as const;
