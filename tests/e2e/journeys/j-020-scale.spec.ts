/**
 * J-020 — the scale leg (AC-8): a partitioned sheet opened, its scale panel docked as the second tab
 * of the right inspector, every view of the sheet listed with its ranked proposals or its declared
 * absence, a two-point calibration taken across two cited picks, the affirmation act previewed in the
 * one ConsequenceDialog and committed, and the sheet card on S-Drawings reading the count of views
 * with no scale of record (R-TO-020, R-TO-021, L-MEA-05, R-UI-021, R-UI-020, R-UI-050, V-E2E).
 *
 * The gate runs `pnpm e2e --journey J-020`, which is Playwright's title grep — so every title here
 * names J-020, and the snapping leg of the same journey (`j-020-snapping.spec.ts`) keeps its own.
 *
 * WebGL in CI: headless Chromium paints through SwiftShader, asked for by name below exactly as the
 * viewer journey asks (playwright.config.ts is locked).
 *
 * Nothing is transcribed. The segment this journey calibrates across is read off the served layer
 * feed and chosen by how clear its ends stand of every other point; the distance entered is derived
 * from the factor the panel itself published for the file's own units; the hatch count, the member
 * count and the card's figures are all read from the screen under test (B-19).
 */
import { expect, test } from "@playwright/test";
import { REFUSALS } from "../../../src/core/errors";
import { metresPer } from "../../../src/core/scale";
import { strings } from "../../../src/ui/strings";
import { SCALE_COPY } from "../../../src/modules/takeoff/scale-ui/copy";
import { drawings } from "../../../src/app/(app)/t/[tenant]/p/[project]/drawings/strings";
import { checkpoint } from "../support/checkpoint";
import { SDrawingsPage } from "../pages/s-drawings.page";
import { SScalePage } from "../pages/s-scale.page";
import { SViewerPartitionPage } from "../pages/s-viewer-partition.page";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";
import { SViewerSnapPage } from "../viewer/s-viewer-snap.page";
import { HEADER_UNIT, stageScaleSheet } from "../viewer/viewer-scale-stage";
import { everyRow, steadyCount, steadyText } from "../support/retrying-read";

/** The rank a header-unit proposal stands at, and the act this panel commits (L-MEA-05, L-ACT-01). */
const FILE_UNITS = "FILE_UNITS";
const AFFIRM_SCALE = "AFFIRM_SCALE";

/** The drawn type a two-point calibration is taken across: a segment has two ends and one axis. */
const LINE = "LINE";

/**
 * How far clear of every other drawn point each end of the calibrated segment must stand, in drawing
 * units, and the camera the picks are taken at. A snap reaches `SNAP_TOLERANCE_PX` (8 px) at whatever
 * camera stands, so this journey states one: at 8 px to the drawing unit a snap reaches about one
 * unit, several times inside the clearance each end stands in.
 */
const CLEARANCE = 6;
const PICK_SCALE = 8;

/** One registered string, read by key: this journey is written before the table carries it. */
function copy(key: string): string {
  const held = (strings as unknown as Record<string, string>)[key];
  expect(typeof held, `the string registry carries \`${key}\` (R-SPINE-060)`).toBe("string");
  return held as string;
}

/**
 * One line of the scale panel's own table, the same way. The panel's sentences live once in
 * `scale-ui/copy.ts` on ground this increment owns, read straight by `scale-region.tsx` — ARCH-01
 * forbids a module importing `src/ui`, so this table, not the assembled registry, is the source of
 * every word the panel paints (I-153; moving these keys into `src/ui/strings` is the §8 IOU).
 */
function scaleCopy(key: string): string {
  const held = (SCALE_COPY as unknown as Record<string, string>)[key];
  expect(typeof held, `the panel's copy table carries \`${key}\` (I-153)`).toBe("string");
  return held as string;
}

/** One line of the drawings screen's own table, the same way. */
function drawingsCopy(key: string): string {
  const held = (drawings as unknown as Record<string, string>)[key];
  expect(typeof held, `the drawings screen's strings table carries \`${key}\` (Decision §3)`).toBe("string");
  return held as string;
}

/** A registered string with its slots filled — the product's own substitution, restated for the lane. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-020 — scale: proposals, a two-point calibration, the affirmation act, and the unplaceable views that remain", () => {
  test("J-020: a reader reads every view's scale, calibrates one, affirms it, and the sheet card counts the rest", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(900_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();

    const staged = await stageScaleSheet(page);
    const viewer = new SViewerPage(page);
    const scale = new SScalePage(page);
    const snap = new SViewerSnapPage(page);
    const partition = new SViewerPartitionPage(page);

    /* --- the sheet, opened and drawn --- */
    await page.goto(S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName), { waitUntil: "commit" });
    await expect(viewer.status, "the staged sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000, message: "every layer of the sheet arrives before it is picked on" })
      .toBe(true);
    const layers = await viewer.statusNumber("data-total-layers");
    await viewer.fit.click();

    /* --- the strip: two tabs, outside the aside, selection pressed at mount (I-152) --- */
    await expect(scale.tabs, "the right inspector is a two-tab panel now").toBeVisible();
    await expect(scale.selectionTab, "and it opens on Selection at every mount").toHaveAttribute("aria-selected", "true");
    expect(
      await page.evaluate(() => {
        const aside = document.querySelector('[data-testid="viewer-inspector"]');
        const strip = document.querySelector('[data-testid="viewer-inspector-tabs"]');
        return aside !== null && strip !== null && aside.contains(strip);
      }),
      "the strip stands OUTSIDE the inspector aside, so the aside a journey pictured before this increment is untouched (I-152)",
    ).toBe(false);

    /* --- j-020-scale/panel-open: every view of the sheet, with its state and its proposals --- */
    await scale.open();
    const keys = await scale.viewKeys();
    expect(keys.length, "one row per view of the sheet's partition — a sheet with views is never an empty panel (R-UI-020)").toBe(staged.views.length);
    expect([...keys].sort(), "and they are the views the store holds for this reading").toEqual(staged.views.map((view) => view.viewKey).sort());

    const absentBefore = await scale.absentRows();
    expect(absentBefore.length, "no act has affirmed a scale on this drawing, so every view stands at its declared absence (L-MEA-05)").toBe(keys.length);
    for (const key of absentBefore) {
      const row = scale.row(key);
      const state = await scale.hook(row, "data-state");
      expect(["SCALE_NO_EVIDENCE", "SCALE_UNIT_UNMAPPED"], `${key} declares which absence it stands at, by name`).toContain(state);
      await expect(row, `${key} says it in the register's own words rather than falling silent (R-UI-020)`).toContainText(REFUSALS[state as "SCALE_NO_EVIDENCE"].message);
    }

    // The header of the staged drawing names a mapped unit, so every view carries the file's own
    // units as its weakest proposal, and that is the rank the last proposal of each row stands at.
    for (const key of keys) {
      const proposals = scale.row(key).getByTestId("viewer-scale-proposal");
      const count = await steadyCount(proposals, `${key}'s scale proposals`);
      expect(count, `${key} lists what the machine read for it`).toBeGreaterThan(0);
      await expect(proposals.last(), `the weakest rank a mapped header always yields is ${FILE_UNITS} (L-MEA-05)`).toHaveAttribute("data-rank", FILE_UNITS);
      await expect(proposals.last(), "and it renders that rank's registered word, not its enum spelling alone").toContainText(scaleCopy("scale_rank_FILE_UNITS"));
      const factorX = await scale.hook(proposals.last(), "data-factor-x");
      await expect(proposals.last(), "with the 12-place factor rendered whole and verbatim (I-159)").toContainText(factorX);
      expect(factorX, "which is a 12-place decimal, unrounded").toMatch(/^[0-9]+\.[0-9]{12}$/);
      expect(factorX, `and for a ${HEADER_UNIT} header it is the metres that spelling carries`).toBe(metresPer(HEADER_UNIT));
    }

    // One hatch home: the overlay hatches every view no act names, and counts them for a journey.
    expect(Number(await scale.hook(partition.overlayCanvas, "data-scale-hatched")), "the overlay hatches exactly the views the panel says have no scale (I-160)").toBe(
      absentBefore.length,
    );

    await checkpoint(page, testInfo, "j-020-scale/panel-open");
    await expect(scale.panel, "panel-light.png pictures the region a reader reads a sheet's scale in").toHaveScreenshot(["j-020-scale", "panel-light.png"], {
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });
    await scale.setTheme("dark");
    await expect(scale.panel, "panel-dark.png pictures the same region on the other paper (R-UI-001)").toHaveScreenshot(["j-020-scale", "panel-dark.png"], {
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });
    await scale.setTheme("light");

    /* --- j-020-scale/observation: two cited picks, an entered distance, one observation --- */
    const records = await scale.sheetRecords(staged, layers);
    const segment = SScalePage.calibratable(records, { type: LINE, clearance: CLEARANCE });

    // The picks are taken at a stated camera: the address carries one (R-UI-031), and at this scale a
    // snap's reach is about a drawing unit — so each pick can only have met the end it stands on.
    const centre: [number, number] = [(segment.from[0] + segment.to[0]) / 2, (segment.from[1] + segment.to[1]) / 2];
    await page.goto(S_VIEWER.at(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, `${centre[0]},${centre[1]},${PICK_SCALE}`), { waitUntil: "commit" });
    await expect(viewer.status, "the sheet paints again at the camera the address states").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000, message: "every layer arrives again before the picks are taken" })
      .toBe(true);
    await scale.open();

    await snap.pickAt(await viewer.screenPointOf(segment.from));
    await snap.pickAt(await viewer.screenPointOf(segment.to));
    await expect(snap.statusDistance, "two picks stand on the sheet, taken on drawn entities (I-158)").toHaveAttribute("data-picks", "2");

    const taken = await Promise.all(
      (await everyRow(snap.picks, "the calibration marks on the overlay")).map(async (mark) => [Number(await scale.hook(mark, "data-key-x")), Number(await scale.hook(mark, "data-key-y"))] as [number, number]),
    );
    expect(taken.length, "both marks stand on the overlay").toBe(2);
    const first = taken[0] as [number, number];
    const second = taken[1] as [number, number];
    const alongX = first[1] === second[1];
    const span = alongX ? Math.abs(second[0] - first[0]) : Math.abs(second[1] - first[1]);
    expect(span, "the two picks stand apart along one axis, which is the axis they observe (L-MEA-05)").toBeGreaterThan(0);

    // The distance a person enters, derived so that what they measured agrees with what the file's
    // own header says: the metres that span measures under the file's own factor, stated back in the
    // unit the reader picks. Nothing is transcribed — both figures come off the screen and the law.
    const headerFactor = metresPer(HEADER_UNIT) as string;
    const entered = ((Number(headerFactor) * span) / Number(metresPer(HEADER_UNIT) as string)).toFixed(3);
    await scale.distance.fill(entered);
    await scale.unit.selectOption(HEADER_UNIT);
    await scale.observe.click();

    await expect(scale.observations, "pressing Observe appends exactly one observation").toHaveCount(1);
    const observation = scale.observations.first();
    await expect(observation, "which speaks for the axis the two picks stand on").toHaveAttribute("data-axis", alongX ? "x" : "y");
    expect(Number(await scale.hook(observation, "data-drawn")), "and spans the lattice distance between the two key points").toBe(span);
    expect(await scale.hook(observation, "data-factor"), "carrying its factor as a 12-place decimal (L-MEA-05)").toMatch(/^[0-9]+\.[0-9]{12}$/);
    await expect(observation, "and it is verified: the drawing's own units agree with what was measured").toHaveAttribute("data-verified", "verified");
    await expect(scale.checkVerification, "the panel names the tolerance that judgement was made at").toBeVisible();
    await expect(snap.statusDistance, "a successful observation spends the marks it was taken from (I-158)").toHaveAttribute("data-picks", "0");
    await checkpoint(page, testInfo, "j-020-scale/observation");

    /* --- j-020-scale/affirm-open: the act, previewed in the one dialog --- */
    const calibrated = await scale.hook(observation, "data-view-key");
    expect(keys, "the observation was taken inside one of the sheet's own views").toContain(calibrated);

    await scale.member(calibrated).click();
    await scale.affirm(FILE_UNITS).click();
    await expect(scale.dialog, "the act opens the one ConsequenceDialog (R-UI-021)").toBeVisible();
    await expect(scale.dialog, "named for what it would do").toHaveAttribute("data-act-type", AFFIRM_SCALE);
    await expect(scale.subjectRows, "with one subject row per member the reader checked — a scale group is the subject set of one act (L-MEA-05)").toHaveCount(1);
    await expect(scale.subjectRows.first(), "and that subject is the view that was checked").toHaveAttribute("data-subject", calibrated);
    await expect(scale.subjectRows.first(), "which stands under no calibration before the act").toContainText(copy("consequence_dialog_none"));

    // No quantity line and no signature exists on this project yet, so the two effect slots stand at
    // nothing — shown, never omitted (R-UI-020).
    await expect(scale.effectLines, "the lines that would re-derive are previewed").toBeVisible();
    await expect(scale.effectLines).toContainText(copy("consequence_dialog_none"));
    await expect(scale.effectSignatures, "and the signatures that would void").toBeVisible();
    await expect(scale.effectSignatures).toContainText(copy("consequence_dialog_none"));

    const digest = await steadyText(scale.digestLine, "the Consequence digest line");
    expect(digest.length, "the dialog shows the digest of what it computed").toBeGreaterThan(0);
    await expect(scale.confirm, "and confirm is the act button, carrying that digest (R-UI-021)").toHaveAttribute("data-digest", digest);
    await checkpoint(page, testInfo, "j-020-scale/affirm-open");

    /* --- j-020-scale/affirmed: the act committed, and what the sheet now says --- */
    await scale.confirm.click();
    await expect(scale.dialog, "a committed act closes the dialog it was confirmed in").toBeHidden();

    const row = scale.row(calibrated);
    await expect(row, "the panel re-reads, and the affirmed view is the visible answer").toHaveAttribute("data-state", "affirmed");
    await expect(row, "standing at the rank the act named").toHaveAttribute("data-rank", FILE_UNITS);
    const calibrationKey = await scale.hook(row, "data-calibration-key");
    expect(calibrationKey.length, "under a calibration of record, named by its content address").toBeGreaterThan(0);
    await expect(row, "which renders whole (I-159)").toContainText(calibrationKey);
    await expect(row, "beside the factor pair it is named over").toContainText(await scale.hook(row, "data-factor-x"));

    const absentAfter = await scale.absentRows();
    expect(absentAfter.length, "exactly the one view the act named has left the absence it declared (membership is positive, L-MEA-05)").toBe(absentBefore.length - 1);
    expect(absentAfter, "and the view that was affirmed is no longer among them").not.toContain(calibrated);
    expect(Number(await scale.hook(partition.overlayCanvas, "data-scale-hatched")), "the overlay's hatch drops by exactly the views the act named (I-160)").toBe(
      absentAfter.length,
    );
    for (const key of absentAfter) {
      await expect(scale.row(key), `${key} keeps declaring the absence it stands at — a view no act names measures nothing (R-TO-021)`).not.toHaveAttribute("data-state", "affirmed");
    }
    await checkpoint(page, testInfo, "j-020-scale/affirmed");

    /* --- j-020-scale/sheet-card: what S-Drawings says about the sheet now --- */
    const sheets = new SDrawingsPage(page);
    await sheets.open(staged.tenantId, staged.projectId);
    const card = sheets.cards.filter({
      has: page.locator(`[data-testid="sheet-card-open"][href="${S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName)}"]`),
    });
    await expect(card, "exactly one card of the index stands for the staged sheet").toHaveCount(1);
    const line = card.getByTestId("sheet-card-scale");
    await expect(line, "a sheet still holding views with no scale of record is unplaceable, not affirmed (R-TO-021)").toHaveAttribute("data-scale", "unplaceable");
    await expect(line, "and it publishes how many").toHaveAttribute("data-unplaceable", String(absentAfter.length));
    await expect(line, "reading as the count of views with no scale of record out of the total").toHaveText(
      fill(drawingsCopy("drawings_scale_unplaceable_count"), { count: String(absentAfter.length), total: String(keys.length) }),
    );
    await checkpoint(page, testInfo, "j-020-scale/sheet-card");
  });
});
