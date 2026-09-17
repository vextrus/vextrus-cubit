/**
 * J-033 — the unpriced draft BOQ: a reader opens the takeoff lane's fifth tab and meets every
 * published line of the pinned campaign, grouped into L-BD-08's sections, each line numbered S.G.I,
 * each section closed by a measured-scope subtotal and the project closed by nothing at all — then
 * exports the draft and finds the issue in Documents (R-TO-053, L-BD-08, L-QTY-04, R-UI-050,
 * R-UI-080, docs/design/s-boq.md).
 *
 * The walk is a customer's: a tab is clicked, a screen is read, one primary is pressed, a link is
 * followed. Nothing is staged mid-walk. The three design checkpoints are taken here and nowhere
 * else; the pictures themselves are the gate's to re-take (v16.2 §1).
 *
 * Nothing here measures time (AM-10 §3) — PB-6 lives in tests/e2e/boq-draft-perf.spec.ts.
 */
import { expect, test, type Locator } from "@playwright/test";
import { WORK_ITEM_CATALOGUE } from "../../src/core/catalogue/catalogue";
import { strings } from "../../src/ui/strings";
import { SBoqPage } from "./pages/s-boq.page";
import { SDocumentsPage } from "./pages/s-documents.page";
import { STakeoffPage } from "./pages/s-takeoff.page";
import { stageBareProject, stageBoq } from "./takeoff/boq-stage";
import { checkpoint } from "./support/checkpoint";
import { emulateTheme, restoreLaneTheme } from "./support/lane-theme";
import { everyAttribute, everyRow, heldAttribute, steadyCount, steadyText } from "./support/retrying-read";
import { signInAsSeededTenant } from "./support/seeded-session";
import { afterSettled, settled } from "./support/settled";
import { BOQ_DRAFT, INCOMPLETE, SIX_BILLS, TAXONOMY_VERSION } from "../takeoff/boq/support/draft-shapes";

/** The width the frame paints the lane at (R-UI-030). */
test.use({ viewport: { width: 1440, height: 900 } });

/** What the fifth tab and the crumb say (docs/design/s-boq.md §3). */
const DRAFT_BOQ = "Draft BOQ";

/** The one label a section's foot carries while coverage is incomplete (L-QTY-04). */
const MEASURED_SCOPE_SUBTOTAL = "Measured-scope subtotal";

/** The shape of an item number (AM-14 §2): three 1-based ordinals, no padding and no zero. */
const SGI = /^[1-9]\d*\.[1-9]\d*\.[1-9]\d*$/u;

/** A quantity a reader reads: digits, a decimal point, and the lakh/crore grouping between them. */
const FIGURE = /^[0-9][0-9,]*(\.[0-9]+)?$/u;

/**
 * What the grid calls its figures column, read from the string seam this screen publishes its copy
 * in — never a word typed here (AM-09 §2). Until that file lands the lookup fails by name, which is
 * the red this increment is owed.
 */
function quantityColumnLabel(): string {
  const label = (strings as unknown as Record<string, string | undefined>)["boq_col_quantity"];
  if (typeof label !== "string") throw new Error("src/ui/strings publishes no boq_col_quantity — the draft's columns have not landed yet");
  return label;
}

test.describe("J-033 — the unpriced draft BOQ, by section", () => {
  test("J-033: the fifth tab lands on the draft, every line is numbered and every section is closed by its measured scope", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageBoq(page);

    const takeoff = new STakeoffPage(page);
    const boq = new SBoqPage(page);

    /* --- the fifth tab: clicked, never typed --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    await settled(page);
    await expect(boq.navBoq, "the takeoff lane carries a fifth tab for the draft").toBeVisible();
    await expect(boq.navBoq, "and it says what the crumb says").toHaveText(DRAFT_BOQ);
    await boq.openThroughNav();
    expect(new URL(page.url()).pathname, "the tab lands at the draft's one address").toBe(`/t/${staged.tenantId}/p/${staged.projectId}/takeoff/boq`);

    await settled(page);

    /* --- what the screen says about itself --- */
    expect(await boq.state(), "the draft is read and rendered").toBe("ready");
    expect(await heldAttribute(boq.screen, "data-coverage"), "the staged campaign sighted a class it never measured, so the coverage is incomplete").toBe(INCOMPLETE);
    expect(await heldAttribute(boq.screen, "data-taxonomy-version"), "and the screen states the taxonomy it read the sections under").toBe(TAXONOMY_VERSION);
    expect(await steadyText(boq.crumbPage, "the page crumb"), "the crumb names the screen a reader asked for").toBe(DRAFT_BOQ);

    /* --- the two chips in the tabs aside: the shipped IdChip, whole values, never truncated text --- */
    for (const [what, chip] of [["the pinned revision", boq.revision], ["the taxonomy", boq.taxonomyVersion]] as const) {
      await expect(chip, `${what} stands in the tabs aside`).toBeVisible();
      const value = (await heldAttribute(chip, "data-value")) as string;
      expect(value, `${what} carries its WHOLE value on the chip, so a reader who copies it copies all of it`).toBeTruthy();

      // An id renders THROUGH IdChip (R-UI-003) — not as a span that merely wears the chip's
      // attributes. What the primitive brings with it is asked for: its own element, and the copy
      // control that is the whole reason a whole value is carried on an element a reader sees short.
      await expect(chip, `${what} is the shipped IdChip, so it wears the primitive's own class`).toHaveClass(/cx-id-chip/u);
      const copy = chip.locator(".cx-id-chip-copy");
      await expect(copy, `${what} offers the primitive's copy control — one, and its own`).toHaveCount(1);
      await expect(copy, `${what}'s copy control is a real control a reader can press`).toBeEnabled();

      const shown = (await steadyText(chip.locator(".cx-id-chip-value"), `${what}'s shown form`)).trim();
      expect(shown.length, `${what} shows something`).toBeGreaterThan(0);
      expect(value.startsWith(shown), `${what} SHORTENS what it shows (${shown}) from the value it carries (${value}) — a chip that relabels an id is not this primitive`).toBe(true);
    }
    expect(await heldAttribute(boq.taxonomyVersion, "data-value"), "the taxonomy chip carries the version the resolver stamped").toBe(TAXONOMY_VERSION);
    expect(await heldAttribute(boq.revision, "data-value"), "and the revision chip carries the campaign's own pinned revision").toBe(staged.setRevisionId);

    /* --- the sections: in L-BD-08's order, one per section that holds a line --- */
    const sections = await everyRow(boq.bills, "the sections of the draft");
    expect(sections.length, "a campaign that published lines shows at least one section — a section holding no line is not rendered").toBeGreaterThan(0);
    const billsShown = await everyAttribute(boq.bills, "data-bill", "the sections of the draft");
    const inOrder = [...billsShown].sort((a, b) => SIX_BILLS.indexOf(a) - SIX_BILLS.indexOf(b));
    expect(billsShown, "the sections stand in L-BD-08's own order, whichever of the six hold a line").toEqual(inOrder);
    for (const bill of billsShown) {
      expect(SIX_BILLS, `${bill} is one of L-BD-08's six sections — never a seventh, and never a provisional-sum section (AM-16)`).toContain(bill);
    }

    /* --- each section: a sticky header over a frozen first column, and its own rendered count --- */
    for (const section of sections) {
      const bill = (await heldAttribute(section, "data-bill")) as string;
      const rendered = await heldAttribute(section, "data-rows-rendered");
      expect(Number(rendered), `${bill} publishes how many rows it rendered, so a read of a virtualised grid is an assertion (R-UI-050)`).toBeGreaterThan(0);

      const header = boq.header(section).first();
      await expect(header, `${bill} carries the grid's own header`).toBeVisible();
      const headerPosition = await afterSettled(page, () => header.evaluate((node) => getComputedStyle(node).position));
      expect(headerPosition, `${bill}'s header is sticky, so the columns stand while the section scrolls`).toBe("sticky");

      const firstCell = boq.linesIn(section).first().getByRole("cell").first();
      const frozen = await afterSettled(page, () => firstCell.evaluate((node) => getComputedStyle(node).position));
      expect(frozen, `${bill}'s key column is frozen, so the item number stands while the row scrolls sideways`).toBe("sticky");

      const groupRows = await everyRow(boq.groupRows(section), `${bill}'s group rows`);
      expect(groupRows.length, `${bill} groups its lines by class and kind`).toBeGreaterThan(0);
      for (const groupRow of groupRows) {
        const subtotals = await steadyCount(boq.groupSubtotals(groupRow), "the group's own subtotal");
        expect(subtotals, `every group row of ${bill} carries its own subtotal`).toBeGreaterThan(0);
      }

      /* --- the section's foot: measured scope, per unit, and nothing grander --- */
      const feet = await everyRow(boq.subtotals(section), `${bill}'s subtotal rows`);
      expect(feet.length, `${bill} is closed by a subtotal`).toBeGreaterThan(0);
      const units = new Set<string>();
      for (const foot of feet) {
        expect(await heldAttribute(foot, "data-scope"), `${bill}'s foot states the scope it is a total OF — what was measured, and nothing more (L-QTY-04)`).toBe("MEASURED");
        await expect(foot, `${bill}'s foot says so in words`).toContainText(MEASURED_SCOPE_SUBTOTAL);
        const unit = await heldAttribute(foot, "data-unit");
        expect(unit, `${bill}'s foot is stated per unit — cubic metres and square metres are never added together`).toBeTruthy();
        expect(units.has(unit as string), `${bill} states one measured-scope subtotal per unit, and ${unit} was stated twice`).toBe(false);
        units.add(unit as string);
      }
    }

    /* --- every line: its number, its unit, its figure, its two bases, its coverage --- */
    const lines = await everyRow(boq.lines, "the lines of the draft");
    expect(lines.length, "the staged campaign's published lines are listed").toBeGreaterThan(0);

    // Which column the figures stand in is read off the grid's own header, by the label the strings
    // give it — never a column index typed here (B-19).
    const headers = await everyRow(boq.header(sections[0] as Locator).first().getByRole("columnheader"), "the grid's column headers");
    const labels = await Promise.all(headers.map(async (header) => (await steadyText(header, "a column header")).trim()));
    const quantityAt = labels.indexOf(quantityColumnLabel());
    expect(quantityAt, `the grid states a ${quantityColumnLabel()} column; it states ${labels.join(" · ")}`).toBeGreaterThanOrEqual(0);

    const numbers = new Set<string>();
    for (const line of lines) {
      const lineId = (await heldAttribute(line, "data-line")) as string;
      const item = (await heldAttribute(line, "data-item")) as string;
      expect(item, `line ${lineId} carries an item number derived at emission (AM-14 §2)`).toMatch(SGI);
      expect(numbers.has(item), `${item} is one line's number and one line's only`).toBe(false);
      numbers.add(item);

      expect(await steadyCount(boq.unitBadges(line), `line ${lineId}'s unit`), `line ${lineId} states its unit through the shipped badge`).toBe(1);

      const quantityCell = line.getByRole("cell").nth(quantityAt);
      const figure = (await steadyText(quantityCell, `line ${lineId}'s quantity`)).trim();
      expect(figure, `line ${lineId}'s figure reads as a figure`).toMatch(FIGURE);

      // THE FIGURE IS WRITTEN TO THE CATALOGUE'S PRECISION, per kind (L-MEA-04, interfaces:
      // `figure(quantity, WORK_ITEM_CATALOGUE[kind].documentPrecision)`). The places are asked of the
      // catalogue by the line's OWN kind, so concrete at three places and formwork at two are two
      // different assertions made by one rule, and a screen that printed everything at three places
      // would be caught by the formwork lines it printed wrong.
      const kind = (await heldAttribute(line, "data-kind")) as string;
      expect(WORK_ITEM_CATALOGUE[kind as keyof typeof WORK_ITEM_CATALOGUE], `line ${lineId}'s kind (${kind}) is a kind the catalogue holds`).toBeTruthy();
      const places = WORK_ITEM_CATALOGUE[kind as keyof typeof WORK_ITEM_CATALOGUE].documentPrecision;
      const stated = await heldAttribute(line, "data-quantity");
      expect(stated, `line ${lineId} states the figure it rendered; only a line that declared what it could not measure may state none`).not.toBeNull();
      expect((String(stated).split(".")[1] ?? "").length, `line ${lineId} states its quantity (${stated}) at ${kind}'s own document precision of ${places} places`).toBe(places);
      expect((figure.split(".")[1] ?? "").length, `and the figure a reader reads (${figure}) is written to the same ${places} places — the page and the attribute never disagree`).toBe(places);
      const alignment = await afterSettled(page, () => quantityCell.evaluate((node) => getComputedStyle(node).textAlign));
      expect(alignment, `line ${lineId}'s figure is right-aligned so a column of them reads down`).toBe("right");
      const numerals = await afterSettled(page, () => quantityCell.evaluate((node) => getComputedStyle(node).fontVariantNumeric));
      expect(numerals, `line ${lineId}'s figure is set in tabular numerals`).toContain("tabular-nums");

      const bases = await everyAttribute(boq.basisChips(line), "data-basis", `line ${lineId}'s bases`);
      expect(bases, `line ${lineId} states exactly two bases — how the quantity was got, then how the object was selected`).toEqual([
        await heldAttribute(line, "data-quantity-basis"),
        await heldAttribute(line, "data-selection-basis"),
      ]);
      expect(await steadyCount(boq.coverageChips(line), `line ${lineId}'s coverage`), `line ${lineId} states its coverage once`).toBe(1);
    }

    /* --- the asserted absences (I-268, R-UI-080, R-UI-083) --- */
    await expect(
      page.locator('[data-scope="GRAND"]'),
      "no element anywhere states a grand total: coverage is incomplete and a figure that hides what it does not cover is the failure this product is built against",
    ).toHaveCount(0);
    await expect(boq.main.locator("select, input[type=date]"), "no native select and no native date input on this screen (R-UI-083)").toHaveCount(0);
    await expect(secondRightColumn(boq.main), "nothing on this screen is selectable, so the shell mounts no inspector and no second right column (R-UI-080)").toHaveCount(0);

    await checkpoint(page, testInfo, "s-boq/sections");

    /* --- the same screen on the light ground, inside the dark lane --- */
    await emulateTheme(page, "light");
    await settled(page);
    await checkpoint(page, testInfo, "s-boq/sections-light");
    await restoreLaneTheme(page, testInfo);
    await settled(page);
  });

  test("J-033: exporting the draft files an issue in Documents", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageBoq(page, { label: "boq-export" });

    const boq = new SBoqPage(page);
    await boq.open(staged.tenantId, staged.projectId);
    await settled(page);

    await expect(boq.exportButton, "the one primary of this screen offers the draft").toBeVisible();
    expect(await heldAttribute(boq.exportButton, "data-permission"), "and it names the permission it asks for").toBe("MEASURE");
    await expect(boq.jobs, "no job strip stands at rest — never an empty box").toHaveCount(0);

    await boq.exportButton.click();
    await expect(boq.jobs, "pressing the primary mounts the job strip while the render is watched").toBeVisible();

    await expect(boq.documentLink, "the render finishes and the draft is offered where it was filed").toHaveCount(1, { timeout: 120_000 });
    await settled(page);
    const documentId = await heldAttribute(boq.documentLink, "data-document");
    expect(documentId, "the link names the document it leads to").toBeTruthy();

    await boq.documentLink.click();
    await page.waitForURL(/\/documents/);
    await settled(page);

    const documents = new SDocumentsPage(page);
    const row = documents.row(documentId as string);
    await expect(row, "Documents lists the issue the export filed").toBeVisible();
    expect(await heldAttribute(row, "data-kind"), "under the draft's own document kind").toBe(BOQ_DRAFT);
    await expect(row, "and names it as a reader would ask for it").toContainText(DRAFT_BOQ);
  });

  test("J-033: a project with no campaign says so, and offers the one thing to do about it", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const bare = await stageBareProject(page, { label: "boq-empty" });

    const boq = new SBoqPage(page);
    await boq.open(bare.tenantId, bare.projectId);
    await settled(page);

    expect(await boq.state(), "a project with nothing published stands in its empty state, never in an error").toBe("empty");
    await expect(boq.empty, "and it teaches what a draft is read from").toBeVisible();
    await expect(boq.grid, "no grid stands behind the teaching — an empty table is not an empty state").toHaveCount(0);
    await expect(boq.bills, "and no section is rendered").toHaveCount(0);
    await expect(boq.empty.locator("a, button"), "the empty state offers exactly one thing to do (R-UI-050)").toHaveCount(1);

    await checkpoint(page, testInfo, "s-boq/empty");
  });
});

/**
 * The right-hand columns standing beside the work surface. The shell hosts exactly one inspector
 * slot; this screen mounts nothing into it, so this locator matches nothing.
 */
function secondRightColumn(main: Locator): Locator {
  return main.locator('[data-rendered-region="inspector"], [role="complementary"]');
}
