// @vitest-environment node
/**
 * The limiter's count, against the storage that holds it (R-SPINE-001): the allowance a burst is
 * actually given, and what the hot path is allowed to delete on its way through.
 *
 * A private scratch database from the db lane's harness, which is imported first because it reads
 * DATABASE_URL at load; the doors are then pointed at it through the same variable, since the seam
 * keys its pools by URL. Raw SQL is spoken through psql as the bootstrap user, so a row-security
 * policy on an identity table can never make a probe silently read nothing.
 *
 * Nothing here transcribes the limiter's key: the key a door counts under is read back out of the
 * table after a real attempt, so a Builder who changes how an identity is folded is judged by the
 * same cases (B-19).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { BOOTSTRAP_URL } from "../../../db/__tests__/support/fixtures";
import { count, lit, scalar } from "../../../db/__tests__/support/live-sql";
import { closePools } from "../../core/db";
import { refusalOf } from "../../core/errors";
import { refusalCodeOf } from "../../core/faults/refusal-marker";
import { admitAttempt, AUTH_RATE_LIMITS } from "./rate-limit";
import { pruneWhenDue, resetPruneSchedule } from "./prune";

/** The door the criterion drives, named in the limiter's own table. */
const DOOR = "signUp";

/** How many callers arrive at once — comfortably past any allowance the table states. */
const BURST = 20;

let scratch: ScratchDb;
/** The scratch database as the bootstrap user, so a probe is never filtered by a policy. */
let admin: string;

/** A fresh server-derived identity nothing else in this run counts under. */
function freshIdentity(): { identity: string; mark: string } {
  const mark = randomUUID();
  return { identity: `verifier-${mark}@example.test`, mark };
}

/** The key the limiter actually counted this identity under, read back rather than re-derived. */
function keyOf(mark: string): string {
  return scalar(admin, `select identity from auth_attempts where identity like ${lit(`%${mark}%`)} limit 1;`);
}

/** How many rows this key holds at this door, optionally only the ones past the door's window. */
function rowsFor(key: string, olderThanMs?: number): number {
  const age = olderThanMs === undefined ? "" : ` and attempted_at < now() - interval '1 millisecond' * ${Math.round(olderThanMs)}`;
  return count(admin, `select count(*) from auth_attempts where door = ${lit(DOOR)} and identity = ${lit(key)}${age};`);
}

/** Plant one spent attempt under a key, older than the door's window by a whole window again. */
function plantStale(key: string): void {
  const age = AUTH_RATE_LIMITS[DOOR].windowMs * 2;
  scalar(
    admin,
    `insert into auth_attempts (door, identity, attempted_at)
     values (${lit(DOOR)}, ${lit(key)}, now() - interval '1 millisecond' * ${Math.round(age)})
     returning attempt_id;`,
  );
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;
  const url = new URL(BOOTSTRAP_URL);
  url.pathname = new URL(scratch.urlApp).pathname;
  admin = url.toString();
}, 240_000);

afterAll(async () => {
  // Nothing may be deleting rows in this database when it goes away: the schedule is drained first,
  // then the pools the doors opened are given back, then the database is dropped.
  await pruneWhenDue();
  await closePools();
  await scratch.drop();
}, 240_000);

describe("the limiter counts one identity's attempts atomically", () => {
  test("AC-1(a): a burst is admitted exactly as often as the door's allowance, and the rest are refused RATE_LIMITED", async () => {
    const { identity, mark } = freshIdentity();
    const allowance = AUTH_RATE_LIMITS[DOOR].attempts;

    const settled = await Promise.allSettled(Array.from({ length: BURST }, () => admitAttempt(DOOR, identity)));
    const admitted = settled.filter((outcome) => outcome.status === "fulfilled");
    const refused = settled.filter((outcome) => outcome.status === "rejected");

    expect(admitted.length, `${BURST} concurrent attempts are admitted exactly ${allowance} times`).toBe(allowance);
    expect(refused.length).toBe(BURST - allowance);
    for (const outcome of refused) {
      expect(refusalCodeOf((outcome as PromiseRejectedResult).reason), "every refused attempt carries the registered refusal").toBe(
        refusalOf("RATE_LIMITED").code,
      );
    }

    expect(rowsFor(keyOf(mark)), "the table holds one row per admitted attempt and no more").toBe(allowance);
  });

  test("AC-1(b): the hot path deletes the caller's own spent rows and nobody else's", async () => {
    // Armed first, so the once-a-window whole-table prune cannot be the thing that removes a row
    // this case is about — what is left to delete anything is the count's own statement.
    resetPruneSchedule();
    await pruneWhenDue();

    const caller = freshIdentity();
    const stranger = freshIdentity();
    await admitAttempt(DOOR, caller.identity);
    await admitAttempt(DOOR, stranger.identity);
    const callerKey = keyOf(caller.mark);
    const strangerKey = keyOf(stranger.mark);

    const window = AUTH_RATE_LIMITS[DOOR].windowMs;
    plantStale(callerKey);
    plantStale(strangerKey);
    expect(rowsFor(callerKey, window), "the caller's planted row is there to be deleted").toBe(1);
    expect(rowsFor(strangerKey, window), "the stranger's planted row is there to be left alone").toBe(1);

    await admitAttempt(DOOR, caller.identity);

    expect(rowsFor(callerKey, window), "the caller's own spent row is gone after the caller's next attempt").toBe(0);
    expect(rowsFor(strangerKey, window), "a spent row under another identity's key survives it").toBe(1);
    expect(rowsFor(callerKey), "the caller's rows inside the window are untouched").toBe(2);
  });
});
