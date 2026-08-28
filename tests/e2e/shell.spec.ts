// J-004 — the signed-in shell, walked the way a person meets it: the door on the nameplate, the
// frame at `/t/{tenant}`, the empty Projects home that teaches the next action, and the URL as the
// source of truth under a deep link and the browser's own back button.
//
// The four checkpoints the Increment Spec names stand in this file: at each one a screenshot is
// attached and axe judges the page (Q-11, at the impacts `support/checkpoint.ts` blocks on and no
// others), and the light and dark frames are compared against the committed Linux baselines.
import { expect, test } from "@playwright/test";
import { strings } from "../../src/ui/strings";
import { SAuthPage, S_AUTH } from "./pages/s-auth.page";
import { ShellPage, SHELL } from "./pages/shell.page";
import { checkpoint } from "./support/checkpoint";
import { newestMail } from "./support/outbox";

/**
 * The journey's identity is fixed, not per-run: the workspace name and the address both appear in
 * the frame, and a baseline compares pixels — volatile text would have to be masked away, and a
 * masked region is a region nothing is grading (V-E2E). The lane's database outlives a run, so the
 * enrolment below is idempotent rather than assumed-fresh.
 */
const EMAIL = "j004-shell@cubit.test";
const PASSWORD = "shell-journey-password";
const WORKSPACE = "Datum Works";

/** An address that names no workspace of this account — what an anonymous request is turned from. */
const STRANGER = "/t/9d1f0e7c-4a2b-4c3d-8e5f-1a2b3c4d5e6f";

/** The frame is graded at a width where the inspector region is painted (R-UI-030, lg and up). */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-004 — the signed-in application shell", () => {
  test("J-004: the workspace door, the frame, the onboarding empty state and the URL as the source of truth", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);

    /* --- a request with no session never paints workspace content (R-UI-031) --- */
    await shell.open(STRANGER);
    await expect(page, "an unauthenticated /t/… lands on the remedy, not on a blank or a 500").toHaveURL(`${origin}${S_AUTH.signIn}`);
    await expect(shell.root, "no frame is painted for a visitor who has not signed in").toHaveCount(0);

    /* --- enrolment: the workspace wears the name entered at sign-up (R-UI-033) --- */
    await auth.open(S_AUTH.signUp);
    await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE);
    await expect(auth.notice.or(auth.refusal), "the sign-up door answers — a notice or a registered refusal, never nothing").toBeVisible();
    if ((await auth.notice.count()) > 0) {
      const verifyMail = await newestMail(EMAIL, "verify-email");
      await auth.openWithToken(S_AUTH.verify, verifyMail.token);
      await auth.expectNotice();
    } else {
      // The lane's database is additive: an earlier run already enrolled this address, and the
      // registered answer says so rather than failing. The account is verified either way.
      await auth.refusedWith("ACCOUNT_ALREADY_EXISTS");
    }

    await auth.open(S_AUTH.signIn);
    await auth.signInWith(EMAIL, PASSWORD);
    await expect(page, "signing in leaves a person on the nameplate — the door is a link, never a redirect").toHaveURL(`${origin}${SHELL.home}`);

    /* --- every shipped screen is reachable by visible navigation: / carries the way in --- */
    await expect(shell.workspaceDoor).toBeVisible();
    await expect(shell.workspaceDoor).toHaveText(strings.shell_home_workspace_door);
    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));

    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(tenantId.length, "the workspace door names the tenant the URL is keyed by (R-UI-031)").toBe(36);

    /* --- j004-shell-light: the R-UI-030 frame, all four regions --- */
    await shell.expectFrame();
    await expect(shell.railMark, "the rail carries the quiet mark (R-UI-070)").toBeVisible();
    await expect(shell.railCollapse).toHaveAttribute("aria-expanded", "true");
    await expect(shell.tenantSwitcher, "the switcher wears the name entered at sign-up (R-UI-033)").toContainText(WORKSPACE);
    await expect(shell.breadcrumb, "and so does the breadcrumb").toContainText(WORKSPACE);
    expect(await shell.selectedArea(), "the workspace home selects Projects, because the URL says so").toEqual(["projects"]);

    await expect(shell.root).toHaveScreenshot("shell-light.png");
    await checkpoint(page, testInfo, "j004-shell-light");

    /* --- j004-shell-dark: the same frame, the same tokens, other values (Decision § 6) --- */
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await shell.expectFrame();
    await expect(page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", "dark");

    await expect(shell.root).toHaveScreenshot("shell-dark.png");
    await checkpoint(page, testInfo, "j004-shell-dark");

    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await shell.expectFrame();

    /* --- j004-shell-onboarding: the empty Projects home teaches the next action (R-UI-033) --- */
    await expect(shell.empty).toBeVisible();
    await expect(shell.emptyAction).toBeVisible();
    await expect(shell.sampleOffer, "the SAMPLE offer is one visible click target, labelled from the table").toHaveText(strings.shell_sample_offer);
    expect(strings.shell_sample_offer, "R-UI-033 offers the set by the name it is labelled with").toContain("SAMPLE");

    await shell.sampleOffer.click();
    await expect(shell.sampleOutcome, "the seam's answer is rendered, and an absence is a notice rather than a fault").toHaveText(strings.shell_sample_unavailable);
    await checkpoint(page, testInfo, "j004-shell-onboarding");

    /* --- the rail navigates, and selection follows the URL --- */
    await shell.nav("books").click();
    await expect(page).toHaveURL(`${origin}${SHELL.books(tenantId)}`);
    expect(await shell.selectedArea()).toEqual(["books"]);

    await shell.nav("settings").click();
    await expect(page).toHaveURL(`${origin}${SHELL.settings(tenantId)}`);
    expect(await shell.selectedArea()).toEqual(["settings"]);
    await expect(shell.settingsName, "the rename R-UI-033 puts in settings is on the settings screen").toBeVisible();

    // Browser back works everywhere: the address goes back and the selection goes with it.
    await page.goBack();
    await expect(page).toHaveURL(`${origin}${SHELL.books(tenantId)}`);
    expect(await shell.selectedArea()).toEqual(["books"]);
    await page.goBack();
    await expect(page).toHaveURL(`${origin}${SHELL.workspace(tenantId)}`);
    expect(await shell.selectedArea()).toEqual(["projects"]);

    /* --- the workspace a session does not hold is refused, not framed (R-UI-050, ARCH-03) --- */
    await shell.open(STRANGER);
    await expect(shell.denied, "an address naming somebody else's workspace answers the denial surface").toBeVisible();
    await expect(shell.root, "and no rail of links into a workspace they cannot see").toHaveCount(0);
    await expect(shell.deniedPermission, "which permission is missing").toBeVisible();
    await expect(shell.deniedHolder, "and who holds it").toBeVisible();
    await expect(shell.refusalState, "the registered code, rendered by the one renderer").toHaveAttribute("data-code", "PERMISSION_NOT_HELD");
    await expect(page.locator(`a[href="${SHELL.workspace(tenantId)}"]`), "the remedy is a place they can actually go").toBeVisible();

    /* --- the rename answers, and the frame re-reads the name it saved (R-UI-033) --- */
    await shell.open(SHELL.settings(tenantId));
    await shell.renameInput.fill(WORKSPACE);
    await shell.renameSubmit.click();
    await expect(shell.settingsName.getByRole("status"), "a saved name says so").toHaveText(strings.shell_rename_saved);
    await expect(shell.renameRefusal, "a member renaming their own workspace is refused nothing").toHaveCount(0);
    await expect(shell.breadcrumb, "and the frame wears the saved name").toContainText(WORKSPACE);

    // R-UI-033 asks for an entered name: a name with nothing visible in it is refused inline, in
    // the shell's own copy, and nothing is stored — the frame still wears the name it had.
    await shell.renameInput.fill("   ");
    await shell.renameSubmit.click();
    await expect(shell.renameRefusal, "a name with nothing visible in it is refused where it was typed").toHaveText(
      strings.shell_rename_refusal,
    );
    await expect(shell.settingsName.getByRole("status"), "and nothing claims to have been saved").toHaveCount(0);
    await expect(shell.breadcrumb, "the stored name is untouched").toContainText(WORKSPACE);

    await shell.open(SHELL.workspace(tenantId));
    await expect(shell.breadcrumb, "on a fresh read too").toContainText(WORKSPACE);

    /* --- j004-shell-deeplink: the address alone is enough, and back restores what was there --- */
    await shell.open(SHELL.books(tenantId));
    await shell.expectFrame();
    await expect(shell.nav("books")).toHaveAttribute("aria-current", "page");
    expect(await shell.selectedArea(), "a deep link selects its own area and no other").toEqual(["books"]);
    await checkpoint(page, testInfo, "j004-shell-deeplink");

    await page.goBack();
    await expect(page, "browser back returns to the screen the person came from").toHaveURL(`${origin}${SHELL.workspace(tenantId)}`);
    expect(await shell.selectedArea()).toEqual(["projects"]);

    /* --- the rail collapses from the keyboard, and says so semantically (Q-11) --- */
    await page.keyboard.press("Tab");
    for (let step = 0; step < 12 && (await shell.railCollapse.evaluate((node) => node !== document.activeElement)); step += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(shell.railCollapse, "Tab travel reaches the collapse control").toBeFocused();
    await page.keyboard.press("Enter");
    await expect(shell.railCollapse, "and the control states what it did, rather than only painting it").toHaveAttribute("aria-expanded", "false");
    await expect(shell.nav("projects"), "a collapsed rail carries no half-legible row").toHaveCount(0);

    await page.keyboard.press("Enter");
    await expect(shell.railCollapse).toHaveAttribute("aria-expanded", "true");
    await expect(shell.nav("projects")).toBeVisible();

    /* --- the user menu holds the two doors a signed-in person always owes --- */
    await shell.openUserMenu();
    // The address itself, not the key it is stored under: `users.email` carries a folded key, and
    // the tag on its carriable side is not part of anybody's address (R-SPINE-001).
    await expect(shell.user, "the menu names the account it belongs to").toHaveText(EMAIL);
    await shell.userSessions.click();
    await expect(page, "the device list is reachable from the shell, never by a typed URL alone").toHaveURL(`${origin}${S_AUTH.sessions}`);

    await shell.open(SHELL.workspace(tenantId));
    await shell.expectFrame();
    await shell.openUserMenu();
    await shell.userSignOut.click();
    await expect(page, "signing out lands on the screen that is itself the way back in").toHaveURL(`${origin}${S_AUTH.signIn}`);
    await expect(auth.submit, "…and that screen offers the door back in").toBeVisible();
  });
});
