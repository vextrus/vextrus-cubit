// The figures R-SPINE-001's doors are held to — what each limited door allows, and how long a session
// lives — in the one home the doors and the hygiene pass both read them from (ARCH-02, B-17).
//
// They are stated apart from the doors themselves for one reason: the pass that keeps these tables
// small (`./prune`) is measured in exactly these figures and is started by the doors, so figures
// living beside a door would make the two files import each other (ARCH-01). Nothing here does any
// work; `./rate-limit` and `./session` publish these under the names the rest of the server calls
// them by, and no door imports this file directly.

/** One door's allowance: how many attempts, over how long a sliding window. */
export interface RateLimit {
  attempts: number;
  windowMs: number;
}

/** A minute is the window every auth door is limited over; the allowances differ by what the door costs. */
const MINUTE = 60_000;

/**
 * The limited doors. Sign-in and sign-up are given a handful of tries a minute — enough for a person
 * who mistypes, far short of an enumeration — while the two doors that send mail are tighter,
 * because each attempt puts a message in somebody's inbox.
 *
 * `tenancyAdmin` is R-SPINE-006's "tenant-admin actions carry rate limits", counted through
 * `admitAttempt` rather than anywhere nearer the workspace, because this table is the one home of
 * what a door allows and that function the one home of the counting (ARCH-02, B-17). Its allowance is
 * the most generous of the five: a person settling a workspace's roles moves several people in a
 * sitting, while a script walking a workspace's members is stopped well short of walking it.
 */
export const AUTH_RATE_LIMITS: Readonly<Record<"signIn" | "signUp" | "requestMagicLink" | "requestPasswordReset" | "tenancyAdmin", RateLimit>> = Object.freeze({
  signIn: Object.freeze({ attempts: 8, windowMs: MINUTE }),
  signUp: Object.freeze({ attempts: 8, windowMs: MINUTE }),
  requestMagicLink: Object.freeze({ attempts: 4, windowMs: MINUTE }),
  requestPasswordReset: Object.freeze({ attempts: 4, windowMs: MINUTE }),
  tenancyAdmin: Object.freeze({ attempts: 12, windowMs: MINUTE }),
});

/** The doors the table limits — the compiler's own list, so a door cannot be limited by a typo. */
export type LimitedDoor = keyof typeof AUTH_RATE_LIMITS;

/**
 * How long a session is live for, counted from when it began — the server's own bound, and the one
 * the cookie's Max-Age is derived from rather than the other way round. A Max-Age is a request to a
 * browser: a token copied out of a cookie jar, or replayed from a capture, is presented by something
 * that never agreed to it, so a lifetime only the browser keeps is no lifetime at all. Thirty days
 * is long enough that a person who uses the product weekly is never signed out mid-work.
 */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
