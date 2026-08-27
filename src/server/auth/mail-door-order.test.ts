// The order the mailing doors judge in: the deployment's own address first, the caller's allowance
// second. A deployment that named no address cannot send whatever the caller does, so spending an
// attempt before saying so would refuse a retrying caller RATE_LIMITED — a refusal naming the caller
// for what is the operator's unnamed address, when LINK_NOT_SENDABLE is what was actually refused
// (R-SPINE-001, R-SPINE-007).
//
// The order is observable without a server: the limiter is the seam's first database call, and the
// seam refuses to build a pool with no `DATABASE_URL`. A door that counted first would therefore
// fault with that error instead of answering the registered refusal.
import { afterEach, describe, expect, test } from "vitest";

import { requestMagicLink, requestPasswordReset } from "./session";

const OPERATORS_OWN = process.env["DATABASE_URL"];

afterEach(() => {
  if (OPERATORS_OWN === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = OPERATORS_OWN;
});

/** The doors the criterion names, each called on a deployment that has named no address. */
const MAILING_DOORS: ReadonlyArray<[string, (request: { email: string; origin: string; requestId: string }) => Promise<{ sent: true }>]> = [
  ["spine.auth.requestPasswordReset", requestPasswordReset],
  ["spine.auth.requestMagicLink", requestMagicLink],
];

describe("the mailing doors judge the deployment's address before they spend a caller's allowance", () => {
  test.each(MAILING_DOORS)("%s refuses LINK_NOT_SENDABLE on an unconfigured deployment, reaching no database", async (door, call) => {
    delete process.env["DATABASE_URL"];

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      // Well past the door's allowance: a door that counted first would run out and answer
      // RATE_LIMITED, and one that counted at all would fault for want of a database.
      const refused = await call({ email: "someone@example.test", origin: "", requestId: `req-${attempt}` }).then(
        () => null,
        (error: unknown) => error,
      );
      expect(refused, `${door} refuses rather than sending on a deployment with no address`).not.toBeNull();
      expect((refused as { refusalCode?: string }).refusalCode, `${door} answers the registered refusal on attempt ${attempt}`).toBe(
        "LINK_NOT_SENDABLE",
      );
    }
  });
});
