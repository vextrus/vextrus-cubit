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
import { and, asc, authAttempts, eq, gt, holdStateLock, isStorableText, lt, runAsSystem } from "../../core/db";
import { rateLimited } from "./refusals";
import { digestOf } from "./secrets";

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

/**
 * The longest a key may be before it is counted under its digest instead. The key is written to
 * `auth_attempts.identity`, which the btree index `auth_attempts_window` covers, and postgres refuses
 * an index row over 2704 bytes (SQLSTATE 54000). The identity is server-derived but not
 * server-*sized*: it is the address the caller wrote, at whatever length they wrote it, and no screen
 * may bound it first (Design Decision I-13). Left unbounded, the limiter fails at its own INSERT —
 * the door refuses nothing, counts nothing, and the caller is handed a fault id for an address that
 * was never looked up (R-SPINE-007, R-SPINE-062). 256 bytes is comfortably above every address and
 * account id a door actually presents and far below the ceiling.
 */
const IDENTITY_MAX_BYTES = 256;

/**
 * The identity as it is counted: the same person under two spellings is one caller — and, just as
 * importantly, two callers are never one key.
 *
 * A value longer than the index can hold is counted under its own digest. A digest is deterministic,
 * so one caller is still one key and the allowance the law states is still the allowance enforced.
 *
 * A value the column cannot hold at all is folded the same way and for the same reason: `identity`
 * is the address the caller wrote, and one carrying a NUL is not text postgres can store or even
 * receive as a parameter (`isStorableText`). Left as it is, the advisory lock this count is
 * serialised on would fail on its own argument — the limiter counts nothing, refuses nothing, and
 * the caller is handed a fault id for an attempt that was never made (R-SPINE-007, R-SPINE-062).
 * Under its digest the attempt is counted like any other, which is what the allowance is for.
 *
 * Both keys say which of the two they are, because otherwise the fold is not injective. A prefix on
 * the digest alone rests on the folded value never wearing it — and nothing bounds or shapes what a
 * door is handed: the two mailing doors take the caller's string with no length check at all
 * (`mailLinkFor`), so a caller could present a long value, compute the same unsecret digest
 * themselves, and present the literal `digest of <that hex>` as a second, short identity. Two
 * identities would then share one row-group and one lock name. Tagged on both sides the two spaces
 * cannot meet: a presented value is only ever equal to itself.
 */
function keyed(identity: string): string {
  const folded = identity.trim().toLowerCase();
  return countable(folded) ? `as presented ${folded}` : `digest of ${digestOf(folded)}`;
}

/**
 * Can this identity be written to `auth_attempts.identity` and indexed there as it stands? Asked of
 * the folded value rather than of the tagged key: the bound is about how much of a caller's own
 * string is carried, and the tag is a fixed handful of bytes on top, still far below the ceiling.
 */
function countable(folded: string): boolean {
  return isStorableText(folded) && Buffer.byteLength(folded, "utf8") <= IDENTITY_MAX_BYTES;
}

/** The longest window any door is limited over — older than that, a row can count towards nothing. */
const LONGEST_WINDOW_MS = Math.max(...Object.values(AUTH_RATE_LIMITS).map((limit) => limit.windowMs));

/**
 * When the spent rows were last swept, so the sweep is not paid for on every attempt.
 *
 * The sweep is a scan of the whole table, and it is the one statement here that is not about the
 * caller's own window: run per call it is a per-attempt cost that grows with exactly the traffic the
 * limiter exists to police, which is the shape a limiter must not have. Run once a window it still
 * bounds the table at what one window's traffic can put in it, which is all the deletion was ever
 * for. Held per process rather than in the table: a second instance sweeping the same rows a second
 * time deletes rows already gone, and the count itself is serialised on its own lock either way.
 */
const SWEEP_KEY = Symbol.for("vextrus.cubit.server.auth.attempts-swept-at");
const processScope = globalThis as typeof globalThis & { [SWEEP_KEY]?: { at: number } };
const sweptAt: { at: number } = (processScope[SWEEP_KEY] ??= { at: Number.NEGATIVE_INFINITY });

/** Drop every row too old to count towards any window — at most once a window, whoever asks. */
async function sweepSpentAttempts(db: ReturnType<typeof runAsSystem>, now: number): Promise<void> {
  if (now - sweptAt.at < LONGEST_WINDOW_MS) return;
  sweptAt.at = now;
  await db.delete(authAttempts).where(lt(authAttempts.attemptedAt, new Date(now - LONGEST_WINDOW_MS)));
}

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
  await sweepSpentAttempts(db, now);

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
