/**
 * J-000 SEGMENTS: affirm scale
 *
 * M2's scale leg: every view of the sheet is offered its ranked proposals or its declared absence,
 * and a person affirms one through the one ConsequenceDialog. The proposal affirmed is the one the
 * PANEL published — nothing is transcribed, and nothing is staged (AM-09 §2, L-MEA-05, L-ACT-01).
 */
import { expect, test } from "@playwright/test";
import { SDrawingsPage, S_DRAWINGS } from "../../pages/s-drawings.page";
import { SScalePage } from "../../pages/s-scale.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { SViewerPage, VIEWER_BUDGETS } from "../../viewer/s-viewer.page";
import { SHEET, goldenRun, releaseGoldenWorker } from "./golden-run";

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe.serial("J-000 — Golden Path: a scale of record for the sheet", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m2-affirm-scale: the panel's own proposal is affirmed, and the view carries a scale of record", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await goldenRun(page);
    const drawings = new SDrawingsPage(page);
    const viewer = new SViewerPage(page);
    const scale = new SScalePage(page);

    await drawings.open(run.tenantId, run.projectId);
    await drawings.cell(drawings.cardForLayout(SHEET), S_DRAWINGS.open).click();
    await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });

    /* --- the scale panel, docked as the inspector's second tab (R-UI-021) --- */
    await scale.open();
    await expect(scale.panel, "the scale panel is past its loading state").not.toHaveAttribute("data-state", "loading", { timeout: 120_000 });
    await expect(scale.rows, "every view of the sheet is listed, with its proposals or its declared absence").not.toHaveCount(0, { timeout: 120_000 });

    /* --- the weakest proposal the panel itself published, affirmed through the act door --- */
    const proposal = scale.proposals.first();
    await expect(proposal, "the panel proposes a scale for at least one view — the file's own units, at worst").toBeVisible({ timeout: 120_000 });
    const rank = (await proposal.getAttribute("data-rank")) ?? "";
    expect(rank, "a proposal states the rank it stands at (L-MEA-05)").not.toBe("");
    await proposal.click();

    await scale.affirm(rank).click();
    await expect(scale.dialog, "affirming a scale is an act, and an act is previewed in the one ConsequenceDialog").toBeVisible();
    await expect(scale.dialog, "and the dialog names the act it is about to commit").toHaveAttribute("data-act-type", "AFFIRM_SCALE");
    await expect(scale.subjectRows, "the preview names what it would change").not.toHaveCount(0);
    await expect(scale.digestLine, "and the digest the commit is bound to").toBeVisible();
    await scale.confirm.click();

    await expect(scale.dialog, "the committed act closes the dialog").toHaveCount(0, { timeout: 60_000 });
    await expect(scale.rows.filter({ has: page.locator('[data-state="affirmed"]') }).or(page.locator('[data-testid="viewer-scale-view"][data-state="affirmed"]')).first(),
      "a view now carries a scale of record").toBeVisible({ timeout: 60_000 });

    await settled(page);
    await checkpoint(page, testInfo, "j-000/scale-affirmed");
  });
});
