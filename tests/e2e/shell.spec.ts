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
import { ShellPage, SHELL, SHELL_AREAS } from "./pages/shell.page";
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

/**
 * The name the rename walk writes, so that "the frame wears the saved name" is an observation of a
 * CHANGED name reaching the frame rather than of the name it already wore (Q-11: observe the
 * response semantically). It is deliberately disjoint from WORKSPACE — neither string contains the
 * other — because every assertion below is a substring match, and a renamed name that still
 * contained the old one would make `not.toContainText(WORKSPACE)` unsatisfiable and
 * `toContainText(WORKSPACE)` blind. The walk renames back, so the identity the baselines are fixed
 * to is what the frame wears at every checkpoint.
 */
const WORKSPACE_RENAMED = "Meridian Renamed";

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

    /* --- and the selection is PAINTED the way R-UI-030 spells it (3 px inset beam bar + beam-100
       row fill). A browser is the only lane that can grade this: jsdom lays nothing out and
       resolves no `var()`. Both sides of every comparison are resolved inside the page, by token
       name, so nothing here spells a colour (R-UI-001). --- */
    const palette = await shell.tokenPalette();
    const beam = palette.filter((token) => token.name.startsWith("--beam-")).map((token) => token.colour);
    expect(beam.length, "the page declares a --beam-* token family for the selection bar to be drawn from").toBeGreaterThan(0);
    const rowFill = palette.find((token) => token.name === "--beam-100")?.colour;
    expect(rowFill, "R-UI-030 names --beam-100 for the selected row's fill, and the page declares it").toBeTruthy();

    const [selected = "projects"] = await shell.selectedArea();
    expect(await shell.paintedFill(selected), `R-UI-030: the selected entry (${selected}) wears the beam-100 row fill`).toBe(rowFill);
    const bars = (await shell.insetStrips(selected, "3px")).filter((strip) => beam.includes(strip.colour));    expect(bars.length, `R-UI-030: the selected entry (${selected}) paints a 3 px inset beam bar`).toBeGreaterThan(0);

    // The other half of "selection = …": an entry that is not selected wears neither, or the paint
    // is decoration rather than a reading of the URL.
    for (const area of SHELL_AREAS.filter((candidate) => candidate !== selected)) {
      expect(await shell.paintedFill(area), `${area} is not selected, so it does not wear the selected row's fill`).not.toBe(rowFill);
      expect((await shell.insetStrips(area, "3px")).filter((strip) => beam.includes(strip.colour)), `${area} is not selected, so it carries no beam bar`).toStrictEqual([]);
    }

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
    expect(
      WORKSPACE_RENAMED.includes(WORKSPACE) || WORKSPACE.includes(WORKSPACE_RENAMED),
      "the two names must be disjoint, or the substring assertions below cannot tell them apart",
    ).toBe(false);

    const renameWorkspaceTo = async (name: string): Promise<void> => {
      await shell.renameInput.fill(name);
      await shell.renameSubmit.click();
      await expect(shell.settingsName.getByRole("status"), "a saved name says so").toHaveText(strings.shell_rename_saved);
      await expect(shell.renameRefusal, "a member renaming their own workspace is refused nothing").toHaveCount(0);
    };

    await shell.open(SHELL.settings(tenantId));
    await expect(shell.breadcrumb).toBeVisible();

    // The lane's database outlives a run (V-E2E), so a run that crashed between the two renames
    // below would leave the workspace wearing the renamed name. Normalise on arrival — the same
    // idempotent posture the enrolment above takes with ACCOUNT_ALREADY_EXISTS — so the walk starts
    // from the fixed identity the pixel baselines were taken against.
    if (((await shell.breadcrumb.textContent()) ?? "").includes(WORKSPACE_RENAMED)) {
      await renameWorkspaceTo(WORKSPACE);
    }
    await expect(shell.breadcrumb, "the rename walk begins from the identity the baselines are fixed to").toContainText(WORKSPACE);

    // A rename is only observed when a DIFFERENT name reaches the frame: a success notice alone
    // proves a rename-shaped form, not a rename, and re-typing the name the workspace already wears
    // would pass whether or not anything was written or the layout re-read (Q-11).
    await renameWorkspaceTo(WORKSPACE_RENAMED);
    await expect(shell.tenantSwitcher, "the switcher wears the saved name, not the one it was rendered with").toContainText(WORKSPACE_RENAMED);
    await expect(shell.breadcrumb, "and so does the breadcrumb — the frame was re-read, not just the form").toContainText(WORKSPACE_RENAMED);
    await expect(shell.breadcrumb, "the name it wore before is gone from the frame").not.toContainText(WORKSPACE);

    // R-UI-033 asks for an entered name: a name with nothing visible in it is refused inline, in
    // the shell's own copy, and nothing is stored — the frame still wears the name it had.
    await shell.renameInput.fill("   ");
    await shell.renameSubmit.click();
    await expect(shell.renameRefusal, "a name with nothing visible in it is refused where it was typed").toHaveText(
      strings.shell_rename_refusal,
    );
    await expect(shell.settingsName.getByRole("status"), "and nothing claims to have been saved").toHaveCount(0);
    await expect(shell.breadcrumb, "the stored name is untouched").toContainText(WORKSPACE_RENAMED);

    // A fresh read, on another screen: the rename was written, not only painted.
    await shell.open(SHELL.workspace(tenantId));
    await expect(shell.breadcrumb, "the saved name survives a fresh read of another screen").toContainText(WORKSPACE_RENAMED);

    // …and back, which proves the propagation a second, independent time and restores the identity
    // every screenshot and axe checkpoint in this file is taken against.
    await shell.open(SHELL.settings(tenantId));
    await renameWorkspaceTo(WORKSPACE);
    await expect(shell.tenantSwitcher, "the switcher follows the second rename too").toContainText(WORKSPACE);
    await expect(shell.breadcrumb, "and the breadcrumb with it").toContainText(WORKSPACE);
    await expect(shell.breadcrumb, "the renamed name is gone in its turn").not.toContainText(WORKSPACE_RENAMED);

    /* --- j004-shell-deeplink: the address alone is enough, and back restores what was there --- */
    // The screen the person comes from, so that back below has a screen to return to: the rename
    // walk above ends on settings and pins the page there (R-UI-031 asks that back reach the actual
    // previous entry, not that a deep link know the workspace home).
    await shell.open(SHELL.workspace(tenantId));
    await shell.expectFrame();
    await shell.open(SHELL.books(tenantId));
    await shell.expectFrame();
    await expect(shell.breadcrumb, "the restored identity is what this checkpoint is graded wearing").toContainText(WORKSPACE);
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
