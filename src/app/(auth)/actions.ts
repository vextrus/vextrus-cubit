'use server';

/**
 * The sign-up act (R-SPINE-002).
 *
 * It is this product's own rather than better-auth's `/sign-up/email`, because the clause is
 * about a transaction: "Every user gets a personal tenant at sign-up (in the user-create
 * transaction)". `createUserWithPersonalTenant` is that transaction, so the sign-up path goes
 * through it and the account, the workspace and the membership are written together or not
 * at all. better-auth's own endpoint stays mounted and reaches the same guarantee through the
 * user-create hook, one statement later.
 *
 * The reply is a string key, never a sentence: the copy is `AUTH_STRINGS`', decided in
 * docs/design/s-auth.md §10 (R-SPINE-060).
 */
import { withinRateLimit } from '../../server/action-rate-limit';
import { runAsSystem } from '../../core/db';
import { EMAIL_SHAPE, MIN_PASSWORD_LENGTH } from '../../server/auth-policy';
import { createUserWithPersonalTenant, USER_EMAIL_CONSTRAINT } from '../../server/tenancy';
import type { AuthStringKey } from './strings';

export type SignUpOutcome = { readonly ok: true } | { readonly ok: false; readonly error: AuthStringKey };

/** Postgres' unique-violation class, which is what a second sign-up on one address is. */
const UNIQUE_VIOLATION = '23505';

/**
 * Sign-ups per client per minute (R-SPINE-001, "rate-limited auth endpoints").
 *
 * The same number `/sign-up/email` carries in `src/server/auth.ts`: this action is the door
 * the screens use and better-auth's endpoint is the one nobody uses, so a limit on one and
 * not the other is not a limit. Far above what a person doing this once will ever spend.
 */
const SIGN_UPS_PER_WINDOW = 20;

/**
 * Whether `error` is the database refusing *this* uniqueness — the address.
 *
 * The constraint name is read, not just the SQLSTATE. `createUserWithPersonalTenant` writes
 * four rows behind four unique constraints, and a 23505 raised by any of the other three is
 * not "an account with this email already exists": telling somebody their available address
 * is taken, and sending them to a sign-in they cannot pass, is worse than the error it hides.
 */
function violates(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const raised = error as { code?: unknown; constraint?: unknown };
  return raised.code === UNIQUE_VIOLATION && raised.constraint === constraint;
}

export async function signUpWithPersonalTenant(input: {
  email: string;
  password: string;
}): Promise<SignUpOutcome> {
  // Before the address is even read: an unmetered mint is an unmetered account-existence
  // oracle, and the reply below is the one auth answer that is not existence-neutral.
  if (!(await withinRateLimit('sign-up', SIGN_UPS_PER_WINDOW))) {
    return { ok: false, error: 'auth.error.rateLimited' };
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email)) return { ok: false, error: 'auth.error.email' };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: 'auth.error.passwordLength' };
  }

  const db = runAsSystem('sign-up: an address belongs to no tenant until the mint gives it one');
  const taken = await db.query.users.findFirst({
    columns: { id: true },
    where: (user, { eq }) => eq(user.email, email),
  });
  if (taken !== undefined) return { ok: false, error: 'auth.error.emailTaken' };

  try {
    await createUserWithPersonalTenant(db, { email, password: input.password });
  } catch (error: unknown) {
    // Two sign-ups on one address that raced past the read above: the database is the
    // authority, and it says the same thing the check would have. Only that constraint —
    // a slug collision between two *different* addresses is somebody else's news.
    if (violates(error, USER_EMAIL_CONSTRAINT)) return { ok: false, error: 'auth.error.emailTaken' };
    throw error;
  }
  return { ok: true };
}
