/**
 * J-000 SEGMENTS: see column lines
 *
 * M2's third leg of the golden path: the campaign the prologue opened is MEASURED, by clicks, and its
 * column lines stand in the register. The door this leg waited on (recorded here as MISSING DOOR
 * until 2026-09-21) was the register following the acts that move the expansion's inputs: a pin, a
 * level, a typical range each re-expand the stored partition (L-CAD-07; the partition module's
 * `reexpandProject`), so a customer's own order of clicks — pin the set, insert the levels, author
 * the typical plan's range, press Measure — reaches a measurable campaign on a project they have just
 * made. The walk itself lives in `golden-run.ts` (`measuredRun`), because the coverage leg starts from
 * the same measured campaign and a second worker of the lane walks it on its own project.
 */
import { expect, test } from "@playwright/test";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { TESTIDS } from "../../../../src/ui/testids";
import { LEVELS, measuredRun, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe.serial("J-000 — Golden Path: the column lines of the measured campaign", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m2-column-lines: the levels stand, the typical plan's range is authored, the campaign is measured, and its column lines stand in the register with their evidence", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await measuredRun(page);
    const takeoff = new STakeoffPage(page);

    await takeoff.open(run.tenantId, run.projectId);
    await expect(takeoff.root, "the register reads the measured campaign").toHaveAttribute("data-state", /ready|partial/);
    await expect(takeoff.levelStack, "and states the stack the campaign was measured over").toBeVisible();

    const rows = takeoff.lines.getByTestId(TESTIDS.datatable.row);
    await expect(rows, "the campaign's published lines stand in the table").not.toHaveCount(0);

    // The column lines, through the class filter — the table is virtualised, so its rendered rows
    // are a window and never the roster; narrowing is how a reader reaches one class (§3.2).
    await takeoff.filter("class").click();
    await page.getByRole("option", { name: /^column$/i }).first().click();
    await expect(takeoff.linesCount, `the register counts the column lines the typical floor plan's columns measure to across ${LEVELS.length} levels`).not.toHaveText(/^0 of/);
    await expect(rows, "and shows them").not.toHaveCount(0);
    await expect(takeoff.evidenceLinks, "every line offering a Trace to the entities it cites (R-UI-022)").not.toHaveCount(0);

    await settled(page);
    await checkpoint(page, testInfo, "j-000/column-lines");
  });
});
