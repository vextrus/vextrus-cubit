/**
 * The two numbers the auth instance, the sign-up action and the sign-up form all have to
 * agree on (R-SPINE-001).
 *
 * They live in a module of their own, with no imports, because one of the three readers runs
 * in the browser: a form that validated against a copy of the rule would eventually disagree
 * with the server that enforces it, and a rule stated twice is a rule stated once and
 * remembered wrong.
 */

/** better-auth's `minPasswordLength`, and the number `auth.error.passwordLength` quotes. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * What the screens accept as an address before they spend a round trip on it. Deliberately
 * permissive — the authority on whether an address exists is the mail that reaches it, and a
 * regular expression that argues with RFC 5322 refuses real people's addresses.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
