/**
 * The rules the auth instance, the sign-up action, the sign-up form and the `/t` entry all
 * have to agree on (R-SPINE-001).
 *
 * They live in a module of their own, with no imports, because some of the readers run in the
 * browser: a form that validated against a copy of the rule would eventually disagree with the
 * server that enforces it, and a rule stated twice is a rule stated once and remembered wrong.
 */

/** better-auth's `minPasswordLength`, and the number `auth.error.passwordLength` quotes. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * What the screens accept as an address before they spend a round trip on it. Deliberately
 * permissive — the authority on whether an address exists is the mail that reaches it, and a
 * regular expression that argues with RFC 5322 refuses real people's addresses.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The mark every verification link's callback carries, and the one `/t` reads back.
 *
 * Every other spent link says so itself: the magic-link and reset tokens are rows in
 * `verifications`, deleted on use, so a replay comes back with an `error` in the query and `/t`
 * turns it into §3's refusal. A verification token is a stateless JWT that is never consumed —
 * replaying one whose user is already verified takes better-auth's `emailVerified` branch,
 * which redirects to the callback with no session *and no error*. The mark is the only thing
 * that distinguishes that arrival from somebody typing `/t` with no session at all; a live
 * link is unaffected, because it carries its new session and `/t` resolves the slug before it
 * ever looks at the query.
 */
export const VERIFY_CALLBACK_PARAM = 'from';
export const VERIFY_CALLBACK_VALUE = 'verify';

/**
 * The same mark, on the error callback the magic-link and reset links are minted with.
 *
 * §3/§13 pin the refusal's query as `?error=link-expired` on all three screens, but the value
 * on those two callbacks is not this product's to choose: better-auth `set`s `error` to its
 * own code (`INVALID_TOKEN`) on the URL it was given, replacing anything already there. So the
 * product marks the callback with a param better-auth does not touch, exactly as the verify
 * path does, and the screen canonicalises the arrival to the documented query before it
 * renders. The mark is also what tells a real spent link apart from a hand-typed `?error=…`:
 * without it, an `error` the product never minted is not a refusal and no `AUTH_LINK_EXPIRED`
 * block appears for a link that never existed.
 */
export const LINK_REFUSAL_VALUE = 'link';

/** The one `error` value §3/§13 name, and the only one the screens render a refusal for. */
export const LINK_EXPIRED = 'link-expired';
