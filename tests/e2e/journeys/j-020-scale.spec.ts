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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { REFUSALS } from "../../../src/core/errors";
import { metresPer } from "../../../src/core/scale";
import { strings } from "../../../src/ui/strings";
import { SCALE_COPY } from "../../../src/modules/takeoff/scale-ui/copy";
import { drawings } from "../../../src/app/(app)/t/[tenant]/p/[project]/drawings/strings";
import { checkpoint } from "../support/checkpoint";
import { laneTheme } from "../support/lane-theme";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SDrawingsPage, S_DRAWINGS } from "../pages/s-drawings.page";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage } from "../pages/shell.page";
import { newestMail } from "../support/outbox";
import { startJourneyWorker } from "../support/worker";
import { S_SCALE, SScalePage, type Span } from "../pages/s-scale.page";
import { SViewerPartitionPage } from "../pages/s-viewer-partition.page";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";
import { SViewerSnapPage } from "../viewer/s-viewer-snap.page";
import { HEADER_UNIT, stageScaleSheet } from "../viewer/viewer-scale-stage";
import { everyAttribute, everyRow, heldAttribute, steadyCount, steadyText } from "../support/retrying-read";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { afterSettled } from "../support/settled";

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

/** The two ranks the legs below affirm at: a person's own calibration, and the dimensions' ratio. */
const QS_TWO_POINT = "QS_TWO_POINT";
const DIMENSION_RATIO = "DIMENSION_RATIO";

/**
 * The unitless leg (I-419): how far each end of a calibrated span stands clear of every other
 * drawn point, how near one another the four spans stand so one camera frames them, and the scale
 * the reader states they measured at — one hundred millimetres to the drawing unit, entered for
 * every span alike, so what agrees is what was measured and not a number chosen to agree.
 */
const SPAN_REACH = 60;
const ENTERED_MM_PER_UNIT = 100;

/** F-RCC6-BNBC's DWG — the upload walk-0 made in front of the product — and its manifest (B-19). */
const BNBC_DWG = join(process.cwd(), "fixtures", "rcc6-bnbc", "rcc6-bnbc.dwg");
const BNBC_MANIFEST = join(process.cwd(), "fixtures", "rcc6-bnbc", "manifest.json");

/** How long the DWG's two passes, its rasters and the partition the ingest chains may take. */
const FRESH_READING_MS = 90_000;

/** The column layout plan's sheet and the caption of its one view, as the manifest declares them. */
function columnLayoutPlan(): { layoutName: string; caption: string } {
  const manifest = JSON.parse(readFileSync(BNBC_MANIFEST, "utf8")) as { sheets?: { number?: string; layout_name?: string; views?: { title?: string }[] }[] };
  const sheet = (manifest.sheets ?? []).find((held) => held.number === "S-10");
  expect(sheet?.layout_name, "the manifest declares S-10's layout").toBeTruthy();
  expect(sheet?.views?.[0]?.title, "and the one view it draws").toBeTruthy();
  return { layoutName: sheet?.layout_name as string, caption: sheet?.views?.[0]?.title as string };
}

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
    // ACT FIRST: Direction §3.1 leaves the shell's one right slot absent — width 0 — until something
    // is selected, and this leg is about the panel a reader OPENS with nothing selected, which is
    // the very case `V≡` exists for (I-152: the scale tab is a door onto every view's scale, not a
    // fact about a selection). The pin is the one lawful way to hold it open at rest, and it is
    // pressed here rather than the panel being waited for in a state the screen is right not to be in.
    await viewer.pinInspector();
    await expect(scale.tabs, "the right inspector is a two-tab panel now").toBeVisible();
    await expect(scale.selectionTab, "and it opens on Selection at every mount").toHaveAttribute("aria-selected", "true");
    expect(
      // Both selectors are resolved in node and handed in: the registry does not exist in the page.
      await afterSettled(page, () => page.evaluate(
        ([asideSelector, stripSelector]) => {
          const aside = document.querySelector(String(asideSelector));
          const strip = document.querySelector(String(stripSelector));
          return aside !== null && strip !== null && aside.contains(strip);
        },
        [testIdSelector(TESTIDS.viewer.inspector), testIdSelector(TESTIDS.viewer.inspectorTabs)] as const,
      )),
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
    // The LIGHT ground, asked for BY NAME, in both lanes. The line below read the LANE's ground
    // until 2026-09-12, so in the dark project `panel-light.png` was a picture of the dark panel —
    // byte-identical to `panel-dark.png` beside it (mean luma 26.9 both, measured on the committed
    // files) and the two-theme comparison in that lane was vacuous. The theme does reach this panel;
    // what did not reach it was the lane (`support/lane-theme.ts`: a capture named `-light` or
    // `-dark` states its own ground and is taken on it in every lane).
    await scale.setTheme("light");
    await expect.soft(scale.panel, "panel-light.png pictures the region a reader reads a sheet's scale in").toHaveScreenshot(["j-020-scale", "panel-light.png"], {
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });
    await scale.setTheme("dark");
    await expect.soft(scale.panel, "panel-dark.png pictures the same region on the other paper (R-UI-001)").toHaveScreenshot(["j-020-scale", "panel-dark.png"], {
      animations: "disabled",
      maxDiffPixelRatio: 0.002,
    });
    // …and the page is given back to the LANE, not to a literal: every capture after this one is
    // named without a theme, so it belongs to the project walking it.
    await scale.setTheme(laneTheme(testInfo));

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
    // A fresh navigation is a fresh mount, and the pin starts released at every one (§3.1: the slot
    // is absent until something is selected). So it is pressed again before the panel is asked for —
    // the same act a reader repeats, not a state the screen is expected to have remembered.
    await viewer.pinInspector();
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
    await scale.select(S_SCALE.unit, HEADER_UNIT);
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
    // The row says the scale in words, as a QS reads one (I-566): no scale before, the rank and
    // what one drawing unit is after — the calibration keys are identifiers and live behind Details.
    await expect(scale.subjectRows.first(), "which stands under no calibration before the act").toHaveAttribute("data-scale-before", "");
    await expect(scale.subjectRows.first(), "and says so in words").toContainText(copy("consequence_dialog_scale_none"));
    await expect(scale.subjectRows.first(), "and after it, the rank the act affirms at").toHaveAttribute("data-scale-after", FILE_UNITS);
    await expect(scale.subjectRows.first(), "named by its registered word").toContainText(copy("consequence_dialog_scale_rank_FILE_UNITS"));
    await expect(scale.subjectRows.first(), "never by the calibration key, a 64-hex identifier").not.toContainText(/[0-9a-f]{64}/);

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
      has: page.locator(`${testIdSelector(TESTIDS.sheet.cardOpen)}[href="${S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName)}"]`),
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

  test("J-020: a sheet the drawing offers no scale for is scaled by two agreeing observations per axis, and a shut door says why", async ({ page }, testInfo) => {
    const staged = await stageScaleSheet(page, { label: "scale-unitless", header: "unitless" });
    const viewer = new SViewerPage(page);
    const scale = new SScalePage(page);
    const snap = new SViewerSnapPage(page);

    await page.goto(S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName), { waitUntil: "commit" });
    await expect(viewer.status, "the staged sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000, message: "every layer of the sheet arrives before it is read" })
      .toBe(true);
    const layers = await viewer.statusNumber("data-total-layers");

    /* --- j-020-scale/unitless-open: no rank of the machine's reads a factor off this header --- */
    await viewer.pinInspector();
    await scale.open();
    const keys = await scale.viewKeys();
    expect(keys.length, "one row per view of the sheet").toBe(staged.views.length);
    for (const state of await everyAttribute(scale.rows, "data-state", "the scale panel's view states")) {
      expect(state, "a header that names no unit carries no factor for any machine rank (L-MEA-05's strict unit lane)").toBe("SCALE_UNIT_UNMAPPED");
    }
    await expect(scale.proposals, "and the drawing offers no scale for any view — the sheet walk-0 could not scale").toHaveCount(0);
    await expect(scale.row(keys[0] as string), "a view with nothing to offer says so rather than falling silent (R-UI-020)").toContainText(scaleCopy("viewer_scale_no_proposals"));

    const door = scale.affirm(QS_TWO_POINT);
    await expect(door, "the two-point door stands, shut until its evidence does (I-169)").toBeDisabled();
    await expect(scale.why("members"), "and says, in words, what it wants first (I-420)").toHaveText(scaleCopy("viewer_scale_why_members"));
    await checkpoint(page, testInfo, "j-020-scale/unitless-open");

    /* --- two spans along each axis, read off the served sheet, all in one camera --- */
    const set = SScalePage.calibrationSet(await scale.sheetRecords(staged, layers), { type: LINE, clearance: CLEARANCE, reach: SPAN_REACH });
    await page.goto(S_VIEWER.at(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, `${set.centre[0]},${set.centre[1]},${PICK_SCALE}`), { waitUntil: "commit" });
    await expect(viewer.status, "the sheet paints again at the camera the address states").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000, message: "every layer arrives again before the picks are taken" })
      .toBe(true);
    await viewer.pinInspector();
    await scale.open();

    const observeAcross = async (span: Span, taken: number): Promise<void> => {
      await snap.pickAt(await viewer.screenPointOf(span.from));
      await snap.pickAt(await viewer.screenPointOf(span.to));
      await expect(snap.statusDistance, "two picks stand on drawn ends (I-158)").toHaveAttribute("data-picks", "2");
      // Stated back at the lattice's own precision, so a span drawn at 45.7 units is entered as
      // 4570 and never as the 4570.000000000001 a float would spell it.
      await scale.distance.fill(String(Number((span.length * ENTERED_MM_PER_UNIT).toFixed(3))));
      await scale.select(S_SCALE.unit, "mm");
      await scale.observe.click();
      await expect(scale.observations, "Observe appends one observation").toHaveCount(taken);
      await expect(snap.statusDistance, "and spends the marks it was taken from (I-158)").toHaveAttribute("data-picks", "0");
    };

    await observeAcross(set.x[0], 1);
    const first = scale.observations.first();
    await expect(first, "one bay along x, and nothing on this sheet to check it against").toHaveAttribute("data-verified", "unverified");
    const plan = await scale.hook(first, "data-view-key");
    expect(keys, "the picks stood inside one of the sheet's views").toContain(plan);
    await scale.member(plan).click();
    await expect(scale.why(`x-single`), "one x reading: the door asks for a second one across other points (I-420)").toHaveText(fill(scaleCopy("viewer_scale_why_axis_single"), { axis: scaleCopy("scale_axis_x") }));
    await expect(scale.why(`y-absent`), "and for a y reading at all").toHaveText(fill(scaleCopy("viewer_scale_why_axis_absent"), { axis: scaleCopy("scale_axis_y") }));

    await observeAcross(set.x[1], 2);
    for (const row of await everyRow(scale.observations, "the observations taken")) {
      await expect(row, "two x bays across different points verify each other, with nothing machine-made under them (I-419)").toHaveAttribute("data-verified", "verified");
    }
    await observeAcross(set.y[0], 3);
    await observeAcross(set.y[1], 4);
    const factors = await everyAttribute(scale.observations, "data-factor", "the observations' factors");
    expect(new Set(factors).size, "every span entered at one scale reads one factor").toBe(1);
    expect(await everyAttribute(scale.observations, "data-view-key", "the observations' views"), "all four stood in the one view chosen").toEqual([plan, plan, plan, plan]);
    for (const row of await everyRow(scale.observations, "the observations taken")) {
      await expect(row, "and every one is vouched for by its axis's other span").toHaveAttribute("data-verified", "verified");
    }
    expect(await scale.whyReasons(), "an open door says nothing it no longer wants").toEqual([]);
    await expect(door, "both axes verified: the door the walk found shut for good opens").toBeEnabled();
    await checkpoint(page, testInfo, "j-020-scale/two-point-ready");

    /* --- j-020-scale/two-point-affirmed: the act, at the person's own rank --- */
    await door.click();
    await expect(scale.dialog, "the act opens the one ConsequenceDialog (R-UI-021)").toHaveAttribute("data-act-type", AFFIRM_SCALE);
    await expect(scale.subjectRows, "over the one view chosen").toHaveCount(1);
    await expect(scale.subjectRows.first()).toHaveAttribute("data-subject", plan);
    await scale.confirm.click();
    await expect(scale.dialog, "a committed act closes the dialog it was confirmed in").toBeHidden();

    const row = scale.row(plan);
    await expect(row, "the view the drawing offered nothing for now stands under a scale of record").toHaveAttribute("data-state", "affirmed");
    await expect(row, "at the two-point rank").toHaveAttribute("data-rank", QS_TWO_POINT);
    await expect(row, "at the factor the first observation read, along x (L-MEA-05: never an average)").toHaveAttribute("data-factor-x", factors[0] as string);
    await expect(row, "and along y").toHaveAttribute("data-factor-y", factors[0] as string);
    await checkpoint(page, testInfo, "j-020-scale/two-point-affirmed");
  });

  test("J-020: a fresh upload of F-RCC6-BNBC's DWG proposes a dimension-ratio scale on S-10's column layout plan, affirmed in one act", async ({ page }, testInfo) => {
    const worker = await startJourneyWorker();
    try {
      const { tenantId, projectId } = await enrolWithProject(page, "fresh");
      const sheet = columnLayoutPlan();
      const drawings = new SDrawingsPage(page);
      const viewer = new SViewerPage(page);
      const scale = new SScalePage(page);

      /* --- the drawing walk-0 uploaded, through the screen's own Dropzone and the shipped worker --- */
      await drawings.open(tenantId, projectId);
      await drawings.dropFile(BNBC_DWG);
      await expect(drawings.dropzoneItems.first(), "the DWG is stored by the upload seam").toHaveAttribute("data-state", "stored", { timeout: FRESH_READING_MS });
      await expect(drawings.timeline, "the jobs the upload asked for finish where the work was started (X-1)").toHaveAttribute("data-state", "done", { timeout: FRESH_READING_MS });
      // The partition the ingest chains lands on the job runner's clock, not the upload's: the card's
      // views line publishes a count once it has (s-drawings I-284), and the sheet is opened then.
      await expect
        .poll(async () => {
          await drawings.open(tenantId, projectId);
          return (await heldAttribute(drawings.cell(drawings.cardForLayout(sheet.layoutName), S_DRAWINGS.views), "data-views")) ?? "";
        }, { timeout: FRESH_READING_MS, message: `the partition of ${sheet.layoutName} stands` })
        .not.toBe("");

      await drawings.cell(drawings.cardForLayout(sheet.layoutName), S_DRAWINGS.open).click();
      await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
      await viewer.pinInspector();
      await scale.open();

      /* --- j-020-scale/fresh-proposal: the dimensions reached the artifact, so rank 3 reads them --- */
      const row = scale.rows.filter({ hasText: sheet.caption });
      await expect(row, `one view of the drawing is captioned ${sheet.caption}`).toHaveCount(1);
      const proposal = row.locator(`[data-testid="${S_SCALE.proposal}"][data-rank="${DIMENSION_RATIO}"]`);
      await expect(proposal, "a fresh DWG upload proposes the dimensions' own ratio on the column layout plan again (I-418)").toHaveCount(1);
      await expect(proposal, "one the view can be placed at").toHaveAttribute("data-placeable", "true");
      expect(await scale.hook(proposal, "data-factor-x"), "its factor a 12-place decimal, unrounded (I-159)").toMatch(/^[0-9]+\.[0-9]{12}$/);
      await checkpoint(page, testInfo, "j-020-scale/fresh-proposal");

      /* --- the proposal affirmed: choose the view, press its door, confirm --- */
      const viewKey = await scale.hook(row, "data-view-key");
      await scale.member(viewKey).click();
      await scale.affirm(DIMENSION_RATIO).click();
      await expect(scale.dialog, "the act opens the one ConsequenceDialog (R-UI-021)").toHaveAttribute("data-act-type", AFFIRM_SCALE);
      await scale.confirm.click();
      await expect(scale.dialog, "a committed act closes the dialog it was confirmed in").toBeHidden();
      await expect(scale.row(viewKey), "the column layout plan stands under a scale of record").toHaveAttribute("data-state", "affirmed");
      await expect(scale.row(viewKey), "at the rank the drawing's dimensions proposed").toHaveAttribute("data-rank", DIMENSION_RATIO);
    } finally {
      await worker.stop();
    }
  });
});

/**
 * A person of a fresh workspace, signed in, with a project of theirs made through the shipped
 * screen — the prologue J-010 walks, so the drawing this leg uploads lands in no other spec's
 * workspace.
 */
async function enrolWithProject(page: Page, label: string): Promise<{ tenantId: string; projectId: string }> {
  const auth = new SAuthPage(page);
  const shell = new ShellPage(page);
  const home = new SHomePage(page);
  const mark = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const email = `j020-${label}-${mark}@cubit.test`;
  const password = `scale-journey-${mark}`;
  const project = `Sattva Scale ${mark}`;

  await auth.open(S_AUTH.signUp);
  await auth.signUpWith(email, password, `Scale ${mark}`);
  await auth.expectNotice();
  const verifyMail = await newestMail(email, "verify-email");
  await auth.openWithToken(S_AUTH.verify, verifyMail.token);
  await auth.expectNotice();
  await auth.open(S_AUTH.signIn);
  await auth.signInWith(email, password);

  await shell.workspaceDoor.click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}$/);
  const tenantId = new URL(page.url()).pathname.split("/")[2] ?? "";
  expect(tenantId, "the workspace door leads to the workspace this person holds").not.toBe("");

  await home.createWith({ name: project, code: `SSC-${mark.slice(0, 4)}`, client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "7" });
  const card = home.cardNamed(project);
  await expect(card, "the created project stands on S-Home").toBeVisible();
  const projectId = (await heldAttribute(card, "data-project")) ?? "";
  expect(projectId, "the card names the project it is for").not.toBe("");
  return { tenantId, projectId };
}
