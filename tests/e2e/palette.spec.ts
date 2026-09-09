// J-021 — the ⌘K palette, walked over the served product: sign in → the workspace → ⌘K → type the
// project's name → Enter lands on the project's home → `?` opens the shortcut sheet.
//
// The gate runs `pnpm e2e --journey J-021`, and Playwright exits 1 on an unmatched grep — so the
// J-021 tag in the titles below is what makes that stage runnable at all.
//
// Two checkpoints, each attaching its capture and judging the page with axe at serious/critical = 0
// (docs/design/command-palette.md § 7): **j-021-palette-open** (palette/open-light.png,
// palette/open-dark.png) and **j-021-shortcut-sheet** (palette/sheet-light.png). The account address
// in the top bar is minted per run, so it is the one region masked — everything the checkpoints
// exist for (the dialog, its groups, the active row, the sheet's rows and keycaps) stays compared.
import { expect, test } from "@playwright/test";
import { CommandPalettePage } from "./pages/command-palette.page";
import { SAuthPage, S_AUTH } from "./pages/s-auth.page";
import { SHomePage } from "./pages/s-home.page";
import { ShellPage, SHELL } from "./pages/shell.page";
import { checkpoint } from "./support/checkpoint";
import { newestMail } from "./support/outbox";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j021-${RUN}@cubit.test`;
const PASSWORD = `palette-journey-${RUN}`;

/** Fixed names: the frame and the palette's rows are painted into baselines. */
const WORKSPACE = "Meghna Works";
const PROJECT = "Meghna Bridge Approach";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-021 — the command palette, from the chord to the sheet", () => {
  test("J-021 (AC-6): ⌘K finds a project by name, Enter lands on it, and ? documents every binding", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(600_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const palette = new CommandPalettePage(page);

    /* --- this journey's own identity, so its project never lands in another spec's workspace --- */
    await auth.open(S_AUTH.signUp);
    await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE);
    await auth.expectNotice();
    const verifyMail = await newestMail(EMAIL, "verify-email");
    await auth.openWithToken(S_AUTH.verify, verifyMail.token);
    await auth.expectNotice();
    await auth.open(S_AUTH.signIn);
    await auth.signInWith(EMAIL, PASSWORD);
    await expect(page).toHaveURL(`${origin}${SHELL.home}`);

    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    await shell.expectFrame();

    /* --- something to find: a project of this workspace --- */
    await home.createWith({ name: PROJECT, code: "MBA-001", buildingType: 1, storeys: "4" });
    const card = home.cardNamed(PROJECT);
    await expect(card, "the created project stands on the workspace home").toBeVisible();
    const projectId = (await card.getAttribute("data-project")) ?? "";
    expect(projectId, "the card names the project it is for").not.toBe("");

    /* --- the bar carries the trigger, and the chord opens the palette (AC-1) --- */
    await expect(shell.topBar.getByTestId("shell-command-palette"), "the trigger joins the top bar (I-135)").toBeVisible();
    await palette.openWithChord();
    await palette.search(PROJECT);

    const navigate = palette.rows("navigate");
    await expect(navigate.first(), "the project the query names is answered by the seam").toBeVisible();
    await expect(palette.activeRow, "…and the first answered row is the active one (Decision §1)").toHaveCount(1);
    await expect(palette.activeRow, "…which is the project's own row").toContainText(PROJECT);

    const masks = [shell.user];
    await checkpoint(page, testInfo, "j-021-palette-open");
    await expect(page, "palette/open-light.png pictures the palette that now stands").toHaveScreenshot(["palette", "open-light.png"], {
      mask: masks,
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });

    /* --- the same picture in the other theme, resolved at load (Decision §6) --- */
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await shell.expectFrame();
    await expect(page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", "dark");
    await palette.openWithChord();
    await palette.search(PROJECT);
    await expect(palette.activeRow).toHaveCount(1);
    await expect(page, "palette/open-dark.png pictures the same palette in the other theme").toHaveScreenshot(["palette", "open-dark.png"], {
      mask: masks,
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });

    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await shell.expectFrame();

    /* --- Enter takes the active row's address (AC-3) --- */
    await palette.openWithChord();
    await palette.search(PROJECT);
    await expect(palette.activeRow).toContainText(PROJECT);
    await page.keyboard.press("Enter");
    await expect(page, "Enter lands on the project's own home").toHaveURL(`${origin}/t/${tenantId}/p/${projectId}`);
    await expect(palette.dialog, "…and the palette closes behind it").toHaveCount(0);

    /* --- ? documents every binding the roster names (AC-4) --- */
    await palette.openSheet();
    const rows = palette.sheetRows;
    await expect(rows.first(), "the sheet lists the roster").toBeVisible();
    const listed = await rows.count();
    expect(listed, "every binding R-UI-032 names is documented — the roster is longer than the two global chords").toBeGreaterThan(2);
    const bound = await rows.evaluateAll((nodes: Element[]) => nodes.map((node) => node.getAttribute("data-shortcut") ?? ""));
    expect(bound.filter((id) => id === "").length, "every row names the roster entry it documents").toBe(0);
    expect(new Set(bound).size, "…and no binding is listed twice").toBe(bound.length);
    await expect(palette.sheetKeys("palette").locator("kbd").first(), "…each row drawing its own keycaps").toBeVisible();

    await checkpoint(page, testInfo, "j-021-shortcut-sheet");
    await expect(page, "palette/sheet-light.png pictures the sheet that now stands").toHaveScreenshot(["palette", "sheet-light.png"], {
      mask: masks,
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });
  });
});
