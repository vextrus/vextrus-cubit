// Breaker acceptance for S-Auth (R-SPINE-007, ARCH-03/B-21, Decision § 1 and § 4).
//
// R-SPINE-007 makes the S-Auth screens distinguish "the machine failed" from "what you presented
// does not work". The fault card is the first of those two answers: it says *Something went wrong
// on our side*, it says *The fault has been recorded for the operators*, and it prints a fault id
// for the person to quote — and every one of those sentences is a claim about the server.
//
// A person who presses the submit button with a field still blank has not made the server fail.
// The screens carry no requiredness on their inputs, so the browser lets the empty form go, the
// door's own input reader rejects it, and the answer that comes back is not refusal-marked — so
// `src/server/trpc.ts` reports a fault, the wire carries a fault id, and `src/app/(auth)/answers.ts`
// renders the fault card. The person is told the machine broke, and the operator gets a
// FaultRecord, for a blank field.
//
// This file holds only that: a submit that the person's own browser should never have sent must not
// come back as the machine's failure. It asserts nothing about *how* the blank is stopped — a
// `required` input, which invents no copy and no credential rule (Decision I-13 bans password
// strength and address formats, not requiredness), satisfies it exactly as well as anything else.
//
// The describe title carries the J-001 tag so `pnpm e2e --journey J-001` (which forwards to
// Playwright's --grep) collects this file: a guarantee no gate invocation runs is green-by-omission,
// which J-001's own words forbid.
import { expect, test } from "@playwright/test";

/** The tRPC lane the S-Auth forms speak through (src/app/(auth)/transport.ts). */
const LANE = "/api/trpc/spine.auth.";

/** Long enough for a call that was sent to come back and paint; nothing here waits on a happy path. */
const SETTLE_MS = 2_000;

/** Every auth call this page made — a blank form must make none of them. */
function watchCalls(page: import("@playwright/test").Page): string[] {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(LANE)) calls.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  return calls;
}

test.describe("J-001 S-AUTH-BREAKER — a blank submit is not a server fault", () => {
  test("S-AUTH-BREAKER: /sign-up with every field blank does not answer the fault card", async ({ page }) => {
    const calls = watchCalls(page);
    await page.goto("/sign-up");
    await expect(page.getByTestId("s-auth-tenant-name")).toBeVisible();

    await page.getByTestId("s-auth-submit").click();
    await page.waitForTimeout(SETTLE_MS);

    expect(calls, "a sign-up submit with every field blank must not be sent — the browser's own requiredness stops it").toEqual([]);
    await expect(page.getByTestId("s-auth-fault"), "a blank field is not a failure of the machine, so the fault card must not render (R-SPINE-007)").toHaveCount(0);
  });

  test("S-AUTH-BREAKER: /sign-in with both fields blank does not answer the fault card", async ({ page }) => {
    const calls = watchCalls(page);
    await page.goto("/sign-in");
    await expect(page.getByTestId("s-auth-password")).toBeVisible();

    await page.getByTestId("s-auth-submit").click();
    await page.waitForTimeout(SETTLE_MS);

    expect(calls, "a sign-in submit with both fields blank must not be sent — the browser's own requiredness stops it").toEqual([]);
    await expect(page.getByTestId("s-auth-fault"), "a blank field is not a failure of the machine, so the fault card must not render (R-SPINE-007)").toHaveCount(0);
  });
});
