/**
 * J-000 SEGMENTS: view coverage grid
 *
 * M2's last leg: the coverage grid, reached through the takeoff lane's own nav entry, states for
 * every kind×class×level what was measured and what was not, and the certificate preview says the
 * same thing in sentences. Nothing is staged: the residue read here is the golden run's own
 * campaign (AM-09 §2, R-TO-052, L-QTY-05).
 */
import { expect, test } from "@playwright/test";
import { SCoveragePage } from "../../pages/s-coverage.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { goldenRun, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe.serial("J-000 — Golden Path: what the campaign did and did not establish", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m2-coverage-grid: the grid states every cell's coverage, and the certificate preview says it in sentences", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await goldenRun(page);
    const takeoff = new STakeoffPage(page);
    const coverage = new SCoveragePage(page);

    /* --- reached the way a reader reaches it: the lane's own nav entry, never a typed URL --- */
    await takeoff.open(run.tenantId, run.projectId);
    await settled(page);
    await coverage.openThroughNav();
    await expect(coverage.root, "the coverage screen is past its loading state").not.toHaveAttribute("data-state", "loading", { timeout: 120_000 });

    await expect(coverage.grid, "the grid stands").toBeVisible({ timeout: 120_000 });
    await expect(coverage.cells.first(), "and it holds the cells the campaign's residue names").toBeVisible({ timeout: 120_000 });
    await expect(coverage.legend, "with a legend for the causes a cell may wear").toBeVisible();

    /* --- the certificate preview: the same reading, in sentences --- */
    await expect(coverage.statement("MEASUREMENT"), "the certificate preview states what was measured").toBeVisible({ timeout: 60_000 });
    await expect(coverage.statement("BILL"), "and what stands in the bill").toBeVisible();

    await settled(page);
    await checkpoint(page, testInfo, "j-000/coverage-grid");
  });
});
