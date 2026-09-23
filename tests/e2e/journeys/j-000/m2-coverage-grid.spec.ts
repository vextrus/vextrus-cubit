/**
 * J-000 SEGMENTS: view coverage grid
 *
 * M2's fourth leg of the golden path: what the measured campaign did and did not establish, read
 * off the coverage grid a customer reaches from the takeoff lane's own nav entry, and said in
 * sentences by the certificate preview beneath it (X-3, R-TO-052, L-QTY-05, L-QTY-07). It starts from
 * the same measured campaign the column-lines leg does (`golden-run.ts`, `measuredRun`): the door
 * this leg waited on was the same one, recorded here as MISSING DOOR until 2026-09-21.
 */
import { expect, test } from "@playwright/test";
import { QUANTITY_BEARING, NOT_ESTABLISHED, SCoveragePage } from "../../pages/s-coverage.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { measuredRun, releaseGoldenWorker } from "./golden-run";
import { TESTIDS, testIdSelector } from "../../../../src/ui/testids";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe.serial("J-000 — Golden Path: what the campaign did and did not establish", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m2-coverage-grid: the grid states every cell's coverage, and the certificate preview says it in sentences", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await measuredRun(page);
    const takeoff = new STakeoffPage(page);
    const coverage = new SCoveragePage(page);

    /* --- reached by the lane's own nav entry, never a typed address (R-UI-031) --- */
    await takeoff.open(run.tenantId, run.projectId);
    await expect(coverage.navCoverage, "the takeoff lane offers the coverage grid beside the register").toBeVisible();
    await coverage.openThroughNav();
    await expect(coverage.navCoverage, "and the entry for the address in the browser says so").toHaveAttribute("aria-current", "page");
    await expect(coverage.screen, "the coverage screen reads the measured campaign").toHaveAttribute("data-state", /ready|partial/);

    /* --- the grid: every cell a reading, on both axes --- */
    await expect(coverage.grid, "the residue reads as a grid").toBeVisible();
    await expect(coverage.cells, "with a cell per kind and class the campaign stands on").not.toHaveCount(0);
    await expect(coverage.measuring(QUANTITY_BEARING), "the measured column concrete bears published quantity").not.toHaveCount(0);
    await expect(coverage.measuring(NOT_ESTABLISHED), "and what the rails did not establish is stated as such — never blank (L-QTY-05)").not.toHaveCount(0);
    await expect(coverage.legend, "the legend beneath names every mark the grid draws (R-UI-060)").toBeVisible();

    /* --- the whole building (COV-ALL, s-coverage I-479/b): F-RCC6-BNBC places columns,
       beams, piles and pile caps, but its sheets also draw slabs and a stair. Each has its column,
       its cells read Not measured, and the cell says why — the drawings show the class and nothing
       placed a member of it — never that nothing explains it. --- */
    for (const klass of ["slab", "stair"]) {
      const declared = coverage.grid.locator(`${testIdSelector(TESTIDS.coverage.cell)}[data-class="${klass}"][data-measurement="${NOT_ESTABLISHED}"]`);
      await expect(declared, `the ${klass} the drawings carry stands on the grid, not measured`).not.toHaveCount(0);
      await coverage.select(declared.first());
      await expect(coverage.inspectorCause, `the ${klass} cell's cause stays the law's fall-through`).toHaveAttribute("data-code", NOT_ESTABLISHED);
      await expect(coverage.inspectorCause, `and it names its reason: the drawings show the ${klass}, and no member of it was placed`).toHaveAttribute(
        "data-reason",
        "COVERAGE_CLASS_NOT_PLACED",
      );
      await expect(coverage.inspectorRemedy, "with a remedy and a door to the sheet that shows it").not.toBeEmpty();
    }
    await expect(coverage.root, "no face of the screen says that nothing explains an absence").not.toContainText(/nothing explains/iu);

    /* --- the certificate preview: the boundaries in sentences, enumerations never counts (L-QTY-07, AM-05) --- */
    await expect(coverage.statement("MEASUREMENT"), "the measurement boundary prints in full").toBeVisible();
    await expect(coverage.statement("BILL"), "and the bill boundary beside it").toBeVisible();
    await expect(
      coverage.statementRows("MEASUREMENT").and(coverage.preview.locator('[data-class="slab"][data-reason="COVERAGE_CLASS_NOT_PLACED"]')),
      "and the slab stands in the measurement boundary under its reason",
    ).not.toHaveCount(0);

    await settled(page);
    await checkpoint(page, testInfo, "j-000/coverage-grid");
  });
});
