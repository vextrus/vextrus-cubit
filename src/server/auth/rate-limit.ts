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
import { foldedKey } from "./folded-key";
import { AUTH_RATE_LIMITS, type LimitedDoor, type RateLimit } from "./limits";
import { pruneWhenDue } from "./prune";
import { rateLimited } from "./refusals";

/**
 * The allowances, published from the door that enforces them. They are declared in `./limits` so that
 * the hygiene pass this file starts can read its window from the same table without the two files
 * depending on each other's initialisation; a caller still reads them from here, which is where the
 * counting is (ARCH-02, B-17).
 */
export { AUTH_RATE_LIMITS, type LimitedDoor, type RateLimit };

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
 * Both folds go through `foldedKey`, which tags both spaces so they cannot meet: were only the
 * folded side tagged, a caller could present a long value, compute the same unsecret digest
 * themselves, and present the literal `digest of <that hex>` as a second, short identity — two
 * identities sharing one row-group and one lock name.
 */
function keyed(identity: string): string {
  const folded = identity.trim().toLowerCase();
  return foldedKey(folded, countable(folded));
}

/**
 * Can this identity be written to `auth_attempts.identity` and indexed there as it stands? Asked of
 * the folded value rather than of the tagged key: the bound is about how much of a caller's own
 * string is carried, and the tag is a fixed handful of bytes on top, still far below the ceiling.
 */
function countable(folded: string): boolean {
  return isStorableText(folded) && Buffer.byteLength(folded, "utf8") <= IDENTITY_MAX_BYTES;
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
 * A full window is answered before anything is written, so a refused attempt is not a new attempt:
 * hammering a limited door cannot push the allowance further away than the law says it is.
 */
export async function admitAttempt(door: LimitedDoor, identity: string): Promise<void> {
  const full = await countAttempt(door, identity);
  if (full !== null) throw rateLimited(door, full);
}

/**
 * R-SPINE-001's sign-in limit, in the two halves a lockout lever has to be taken apart into.
 *
 * A hard refusal keyed on the address somebody is signing in *as* is a lever any stranger can pull:
 * they hammer a door with somebody else's address, and it is that person who is refused when they
 * come to sign in. So the refusing key names the *caller* as well — the same address presented by two
 * callers is two counts, and one of them cannot spend the other's allowance (`AppContext.client`).
 * Where the deployment cannot yet tell its callers apart, the key is still not the address alone; it
 * is that address as presented by the one caller the server can see, and it becomes per-caller the
 * moment the deployment can name them.
 *
 * The address's own counter is kept, because a stuffing run spread across callers is exactly what the
 * caller key cannot see — but it never refuses. It slows the answer down instead: pressure on one
 * account costs the attacker wall-clock on every attempt past the allowance, and costs the account's
 * owner a slower sign-in rather than a door they cannot open at all.
 */
export async function admitSignIn(client: string, email: string): Promise<void> {
  await admitAttempt("signIn", `${client} signing in as ${email}`);
  if ((await countAttempt("signIn", `the account ${email}`)) !== null) await pause(ACCOUNT_PRESSURE_DELAY_MS);
}

/**
 * What an attempt past the address's own allowance costs the caller who made it. Long enough that a
 * run of guesses against one account is measured in hours rather than minutes, short enough that the
 * person whose account is under that run still signs in on the attempt they make.
 */
const ACCOUNT_PRESSURE_DELAY_MS = 1_000;

function pause(ms: number): Promise<void> {
  return new Promise((settle) => setTimeout(settle, ms));
}

/**
 * Count one attempt at this door under this key, and answer how long the window stays full for — or
 * null when the attempt was counted and the caller may proceed. What a full window *means* is the
 * caller's to decide: `admitAttempt` refuses, `admitSignIn`'s account half slows the answer down.
 */
async function countAttempt(door: LimitedDoor, identity: string): Promise<number | null> {
  const limit = AUTH_RATE_LIMITS[door];
  const now = Date.now();
  const key = keyed(identity);
  const db = runAsSystem(REASON);

  const full = await db.transaction(async (tx) => {
    await holdStateLock(tx, lockName(door, key));

    // This key's own spent rows, dropped under the same lock the count is taken under: they can
    // count towards nothing, and the index the window is read through (`auth_attempts_window`) is
    // the index this predicate uses, so it costs the read it saves. Scoped to the caller: a
    // statement over every identity's rows is a whole-table DELETE on the hot path, which is the
    // shape a limiter must not have — that pass is the prune's, started below and awaited by nobody.
    await tx
      .delete(authAttempts)
      .where(and(eq(authAttempts.door, door), eq(authAttempts.identity, key), lt(authAttempts.attemptedAt, new Date(now - limit.windowMs))));

    const window = await tx
      .select({ at: authAttempts.attemptedAt })
      .from(authAttempts)
      .where(and(eq(authAttempts.door, door), eq(authAttempts.identity, key), gt(authAttempts.attemptedAt, new Date(now - limit.windowMs))))
      .orderBy(asc(authAttempts.attemptedAt));

    const oldest = window[0];
    if (oldest !== undefined && window.length >= limit.attempts) return limit.windowMs - (now - oldest.at.getTime());

    await tx.insert(authAttempts).values({ door, identity: key });
    return null;
  });

  // The hygiene every auth table owes, once a window at most and never on this answer's path: it is
  // started after the lock has been given back, and deliberately not awaited — the rows it removes
  // are rows nothing would read again, so no caller's answer may wait on them going (`./prune`).
  void pruneWhenDue();
  return full;
}
