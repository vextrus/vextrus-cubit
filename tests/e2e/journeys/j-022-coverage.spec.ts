/**
 * J-022 — the coverage grid: what this campaign measured, what it did not, and why (X-3, R-TO-052,
 * L-QTY-05, L-QTY-07, AC-8).
 *
 * A measured campaign is staged by `stageCoverage`, which is `stageRegister` plus one class sighted
 * on a level nothing published a line for — so the grid a reader meets holds both readings at once.
 * The reader opens the coverage grid through the takeoff lane's own nav entry, reads the unmeasured
 * cell's cause and its remedy, holds it out of this bill through the shipped ConsequenceDialog, sees
 * the cell change its bill reading, and finds it enumerated on the certificate's bill statement.
 *
 * The gate runs `pnpm e2e --journey J-022`, which is Playwright's title grep — so every title here
 * names J-022.
 *
 * Nothing is transcribed. Which cell is unmeasured is read off the GRID rather than assumed, and the
 * cause's words are the ones the screen's own legend states for that cause — so a catalogue that
 * grows a bears row, or a registry entry that is reworded, moves this journey with it (B-19).
 */
import { expect, test } from "@playwright/test";
import { NOT_ESTABLISHED, NOT_IN_THIS_BILL, QUANTITY_BEARING, SCoveragePage } from "../pages/s-coverage.page";
import { STakeoffPage } from "../pages/s-takeoff.page";
import { checkpoint } from "../support/checkpoint";
import { stageCoverage } from "../takeoff/coverage-stage";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-022 — the coverage grid: unmeasured cells with causes, a hold-out act, and the certificate that lists it", () => {
  test("J-022: a reader reads the residue as a heat grid, holds one cell out of this bill, and finds it on the bill statement", async ({ page }, testInfo) => {
    test.slow();
    const takeoff = new STakeoffPage(page);
    const coverage = new SCoveragePage(page);

    /* --- the stage: a measured campaign with one level sighted and never measured --- */
    const staged = await stageCoverage(page, { label: "j022" });

    /* --- j-022-coverage/grid: the grid, reached through the lane's own nav entry --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    await expect(coverage.navCoverage, "the takeoff lane carries a second entry, beside the register's (R-UI-031)").toBeVisible();
    await expect(takeoff.navRegister, "which stands beside the register entry rather than replacing it").toBeVisible();
    await coverage.openThroughNav();

    await expect(coverage.grid, "the residue paints as a grid of kinds by class and level").toBeVisible();
    await expect(coverage.cells.first(), "which holds cells").toBeVisible();

    const measured = coverage.cell(staged.measured.kind, staged.measured.class, staged.measured.levelId);
    await expect(measured, "the cell the campaign published a line for reads as bearing quantity").toHaveAttribute("data-measurement", QUANTITY_BEARING);
    await expect(measured, "and stands in this bill").toHaveAttribute("data-bill", "IN_BILL");

    const unmeasured = coverage.cell(staged.unmeasured.kind, staged.unmeasured.class, staged.unmeasured.levelId);
    await expect(unmeasured, "the cell sighted on the level nothing measured says nothing explains its absence").toHaveAttribute("data-measurement", NOT_ESTABLISHED);
    await expect(unmeasured.getByTestId("coverage-cell-glyph").first(), "and carries a mark for that cause — a reading a colour alone could never carry (R-UI-060)").toBeVisible();
    const name = (await unmeasured.getAttribute("aria-label")) ?? "";
    expect(name, "which is named in words for a reader who never sees the colour").toContain(staged.unmeasured.kind);
    expect(name.includes(NOT_ESTABLISHED), "and never as a code").toBe(false);

    const entry = coverage.legendEntry(NOT_ESTABLISHED);
    await expect(entry, "the legend names the cause standing on the grid").toBeVisible();
    const remedy = ((await entry.textContent()) ?? "").trim();
    expect(remedy.length, "and states what to do about it — every cause a remedy (X-3)").toBeGreaterThan(0);

    await checkpoint(page, testInfo, "j-022-coverage/grid");
    await expect(coverage.grid, "grid.png pictures the residue as a reader first meets it").toHaveScreenshot(["j-022-coverage", "grid.png"], {
      animations: "disabled",
      mask: coverage.masks(),
      maxDiffPixelRatio: 0.002,
    });

    /* --- the inspector: the evidence the cell stands on, and the doors that could move it --- */
    await coverage.select(unmeasured);
    await expect(coverage.cause, "the inspector states the cell's cause").toBeVisible();
    await expect(coverage.remedy, "and the remedy the registry holds for it, verbatim (I-191)").toBeVisible();
    expect(((await coverage.remedy.textContent()) ?? "").trim().length, "in words a reader can act on").toBeGreaterThan(0);
    await expect(coverage.sightings.first(), "beside the channel that sighted this class on this level").toBeVisible();

    await expect(coverage.declareOutOfScope, "a borne cell that measured nothing can be declared out of the project scope").toBeVisible();
    await expect(coverage.holdOut, "or held out of this bill — the two doors L-ACT-03 puts under SET_BILL_BOUNDARY").toBeVisible();

    await coverage.select(measured);
    await expect(coverage.holdOut, "while a cell that bears quantity offers no door at all — absent, never disabled (I-194)").toHaveCount(0);
    await expect(coverage.declareOutOfScope, "neither of them").toHaveCount(0);

    /* --- j-022-coverage/held-out: the act, carried through the one shipped dialog --- */
    await coverage.select(unmeasured);
    await coverage.carry(coverage.holdOut);

    await expect(unmeasured, "the cell the act named now stands outside this bill").toHaveAttribute("data-bill", NOT_IN_THIS_BILL, { timeout: 30_000 });
    await expect(unmeasured, "while the measurement axis says what it always said — the two axes are orthogonal (L-QTY-05)").toHaveAttribute("data-measurement", NOT_ESTABLISHED);
    await expect(unmeasured, "and no line contradicts the hold").toHaveAttribute("data-contradicted", "false");

    await coverage.select(unmeasured);
    const stated = (await coverage.cause.getAttribute("data-code")) ?? (await coverage.cause.getAttribute("data-cause"));
    expect(stated, "the inspector now states the bill's own cause — the axis a person moved is the one the cell is read on").toBe(NOT_IN_THIS_BILL);
    await expect(coverage.legendEntry(NOT_IN_THIS_BILL), "which the legend names too").toBeVisible();
    await expect(coverage.sightings.first(), "the evidence the cell stands on is still shown").toBeVisible();

    await checkpoint(page, testInfo, "j-022-coverage/held-out");
    await expect(coverage.inspector, "held-out.png pictures the inspector on the cell a person decided about").toHaveScreenshot(["j-022-coverage", "held-out.png"], {
      animations: "disabled",
      mask: coverage.masks(),
      maxDiffPixelRatio: 0.002,
    });

    /* --- j-022-coverage/certificate: the two statements, as enumerations --- */
    await expect(coverage.preview, "the certificate preview stands beneath the grid").toBeVisible();
    await expect(coverage.statements, "holding exactly two statements — the measurement boundary and the bill boundary (L-QTY-07)").toHaveCount(2);

    const billed = coverage.statementRows("bill");
    await expect(billed, "the bill statement enumerates what a person held out of this bill").toHaveCount(1);
    await expect(billed.first(), "naming the kind it stands over").toHaveAttribute("data-kind", staged.unmeasured.kind);
    await expect(billed.first(), "the class").toHaveAttribute("data-class", staged.unmeasured.class);
    await expect(billed.first(), "and the cause it stands under").toHaveAttribute("data-cause", NOT_IN_THIS_BILL);

    const printed = ((await coverage.preview.textContent()) ?? "").replace(/\s+/gu, " ");
    expect(/\b\d+ of \d+\b/u.test(printed), "and nothing in the preview states a count: L-QTY-07 prints enumerations, never cardinalities").toBe(false);
    expect(/\d\s*%/u.test(printed), "nor a proportion").toBe(false);

    await checkpoint(page, testInfo, "j-022-coverage/certificate");
    await expect(coverage.preview, "certificate.png pictures the two statements as they will print").toHaveScreenshot(["j-022-coverage", "certificate.png"], {
      animations: "disabled",
      mask: coverage.masks(),
      maxDiffPixelRatio: 0.002,
    });
  });
});
