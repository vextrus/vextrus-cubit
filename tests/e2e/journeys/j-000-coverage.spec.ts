/**
 * J-000 — the Golden Path reaches the coverage grid (AC-8). A new account uploads F-RCC6, confirms
 * the discipline its sheets fanned out under, affirms the scale of a view, pins a drawing set, asks
 * for a measure run, reads the column concrete lines the rails published, and then reads the grid
 * that says what the campaign did NOT measure and why (X-3, R-TO-052, J-000).
 *
 * A NEW file rather than an edit of `j-000-golden-path.spec.ts`: the merged `tests/hotfix-j000` suite
 * byte-freezes every J-000 asset the pre-fix merge tracked, and its own words make an addition under
 * its own name no trespass — the `j-000-viewer` precedent. The titles name J-000, which is what
 * `pnpm e2e --journey J-000` greps on, so the Golden Path collects this leg beside the ones it runs.
 *
 * The e2e lane starts the web server and nothing else, so this journey spawns the shipped worker
 * itself: a job queue nobody consumes never finishes.
 *
 * Nothing is transcribed. Which view is affirmed, which drawing is pinned and which cells stand on
 * the grid are all read off the product as this journey walks it (B-19).
 */
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SCoveragePage } from "../pages/s-coverage.page";
import { SDrawingsPage, S_DRAWINGS } from "../pages/s-drawings.page";
import { SHomePage, S_HOME } from "../pages/s-home.page";
import { SScalePage } from "../pages/s-scale.page";
import { STakeoffPage } from "../pages/s-takeoff.page";
import { ShellPage, SHELL } from "../pages/shell.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";
import { startJourneyWorker } from "../support/worker";
import { SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j000c-${RUN}@cubit.test`;
const PASSWORD = `golden-path-coverage-${RUN}`;

/** Fixed, because they are painted into frames a baseline compares (the Golden Path's own reason). */
const WORKSPACE_AT_SIGN_UP = `First Workspace ${RUN}`;
const WORKSPACE = "Golden Path Works";
const PROJECT = "Riverside Tower";
const SET_NAME = "Tender set";

/** The corpus this leg uploads, the sheet it scales, and the discipline its sheets fan out under. */
const FIXTURE = join(process.cwd(), "fixtures", "rcc6", "rcc6.dxf");
const SHEET = "FOUNDATION PLAN";
const DISCIPLINE = "STRUCTURAL";

/** The weakest rank a mapped header always yields, so a view can be affirmed without an observation. */
const FILE_UNITS = "FILE_UNITS";

/** The sets screen's own test ids (docs/design/s-drawings-sets.md §7): the page objects gain no file. */
const S_SETS = {
  createForm: "set-create-form",
  nameInput: "set-name-input",
  create: "set-create",
  drawing: "set-drawing",
  toggle: "set-member-toggle",
  pin: "set-pin",
  dialog: "consequence-dialog",
  dialogConfirm: "consequence-confirm",
} as const;

const at = (page: Page, testId: string): Locator => page.locator(`[data-testid="${testId}"]`);
const setsRoute = (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings/sets`;

/** How long the extraction, the rasters and a measure run may take on a cold server. */
const FAN_OUT_BUDGET_MS = 90_000;
const MEASURE_BUDGET_MS = 180_000;

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-000 — Golden Path: the uploaded drawing is measured, and the coverage grid says what it did not measure", () => {
  test("J-000: a new account walks F-RCC6 through disciplines, scale, a pinned set and a measure run, and reads the coverage grid", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(900_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";

    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const drawings = new SDrawingsPage(page);
    const viewer = new SViewerPage(page);
    const scale = new SScalePage(page);
    const takeoff = new STakeoffPage(page);
    const coverage = new SCoveragePage(page);

    const worker = await startJourneyWorker();
    try {
      /* --- this run's own account, its workspace and its first project --- */
      await auth.open(S_AUTH.signUp);
      await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE_AT_SIGN_UP);
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
      expect(tenantId, "the workspace door lands on an address naming the workspace").not.toBe("");
      await shell.open(S_HOME.settings(tenantId));
      await shell.renameInput.fill(WORKSPACE);
      await shell.renameSubmit.click();
      await expect(shell.renameInput, "the saved name is what the settings screen reads back").toHaveValue(WORKSPACE);

      await home.open(S_HOME.workspace(tenantId));
      await home.createWith({ name: PROJECT, buildingType: 0 });
      const card = home.cardNamed(PROJECT);
      await expect(card, "the created project stands on S-Home").toBeVisible();
      const projectId = (await card.getAttribute("data-project")) ?? "";
      expect(projectId, "the card names the project it is for").not.toBe("");

      /* --- upload F-RCC6, and wait for the reading --- */
      await drawings.open(tenantId, projectId);
      await drawings.dropFile(FIXTURE);
      await expect(drawings.dropzoneItems.first(), "the dropped drawing is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: FAN_OUT_BUDGET_MS });
      await expect(drawings.timeline, "the jobs the upload asked for finish where the work was started (X-1)").toHaveAttribute("data-state", "done", { timeout: FAN_OUT_BUDGET_MS });

      /* --- confirm the discipline the sheets fanned out under --- */
      await expect(drawings.groupFor(DISCIPLINE), `the sheets fanned out under ${DISCIPLINE}, offered as one group to confirm (R-UI-023)`).toBeVisible({ timeout: FAN_OUT_BUDGET_MS });
      await drawings.confirmGroup(DISCIPLINE);
      await expect(drawings.dialog, "the group is confirmed as one act through the one shipped dialog (R-UI-021)").toBeHidden();

      /* --- affirm the scale of a view of the sheet, which is what makes a length measurable --- */
      const sheetCard = drawings.cardForLayout(SHEET);
      await expect(sheetCard, `the sheet "${SHEET}" fanned out as a card of its own`).toHaveCount(1, { timeout: FAN_OUT_BUDGET_MS });
      await drawings.cell(sheetCard, S_DRAWINGS.open).click();
      await page.waitForURL(/\/viewer\//);
      await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });

      await scale.open();
      const viewKeys = await scale.viewKeys();
      expect(viewKeys.length, "the sheet's own views stand in the scale panel").toBeGreaterThan(0);
      const affirming = viewKeys[0] as string;
      await scale.member(affirming).click();
      await scale.affirm(FILE_UNITS).click();
      await scale.dialog.waitFor({ state: "visible" });
      await scale.confirm.click();
      await expect(scale.row(affirming), "the view the act named stands affirmed — a view no act names measures nothing (R-TO-021)").toHaveAttribute("data-state", "affirmed");

      /* --- pin a drawing set, which is what opens a campaign (L-REG-07) --- */
      await page.goto(setsRoute(tenantId, projectId));
      await expect(at(page, S_SETS.createForm), "the sets index carries the door that names a set").toBeVisible();
      await at(page, S_SETS.nameInput).fill(SET_NAME);
      await at(page, S_SETS.create).click();
      await expect(page, "the named set stands open at its own address").toHaveURL(new RegExp(`^${origin}/t/${tenantId}/p/${projectId}/drawings/sets/[0-9a-f-]{36}$`));

      const memberRow = at(page, S_SETS.drawing).first();
      await memberRow.locator(`[data-testid="${S_SETS.toggle}"]`).click();
      await expect(memberRow, "the drawing joins the set's draft at once").toHaveAttribute("data-member", "true");
      await at(page, S_SETS.pin).click();
      const setDialog = at(page, S_SETS.dialog);
      await setDialog.waitFor({ state: "visible" });
      await setDialog.locator(`[data-testid="${S_SETS.dialogConfirm}"]`).click();
      await expect(setDialog, "the dialog closes on the act it carried (R-UI-021)").toHaveCount(0, { timeout: FAN_OUT_BUDGET_MS });

      /* --- j-000/column-lines: the measure run, and the lines it published --- */
      await takeoff.open(tenantId, projectId);
      await expect(takeoff.measure, "the register offers the door that measures the pinned campaign").toBeVisible();
      await takeoff.measure.click();
      await expect(takeoff.lines, "the lines table stands").toBeVisible();
      await expect
        .poll(async () => takeoff.lines.getByTestId("evidence-link").count(), { timeout: MEASURE_BUDGET_MS, message: "the rails publish the column concrete lines of the walked-in project" })
        .toBeGreaterThan(0);
      await checkpoint(page, testInfo, "j-000/column-lines");
      await expect(takeoff.lines, "column-lines.png pictures what the Golden Path's own project measured").toHaveScreenshot(["j-000", "column-lines.png"], {
        animations: "disabled",
        mask: takeoff.masks(),
        maxDiffPixelRatio: 0.002,
      });

      /* --- j-000/coverage-grid: the residue, reached through the lane's own nav entry --- */
      await expect(coverage.navCoverage, "the takeoff lane carries an entry onto the coverage grid (R-UI-031)").toBeVisible();
      await coverage.openThroughNav();
      await expect(coverage.grid, "the residue paints as a grid of kinds by class and level").toBeVisible();
      await expect(coverage.cells.first(), "which holds a cell for every kind a sighted class bears, on every level it was sighted").toBeVisible();
      await expect(coverage.measuring("QUANTITY_BEARING").first(), "the cell the measure run published stands measured").toBeVisible();
      await expect(coverage.legend, "beside a legend that says in words what every mark on it means (R-UI-060)").toBeVisible();

      await checkpoint(page, testInfo, "j-000/coverage-grid");
      await expect(coverage.root, "coverage-grid.png pictures the Golden Path's own residue").toHaveScreenshot(["j-000", "coverage-grid.png"], {
        animations: "disabled",
        mask: coverage.masks(),
        maxDiffPixelRatio: 0.002,
      });
    } finally {
      await worker.stop();
    }
  });
});
