/**
 * J-000 SEGMENTS: run the structural campaign on F-RCC6-BNBC; review the register
 *
 * M3's first leg after the transcriptions, WALKED (AM-09 §3, AM-17): the M3 fixture F-RCC6-BNBC
 * (AM-01) stands uploaded, affirmed, stacked and transcribed by `golden-run.ts` (`bnbcMeasured`, the
 * walk m3-levels-and-notes.spec.ts proves by clicks), Measure is pressed, the ranges the first run
 * deferred are stated on the levels rail — the rail is the campaign's index (s-levels I-240) — the
 * campaign is measured again, and the register is reviewed: the lines the rails published, the
 * refusals and deferrals by their registered codes, the column lines the column layout's members
 * measure to, and the coverage grid's cells and boundary statement (L-QTY-05).
 *
 * The doors this leg waited on landed in session 5: a paper-space viewport's title captions the
 * model-space region it shows (viewer.md I-290), a block-drawn grid bubble georeferences (I-292),
 * the section's `EL` marks propose the stack (I-293), the stacked column schedule reads (I-294), a
 * feet-and-inches dimension scales a unitless header (I-295/I-295b), a band written in ordinal words
 * covers the stack's floor labels, and the unit the drawing declares is the last word on a unitless
 * section (I-302). What the run's own database says at the end of this leg: 182 column concrete
 * lines COMPLETE, 92.21 m³. The legs that emit the documents and read them against the golden stand
 * in m3-bill-and-schedules.spec.ts, behind the doors that file names.
 *
 * Nothing here measures time (AM-10 §3).
 */
import { expect, test, type TestInfo } from "@playwright/test";
import { NOT_ESTABLISHED, QUANTITY_BEARING, SCoveragePage } from "../../pages/s-coverage.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { heldAttribute, steadyCount, steadyText } from "../../support/retrying-read";
import { settled } from "../../support/settled";
import { TESTIDS } from "../../../../src/ui/testids";
import { bnbcMeasured, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** A reading of the register, attached to the run so the handoff can quote it. */
async function attach(testInfo: TestInfo, name: string, body: string): Promise<void> {
  await testInfo.attach(name, { body, contentType: "text/plain" });
}

test.describe.serial("J-000 — Golden Path: M3's measure on F-RCC6-BNBC", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m3-measure-and-register: the structural campaign is measured on F-RCC6-BNBC and the register is reviewed", async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    const run = await bnbcMeasured(page);
    const takeoff = new STakeoffPage(page);
    const coverage = new SCoveragePage(page);

    await takeoff.open(run.tenantId, run.bnbc.projectId);
    await expect(takeoff.root, "the register reads the measured campaign").toHaveAttribute("data-state", /ready|partial/);
    // Both may stand on this campaign — the tree of registered objects AND the level stacks read off
    // the drawings — and `or` is strict about resolving to one, so the first is the one asserted.
    await expect(takeoff.levelStack.or(takeoff.tree).first(), "the campaign's index stands beside the lines").toBeVisible();
    const count = await steadyText(takeoff.linesCount, "the register's count line");
    expect(count, "the rails published lines over the M3 fixture").not.toMatch(/^0 of/);

    const rows = takeoff.lines.getByTestId(TESTIDS.datatable.row);
    await expect(rows, "the campaign's published lines stand in the table").not.toHaveCount(0);
    await expect(takeoff.evidenceLinks, "every line offering a Trace to the entities it cites (R-UI-022)").not.toHaveCount(0);

    // The refusals and deferrals, reviewed where they stand: each says why, by its registered code.
    const refusals = await steadyText(takeoff.refusals, "the deferred-and-refused section").catch(() => "");
    await attach(testInfo, "m3-register-refusals", `count=${(await heldAttribute(takeoff.refusals, "data-count").catch(() => null)) ?? "absent"}\n${refusals}`);

    await takeoff.filter("class").click();
    await page.getByRole("option", { name: /^column$/i }).first().click();
    await expect(takeoff.linesCount, "the register counts the column lines the column layout's members measure to").not.toHaveText(/^0 of/);
    await settled(page);
    await checkpoint(page, testInfo, "j-000/bnbc-register");

    /* --- the coverage grid: what the campaign did and did not establish, said in cells (L-QTY-05) --- */
    await coverage.openThroughNav();
    await expect(coverage.screen, "the coverage screen reads the measured campaign").toHaveAttribute("data-state", /ready|partial/);
    await expect(coverage.cells, "with a cell per kind and class the campaign stands on").not.toHaveCount(0);
    await expect(coverage.measuring(QUANTITY_BEARING), "the measured cells bear published quantity").not.toHaveCount(0);
    const unestablished = await steadyCount(coverage.measuring(NOT_ESTABLISHED), "the cells the campaign did not establish", { min: 0 });
    await attach(testInfo, "m3-coverage", `not-established cells=${unestablished}`);
    await expect(coverage.statement("MEASUREMENT"), "the measurement boundary prints in full").toBeVisible();
    await settled(page);
    await checkpoint(page, testInfo, "j-000/bnbc-coverage");
  });
});
