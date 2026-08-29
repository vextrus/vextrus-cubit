// J-000 — the Golden Path's first real segment (AC-5): sign up → name the workspace through the
// shipped door → create the first project, and see it on S-Home. Everything past create-project is
// a later milestone's leg; the smoke in `j-000-smoke.spec.ts` keeps proving the lane itself.
//
// The identity is per-run unique (a fresh email every run) because `cubit_e2e` is additive and never
// fresh: two runs sharing an address would meet the account the first one made, and the second one's
// workspace would not be projectless. The workspace and project NAMES are fixed, because they are
// painted into the frame a baseline compares; the address and the dates are masked (V-E2E).
import { expect, test } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { ShellPage, SHELL } from "../pages/shell.page";
import { QUICK_STATS, SHomePage, S_HOME } from "../pages/s-home.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j000-${RUN}@cubit.test`;
const PASSWORD = `golden-path-${RUN}`;

/** The name sign-up enters, deliberately disjoint from the name the rename door writes. */
const WORKSPACE_AT_SIGN_UP = `First Workspace ${RUN}`;
/** What the shipped rename door names it — fixed, because the frame paints it into the baseline. */
const WORKSPACE = "Golden Path Works";
/** The first project, fixed for the same reason. */
const PROJECT = "Riverside Tower";

/** AC-5: the whole segment, from the first keystroke of sign-up to the card on S-Home. */
const SEGMENT_BUDGET_MS = 120_000;

/** The frame is graded at a width where every shell region is painted (R-UI-030, lg and up). */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-000 — Golden Path: sign up, name the workspace, create the first project", () => {
  test("J-000: a new account names its workspace and creates its first project in under two minutes", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);

    const startedAt = Date.now();

    /* --- sign up, verify and sign in: a person who did not have an account now has one --- */
    await auth.open(S_AUTH.signUp);
    await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE_AT_SIGN_UP);
    await auth.expectNotice();

    const verifyMail = await newestMail(EMAIL, "verify-email");
    await auth.openWithToken(S_AUTH.verify, verifyMail.token);
    await auth.expectNotice();

    await auth.open(S_AUTH.signIn);
    await auth.signInWith(EMAIL, PASSWORD);
    await expect(page, "signing in lands on the nameplate the workspace door stands on").toHaveURL(`${origin}${SHELL.home}`);

    /* --- into the workspace, through visible navigation (R-UI-031) --- */
    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(tenantId, "the workspace door lands on an address naming the workspace").not.toBe("");

    /* --- name the workspace through the shipped rename door (R-UI-033) --- */
    await shell.open(S_HOME.settings(tenantId));
    await shell.renameInput.fill(WORKSPACE);
    await shell.renameSubmit.click();
    await expect(shell.settingsName, "the saved name is what the settings screen reads back").toContainText(WORKSPACE);

    await home.open(S_HOME.workspace(tenantId));
    await shell.expectFrame();
    await expect(shell.breadcrumb, "the frame wears the name the door just saved").toContainText(WORKSPACE);

    /* --- AC-3: a workspace with no projects keeps the teaching empty state, beside the create door --- */
    await expect(shell.empty, "R-UI-033: the zero-project workspace still teaches the next action").toBeVisible();
    await expect(shell.sampleOffer, "R-UI-033: the SAMPLE offer is preserved").toBeVisible();
    await expect(home.createProject, "AC-3: the create door stands on the empty branch too").toBeVisible();
    await expect(home.grid, "no grid is painted for a workspace that holds no projects").toHaveCount(0);

    await checkpoint(page, testInfo, "j-000/workspace-named");
    await expect(page).toHaveScreenshot(["j-000", "workspace-named.png"], { mask: home.masks(), animations: "disabled" });

    /* --- create the first project --- */
    await home.createWith({ name: PROJECT, buildingType: 0 });

    const card = home.cardNamed(PROJECT);
    await expect(card, "the new project is the visible answer: its card stands in the grid").toBeVisible();
    await expect(home.grid).toBeVisible();

    /* --- AC-3: what a card carries --- */
    await expect(card.getByTestId("s-home-project-status"), "each entry carries its status").toBeVisible();
    await expect(card.getByTestId("s-home-project-last-activity"), "each entry carries its last activity").toBeVisible();
    await expect(card.getByTestId("s-home-project-ruleset"), "L-REG-07 made visible: the pin is a link from the card").toHaveAttribute(
      "href",
      new RegExp(`^/t/${tenantId}/p/[0-9a-f-]{36}/settings/ruleset$`),
    );
    await expect(card.getByTestId("s-home-quick-stats"), "the quick stats stand on the card").toBeVisible();
    for (const stat of QUICK_STATS) {
      const text = await card.getByTestId(stat).innerText();
      expect(Number(text.replace(/[^0-9]/g, "")), `${stat} is an honest zero at M0 — a counted empty set, never a hidden region: it reads "${text}"`).toBe(0);
    }
    await expect(home.recentDocuments, "the recent-documents region stands, and says why it is empty").toBeVisible();

    /* --- AC-5: the whole segment, measured --- */
    const elapsed = Date.now() - startedAt;
    expect(elapsed, `J-000's first segment must be walkable in under two minutes; it took ${Math.round(elapsed / 1000)} s`).toBeLessThan(SEGMENT_BUDGET_MS);

    await checkpoint(page, testInfo, "j-000/first-project-on-s-home");
    await expect(page).toHaveScreenshot(["j-000", "first-project-on-s-home.png"], { mask: home.masks(), animations: "disabled" });
  });
});
