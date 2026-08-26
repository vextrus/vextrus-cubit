// R-SPINE-001: "rate-limited auth endpoints keyed on server-derived identity, never
// client-influencable headers alone."
//
// The key is the identity the *server* derived from the call — the normalised address the door was
// asked about, or the account id a session resolved to. `X-Forwarded-For` and `User-Agent` arrive on
// the request and a caller may write anything into either, so neither is ever part of a key: a
// limiter a caller can rotate its own key on limits nobody. The limiter is deliberately not offered
// a request or a header bag at all, so that reading one is not something a later door can drift into.
//
// The count is kept in the database rather than in the process. An allowance the law states is the
// product's allowance: a count one process holds is multiplied by however many instances serve the
// same address, and given back in full by every restart.
import { and, asc, authAttempts, eq, gt, holdStateLock, lt, runAsSystem } from "../../core/db";
import { rateLimited } from "./refusals";

/** One door's allowance: how many attempts, over how long a sliding window. */
export interface RateLimit {
  attempts: number;
  windowMs: number;
}

/** A minute is the window every auth door is limited over; the allowances differ by what the door costs. */
const MINUTE = 60_000;

/**
 * The four limited doors. Sign-in and sign-up are given a handful of tries a minute — enough for a
 * person who mistypes, far short of an enumeration — while the two doors that send mail are tighter,
 * because each attempt puts a message in somebody's inbox.
 */
export const AUTH_RATE_LIMITS: Readonly<Record<"signIn" | "signUp" | "requestMagicLink" | "requestPasswordReset", RateLimit>> = Object.freeze({
  signIn: Object.freeze({ attempts: 8, windowMs: MINUTE }),
  signUp: Object.freeze({ attempts: 8, windowMs: MINUTE }),
  requestMagicLink: Object.freeze({ attempts: 4, windowMs: MINUTE }),
  requestPasswordReset: Object.freeze({ attempts: 4, windowMs: MINUTE }),
});

/** The doors the table limits — the compiler's own list, so a door cannot be limited by a typo. */
export type LimitedDoor = keyof typeof AUTH_RATE_LIMITS;

/**
 * Where the attempts are counted: the database, one row per attempt. An allowance is a statement
 * about the product, and a count held in a process is a count of what one process saw — a second
 * instance behind the same address would hand out the allowance twice over, and a restart would hand
 * it out again from nothing. The table is the one place every instance and every restart can see.
 */
const REASON = "R-SPINE-001 rate limiting: counting one server-derived identity's recent attempts at a limited auth door";

/** The identity as it is counted: the same person under two spellings is one caller. */
function keyed(identity: string): string {
  return identity.trim().toLowerCase();
}

/** The longest window any door is limited over — older than that, a row can count towards nothing. */
const LONGEST_WINDOW_MS = Math.max(...Object.values(AUTH_RATE_LIMITS).map((limit) => limit.windowMs));

/**
 * The name the count is serialised on — one door, one identity. Counting is a read followed by a
 * write, and a burst is the traffic a limiter exists to stop: without this, N callers on one address
 * all read a window one short of full and all insert, so the allowance the law states is not the
 * allowance enforced. The lock is held on the *name* of the count rather than on the rows that hold
 * it now, because the rows a concurrent attempt is about to insert are locked by nothing (see
 * `holdStateLock`). It is released when the transaction ends, whichever way it ends.
 */
function lockName(door: LimitedDoor, key: string): string {
  return `auth-rate-limit:${door}:${key}`;
}

/**
 * Record an attempt at this door by this server-derived identity, and refuse it when the window is
 * already full. Refused *before* the work is done, so the answer does not depend on whether the
 * credential was right — a limiter that only counted failures tells an attacker which tries counted.
 *
 * The refusal is thrown from inside the transaction, so the transaction ends with nothing written:
 * a refused attempt is not a new attempt, and hammering a limited door cannot push the allowance
 * further away than the law says it is.
 */
export async function admitAttempt(door: LimitedDoor, identity: string): Promise<void> {
  const limit = AUTH_RATE_LIMITS[door];
  const now = Date.now();
  const key = keyed(identity);
  const db = runAsSystem(REASON);

  // A row older than the longest window counts towards nothing, whoever it belonged to. Dropped
  // here, or the table is a leak keyed by address — every address ever presented, kept for ever.
  // Outside the count's own transaction, because it is about every identity but this one's window.
  await db.delete(authAttempts).where(lt(authAttempts.attemptedAt, new Date(now - LONGEST_WINDOW_MS)));

  await db.transaction(async (tx) => {
    await holdStateLock(tx, lockName(door, key));

    const window = await tx
      .select({ at: authAttempts.attemptedAt })
      .from(authAttempts)
      .where(and(eq(authAttempts.door, door), eq(authAttempts.identity, key), gt(authAttempts.attemptedAt, new Date(now - limit.windowMs))))
      .orderBy(asc(authAttempts.attemptedAt));

    const oldest = window[0];
    if (oldest !== undefined && window.length >= limit.attempts) throw rateLimited(door, limit.windowMs - (now - oldest.at.getTime()));

    await tx.insert(authAttempts).values({ door, identity: key });
  });
}
