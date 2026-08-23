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
import { runAsSystem } from '../../core/db';
import { EMAIL_SHAPE, MIN_PASSWORD_LENGTH } from '../../server/auth-policy';
import { createUserWithPersonalTenant } from '../../server/tenancy';
import type { AuthStringKey } from './strings';

export type SignUpOutcome = { readonly ok: true } | { readonly ok: false; readonly error: AuthStringKey };

/** Postgres' unique-violation class, which is what a second sign-up on one address is. */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return (error as { code?: unknown }).code === UNIQUE_VIOLATION;
}

export async function signUpWithPersonalTenant(input: {
  email: string;
  password: string;
}): Promise<SignUpOutcome> {
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
    // authority, and it says the same thing the check would have.
    if (isUniqueViolation(error)) return { ok: false, error: 'auth.error.emailTaken' };
    throw error;
  }
  return { ok: true };
}
