/**
 * J-022 — the coverage grid shows what was not measured, a person holds a cell out of the bill, and
 * the certificate preview states it (R-TO-052, X-3, L-QTY-05, L-QTY-07, docs/design/s-coverage.md).
 *
 * The journey walks the product as a person does: from the register, through the nav entry this
 * increment adds, into the grid; onto the one cell the campaign did not measure; into the inspector
 * that says why and what to do about it; out through the hold-out door and its consequence dialog;
 * and down to the bill statement, which now names that cell and nothing else.
 *
 * The three design checkpoints are taken here and nowhere else; the picture itself is the gate's to
 * re-take (v16.2 §1).
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { STakeoffPage } from "../pages/s-takeoff.page";
import { checkpoint } from "../support/checkpoint";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** The width the frame paints the grid and the inspector side by side at (R-UI-030, lg and up). */
test.use({ viewport: { width: 1440, height: 900 } });

/** The kind and class the staged campaign sighted, and the channel the sighting came through. */
const KIND = "rcc.concrete";
const CLASS = "column";
const REGISTER = "REGISTER";
const DECLARATION = "DECLARATION";

/** The readings this walk names, as the page object publishes them (test contract). */
const NOT_ESTABLISHED = "NOT_ESTABLISHED";
const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL";
const QUANTITY_BEARING = "QUANTITY_BEARING";

/** The screen's page object, through the surface this journey drives (interfaces). */
interface CoveragePage {
  readonly navCoverage: Locator;
  openThroughNav(): Promise<void>;
  readonly screen: Locator;
  readonly grid: Locator;
  readonly inspector: Locator;
  readonly inspectorCause: Locator;
  readonly inspectorRemedy: Locator;
  readonly holdOut: Locator;
  readonly declareOutOfScope: Locator;
  readonly dialog: Locator;
  readonly dialogConfirm: Locator;
  statement(axis: "MEASUREMENT" | "BILL"): Locator;
  statementRows(axis: "MEASUREMENT" | "BILL"): Locator;
  masks(): Locator[];
}

/** The staging this journey is walked over (interfaces: `tests/e2e/takeoff/coverage-stage.ts`). */
interface CoverageStage {
  stageCoverage(page: Page, options: { label: string }): Promise<{ tenantId: string; projectId: string }>;
  UNMEASURED_LEVEL: string;
}

/**
 * The page object and the stage are loaded when the walk begins rather than when the file is
 * collected: a journey that cannot be COLLECTED takes every other journey down with it, and J-000
 * runs on this tree as it stands on main (AC-8). Until the screen's own page object lands, this
 * journey fails on its own and alone.
 */
async function surfaces(page: Page): Promise<{ coverage: CoveragePage; stage: CoverageStage }> {
  const stage = (await import("../takeoff/coverage-stage")) as unknown as CoverageStage;
  const pages = (await import("../pages/s-coverage.page")) as unknown as { SCoveragePage: new (page: Page) => CoveragePage };
  return { coverage: new pages.SCoveragePage(page), stage };
}

test.describe("J-022 — the coverage grid", () => {
  test("J-022: an unmeasured cell states its cause, is held out of the bill by act, and prints on the bill statement", async ({ page }, testInfo) => {
    const { coverage, stage } = await surfaces(page);
    const staged = await stage.stageCoverage(page, { label: "j022-coverage" });
    const takeoff = new STakeoffPage(page);

    /* --- the nav entry this increment adds, beside the register's (AC-8) --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    await expect(takeoff.navRegister, "the register entry stands where it stood").toBeVisible();
    await expect(coverage.navCoverage, "and the coverage entry stands beside it").toBeVisible();
    await coverage.openThroughNav();
    await expect(coverage.screen, "the coverage screen reads beneath the takeoff nav").toBeVisible();
    await expect(coverage.navCoverage, "and the entry for the address in the browser says so (I-125)").toHaveAttribute("aria-current", "page");
    await expect(coverage.grid, "the residue reads as a grid").toBeVisible();

    /* --- the cell the campaign did not measure, beside the one it did (AC-8) --- */
    const measured = page.locator(`${testIdSelector(TESTIDS.coverage.cell)}[data-kind="${KIND}"][data-class="${CLASS}"][data-measurement="${QUANTITY_BEARING}"]`);
    await expect(measured, `the ground floor bears published quantity for ${KIND}`).toHaveCount(1);

    const unmeasured = page.locator(`${testIdSelector(TESTIDS.coverage.cell)}[data-kind="${KIND}"][data-class="${CLASS}"][data-measurement="${NOT_ESTABLISHED}"]`);
    await expect(unmeasured, `${stage.UNMEASURED_LEVEL} was sighted and never measured, so exactly one cell stands unestablished for ${KIND} on ${CLASS}`).toHaveCount(1);
    await expect(unmeasured, "and it names the level it stands on").toHaveAttribute("data-level", /.+/);
    await expect(unmeasured.getByTestId("coverage-cell-glyph"), "carrying the mark its cause is read by — colour never alone (R-UI-060)").toHaveAttribute(
      "data-code",
      NOT_ESTABLISHED,
    );

    /* --- the inspector: the cause in words, the remedy, and what was sighted (AC-8) --- */
    await unmeasured.click();
    await expect(coverage.inspector, "the cell a reader chose fills the inspector").toBeVisible();
    await expect(coverage.inspectorCause, "which states the cause the cell is read under").toHaveAttribute("data-code", NOT_ESTABLISHED);
    await expect(coverage.inspectorRemedy, "and the remedy that resolves it — every cause a remedy (X-3)").not.toBeEmpty();
    await expect(
      page.locator(`${testIdSelector(TESTIDS.coverage.inspectorSighting)}[data-channel="${REGISTER}"]`),
      "the register's own sighting of this class on this level is shown as the evidence the cell stands on",
    ).toHaveCount(1);
    await expect(page.getByTestId("coverage-legend"), "and the legend beneath names every mark the grid draws").toBeVisible();
    await expect(coverage.holdOut, "both doors stand on a cell that bears no quantity (I-194)").toBeVisible();
    await expect(coverage.declareOutOfScope).toBeVisible();

    await checkpoint(page, testInfo, "grid");
    await expect(page).toHaveScreenshot(["j-022-coverage", "grid.png"], { mask: coverage.masks(), animations: "disabled" });

    /* --- the hold-out act, carried through its consequence dialog (AC-8) --- */
    await coverage.holdOut.click();
    await expect(coverage.dialog, "a door opens a preview of exactly what it changes, and commits nothing itself").toBeVisible();
    await coverage.dialogConfirm.click();
    await expect(coverage.dialog, "and the dialog closes once the act is carried").not.toBeVisible();

    await expect(unmeasured, "the cell now reads as held out of this bill").toHaveAttribute("data-bill", NOT_IN_THIS_BILL);
    await expect(unmeasured, "on the bill axis only: holding a cell out of a bill measures nothing (L-QTY-05)").toHaveAttribute("data-measurement", NOT_ESTABLISHED);
    await expect(coverage.inspectorCause, "the inspector reads the cause the person gave it").toHaveAttribute("data-code", NOT_IN_THIS_BILL);
    await expect(coverage.inspectorCause, "naming the act that declared it — a declaration without its act is a flag").toHaveAttribute("data-act", /.+/);
    await expect(
      page.locator(`${testIdSelector(TESTIDS.coverage.inspectorSighting)}[data-channel="${DECLARATION}"]`),
      "and the declaration stands among the evidence, beside what the channels sighted",
    ).toHaveCount(1);
    await expect(coverage.holdOut, "both doors still stand — nothing was withdrawn").toBeVisible();
    await expect(coverage.declareOutOfScope).toBeVisible();

    await checkpoint(page, testInfo, "held-out");
    await expect(page).toHaveScreenshot(["j-022-coverage", "held-out.png"], { mask: coverage.masks(), animations: "disabled" });

    /* --- the certificate preview: the bill statement names that cell, and nothing else (AC-8) --- */
    await expect(coverage.statement("MEASUREMENT"), "the measurement boundary prints first and in full (L-QTY-07)").toBeVisible();
    const bill = coverage.statementRows("BILL");
    await expect(bill, "and the bill boundary names exactly what a person held out of it: one cell").toHaveCount(1);
    await expect(bill.first(), `the kind held out`).toHaveAttribute("data-kind", KIND);
    await expect(bill.first(), "on the class it was held out on").toHaveAttribute("data-class", CLASS);
    await expect(bill.first(), "under the cause the act wrote").toHaveAttribute("data-code", NOT_IN_THIS_BILL);

    await checkpoint(page, testInfo, "certificate");
    await expect(page).toHaveScreenshot(["j-022-coverage", "certificate.png"], { mask: coverage.masks(), animations: "disabled" });
  });
});
