// The hygiene the auth tables owe, in one home (ARCH-02, B-17): `auth_attempts` rows too old to count
// towards any window, `sessions` rows past the lifetime that could ever resolve them, and
// `auth_tokens` rows past their expiry. Three tables, one statement each, one schedule.
//
// It lives apart from the doors because it is about every identity rather than the one in front of
// the door. Each door used to keep its own half of this — the limiter swept the whole attempts table
// on the way through a count, `startSession` deleted the expired sessions of whichever account
// happened to sign in, and nothing at all ended a spent token — so the cost fell on the hot path, the
// scope was whoever turned up, and one table was never swept at all.
//
// Nothing waits on it. `pruneWhenDue` is started from a limited door and awaited by nobody: the rows
// it removes are rows no statement in this tree would ever read again, so a caller's answer must not
// depend on them going. A failure is therefore not the caller's — it is recorded through the one
// fault seam (ARCH-03) and the promise settles, so a prune that meets a database going away cannot
// surface as an unhandled rejection in somebody else's request.
import { authAttempts, authTokens, lt, runAsSystem, sessions } from "../../core/db";
import { reportFault } from "../../core/faults/report";
import { AUTH_RATE_LIMITS, SESSION_LIFETIME_MS } from "./limits";
import { oncePerWindow } from "./once-per-window";

/** What the fault seam calls this work, when it has to record a failure of it (ARCH-03). */
export const PRUNE_ROUTE = "spine.auth.prune";

/** Whom a failure of it is recorded against: no request made it and no person asked for it. */
const PRUNE_ACTOR = "prune";

/**
 * How often the pass runs, and how old an attempt must be to be swept: the longest window any door is
 * limited over, read from the allowances rather than restated (ARCH-02). A row older than that counts
 * towards nothing, whoever it belonged to, and running the pass on that same period bounds the table
 * at what one window's traffic can put in it — which is all the deletion was ever for.
 */
export const AUTH_PRUNE_WINDOW_MS = Math.max(...Object.values(AUTH_RATE_LIMITS).map((limit) => limit.windowMs));

const REASON = "R-SPINE-001 auth hygiene: removing the attempt, session and token rows no door could read again";

/** What one pass removed, per table. */
export interface PrunedRows {
  attempts: number;
  sessions: number;
  tokens: number;
}

/**
 * Remove every spent row of the three tables, whoever they belonged to. Identity is not tenant-scoped
 * and this is nobody's request, so it runs under one system reason (SEAM-TENANT).
 *
 * Each statement answers the rows it deleted rather than a count taken afterwards: a concurrent
 * sign-in writing a row while this runs must not be counted as something this pass removed.
 */
export async function pruneExpiredAuthRows(now: number = Date.now()): Promise<PrunedRows> {
  const db = runAsSystem(REASON);

  const attempts = await db
    .delete(authAttempts)
    .where(lt(authAttempts.attemptedAt, new Date(now - AUTH_PRUNE_WINDOW_MS)))
    .returning({ id: authAttempts.attemptId });

  // Revoked or not: a session that began before the lifetime's edge can never be resolved again
  // (`resolveSession` reads the same predicate), so the row proves nothing about anybody.
  const spentSessions = await db
    .delete(sessions)
    .where(lt(sessions.createdAt, new Date(now - SESSION_LIFETIME_MS)))
    .returning({ id: sessions.sessionId });

  // By expiry rather than by age: a token's own TTL is what `consumeToken` refuses it past, and the
  // kinds do not share one (`AUTH_TOKEN_TTLS`).
  const tokens = await db
    .delete(authTokens)
    .where(lt(authTokens.expiresAt, new Date(now)))
    .returning({ id: authTokens.authTokenId });

  return { attempts: attempts.length, sessions: spentSessions.length, tokens: tokens.length };
}

/** The schedule the pass is due on — process-anchored, so two module instances share one window. */
const schedule = oncePerWindow("auth-prune", AUTH_PRUNE_WINDOW_MS);

/** The pass that is running now, if one is: what a caller arriving mid-pass is handed. */
let inFlight: Promise<void> | null = null;

/**
 * Start a pass if one is due, and answer the promise it runs on — or null when the window has already
 * had its pass. A burst of callers therefore starts one prune between them and not one each: the
 * in-flight promise is handed to everyone who asks while it runs, and the window holds the next one
 * off after it settles.
 *
 * The promise is answered rather than swallowed so that a caller who must know the pass is over — a
 * test, or a lane about to take the database away — can await it. Nothing on a request path does.
 */
export function pruneWhenDue(now: number = Date.now()): Promise<void> | null {
  if (inFlight !== null) return inFlight;
  if (!schedule.due(now)) return null;

  const running: Promise<void> = pruneExpiredAuthRows(now)
    .then(() => undefined)
    .catch((cause: unknown) => {
      reportFault({ requestId: PRUNE_ROUTE, actor: PRUNE_ACTOR, route: PRUNE_ROUTE, cause });
    })
    .finally(() => {
      if (inFlight === running) inFlight = null;
    });

  inFlight = running;
  return running;
}

/** Arm the schedule again, so the next caller starts a pass. */
export function resetPruneSchedule(): void {
  schedule.reset();
}
