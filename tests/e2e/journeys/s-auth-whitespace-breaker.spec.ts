// Breaker acceptance for S-Auth (R-SPINE-007, ARCH-03/B-21, Decision § 1 and I-13).
//
// R-SPINE-007 makes the S-Auth screens distinguish "the machine failed" from "what you presented
// does not work". The fault card is the first of those two: it says the failure is on our side, it
// says the fault has been recorded for the operators, and it prints a fault id for the person to
// quote. Every one of those sentences is a claim about the server.
//
// A person who types a space into the password box has not made the server fail. They have
// presented a credential that identifies no account, and the closed taxonomy already registers the
// answer for that — CREDENTIALS_NOT_VALID, rendered at [data-testid=s-auth-refusal].
//
// The blank-field case is settled and is not this file's: the inputs carry the browser's own
// `required`, so a wholly empty submit is never sent. Requiredness cannot reach this one. To the
// browser a single space is a value, and the screen may not lawfully invent a rule that would
// reject it — Decision I-13 bans a screen judging a credential, and "a password may not be only
// whitespace" is exactly such a judgement. So the submit is sent, `src/server/auth/router.ts`
// rejects it in its input reader with an unmarked `Error`, `src/server/trpc.ts` sees no refusal
// marker and files a FaultRecord, and the person is shown the fault card with a fault id.
//
// This file asserts only that floor — the fault card must not be the answer to a credential — and
// nothing about how the door reaches it.
import { expect, test } from "@playwright/test";

import { S_AUTH, SAuthPage } from "../pages/s-auth.page";

/** The tRPC lane the S-Auth forms speak through (src/app/(auth)/transport.ts). */
const LANE = "/api/trpc/spine.auth.";

/** Long enough for a call that was sent to come back and paint. */
const SETTLE_MS = 4_000;

/** A space is what the person left in the box; the browser's requiredness counts it as filled in. */
const WHITESPACE_PASSWORD = " ";

/** Every auth call this page made — evidence for the failure message, never an assertion of its own. */
function watchCalls(page: import("@playwright/test").Page): string[] {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(LANE)) calls.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  return calls;
}

/** A fresh address, so no run of this file can pass or fail on another's rows. */
function freshEmail(label: string): string {
  return `breaker-${label}-${Date.now().toString(36)}@cubit.test`;
}

function faultCardReport(where: string, calls: readonly string[]): string {
  return (
    `${where}: the screen answered a credential with the fault card — it tells the person the machine broke on our ` +
    `side and hands them a fault id to quote, and the operator gets a FaultRecord, for a password that is a space ` +
    `(R-SPINE-007, ARCH-03). The closed taxonomy already registers the answer for a credential that identifies no ` +
    `account. A blank submit is stopped by the inputs' own requiredness, but a space is a value requiredness admits ` +
    `and no screen may lawfully reject (Decision I-13). Calls the page made: ${JSON.stringify(calls)}`
  );
}

test.describe("S-AUTH-BREAKER — a whitespace credential is not a server fault", () => {
  test("S-AUTH-BREAKER: /sign-in with a password of one space does not answer the fault card", async ({ page }) => {
    const calls = watchCalls(page);
    const screen = new SAuthPage(page);

    await screen.open(S_AUTH.signIn);
    await expect(screen.password).toBeVisible();

    await screen.signInWith(freshEmail("sign-in"), WHITESPACE_PASSWORD);
    await page.waitForTimeout(SETTLE_MS);

    await expect(screen.fault, faultCardReport("/sign-in", calls)).toHaveCount(0);
  });

  test("S-AUTH-BREAKER: /sign-up with a password of one space does not answer the fault card", async ({ page }) => {
    const calls = watchCalls(page);
    const screen = new SAuthPage(page);

    await screen.open(S_AUTH.signUp);
    await expect(screen.workspace).toBeVisible();

    await screen.signUpWith(freshEmail("sign-up"), WHITESPACE_PASSWORD, "Breaker Workspace");
    await page.waitForTimeout(SETTLE_MS);

    await expect(screen.fault, faultCardReport("/sign-up", calls)).toHaveCount(0);
  });
});
