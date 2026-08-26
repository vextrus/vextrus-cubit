// J-001a — the auth-and-sessions half of J-001, end to end and in the order a person lives it:
// sign up (naming the workspace) → verify from the mail → sign in → magic link → reset, which
// revokes the account's other sessions → the device list, and a revoke from it → sign out.
//
// The invitation segments of J-001 are the J-001b leaf's: this file walks only the segments this
// increment builds, and names itself J-001a so nothing claims the whole journey.
import { expect, test } from "@playwright/test";
import { auth } from "../../../src/ui/strings/auth";
import { SAuthPage, SESSION_COOKIE, S_AUTH } from "../pages/s-auth.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";

/** One run's identity: a journey brings its own account rather than leaning on the last run's. */
const RUN = Date.now().toString(36);
const EMAIL = `j001a-${RUN}@cubit.test`;
const PASSWORD = `first-password-${RUN}`;
const NEW_PASSWORD = `second-password-${RUN}`;
const WORKSPACE = `Meridian Builders ${RUN}`;

test.describe("J-001a — auth and sessions", () => {
  test("J-001a: sign up, verify, sign in, magic link, reset, revoke and sign out", async ({ page, browser, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const screen = new SAuthPage(page);

    /* --- sign up: the door that names the workspace (R-SPINE-002) --- */
    await screen.open(S_AUTH.signUp);
    await expect(screen.workspace).toBeVisible();
    await checkpoint(page, testInfo, "s-auth-sign-up");

    // A single space is a value the browser's own requiredness admits and no screen may lawfully
    // reject (Decision I-13), so the door judges it — and answers the entry that is true of a person
    // creating an account, not the one that says their email and password match no account.
    await screen.signUpWith(EMAIL, " ", WORKSPACE);
    await screen.refusedWith("DETAIL_NOT_GIVEN");
    await screen.signUpWith(EMAIL, PASSWORD, "   ");
    await screen.refusedWith("DETAIL_NOT_GIVEN");

    await screen.signUpWith(EMAIL, PASSWORD, WORKSPACE);
    await screen.expectNotice();
    // The heading names what the screen is showing now: the form it named is gone.
    await expect(screen.heading, "a finished door renames the screen it finished on").toHaveText(auth.auth_sign_up_sent_title);

    /* --- verify: the token comes out of the outbox, exactly as a person's mail would --- */
    const verifyMail = await newestMail(EMAIL, "verify-email");
    expect(verifyMail.url, "the verification mail carries a link to the verify route").toContain(S_AUTH.verify);
    await screen.openWithToken(S_AUTH.verify, verifyMail.token);
    await screen.expectNotice();

    /* --- sign in with the credentials, and read the device list --- */
    await screen.open(S_AUTH.signIn);
    await screen.signInWith(EMAIL, PASSWORD);
    await expect(page).toHaveURL(`${origin}${S_AUTH.home}`);

    await screen.open(S_AUTH.sessions);
    await expect(screen.currentSession).toHaveCount(1);
    await checkpoint(page, testInfo, "s-auth-signed-in-sessions");

    /* --- magic link: asked for, mailed, spent --- */
    await screen.open(S_AUTH.magicLink);
    await screen.email.fill(EMAIL);
    await screen.submit.click();
    await screen.expectNotice();

    const magicMail = await newestMail(EMAIL, "magic-link");
    await screen.openWithToken(S_AUTH.magicLink, magicMail.token);
    await expect(page).toHaveURL(`${origin}${S_AUTH.home}`);

    // The session the magic link started is what the reset must revoke, so it is held on another
    // device before the reset happens — a revocation nobody was holding proves nothing.
    const revokedByReset = await screen.sessionToken();

    /* --- reset: the password is set and the account's other sessions end (R-SPINE-001) --- */
    await screen.open(S_AUTH.reset);
    await screen.email.fill(EMAIL);
    await screen.submit.click();
    await screen.expectNotice();

    const resetMail = await newestMail(EMAIL, "password-reset");
    await screen.openWithToken(S_AUTH.reset, resetMail.token);
    await screen.password.fill(NEW_PASSWORD);
    await screen.submit.click();
    await screen.expectNotice();
    await expect(screen.heading, "the reset screen says the password is set, rather than still asking for one").toHaveText(auth.auth_reset_done_title);
    await checkpoint(page, testInfo, "s-auth-reset-done");

    const other = await browser.newContext({ baseURL });
    await other.addCookies([{ name: SESSION_COOKIE, value: revokedByReset, url: origin }]);
    const otherScreen = new SAuthPage(await other.newPage());

    await otherScreen.open(S_AUTH.sessions);
    await otherScreen.refusedWith("SIGNED_OUT");

    // …and the new password is the one that works now, on that same other device.
    await otherScreen.open(S_AUTH.signIn);
    await otherScreen.signInWith(EMAIL, NEW_PASSWORD);
    await expect(otherScreen.at()).toHaveURL(`${origin}${S_AUTH.home}`);

    /* --- the device list revokes the other device --- */
    await screen.open(S_AUTH.sessions);
    await expect(screen.sessionRows).toHaveCount(2);
    await expect(screen.revokeButtons).toHaveCount(1);
    await screen.revokeButtons.first().click();
    await expect(screen.sessionRows).toHaveCount(1);
    await expect(screen.currentSession).toHaveCount(1);

    await otherScreen.open(S_AUTH.sessions);
    await otherScreen.refusedWith("SIGNED_OUT");
    await other.close();

    /* --- sign out ends this device's session too --- */
    await screen.open(S_AUTH.sessions);
    await screen.signOut.click();
    await expect(page).toHaveURL(`${origin}${S_AUTH.signIn}`);

    await screen.open(S_AUTH.sessions);
    await screen.refusedWith("SIGNED_OUT");
  });
});
