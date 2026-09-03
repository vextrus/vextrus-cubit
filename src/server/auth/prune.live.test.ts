// @vitest-environment node
/**
 * The hygiene the auth tables owe, in its one home (ARCH-02, B-17): what a prune removes, what it
 * leaves, and the schedule that keeps a burst from starting one prune per caller.
 *
 * The rows are planted through psql as the bootstrap user and read back the same way, so the case
 * judges the statements the prune actually issued rather than anything the seam reports about
 * itself. Every count is taken as a difference across the call, so a row another case in this file
 * planted can never make or break one (B-19).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { BOOTSTRAP_URL } from "../../../db/__tests__/support/fixtures";
import { count, lit, scalar } from "../../../db/__tests__/support/live-sql";
import { closePools } from "../../core/db";
import { AUTH_PRUNE_WINDOW_MS, pruneExpiredAuthRows, pruneWhenDue, resetPruneSchedule } from "./prune";
import { AUTH_RATE_LIMITS } from "./rate-limit";
import { SESSION_LIFETIME_MS, signIn, signUp } from "./session";

let scratch: ScratchDb;
let admin: string;

/** The address this deployment answers at, as the harness names it — never restated here. */
const ORIGIN = process.env["CUBIT_PUBLIC_ORIGIN"] ?? "";
const PASSWORD = "correct-horse-battery-staple-9";

/** An interval literal, so an age derived in milliseconds is spoken to postgres without a second unit. */
function ago(ms: number): string {
  return `now() - interval '1 millisecond' * ${Math.round(ms)}`;
}

function ahead(ms: number): string {
  return `now() + interval '1 millisecond' * ${Math.round(ms)}`;
}

/** An account to hang planted rows off; the address carries a mark nothing else in the run shares. */
function plantUser(mark: string): string {
  return scalar(admin, `insert into users (email, password_hash) values (${lit(`planted-${mark}@example.test`)}, 'planted') returning user_id;`);
}

function plantSession(userId: string, hash: string, createdAt: string): void {
  scalar(
    admin,
    `insert into sessions (user_id, token_hash, device_label, created_at, last_seen_at)
     values (${lit(userId)}, ${lit(hash)}, 'planted device', ${createdAt}, now()) returning session_id;`,
  );
}

function plantToken(userId: string, hash: string, expiresAt: string): void {
  scalar(
    admin,
    `insert into auth_tokens (user_id, kind, token_hash, expires_at)
     values (${lit(userId)}, 'planted', ${lit(hash)}, ${expiresAt}) returning auth_token_id;`,
  );
}

function plantAttempt(identity: string, attemptedAt: string): void {
  scalar(admin, `insert into auth_attempts (door, identity, attempted_at) values ('signUp', ${lit(identity)}, ${attemptedAt}) returning attempt_id;`);
}

/** How many rows each pruned table holds right now — the denominator every answer is checked against. */
function held(): { attempts: number; sessions: number; tokens: number } {
  return {
    attempts: count(admin, "select count(*) from auth_attempts;"),
    sessions: count(admin, "select count(*) from sessions;"),
    tokens: count(admin, "select count(*) from auth_tokens;"),
  };
}

function exists(table: string, column: string, value: string): boolean {
  return count(admin, `select count(*) from ${table} where ${column} = ${lit(value)};`) === 1;
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;
  const url = new URL(BOOTSTRAP_URL);
  url.pathname = new URL(scratch.urlApp).pathname;
  admin = url.toString();
  expect(ORIGIN, "the harness names the address this deployment answers at").not.toBe("");
}, 240_000);

afterAll(async () => {
  await pruneWhenDue();
  await closePools();
  await scratch.drop();
}, 240_000);

describe("one prune keeps every auth table small", () => {
  test("AC-2(a): pruneExpiredAuthRows removes the spent rows of all three tables, leaves the live ones, and answers what it removed", async () => {
    const mark = randomUUID();
    const userId = plantUser(mark);

    const spentAttempt = `spent-${mark}`;
    const liveAttempt = `live-${mark}`;
    plantAttempt(spentAttempt, ago(AUTH_PRUNE_WINDOW_MS + AUTH_RATE_LIMITS.signUp.windowMs));
    plantAttempt(liveAttempt, "now()");

    const spentSession = `spent-session-${mark}`;
    const liveSession = `live-session-${mark}`;
    plantSession(userId, spentSession, ago(SESSION_LIFETIME_MS + AUTH_RATE_LIMITS.signUp.windowMs));
    plantSession(userId, liveSession, "now()");

    const spentToken = `spent-token-${mark}`;
    const liveToken = `live-token-${mark}`;
    plantToken(userId, spentToken, ago(AUTH_RATE_LIMITS.signUp.windowMs));
    plantToken(userId, liveToken, ahead(SESSION_LIFETIME_MS));

    const before = held();
    const removed = await pruneExpiredAuthRows();
    const after = held();

    expect(exists("auth_attempts", "identity", spentAttempt), "an attempt older than the longest window is gone").toBe(false);
    expect(exists("sessions", "token_hash", spentSession), "a session older than its lifetime is gone, signing in or not").toBe(false);
    expect(exists("auth_tokens", "token_hash", spentToken), "a token past its expiry is gone").toBe(false);

    expect(exists("auth_attempts", "identity", liveAttempt), "an attempt inside the window stays").toBe(true);
    expect(exists("sessions", "token_hash", liveSession), "a session inside its lifetime stays").toBe(true);
    expect(exists("auth_tokens", "token_hash", liveToken), "a token that has not expired stays").toBe(true);

    expect(removed, "the answer counts exactly the rows the three statements removed").toEqual({
      attempts: before.attempts - after.attempts,
      sessions: before.sessions - after.sessions,
      tokens: before.tokens - after.tokens,
    });
    expect(removed.attempts).toBeGreaterThanOrEqual(1);
    expect(removed.sessions).toBeGreaterThanOrEqual(1);
    expect(removed.tokens).toBeGreaterThanOrEqual(1);
  });

  test("AC-2(b): a burst starts one prune, the window holds it off, and a reset arms it again", async () => {
    resetPruneSchedule();
    const now = Date.now();

    const started = Array.from({ length: 5 }, () => pruneWhenDue(now));
    const first = started[0];
    expect(first, "a due schedule starts a prune and answers the promise it is running on").not.toBeNull();
    for (const asked of started) expect(asked, "every caller of the same burst is handed the one in-flight prune").toBe(first);

    await first;
    expect(pruneWhenDue(now), "inside the window, a further caller starts nothing").toBeNull();

    resetPruneSchedule();
    const armed = pruneWhenDue(now);
    expect(armed, "a reset schedule is due again").not.toBeNull();
    expect(armed, "and the prune it starts is a new one").not.toBe(first);
    await armed;
  });

  test("AC-2(c): starting a session deletes nothing — an account's expired session outlives its own sign-in", async () => {
    // The schedule is armed before anything is planted, so the fire-and-forget prune the doors start
    // is not due while this case runs: what is left to delete a row is a statement of the doors' own.
    resetPruneSchedule();
    await pruneWhenDue();

    const mark = randomUUID();
    const email = `signer-${mark}@example.test`;
    await signUp({ email, password: PASSWORD, tenantName: `Workspace ${mark}`, deviceLabel: "verifier", origin: ORIGIN, requestId: `req-${mark}` });

    const userId = scalar(admin, `select user_id from users where email like ${lit(`%${mark}%`)} limit 1;`);
    const expired = `expired-${mark}`;
    plantSession(userId, expired, ago(SESSION_LIFETIME_MS + AUTH_RATE_LIMITS.signUp.windowMs));

    await signIn({ email, password: PASSWORD, deviceLabel: "verifier", client: `client-${mark}` });

    expect(exists("sessions", "token_hash", expired), "signing in issues no DELETE of its own").toBe(true);
    await pruneExpiredAuthRows();
    expect(exists("sessions", "token_hash", expired), "the prune is what ends it").toBe(false);
  });
});
