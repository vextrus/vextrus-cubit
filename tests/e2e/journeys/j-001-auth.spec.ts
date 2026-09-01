// J-001 — the multi-tenancy half of the journey, end to end and in the order a person lives it:
// two accounts made through the shipped doors, an invitation offered from the members screen, the
// mailed link spent on the accept screen, and the invitee holding a SECOND membership which the
// rail's switcher then moves them between — the same session throughout, with no second sign-in.
//
// The auth-and-sessions half is `j-001a-auth-core.spec.ts`; both describe titles carry "J-001", so
// `pnpm e2e --journey J-001` collects them together and no segment of the journey is green by
// omission (V-E2E).
import { expect, test, type Page } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SMembersPage, S_MEMBERS, switchTo, switcherWorkspaces } from "../pages/s-members.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";

/** One run's identities: a journey brings its own accounts rather than leaning on the last run's. */
const RUN = Date.now().toString(36);
const INVITER = `j001-inviter-${RUN}@cubit.test`;
const INVITEE = `j001-invitee-${RUN}@cubit.test`;
const PASSWORD = `j001-password-${RUN}`;
const INVITING_WORKSPACE = `Ironworks ${RUN}`;
const INVITEE_WORKSPACE = `Kiln Road ${RUN}`;

/** The regions a run's own identities land in, painted over so a baseline is about the layout. */
const VOLATILE = ["shell-topbar", "shell-tenant-switcher", "members-row", "invitations-row", "accept-invitation-workspace"] as const;

/** The masks one shot takes: every volatile region the page happens to be showing. */
const masks = (page: Page) => VOLATILE.map((testId) => page.getByTestId(testId));

/**
 * One account, made through the doors a person uses: sign up naming the workspace, verify from the
 * mail, then sign in. Nothing is staged behind the product's back.
 */
async function enrol(screen: SAuthPage, email: string, workspace: string): Promise<void> {
  await screen.open(S_AUTH.signUp);
  await screen.signUpWith(email, PASSWORD, workspace);
  await screen.expectNotice();

  const verification = await newestMail(email, "verify-email");
  await screen.openWithToken(S_AUTH.verify, verification.token);
  await screen.expectNotice();

  await screen.open(S_AUTH.signIn);
  await screen.signInWith(email, PASSWORD);
  await screen.at().waitForURL((url) => url.pathname === S_AUTH.home, { timeout: 30_000 });
}

/** The workspace sign-up minted for this account, as the entry's own door addresses it. */
async function ownWorkspaceId(page: Page): Promise<string> {
  await page.goto(S_AUTH.home);
  const href = await page.getByTestId("root-home-workspace-door").getAttribute("href");
  return (href ?? "").replace("/t/", "");
}

test.describe("J-001 — invite, ACCEPT, and the second membership the switcher moves between", () => {
  test("J-001: an invitation is offered, mailed, spent, and the invitee switches workspaces", async ({ page, browser, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";

    /* --- two accounts, each through the shipped doors (R-SPINE-002) --- */
    const inviterScreen = new SAuthPage(page);
    await enrol(inviterScreen, INVITER, INVITING_WORKSPACE);
    const invitingTenant = await ownWorkspaceId(page);
    expect(invitingTenant.length, "sign-up minted the inviter a workspace of their own (R-SPINE-002)").toBeGreaterThan(0);

    const inviteeContext = await browser.newContext({ baseURL });
    const invitee = await inviteeContext.newPage();
    await enrol(new SAuthPage(invitee), INVITEE, INVITEE_WORKSPACE);
    const inviteeTenant = await ownWorkspaceId(invitee);
    expect(inviteeTenant, "the invitee's own workspace is not the one they are about to be invited to").not.toBe(invitingTenant);

    /* --- the offer, made from the members screen the settings landing links to (I-60) --- */
    const members = new SMembersPage(page);
    await page.goto(S_MEMBERS.settings(invitingTenant));
    await members.link.click();
    await expect(members.section, "the members roster is the screen the link lands on").toBeVisible();

    await members.invite(INVITEE);
    await expect(members.pendingRows, "the invitation just made stands as one pending row (AC-2)").toHaveCount(1);
    await expect(members.panelRefusal, "a valid invitation is not refused").toHaveCount(0);
    await checkpoint(page, testInfo, "invite-pending");
    await expect(page).toHaveScreenshot(["j-001-auth", "invite-pending.png"], { mask: masks(page) });

    /* --- the mailed link, opened by the invitee in their own browser --- */
    const invitation = await newestMail(INVITEE, "invitation");
    expect(invitation.url, "the invitation carries the accept link the test contract fixes").toContain(`${S_MEMBERS.accept}?token=`);
    await invitee.goto(new URL(invitation.url, origin).toString());

    await expect(invitee.getByTestId("accept-invitation-form"), "the invitee is asked to decide, in place").toBeVisible();
    await expect(
      invitee.getByTestId("accept-invitation-workspace"),
      "the screen names the inviting workspace the invitee is deciding about (AC-3)",
    ).toHaveText(INVITING_WORKSPACE);
    await expect(invitee.getByTestId("accept-invitation-refusal"), "a token straight out of the invitee's own mail is claimable").toHaveCount(0);
    await checkpoint(invitee, testInfo, "accept");
    await expect(invitee).toHaveScreenshot(["j-001-auth", "accept.png"], { mask: masks(invitee) });

    /* --- spending it: one user, two tenants, and the switcher live (R-SPINE-003) --- */
    await invitee.getByTestId("accept-invitation-submit").click();
    await invitee.waitForURL((url) => url.pathname.startsWith(`/t/${invitingTenant}`), { timeout: 60_000 });

    const offered = await switcherWorkspaces(invitee);
    expect(offered, "shell-tenant-switcher lists both memberships the invitee now holds (AC-4)").toEqual([INVITEE_WORKSPACE, INVITING_WORKSPACE]);

    // A real move between them, made the way a person makes it — and back, so the address the
    // journey ends on is one it navigated to rather than one it happened to be left at.
    await switchTo(invitee, INVITEE_WORKSPACE);
    await invitee.waitForURL((url) => url.pathname.startsWith(`/t/${inviteeTenant}`), { timeout: 60_000 });
    await switchTo(invitee, INVITING_WORKSPACE);
    await expect(invitee.getByTestId("shell-root"), "the joined workspace opens in the frame, not in a denial").toBeVisible();
    await expect(
      invitee,
      "the session that accepted is the session standing inside /t/{invitingTenant} — no re-authentication (AC-4, R-SPINE-002)",
    ).toHaveURL(`${origin}/t/${invitingTenant}`);
    await checkpoint(invitee, testInfo, "switched");
    await expect(invitee).toHaveScreenshot(["j-001-auth", "switched.png"], { mask: masks(invitee) });

    await inviteeContext.close();
  });
});
