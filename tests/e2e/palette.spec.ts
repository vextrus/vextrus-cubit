/**
 * J-021 — the command palette walked: ⌘K over the workspace, a project found by typing its name,
 * Enter landing on that project's own address, and `?` documenting every key the product promises
 * (R-SPINE-050, R-UI-032, docs/design/command-palette.md § 7, docs/design/shortcut-sheet.md § 7).
 *
 * The gate runs `pnpm e2e --journey J-021`, and Playwright exits 1 on an unmatched grep — so the
 * J-021 tag in the titles below is what makes this spec runnable at all.
 *
 * The identity and the project are FIXED and reached idempotently: the lane's database outlives a
 * run (V-E2E), so an address already enrolled and a project already created are answers this walk
 * takes rather than failures — and a fixed identity is what lets the checkpoints compare pixels
 * against committed baselines at all.
 *
 * Nothing product-side is imported here: a journey drives the served product through the ids the
 * Design Decisions close over.
 */
import { expect, test, type Page } from "@playwright/test";
import { CommandPalettePage, PALETTE_KEYS } from "./pages/command-palette.page";
import { SAuthPage, S_AUTH } from "./pages/s-auth.page";
import { SHomePage, S_HOME } from "./pages/s-home.page";
import { SProjectPage, S_PROJECT } from "./pages/s-project.page";
import { ShellPage } from "./pages/shell.page";
import { checkpoint } from "./support/checkpoint";
import { newestMail } from "./support/outbox";

const EMAIL = "j021-palette@cubit.test";
const PASSWORD = "command-palette-journey-password";
const WORKSPACE = "Keraniganj Works";
const PROJECT = "Keraniganj Depot";

/** The width the frame paints all of its regions at (R-UI-030, lg and up). */
test.use({ viewport: { width: 1440, height: 900 } });

/** Enrolment and sign-in, idempotent across runs — the lane's database is additive (V-E2E). */
async function signIn(page: Page): Promise<void> {
  const auth = new SAuthPage(page);

  await auth.open(S_AUTH.signUp);
  await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE);
  await expect(auth.notice.or(auth.refusal), "the sign-up door answers — a notice or a registered refusal, never nothing").toBeVisible();
  if ((await auth.notice.count()) > 0) {
    const verifyMail = await newestMail(EMAIL, "verify-email");
    await auth.openWithToken(S_AUTH.verify, verifyMail.token);
    await auth.expectNotice();
  } else {
    await auth.refusedWith("ACCOUNT_ALREADY_EXISTS");
  }

  await auth.open(S_AUTH.signIn);
  await auth.signInWith(EMAIL, PASSWORD);
  await expect(auth.refusal, "the sign-in door admits the journey's own account").toHaveCount(0);
  await page.waitForURL((url) => url.pathname !== S_AUTH.signIn);
}

test.describe("J-021 — the command palette", () => {
  test("J-021: ⌘K finds a project by name, Enter lands on it, and ? documents every key", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const project = new SProjectPage(page);
    const palette = new CommandPalettePage(page);

    await page.emulateMedia({ colorScheme: "light" });
    await signIn(page);

    /* --- the workspace, and the project the palette will find --- */
    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(tenantId.length, "the workspace door names the tenant the URL is keyed by").toBe(36);

    const card = home.cardNamed(PROJECT);
    if ((await card.count()) === 0) {
      await home.createWith({ name: PROJECT, code: "KD-021", client: "Keraniganj Holdings", district: "Dhaka", buildingType: 0, storeys: "8", gfaM2: "1250.50" });
    }
    await expect(card, "the project this journey searches for stands on S-Home").toBeVisible();
    const projectId = (await card.getAttribute("data-project")) ?? "";
    expect(projectId.length, "the card names the project it is for").toBe(36);

    /* --- the frame's own occupant (AC-1) --- */
    await home.open(S_HOME.workspace(tenantId));
    await expect(palette.trigger, "the top bar holds the ⌘K trigger (shell I-135)").toBeVisible();
    await expect(palette.trigger, "and it says which keys open it").toHaveAttribute("aria-haspopup", "dialog");

    /* --- ⌘K, and the project found by typing its name (AC-2) --- */
    await palette.openWithChord(PALETTE_KEYS.open);
    await palette.type(PROJECT);
    const hit = palette.itemNamed(PROJECT).first();
    await expect(hit, "typing the project's name finds it").toBeVisible();
    await expect(hit, "and it stands available").toHaveAttribute("data-available", "true");
    await expect(palette.itemsOf("navigate").first(), "under the navigate group").toBeVisible();

    // j-021-palette-open: the palette open over the frame, a typed name, its hit active, focus in
    // the input where the reticle is drawn (I-137). axe gates at serious and critical, and at
    // nothing else (Q-11).
    await page.keyboard.press(PALETTE_KEYS.down);
    await expect(palette.activeOption(), "an option is active for the keyboard to act on").toBeVisible();
    await expect(palette.input, "focus stays in the combobox (I-137)").toBeFocused();
    await checkpoint(page, testInfo, "j-021-palette-open");
    await expect(palette.dialog).toHaveScreenshot(["palette", "open-light.png"], { animations: "disabled" });

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(palette.dialog, "the palette stands through the theme change").toBeVisible();
    await expect(palette.dialog).toHaveScreenshot(["palette", "open-dark.png"], { animations: "disabled" });
    await page.emulateMedia({ colorScheme: "light" });

    /* --- Enter on the hit lands on the project's own address (AC-2) --- */
    await palette.chooseNamed(PROJECT);
    await expect(page, "choosing the project's hit lands on its home").toHaveURL(`${origin}${S_PROJECT.home(tenantId, projectId)}`);
    await expect(project.root, "and the project home renders there").toBeVisible();
    await expect(palette.dialog, "and the palette closes behind it").toHaveCount(0);

    /* --- ? opens the sheet, listing every key with its chord and its scope (AC-3) --- */
    await palette.openSheet();
    const rows = await palette.sheetRows.count();
    expect(rows, "the sheet lists the keys the product promises").toBeGreaterThan(0);
    for (const row of await palette.sheetRows.all()) {
      await expect(row, "every row says which shortcut it documents").toHaveAttribute("data-shortcut", /.+/);
      await expect(row, "and where the key works").toHaveAttribute("data-scope", /.+/);
      await expect(palette.keysOf(row), "and reads the chord that reaches it").not.toHaveText("");
    }

    await checkpoint(page, testInfo, "j-021-shortcut-sheet");
    await expect(palette.sheet).toHaveScreenshot(["palette", "sheet-light.png"], { animations: "disabled" });
  });
});
