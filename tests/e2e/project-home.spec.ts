// J-010 — S-Project, the project home: the screen a person reaches from their workspace's grid, and
// the visible door into the drawings screen where J-010's upload begins (R-SPINE-013, S-Project,
// R-AI-005, R-UI-031, docs/design/s-project.md § 7).
//
// The gate runs `pnpm e2e --journey J-010`, and Playwright exits 1 on an unmatched grep — so the
// J-010 tag in the titles below is what makes this spec runnable at all. It deliberately carries no
// other journey's tag: the golden path is not what this file walks, and the home is J-010's own
// first door.
//
// The identity and the project are FIXED and reached idempotently: the lane's database outlives a
// run (V-E2E), so an address already enrolled and a project already created are answers this walk
// takes rather than failures — and a fixed identity is what lets the checkpoint compare pixels
// against a committed baseline at all.
//
// Nothing product-side is imported here: a journey drives the served product through the ids the
// Design Decision closes over, and an import into this file would be a second reading of the screen.
import { expect, test } from "@playwright/test";
import { SAuthPage, S_AUTH } from "./pages/s-auth.page";
import { SHomePage } from "./pages/s-home.page";
import { SProjectPage, PROJECT_AREA_KEYS, PROJECT_QUICK_ACTIONS, S_PROJECT } from "./pages/s-project.page";
import { ShellPage, SHELL } from "./pages/shell.page";
import { checkpoint } from "./support/checkpoint";
import { newestMail } from "./support/outbox";

const EMAIL = "j010-project-home@cubit.test";
const PASSWORD = "project-home-journey-password";
const WORKSPACE = "Keraniganj Works";
const PROJECT = "Keraniganj Depot";
const CLIENT = "Keraniganj Holdings";
const DISTRICT = "Dhaka";
const GFA_M2 = "1250.50";

/** The five newest acts is the screen's cap (S-Project's Decision I-132), stated once here too. */
const RECENT_ACTIVITY_LIMIT = 5;

/** The areas that have a screen today, and the address each one leads to (test contract). */
const LIVE_AREAS: readonly (readonly [string, (tenantId: string, projectId: string) => string])[] = [
  ["drawings", S_PROJECT.drawings],
  ["activity", S_PROJECT.audit],
  ["settings", S_PROJECT.ruleset],
];

/** Each quick action and where it goes (test contract). */
const QUICK_ACTION_ROUTES: readonly (readonly [string, (tenantId: string, projectId: string) => string])[] = [
  ["upload-drawings", S_PROJECT.drawings],
  ["browse-sets", S_PROJECT.sets],
  ["manage-participants", S_PROJECT.participants],
];

/** The width the frame paints all four of its regions at (R-UI-030, lg and up). */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-010 — the project home", () => {
  test("J-010: a project's home answers from its card on S-Home, and its drawings tab opens the sheet index", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const project = new SProjectPage(page);

    /* --- enrolment, idempotent: the lane's database is additive across runs --- */
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
    await expect(page, "signing in leaves a person on the nameplate").toHaveURL(`${origin}${SHELL.home}`);

    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));
    const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(tenantId.length, "the workspace door names the tenant the URL is keyed by").toBe(36);

    /* --- the project this home is about: created on the first run, reused on every one after --- */
    const card = home.cardNamed(PROJECT);
    if ((await card.count()) === 0) {
      await home.createWith({ name: PROJECT, code: "KD-001", client: CLIENT, district: DISTRICT, buildingType: 0, storeys: "8", gfaM2: GFA_M2 });
    }
    await expect(card, "the project this journey opens stands on S-Home").toBeVisible();
    const projectId = (await card.getAttribute("data-project")) ?? "";
    expect(projectId.length, "the card names the project it is for").toBe(36);

    /* --- AC-1: every card's name is the door to that project's home (R-UI-031, I-131) --- */
    const cards = await home.cards.all();
    expect(cards.length, "the grid holds at least the project this journey made").toBeGreaterThan(0);
    for (const entry of cards) {
      const id = (await entry.getAttribute("data-project")) ?? "";
      const door = entry.getByTestId("s-home-project-open");
      await expect(door, `the card for ${id} opens its project's home`).toHaveAttribute("href", S_PROJECT.home(tenantId, id));
    }

    /* --- the home itself, reached the way a person reaches it --- */
    await home.projectOpen(projectId).click();
    await expect(page, "the card's name lands on the project's own address").toHaveURL(`${origin}${S_PROJECT.home(tenantId, projectId)}`);
    await expect(project.root, "and the project home renders there").toBeVisible();
    await expect(shell.main, "inside the shell frame, like every screen in the workspace (R-UI-030)").toContainText(PROJECT);

    /* --- the header: name, client, district, zones, GFA in both units --- */
    await expect(project.name, "the h1 is the project, verbatim as it is stored").toHaveText(PROJECT);
    await expect(project.client).toHaveText(CLIENT);
    await expect(project.district).toHaveText(DISTRICT);
    // No book is pinned to a project on this tree, so the derived zone roster is empty and says so.
    const zoneCount = await project.zoneBadges.count();
    await expect(project.zones, "the zone cell counts exactly the badges it holds").toHaveAttribute("data-count", String(zoneCount));
    await expect(project.gfa, "the target GFA is stated as a figure").toHaveText(/\d/);
    await expect(project.header.getByTestId("unit-badge"), "beside the two units of the one quantity it states, m² before sft").toHaveText(["m²", "sft"]);
    await expect(project.gfaSft, "and the same target in the feet a reader knows it by").toHaveText(/\d/);

    /* --- the seven areas: three live, four honest non-controls (I-125/I-126) --- */
    await expect(project.tabs, "the areas are one navigation region").toBeVisible();
    await expect(project.allTabs, "the clause's seven areas, all shown").toHaveCount(PROJECT_AREA_KEYS.length);
    for (const area of PROJECT_AREA_KEYS) {
      const live = LIVE_AREAS.find(([key]) => key === area);
      if (live === undefined) {
        await expect(project.tab(area), `\`${area}\` has no screen yet, and the tab says so`).toHaveAttribute("data-available", "false");
        await expect(project.tab(area), `\`${area}\` announces itself as no control`).toHaveAttribute("aria-disabled", "true");
        expect(await project.tab(area).getAttribute("href"), `\`${area}\` is not a link to anywhere`).toBeNull();
      } else {
        await expect(project.tab(area), `\`${area}\` has a screen`).toHaveAttribute("data-available", "true");
        await expect(project.tab(area), `\`${area}\` leads to it`).toHaveAttribute("href", live[1](tenantId, projectId));
      }
    }

    /* --- the three quick actions --- */
    await expect(project.quickActions, "exactly the three quick actions S-Project offers").toHaveCount(PROJECT_QUICK_ACTIONS.length);
    for (const [action, route] of QUICK_ACTION_ROUTES) {
      await expect(project.quickAction(action), `the \`${action}\` action opens the address it names`).toHaveAttribute("href", route(tenantId, projectId));
    }

    /* --- AI cost so far: the ledger's USD, never a ৳ (R-AI-005, I-128) --- */
    await expect(project.aiCost, "what this project has spent on model calls").toHaveText(/\d/);
    await expect(project.aiCostUnit, "in the currency the ledger records").toHaveText("USD");
    await expect(project.aiSpend, "and never in taka: converting the ledger is out of scope").not.toContainText("৳");
    await expect(project.aiCalls, "how many calls were made").toHaveText(/\d/);
    await expect(project.aiOutcomes, "and what came of them").toBeVisible();
    // The none line explains zeros and nothing else: it stands exactly when no call has been made.
    const calls = ((await project.aiCalls.textContent()) ?? "").replace(/\D/g, "");
    await expect(project.aiNone, `no model has been called on this project (calls read "${calls}")`).toHaveCount(calls === "0" ? 1 : 0);
    await expect(project.aiLedger, "the ledger itself is one link away").toHaveAttribute("href", S_PROJECT.audit(tenantId, projectId));

    /* --- recent activity: the newest five, or the reason there are none --- */
    const rows = await project.activityRows.count();
    expect(rows, "the region shows at most the five newest acts").toBeLessThanOrEqual(RECENT_ACTIVITY_LIMIT);
    await expect(project.activityEmpty, rows === 0 ? "with no act recorded the region says why" : "with acts listed there is no empty line").toHaveCount(rows === 0 ? 1 : 0);
    await expect(project.activityAll, "and the whole log is one link away").toHaveAttribute("href", S_PROJECT.audit(tenantId, projectId));

    /* --- participants: the creator holds the project as its principal (C-SPINE-PROJECT, L-ACT-03) --- */
    await expect(project.refusal, "this member holds the project, so nothing here is refused").toHaveCount(0);
    await expect(project.participantRows, "the roster names who holds the project").not.toHaveCount(0);
    await expect(project.participantRoles.filter({ hasText: "PRINCIPAL" }).first(), "and the creator holds it as its principal").toBeVisible();

    /* --- s-project/home: axe over the page, then the committed Linux baseline --- */
    await checkpoint(page, testInfo, "s-project-home");
    await expect(page).toHaveScreenshot(["s-project", "home.png"], { mask: project.masks(), animations: "disabled" });

    /* --- s-project/drawings-via-tab: the home is the visible navigation into J-010 (R-UI-031) --- */
    await project.activateTabFromKeyboard("drawings");
    await expect(page, "activating the drawings tab from the keyboard lands on the drawings route").toHaveURL(`${origin}${S_PROJECT.drawings(tenantId, projectId)}`);
    await expect(project.sheetIndex, "and the sheet index is standing there — the screen J-010's upload begins on").toBeVisible();
    await checkpoint(page, testInfo, "s-project-drawings-via-tab");
  });
});
