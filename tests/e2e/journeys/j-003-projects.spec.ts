// J-003 — projects, on their own per-run identity (AC-6): create, edit a field and see the change on
// S-Home, archive and restore, and read the project's pinned rule-set edition on the shipped
// settings screen. J-003's participants and last-PRINCIPAL segments belong to the participants
// increment; this file walks only what this one builds.
//
// The gate runs `pnpm e2e --journey J-003`, and Playwright exits 1 on an unmatched grep — so the
// J-003 tag in the titles below is what makes that stage runnable at all.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { ShellPage, SHELL } from "../pages/shell.page";
import { SHomePage, S_HOME } from "../pages/s-home.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j003-${RUN}@cubit.test`;
const PASSWORD = `projects-journey-${RUN}`;

/** Fixed names: the frame and the card are painted into baselines; only the address is volatile. */
const WORKSPACE = "Sattva Projects";
const PROJECT = "Sattva Court";
const PROJECT_EDITED = "Chandpur Riverfront";

/** The two ids the shipped rule-set settings screen answers a pin through (inc-015's contract). */
const RULESET_IDENTITY = "ruleset-edition-identity";
const RULESET_DIGEST = "ruleset-edition-digest";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-003 — projects: create, edit, archive, restore, and the pin they carry", () => {
  test("J-003: a project is created, edited, archived, restored, and shows the edition it pinned", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);

    /* --- this journey's own identity, so its projects never land in another spec's workspace --- */
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

    /* --- create, with every field R-SPINE-010 names carried through project-form (AC-4) --- */
    await home.createWith({
      name: PROJECT,
      code: "SC-001",
      client: "Sattva Holdings",
      siteAddress: "Plot 14, Airport Road",
      district: "Dhaka",
      buildingType: 1,
      storeys: "12",
      gfaM2: "8400",
      notes: "Tower over a two-level podium.",
    });

    const created = home.cardNamed(PROJECT);
    await expect(created, "the created project stands on S-Home").toBeVisible();
    const projectId = (await created.getAttribute("data-project")) ?? "";
    expect(projectId, "the card names the project it is for (docs/design/s-home.md § 7)").not.toBe("");

    /* --- edit a field, and see the change on S-Home --- */
    await created.getByTestId("project-edit").click();
    await expect(home.form, "the edit door opens the same form, prefilled").toBeVisible();
    await expect(home.field("project-code"), "an edit opens on what is stored, never on an empty form").toHaveValue("SC-001");
    await home.fill({ name: PROJECT_EDITED });
    await home.submit.click();

    const edited = home.cardNamed(PROJECT_EDITED);
    await expect(edited, "the edited field is reflected on S-Home").toBeVisible();
    await expect(home.cardNamed(PROJECT), "and the name it replaced is gone from the grid").toHaveCount(0);

    await checkpoint(page, testInfo, "j-003/project-edited");
    await expect(page).toHaveScreenshot(["j-003", "project-edited.png"], { mask: home.masks(), animations: "disabled" });

    /* --- archive, then restore: reversible, and nothing is deleted (AC-4) --- */
    await edited.getByTestId("project-archive").click();
    await expect(edited.getByTestId("s-home-project-archived-badge"), "an archived project is flagged on the card, by a word and never by colour alone").toBeVisible();
    await expect(edited.getByTestId("s-home-project-status"), "the status says so too").toHaveAttribute("data-status", "archived");
    await expect(edited, "an archived project is shown, never hidden").toBeVisible();

    await edited.getByTestId("project-restore").click();
    await expect(edited.getByTestId("s-home-project-archived-badge"), "restoring takes the flag away").toHaveCount(0);
    await expect(edited.getByTestId("s-home-project-status")).toHaveAttribute("data-status", "active");

    /* --- the pin, on the shipped settings screen (R-SPINE-012, L-REG-07) --- */
    await edited.getByTestId("s-home-project-ruleset").click();
    await expect(page).toHaveURL(`${origin}${S_HOME.ruleset(tenantId, projectId)}`);

    const identity = page.getByTestId(RULESET_IDENTITY);
    const digest = page.getByTestId(RULESET_DIGEST);
    await expect(identity, "the project's pinned edition names itself").toBeVisible();
    await expect(digest, "…and carries the digest that edition was forked with").toBeVisible();
    expect((await identity.innerText()).trim().length, "the edition identity is not an empty line").toBeGreaterThan(0);
    expect((await digest.innerText()).trim().length, "the digest is not an empty line").toBeGreaterThan(0);

    await checkpoint(page, testInfo, "j-003/ruleset-pin-visible");
    await expect(page).toHaveScreenshot(["j-003", "ruleset-pin-visible.png"], { animations: "disabled" });
  });

  /**
   * AC-3's B-20 half, which no browser walk can state: the create door now stands on the screen the
   * four owned shell baselines were taken of, so those four images must be REGENERATED against the
   * screen that stands. The pins below are the bytes as they were BEFORE this increment — a negative,
   * so a later increment that re-baselines again still passes, and only a branch that shipped the
   * grown screen while leaving its baselines untouched fails.
   */
  test("J-003: the four owned shell design baselines were regenerated against the grown screen (B-20)", () => {
    const before: Record<string, string> = {
      "shell-light.png": "b69db18c7bfbd3c1e3aa4b11ce84a31db651895e1c98b8e19b111c22dd5c518c",
      "shell-dark.png": "b6c4103da432825ebaf8dc8daf66ebe417e7330b7dbf54544c9548f3359deb44",
      "shell-tenant-switcher-open.png": "ce0b99ee98c8cad7a93cf3b3ceb7b72efc90617dd4d00c1cdc5391a3fb4f558c",
      "shell-user-menu-open.png": "65dc9837a80bb015a44b9ca0b10e0477ae9c972337bd437d12146051152edfc9",
    };
    const baselines = join(process.cwd(), "tests", "e2e", "baselines", "design");
    for (const [name, wasSha256] of Object.entries(before)) {
      const now = createHash("sha256").update(readFileSync(join(baselines, name))).digest("hex");
      expect(
        now,
        `tests/e2e/baselines/design/${name} is byte-for-byte what it was before this increment. AC-3 adds the create door to the screen it pictures, so the baseline must be regenerated (B-20) with the journey lane scoped to the shell spec and its diff reviewed — \`--update-snapshots=missing\` alone cannot re-bless a changed baseline.`,
      ).not.toBe(wasSha256);
    }
  });
});
