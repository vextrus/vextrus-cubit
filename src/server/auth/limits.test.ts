/**
 * The figures the auth doors are held to, judged where they live (R-SPINE-001, R-SPINE-006).
 *
 * They sit apart from the doors so that the hygiene pass measured in them does not have to import a
 * door that starts it (ARCH-01) — which only pays if there is exactly one copy of each figure and the
 * doors publish that copy rather than a restatement (ARCH-02, B-17). Everything here is derived from
 * the table itself, never transcribed (B-19).
 */
import { describe, expect, test } from "vitest";

import { AUTH_RATE_LIMITS, SESSION_LIFETIME_MS } from "./limits";
import { AUTH_PRUNE_WINDOW_MS } from "./prune";
import { AUTH_RATE_LIMITS as DOOR_LIMITS } from "./rate-limit";
import { SESSION_LIFETIME_MS as DOOR_SESSION_LIFETIME_MS } from "./session";

describe("every limited door reads the one table", () => {
  test("the doors publish the table itself, not a copy of it", () => {
    expect(DOOR_LIMITS, "the counting door's allowances are the table's own object").toBe(AUTH_RATE_LIMITS);
    expect(DOOR_SESSION_LIFETIME_MS, "and a session's lifetime is the one figure the prune is measured in").toBe(SESSION_LIFETIME_MS);
  });

  test("each allowance is a real count over a real window", () => {
    const doors = Object.entries(AUTH_RATE_LIMITS);
    expect(doors.length, "the table names the doors that are limited").toBeGreaterThan(0);
    for (const [door, limit] of doors) {
      expect(Number.isInteger(limit.attempts) && limit.attempts > 0, `${door} allows a whole number of attempts`).toBe(true);
      expect(Number.isFinite(limit.windowMs) && limit.windowMs > 0, `${door} counts them over a real window`).toBe(true);
    }
  });

  test("the hygiene pass keeps attempts for as long as the longest window still counts them", () => {
    const longest = Math.max(...Object.values(AUTH_RATE_LIMITS).map((limit) => limit.windowMs));
    expect(AUTH_PRUNE_WINDOW_MS, "a shorter horizon would drop rows a door is still counting").toBe(longest);
  });
});
