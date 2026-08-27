// Breaker acceptance for the other half of R-SPINE-007: the fault surface, reached from a browser.
//
// The sibling breaker (s-auth-breaker.spec.ts) holds the floor — a blank submit is never the
// machine's failure. This file holds the ceiling. When the machine does fail, the screen must say so
// on the surface the Decision reserves for it, carrying the id the operator's FaultRecord is filed
// under, and never inside the refusal wrapper: "two different answers". Without a browser-level
// check, `[data-testid=s-auth-fault]` is a surface only an injected `perform` has ever painted
// (Decision § 7's jsdom acceptance), and nothing proves the shipped transport can reach it.
//
// Two failures, because Decision § 1 and I-12 rule two bodies for the card: a server that answered a
// fault (the id line) and a server that was never reached (no id line, and no invented id).
//
// The first is induced the only way a browser can induce it. src/server/auth/router.ts says of a
// door handed a value that is not a string: "no browser can produce that, and a plain throw for it
// is honest" — so the request body is rewritten on the wire and the real door is called wrongly.
// Nothing about the answer is faked: the built server really fails, `src/server/trpc.ts` really
// files the record, and the id the card prints is that record's own. The second aborts the request,
// which is what a browser with no network does.
//
// The describe title carries the J-001 tag so `pnpm e2e --journey J-001` (which forwards to
// Playwright's --grep) collects this file: a guarantee no gate invocation runs is green-by-omission,
// which J-001's own words forbid.
import { expect, test } from "@playwright/test";

/** The tRPC lane the S-Auth forms speak through (src/app/(auth)/transport.ts). */
const SIGN_IN = "**/api/trpc/spine.auth.signIn";

/** What the browser sends: filled boxes, so the form submits and the door is really called. */
const EMAIL = "fault-surface@cubit.test";
const PASSWORD = "correct-horse-battery-staple-9";

/**
 * The same call, miscalled on the wire: `email` is not a string, which no screen can produce and no
 * registered code speaks to, so the door throws unmarked and the seam answers a fault.
 */
const MISCALLED = JSON.stringify({ email: 0, password: 0 });

/** A fault id as `src/core/faults/report.ts` mints it (`randomUUID`) — what the card must quote. */
const FAULT_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function submitSignIn(page: import("@playwright/test").Page): Promise<void> {
  await page.getByTestId("s-auth-email").fill(EMAIL);
  await page.getByTestId("s-auth-password").fill(PASSWORD);
  await page.getByTestId("s-auth-submit").click();
}

test.describe("J-001 S-AUTH-BREAKER — the fault surface is reachable, and is never the refusal", () => {
  test("S-AUTH-BREAKER: a fault the server really filed renders the fault card with its id", async ({ page }) => {
    await page.route(SIGN_IN, (route) => route.continue({ postData: MISCALLED }));
    await page.goto("/sign-in");
    await submitSignIn(page);

    const fault = page.getByTestId("s-auth-fault");
    await expect(fault, "a failure the taxonomy does not register renders the fault surface (R-SPINE-007)").toBeVisible();
    await expect(fault, "the card quotes the id the operator's FaultRecord is filed under (ARCH-03, B-21)").toContainText(FAULT_ID);
    await expect(page.getByTestId("s-auth-refusal"), "a fault is never dressed as a refusal — two different answers").toHaveCount(0);
  });

  test("S-AUTH-BREAKER: a server that was never reached renders the fault card without an id", async ({ page }) => {
    await page.goto("/sign-in");
    await page.route(SIGN_IN, (route) => route.abort("failed"));
    await submitSignIn(page);

    const fault = page.getByTestId("s-auth-fault");
    await expect(fault, "a transport that failed is a fault of reachability, never silence (Decision I-12)").toBeVisible();
    await expect(fault, "no id came back, so the card invents none").not.toContainText(FAULT_ID);
    await expect(page.getByTestId("s-auth-refusal"), "an unreachable server is not an answer the taxonomy gave").toHaveCount(0);
  });
});
