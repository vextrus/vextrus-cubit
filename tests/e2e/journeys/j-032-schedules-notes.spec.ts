/**
 * J-032's bar-schedule leg — a general note read off the drawing re-versions the applied rules, the
 * campaign is measured, and the takeoff lane's SIXTH tab shows every bar of that campaign by member
 * and mark, with every lap standing as its own row at fifty diameters (J-032, R-TO-054, AM-03(a)(h),
 * L-BD-02, L-FRM-05, R-UI-050, R-UI-080, R-UI-083, docs/design/s-bbs.md).
 *
 * The walk is a customer's: a sheet is opened, five readings are transcribed, one of them edited; the
 * campaign is measured; a tab is clicked and a schedule is read. Nothing is staged mid-walk, and
 * every figure the screen shows is compared against THE DOOR'S OWN ANSWER for the campaign that was
 * just measured (`measureStaged` → `bbsOf`) — never against a number typed here (B-19, I-bbs-2).
 *
 * The three design checkpoints of S-BBS are taken here and nowhere else; the pictures themselves are
 * the gate's to re-take (v16.2 §1). J-032's first two titles live in `tests/e2e/schedules.spec.ts`
 * (inc-303's, read-only): `pnpm e2e --journey J-032` runs both files.
 *
 * Nothing here measures time (AM-10 §3).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { formatUserFigure } from "../../../src/core/format";
import { strings } from "../../../src/ui/strings";
import { TESTIDS } from "../../../src/ui/testids";
import { SBbsPage } from "../pages/s-bbs.page";
import { SSchedulesPage } from "../pages/s-schedules.page";
import { STakeoffPage } from "../pages/s-takeoff.page";
import { stageBareProject } from "../takeoff/schedules-stage";
import { checkpoint } from "../support/checkpoint";
import { emulateTheme, restoreLaneTheme } from "../support/lane-theme";
import { everyAttribute, heldAttribute, steadyText } from "../support/retrying-read";
import { signInAsSeededTenant } from "../support/seeded-session";
import { afterSettled, settled } from "../support/settled";

/** The width the frame paints the lane at (R-UI-030). */
test.use({ viewport: { width: 1440, height: 900 } });

/** The two note kinds this leg reads by name, and the verdicts the seam gives them (test contract). */
const LAP = "LAP";
const HOOK_MIN = "HOOK_MIN";
const ACCEPTED = "ACCEPTED";
const EDITED = "EDITED";
const AGREED = "AGREED";

/** What the walk reads the minimum hook as, against the 75 mm the sheet states (inc-303's leg). */
const EDITED_HOOK_MIN = "100";

/** The second viewport §7 C2 holds every screen at, beside the lane's own (R-UI-030). */
const NARROW = { width: 1280, height: 800 } as const;

/** What the work surface owes the screen it is the point of (R-UI-080, Decision §1). */
const WORK_SURFACE_SHARE = 0.55;
const FIRST_ROW_WITHIN_PX = 240;

/** One row of the campaign's bill of bars, as the one door answers it (interfaces: `BbsDocument`). */
type DoorRow = {
  barKey: string;
  objectKey: string;
  barMark: string;
  role: string;
  diameterMm: number;
  shape: string;
  cuttingRawMm: string;
  cuttingRoundedMm: string;
  cuttingIsAdditiveMm: string;
  bars: string;
  lapMm: string;
  lapsPerBar: number;
  kgLap: string;
  kgNet: string;
  kg: string;
};

/** What the stage hands this walk (test contract: `stageBbs`, `measureStaged`). */
type StagedBbs = {
  tenantId: string;
  projectId: string;
  drawingId: string;
  notesLayout: string;
  setRevisionId: string;
  noteCanonicals: Record<string, string>;
};

/** The stage of this increment, as its own file publishes it (tests/e2e/takeoff/bbs-stage.ts). */
type BbsStage = {
  stageBbs(page: Page, options?: { label?: string }): Promise<StagedBbs>;
  measureStaged(staged: StagedBbs): Promise<{ document: unknown; expectedState: string }>;
};

/**
 * The stage, loaded by PATH rather than imported at the top of the file: a stage that has not landed
 * yet is this journey's own failure, named, instead of a module resolution error that takes every
 * other journey of the lane down with it at collection.
 */
async function bbsStage(): Promise<BbsStage> {
  const relative = "tests/e2e/takeoff/bbs-stage.ts";
  const absolute = join(process.cwd(), relative);
  if (!existsSync(absolute)) throw new Error(`${relative} is missing from the checkout — the bar schedule's stage (stageBbs, measureStaged — test contract) does not exist yet`);
  const specifier: string = absolute;
  return (await import(specifier)) as BbsStage;
}

/** The document beside them: the totals by diameter and what the cutting stock came to. */
type DoorDocument = {
  rows: readonly DoorRow[];
  perDiameterKg: Readonly<Record<string, string>>;
  cuttingStock: Readonly<Record<string, { stockBars: number; pieces: number; offcutMm: string }>>;
  stockMm: string;
  roundingMm: number;
  grandTotalKg: string;
};

/**
 * What the sixth tab and the crumb say, read from the string seam this screen publishes its copy in
 * — never a word typed here (AM-09 §2). Until that file lands the lookup fails by name, which is the
 * red this increment is owed.
 */
function copyOf(key: string): string {
  const said = (strings as unknown as Record<string, string | undefined>)[key];
  if (typeof said !== "string" || said.length === 0) throw new Error(`src/ui/strings publishes no ${key} — this screen's copy has not landed yet (AM-09 §2)`);
  return said.replace(/\s+/gu, " ").trim();
}

function navLabel(): string {
  return copyOf("takeoff_nav_bbs");
}

/** The box an element occupies, once the screen has stopped moving. */
async function boxOf(locator: Locator, what: string): Promise<{ top: number; height: number }> {
  const box = await afterSettled(locator, () => locator.boundingBox());
  expect(box, `${what} is on the screen and has a box`).not.toBeNull();
  return { top: (box as { y: number; height: number }).y, height: (box as { y: number; height: number }).height };
}

/** What the primary surface owes at a viewport: its share of main, and how soon it starts. */
async function assertWorkSurface(bbs: SBbsPage, where: string): Promise<void> {
  const main = await boxOf(bbs.main, "the shell's main region");
  const grid = await boxOf(bbs.grid, "the schedule's grid");
  expect(
    grid.height / main.height,
    `${where}: the grid is the point of this screen, so it holds at least ${WORK_SURFACE_SHARE * 100} % of main (R-UI-080) — it holds ${Math.round((grid.height / main.height) * 100)} %`,
  ).toBeGreaterThanOrEqual(WORK_SURFACE_SHARE);
  expect(
    grid.top - main.top,
    `${where}: the schedule starts within ${FIRST_ROW_WITHIN_PX} px of the top of main — a reader meets bars, not furniture (Decision §1)`,
  ).toBeLessThanOrEqual(FIRST_ROW_WITHIN_PX);
}

test.describe("J-032 — the bar schedule the transcribed notes produce", () => {
  test("J-032 · AC-2 · AC-3 · AC-4 · AC-5: the 50d note re-versions the lap, and the sixth tab shows every bar of the measured campaign", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const { stageBbs, measureStaged } = await bbsStage();
    const staged = await stageBbs(page, { label: "j032-bbs" });

    /* --- the first leg: the sheet's own notes, transcribed, one of them edited (AM-03(h)) --- */
    const schedules = new SSchedulesPage(page);
    await schedules.open(staged.tenantId, staged.projectId);
    await settled(page);
    await schedules.sheetRow(staged.drawingId, staged.notesLayout).click();
    await settled(page);

    await schedules.transcribeWith(HOOK_MIN, EDITED_HOOK_MIN);
    await expect(schedules.dialog, "a door previews rather than committing (R-UI-021)").toBeVisible();
    await schedules.confirmAct();
    await settled(page);

    await expect(schedules.readingJudged(HOOK_MIN, EDITED), "the minimum hook the walk read at another figure is recorded as EDITED").toHaveCount(1);
    await expect(schedules.readingJudged(LAP, ACCEPTED), "and the lap, taken as the sheet proposes it, as ACCEPTED").toHaveCount(1);
    await expect(schedules.standing(LAP), "nobody contests this lap, so the drawing's general note is what the campaign applies (L-BD-02)").toHaveAttribute("data-standing", AGREED);

    // The multiple the note states is the GROUND'S, read off the sheet the stage planted — never a
    // number typed in this file (B-19). `50d` is what F-RCC6-BNBC's general note says.
    const lapMultiple = Number(staged.noteCanonicals[LAP]);
    expect(lapMultiple, "the sheet's general note states the lap as a multiple of the diameter").toBeGreaterThan(0);

    /* --- the campaign is measured by the shipped job, through the shipped rails --- */
    const measured = await measureStaged(staged);
    const document_ = measured.document as unknown as DoorDocument;
    const doorRows = document_.rows;
    expect(doorRows.length, "the measured campaign wrote bar rows through the one door (inc-309)").toBeGreaterThan(0);

    /* --- the sixth tab: clicked, never typed --- */
    const takeoff = new STakeoffPage(page);
    const bbs = new SBbsPage(page);
    await takeoff.open(staged.tenantId, staged.projectId);
    await settled(page);
    await expect(bbs.navBbs, "the takeoff lane carries a sixth tab for the bar schedule").toBeVisible();
    await expect(bbs.navBbs, "and it says what the crumb says").toHaveText(navLabel());
    await bbs.openThroughNav();
    expect(new URL(page.url()).pathname, "the tab lands at the schedule's one address").toBe(`/t/${staged.tenantId}/p/${staged.projectId}/takeoff/bbs`);
    await expect(bbs.navBbs, "and the tab a reader is standing on says so (R-UI-002)").toHaveAttribute("aria-current", "page");
    await settled(page);

    // WHERE the tab stands is the rule, not how many tabs there are: the bar schedule follows the
    // draft BOQ, and a seventh tab a later increment adds moves neither of them (B-19).
    const tabs = await everyAttribute(bbs.takeoffNav.getByRole("link"), "data-testid", "the takeoff lane's tabs", { min: 2 });
    const standingAt = tabs.indexOf((await heldAttribute(bbs.navBbs, "data-testid")) as string);
    expect(standingAt, "the bar schedule is a tab of the lane's own track").toBeGreaterThan(-1);
    expect(standingAt, `the bar schedule stands immediately after the draft BOQ — the lane reads ${tabs.join(" · ")}`).toBe(tabs.indexOf(TESTIDS.takeoff.navBoq) + 1);

    /* --- what the screen says about itself (AC-2) --- */
    expect(await bbs.state(), "a campaign whose rebar lines are wholly or partly declared is read and rendered — the ground decides which").toBe(measured.expectedState);
    expect(["partial", "ready"], `a measured campaign is READ: its state is what its own lines declare, wholly or partly (the stage reckoned ${measured.expectedState} from the coverage they stored)`).toContain(measured.expectedState);

    // A reading nobody can see is not a disclosure: a campaign the door calls partly declared SAYS
    // so, in the Decision's own sentence, and one it calls ready says nothing of the sort (Decision
    // §2, L-QTY-02). The derivation itself is graded over a real campaign in `view.db.test.ts`.
    const answerSaid = (await steadyText(bbs.answer, "the schedule's answer region")).replace(/\s+/gu, " ");
    expect(answerSaid.includes(copyOf("bbs_partial")), `the partial notice stands exactly where the state does — the screen reads ${measured.expectedState}`).toBe(measured.expectedState === "partial");

    expect(await heldAttribute(bbs.screen, "data-rows"), "the screen states how many bar rows the door answered with").toBe(String(doorRows.length));
    expect(await heldAttribute(bbs.screen, "data-campaign"), "and which campaign it read").toBeTruthy();
    expect(await steadyText(bbs.crumbPage, "the page crumb"), "the crumb names the screen a reader asked for").toBe(navLabel());

    await expect(bbs.revision, "the pinned revision stands in the tabs aside").toBeVisible();
    expect(await heldAttribute(bbs.revision, "data-value"), "carrying the campaign's WHOLE pinned revision, so a reader who copies it copies all of it").toBe(staged.setRevisionId);
    await expect(bbs.revision, "through the shipped IdChip — an id is never a bare text node (R-UI-003)").toHaveClass(/cx-id-chip/u);
    expect(await heldAttribute(bbs.stock, "data-stock-mm"), "the stock chip says what the schedule was cut from (AM-01)").toBe(document_.stockMm);
    expect(await heldAttribute(bbs.stock, "data-rounding-mm"), "and the one surface it rounded to").toBe(String(document_.roundingMm));

    /* --- the grid: one group per member, one row per bar, every figure the door's own (AC-4) --- */
    const rendered = Number(await bbs.rowsRendered());
    expect(rendered, "the grid publishes how many rows it painted, so a read of a virtualised table is an assertion (R-UI-050)").toBeGreaterThan(0);

    const barKeys = await everyAttribute(bbs.rows, "data-bar-key", "the schedule's bar rows", { min: 1 });
    expect([...barKeys].sort(), "every bar the door answered stands as its own NET row, and no row stands for a bar it did not").toEqual([...doorRows.map((row) => row.barKey)].sort());

    const byKey = new Map(doorRows.map((row) => [row.barKey, row]));
    const columns: [string, (row: DoorRow) => string][] = [
      ["data-bar-mark", (row) => row.barMark],
      ["data-role", (row) => row.role],
      ["data-diameter", (row) => String(row.diameterMm)],
      ["data-shape", (row) => row.shape],
      ["data-cutting-raw", (row) => row.cuttingRawMm],
      ["data-cutting-rounded", (row) => row.cuttingRoundedMm],
      ["data-cutting-is", (row) => row.cuttingIsAdditiveMm],
      ["data-bars", (row) => row.bars],
      ["data-kg", (row) => row.kgNet],
      ["data-component", () => "NET"],
    ];
    for (const [attribute, owed] of columns) {
      const read = await everyAttribute(bbs.rows, attribute, `the schedule's ${attribute} column`, { min: 1 });
      const expected = barKeys.map((key) => owed(byKey.get(key) as DoorRow));
      expect(read, `every row's ${attribute} is the door's own figure for that bar, carried verbatim and never re-reckoned (I-bbs-2)`).toEqual(expected);
    }

    /* --- AC-3: the figures a reader READS are the stored figures, grouped by the one formatter --- */
    //
    // The attributes carry the door's decimal verbatim (asserted above); a CELL is where that decimal
    // becomes something a person reads, and the one home for that is `formatUserFigure` (SEAM-FORMAT,
    // I-bbs-2). The rows this is read on are the ones where the two forms DIFFER — a four-figure
    // cutting length — so a screen that printed the stored string, or grouped it in thousands, shows
    // a different line from the one asserted here.
    const groupedRows = doorRows.filter((row) => formatUserFigure(row.cuttingRawMm) !== row.cuttingRawMm).slice(0, 5);
    expect(groupedRows.length, "the staged campaign holds bars whose cutting length is long enough to be grouped — a schedule of three-digit lengths could not show this rule either way").toBeGreaterThan(0);
    for (const row of groupedRows) {
      const said = (await steadyText(bbs.row(row.barKey), `${row.barMark}'s row`)).replace(/\s+/gu, " ");
      expect(said, `${row.barMark}'s cutting length reads ${formatUserFigure(row.cuttingRawMm)} — lakh/crore grouping through @/core/format, over the stored ${row.cuttingRawMm}`).toContain(
        formatUserFigure(row.cuttingRawMm),
      );
      expect(said, `and the raw decimal ${row.cuttingRawMm} is what the ATTRIBUTE carries, never what the cell shows a reader (R-UI-083)`).not.toContain(row.cuttingRawMm);
    }

    const grandTotal = (await heldAttribute(bbs.summary, "data-kg")) as string;
    expect(grandTotal, "the summary region carries the door's own grand total").toBe(document_.grandTotalKg);
    const summarySaid = (await steadyText(bbs.summary, "the cutting-stock summary")).replace(/\s+/gu, " ");
    expect(summarySaid, `the total a reader reads is ${formatUserFigure(grandTotal)} — the stored ${grandTotal} through the one formatter`).toContain(formatUserFigure(grandTotal));
    if (formatUserFigure(grandTotal) !== grandTotal) {
      expect(summarySaid, "and the ungrouped decimal is not what the total cell shows").not.toContain(grandTotal);
    }

    /* --- the lap: its own row, at the multiple the drawing's note states (AM-03(a), L-BD-02) --- */
    const mains = doorRows.filter((row) => row.role === "MAIN");
    expect(mains.length, "the staged campaign holds main bars, which are the bars that lap").toBeGreaterThan(0);
    const lapKeys = await everyAttribute(bbs.laps, "data-bar-key", "the lap rows", { min: 1 });
    const lapComponents = await everyAttribute(bbs.laps, "data-component", "the lap rows' component");
    const lapCounts = await everyAttribute(bbs.laps, "data-laps", "the lap rows' count");
    const lapMasses = await everyAttribute(bbs.laps, "data-kg", "the lap rows' mass");
    const lapLengths = await everyAttribute(bbs.rows, "data-lap-mm", "the bars' lap length");

    expect([...new Set(lapComponents)], "a lap row states what it is: a component beside the net bar, never a percentage of it").toEqual(["LAP"]);
    for (const main of mains) {
      const at = barKeys.indexOf(main.barKey);
      expect(lapLengths[at], `${main.barMark} (${main.diameterMm} mm) laps at ${lapMultiple} × d, as the drawing's general note re-versioned it (L-BD-02)`).toBe(String(lapMultiple * main.diameterMm));
      const lapAt = lapKeys.indexOf(main.barKey);
      expect(lapAt, `${main.barMark}'s lap stands as its own row beside it`).toBeGreaterThan(-1);
      expect(lapCounts[lapAt], `${main.barMark}'s lap row states how many laps the bar carries`).toBe(String(main.lapsPerBar));
      expect(lapMasses[lapAt], `${main.barMark}'s lap row carries the lap's own mass, and the bar's row carries none of it (AM-03(a))`).toBe(main.kgLap);
      expect(Number(main.kgLap), `${main.barMark}'s lap weighs something — a lap billed at nothing is not a lap billed`).toBeGreaterThan(0);
    }

    /* --- one group row per member, and the cutting stock beneath the grid --- */
    const members = await everyAttribute(bbs.members, "data-member", "the member group rows", { min: 1 });
    expect([...members].sort(), "one group row per member the schedule holds bars for, and not one more (I-bbs-2)").toEqual([...new Set(doorRows.map((row) => row.objectKey))].sort());

    const diameters = Object.keys(document_.perDiameterKg);
    expect(diameters.length, "the door totals the schedule's mass by diameter").toBeGreaterThan(0);
    const summaryDiameters = await everyAttribute(bbs.summaryRows, "data-diameter", "the cutting-stock summary", { min: 1 });
    expect([...summaryDiameters].sort(), "one summary line per diameter the door packed, and no other").toEqual([...diameters].sort());
    for (const diameter of summaryDiameters) {
      const line = bbs.summaryRow(diameter);
      const stock = document_.cuttingStock[diameter] as { stockBars: number; pieces: number; offcutMm: string };
      expect(await heldAttribute(line, "data-kg"), `the ${diameter} mm line states the door's own total mass`).toBe(document_.perDiameterKg[diameter]);
      expect(await heldAttribute(line, "data-stock-bars"), `the ${diameter} mm line states the stock bars the packing took (AM-03(e))`).toBe(String(stock.stockBars));
      expect(await heldAttribute(line, "data-pieces"), `and the pieces it cut from them`).toBe(String(stock.pieces));
    }

    /* --- the furniture a compact grid owes (R-UI-012, Decision §1) --- */
    const header = bbs.header();
    await expect(header, "the grid carries the shipped primitive's own header").toBeVisible();
    const position = await afterSettled(page, () => header.evaluate((node) => getComputedStyle(node).position));
    expect(position, "the header is sticky, so the columns stand while four thousand bars scroll under them").toBe("sticky");

    const firstRow = bbs.rows.first();
    const rowStyle = await afterSettled(page, () =>
      firstRow.evaluate((node) => {
        const style = getComputedStyle(node);
        return { height: node.getBoundingClientRect().height, wrap: style.whiteSpace, density: document.documentElement.getAttribute("data-density") ?? document.body.getAttribute("data-density") };
      }),
    );
    expect(Math.round(rowStyle.height), "a row of the compact grid stands at the density's own row height, revalued at the root and never per screen").toBe(28);
    expect(rowStyle.density, "and the density is declared at the ROOT, which is the one switch the grid reads `--row-h` from").toBeTruthy();

    const massCell = firstRow.getByRole("gridcell").last();
    const numerals = await afterSettled(page, () => massCell.evaluate((node) => ({ align: getComputedStyle(node).textAlign, variant: getComputedStyle(node).fontVariantNumeric })));
    expect(numerals.align, "a mass is right-aligned, so a column of them reads down").toBe("right");
    expect(numerals.variant, "and set in tabular numerals").toContain("tabular-nums");

    /* --- the asserted absences (R-UI-080, R-UI-083, Decision §6) --- */
    await expect(bbs.main.locator("select, input[type=date]"), "no native select and no native date input on this screen (R-UI-083)").toHaveCount(0);
    await expect(
      bbs.main.locator('[data-rendered-region="inspector"], [role="complementary"]'),
      "nothing on this screen is selectable, so the shell mounts no inspector and no second right column (R-UI-080)",
    ).toHaveCount(0);

    /* --- the work surface, at both widths §7 C2 holds a screen at (AC-5) --- */
    await assertWorkSurface(bbs, "at 1440 × 900");
    await page.setViewportSize({ width: NARROW.width, height: NARROW.height });
    await settled(page);
    await assertWorkSurface(bbs, `at ${NARROW.width} × ${NARROW.height}`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await settled(page);

    /* --- the two pictures: the lane's dark ground, and the light one beside it --- */
    await checkpoint(page, testInfo, "s-bbs/schedule");
    await expect(page, "schedule.png pictures the schedule a reader meets after the note and the measurement").toHaveScreenshot(["s-bbs", "schedule.png"], {
      mask: bbs.masks(),
      animations: "disabled",
    });

    await emulateTheme(page, "light");
    await settled(page);
    await checkpoint(page, testInfo, "s-bbs/schedule-light");
    await expect(page, "schedule-light.png pictures the same screen on the other paper (R-UI-001)").toHaveScreenshot(["s-bbs", "schedule-light.png"], {
      mask: bbs.masks(),
      animations: "disabled",
    });
    await restoreLaneTheme(page, testInfo);
    await settled(page);
  });

  test("J-032 · AC-5: a project with no campaign says so, and offers the one thing to do about it", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const bare = await stageBareProject(page, { label: "j032-bbs-empty" });

    const bbs = new SBbsPage(page);
    await bbs.open(bare.tenantId, bare.projectId);
    await settled(page);

    expect(await bbs.state(), "a project with nothing measured stands in its empty state, never in an error").toBe("empty");
    await expect(bbs.empty, "and it teaches what a schedule is read from").toBeVisible();
    await expect(bbs.grid, "no grid stands behind the teaching — an empty table is not an empty state").toHaveCount(0);
    await expect(bbs.summaryRows, "and no cutting stock is summarised for bars nobody has measured").toHaveCount(0);

    const action = bbs.empty.locator("a, button");
    await expect(action, "the empty state offers exactly one thing to do (R-UI-050)").toHaveCount(1);
    await expect(action, "and it leads to the register, where a campaign is measured").toHaveAttribute("href", `/t/${bare.tenantId}/p/${bare.projectId}/takeoff/register`);

    await checkpoint(page, testInfo, "s-bbs/empty");
    await expect(page, "empty.png pictures the screen a project with no bars stands in").toHaveScreenshot(["s-bbs", "empty.png"], { mask: bbs.masks(), animations: "disabled" });
  });
});
