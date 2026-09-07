// @vitest-environment node
/**
 * The allowance the accept-invitation *read* is held to (R-SPINE-006, Q-12), judged in the one table
 * of figures the doors publish (ARCH-02, B-17).
 *
 * A render is not a mutation. R-SPINE-006 limits what a tenant admin *does* to a workspace, and the
 * accept action still spends that budget; the page that merely shows the offer a mailed token names
 * gets a door of its own, so reloading a link cannot cost an admin one of the moves they hold for
 * moving people. The two counters are separate exactly because they answer different questions.
 *
 * Nothing here reaches into the table by a key the compiler already knows: every entry is looked up
 * by name through `Object.entries`, so a door the table has not got yet is a missing entry rather
 * than a type error, and the case reads as the missing feature it is.
 */
import { expect, test } from "vitest";

import { AUTH_RATE_LIMITS, type RateLimit } from "../../src/server/auth/limits";
import { AUTH_RATE_LIMITS as DOOR_LIMITS } from "../../src/server/auth/rate-limit";

/** A minute, which is the window every auth door in this table counts over. */
const MINUTE = 60_000;

/** The table as a lookup by door name, which is how a door not yet in it can be asked about at all. */
function doorsOf(table: Readonly<Record<string, RateLimit>>): Map<string, RateLimit> {
  return new Map(Object.entries(table));
}

/**
 * The doors that were limited before this one, with the allowances they were limited by. AC-1 says
 * they are unchanged, and "unchanged" is the one thing a table cannot be asked about itself, so the
 * figures are stated here; a later increment that lawfully moves one re-baselines this case with it
 * (B-20). Their names are read as a containment, never as a census: the spec schedules further read
 * doors as its own out-of-scope IOUs, and a table the law lets grow is not one this file may close.
 */
const DOORS_ALREADY_LIMITED: Readonly<Record<string, RateLimit>> = {
  signIn: { attempts: 8, windowMs: MINUTE },
  signUp: { attempts: 8, windowMs: MINUTE },
  requestMagicLink: { attempts: 4, windowMs: MINUTE },
  requestPasswordReset: { attempts: 4, windowMs: MINUTE },
  tenancyAdmin: { attempts: 12, windowMs: MINUTE },
};

test("AC-1: the accept-invitation read is a limited door of its own, thirty attempts a minute", () => {
  const read = doorsOf(AUTH_RATE_LIMITS).get("acceptInvitationRead");

  expect(read, "the page's read is limited by the one table of allowances, not by a figure of its own").toBeDefined();
  expect(read, "thirty a minute: far above anyone reloading a mailed link, far below walking the token space").toEqual({
    attempts: 30,
    windowMs: MINUTE,
  });
  expect(Object.isFrozen(read), "an allowance the law states is not one a caller can rewrite at runtime").toBe(true);

  expect(DOOR_LIMITS, "the counting door publishes the very table the figures live in, never a copy of it").toBe(AUTH_RATE_LIMITS);
  expect(doorsOf(DOOR_LIMITS).get("acceptInvitationRead"), "so the door the limiter counts is the entry read above").toBe(read);
});

test("AC-1: the doors that were already limited are untouched, and the read door joined them", () => {
  const doors = doorsOf(AUTH_RATE_LIMITS);

  for (const [door, limit] of Object.entries(DOORS_ALREADY_LIMITED)) {
    expect(doors.get(door), `${door} keeps the allowance it was limited by — a read door buys itself nothing from the others`).toEqual(limit);
  }

  for (const door of Object.keys(DOORS_ALREADY_LIMITED)) {
    expect(doors.has(door), `${door} is still a door of the table — none dropped and none renamed`).toBe(true);
  }
  expect(
    doors.has("acceptInvitationRead"),
    "the doors already limited are all still here and the read door joined them — the table may lawfully gain further doors (out-of-scope IOUs), so this is a containment, not a census",
  ).toBe(true);
});
