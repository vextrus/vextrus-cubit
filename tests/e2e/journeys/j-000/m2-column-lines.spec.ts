/**
 * J-000 SEGMENTS: see column lines
 *
 * M2's exit, walked: a level is inserted, the campaign the pinned set opened is MEASURED through
 * its own door, and the column concrete lines the rails published stand in the register with their
 * evidence. Every act goes through the shipped ConsequenceDialog; the measure runs on the shipped
 * worker the golden run started. Nothing is staged (AM-09 §2, X-2, R-UI-022).
 */
import { expect, test } from "@playwright/test";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { goldenRun, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** How long the shipped rails may take over F-RCC6's columns, on the worker the golden run started. */
const MEASURE_BUDGET_MS = 300_000;

test.describe.serial("J-000 — Golden Path: the column lines of the measured campaign", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m2-column-lines: a level is inserted, the campaign is measured, and its column lines stand in the register", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await goldenRun(page);
    const takeoff = new STakeoffPage(page);

    await takeoff.open(run.tenantId, run.projectId);
    await settled(page);

    /* --- the levels the reading offered, inserted through the act door --- */
    await expect(takeoff.levelStack, "the register stands on a stack of levels").toBeVisible({ timeout: 120_000 });
    const offer = takeoff.levelStack.getByTestId("offered-group").first();
    if (await offer.isVisible().catch(() => false)) {
      await offer.getByTestId("offered-group-confirm").click();
      const dialog = page.getByTestId("consequence-dialog");
      await expect(dialog, "inserting a level is an act, previewed in the one ConsequenceDialog").toBeVisible();
      await expect(dialog).toHaveAttribute("data-act-type", "INSERT_LEVEL");
      await page.getByTestId("consequence-confirm").click();
      await expect(dialog, "the committed act closes the dialog").toHaveCount(0, { timeout: 60_000 });
    }

    /* --- the campaign the pinned set opened, measured through its own door --- */
    await expect(takeoff.measure, "the register carries the door that measures its campaign").toBeVisible({ timeout: 120_000 });
    await takeoff.measure.click();
    await expect(takeoff.measureStep, "the measure the door asked for is run where it was asked for (X-1)").toHaveAttribute("data-state", "done", {
      timeout: MEASURE_BUDGET_MS,
    });

    /* --- the lines themselves --- */
    await expect(takeoff.lines, "the rails published lines for the campaign's column objects").not.toHaveCount(0, { timeout: MEASURE_BUDGET_MS });
    await expect(takeoff.linesCount, "and the register counts them").not.toBeEmpty();
    await expect(takeoff.evidenceLinks.first(), "each published line carries the evidence it was read from (X-2)").toBeVisible({ timeout: 60_000 });

    await settled(page);
    await checkpoint(page, testInfo, "j-000/column-lines");
  });
});
