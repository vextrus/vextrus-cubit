// Breaker acceptance for S-Auth under the browser's Back button (R-SPINE-001, R-SPINE-007,
// Decision § 2 and § 3).
//
// A mailed magic link is spent by the panel behind it and the person is then sent onward with
// `router.push` (src/app/(auth)/token-panel.tsx), so the link's own URL stays in the session
// history. Back is not an exotic gesture — it is the first thing a person does when they land
// somewhere and want to check what just happened — and it puts them straight back on
// `/magic-link?token=…`, where the panel mounts again and spends the same single-use token a second
// time. It is gone, so the screen answers TOKEN_NOT_VALID: *This link is no longer valid* with the
// remedy *Request a fresh link*, shown to somebody whose sign-in worked and whose session is live
// at that very moment.
//
// This file asserts only that floor: a person the product has just signed in is not told their link
// is dead. It says nothing about how — leaving the spent link out of the history (`router.replace`),
// or the panel recognising the session it already handed out, satisfy it equally.
//
// The describe title carries the J-001 tag so `pnpm e2e --journey J-001` (which forwards to
// Playwright's --grep) collects this file: a guarantee no gate invocation runs is green-by-omission,
// which J-001's own words forbid.
import { expect, test } from "@playwright/test";
import { newestMail } from "../support/outbox";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";

/** Long enough for the panel's own call to be sent, answered and painted. */
const SETTLE_MS = 2_000;

const PASSWORD = "correct-horse-battery-staple-9";

/** An address of this run's own, so the case never meets another journey's account. */
function freshAddress(): string {
  return `breaker-back-${Date.now().toString(36)}@cubit.test`;
}

test.describe("J-001 S-AUTH-BREAKER — Back after a mailed link", () => {
  test("S-AUTH-BREAKER: going back after a magic-link sign-in does not tell a signed-in person their link is dead", async ({ page }) => {
    const s = new SAuthPage(page);
    const email = freshAddress();

    await page.goto(S_AUTH.signUp);
    await s.email.fill(email);
    await s.password.fill(PASSWORD);
    await s.workspace.fill("Breaker Back");
    await s.submit.click();
    await expect(s.notice, "the sign-up door finishes on the screen with its notice (Decision § 2)").toBeVisible();

    await page.goto(S_AUTH.magicLink);
    await s.email.fill(email);
    await s.submit.click();
    await expect(s.notice, "the magic-link door answers the same sent notice for every address (Decision § 2)").toBeVisible();

    const mail = await newestMail(email, "magic-link");
    await page.goto(`${S_AUTH.magicLink}?token=${encodeURIComponent(mail.token)}`);
    await page.waitForURL((url) => url.pathname === S_AUTH.home, { timeout: 30_000 });

    // The Back button, as the browser itself performs it on the entry `router.push` left behind.
    await page.evaluate(() => {
      window.history.back();
    });
    await page.waitForTimeout(SETTLE_MS);

    // The session the link handed out is live — read before the assertion below, so a failure there
    // is unambiguously "signed in, and told otherwise" rather than "signed out all along".
    const listing = await page.request.get("/api/trpc/spine.auth.listSessions");
    expect(listing.ok(), "the magic link signed this person in, so their session list is readable (AC-5)").toBe(true);

    await expect(
      s.refusal,
      "a person whose magic-link sign-in worked, and whose session is live, must not be shown TOKEN_NOT_VALID for pressing Back (R-SPINE-001, Decision § 3)",
    ).toHaveCount(0);
    await expect(s.fault, "and Back is not a failure of the machine either (R-SPINE-007)").toHaveCount(0);
  });
});
