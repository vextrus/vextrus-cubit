/**
 * J-000 SEGMENTS: run partition
 *
 * M2's first leg: the partition the ingest chained is READ on the sheet a person opens — the views
 * it found, the grid it laid, and the deferrals it was honest about. Nothing is staged: the reading
 * standing here is the one the shipped worker produced for the golden run's own upload (AM-09 §2).
 */
import { expect, test } from "@playwright/test";
import { SDrawingsPage, S_DRAWINGS } from "../../pages/s-drawings.page";
import { SViewerPartitionPage } from "../../pages/s-viewer-partition.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { SViewerPage, VIEWER_BUDGETS } from "../../viewer/s-viewer.page";
import { SHEET, goldenRun } from "./golden-run";

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe.serial("J-000 — Golden Path: the partition of the uploaded sheet", () => {
  test("J-000 m2-run-partition: the sheet's views and grid stand on the partition the upload's own job laid", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await goldenRun(page);
    const drawings = new SDrawingsPage(page);
    const viewer = new SViewerPage(page);
    const partition = new SViewerPartitionPage(page);

    /* --- onto the sheet through its own card's door (R-UI-031) --- */
    await drawings.open(run.tenantId, run.projectId);
    const door = drawings.cell(drawings.cardForLayout(SHEET), S_DRAWINGS.open);
    await expect(door, "the sheet card carries a visible door onto its sheet").toBeVisible({ timeout: 120_000 });
    await door.click();
    await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });

    /* --- the partition panel, as the worker left it --- */
    await expect(partition.panel, "the partition panel stands beside the sheet").toBeVisible({ timeout: 120_000 });
    await expect(partition.panel, "and it is past its loading state — a reading, not a wait").not.toHaveAttribute("data-state", "loading", { timeout: 120_000 });
    await expect(partition.viewRows, "the partition found at least one view of this sheet").not.toHaveCount(0, { timeout: 120_000 });
    await expect(partition.viewsToggle, "the views it found can be shown on the sheet").toBeVisible();
    await partition.viewsToggle.click();
    await expect(partition.overlayCanvas, "and the overlay paints them over the drawing").toBeVisible();
    await partition.gridToggle.click();

    await settled(page);
    await checkpoint(page, testInfo, "j-000/partition-read");
  });
});
