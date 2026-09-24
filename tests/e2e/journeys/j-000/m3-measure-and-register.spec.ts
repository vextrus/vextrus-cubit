/**
 * J-000 SEGMENTS: run the structural campaign on F-RCC6-BNBC; review the register
 *
 * M3's first leg after the transcriptions, WALKED (AM-09 §3, AM-17): the M3 fixture F-RCC6-BNBC
 * (AM-01) stands uploaded, affirmed, stacked and transcribed by `golden-run.ts` (`bnbcMeasured`, the
 * walk m3-levels-and-notes.spec.ts proves by clicks), Measure is pressed, the ranges the first run
 * deferred are stated on the levels rail — the rail is the campaign's index (s-levels I-240) — the
 * campaign is measured again, and the register is reviewed: the lines the rails published, the
 * refusals and deferrals by their registered codes, the column lines the column layout's members
 * measure to, the campaign's own figures storey by storey against the golden, and the coverage
 * grid's cells and boundary statement (L-QTY-05).
 *
 * The doors this leg waited on landed in sessions 5 and 6: a paper-space viewport's title captions
 * the model-space region it shows (viewer.md I-290), a block-drawn grid bubble georeferences (I-292),
 * the section's `EL` marks propose the stack (I-293), the stacked column schedule reads (I-294), a
 * feet-and-inches dimension scales a unitless header (I-295/I-295b), a band written in ordinal words
 * covers the stack's floor labels, the unit the drawing declares is the last word on a unitless
 * section (I-302), a plan note naming a mark is evidence about the MEMBER (I-303: the porch column
 * C7 — stack C7X, which model.json carries at FDN and GF — stands on GF and on no storey above it, and
 * C5 is minted on 1F..6F, its 1F line MEASURED), and a circular column is a PRISM_POLY billed by its
 * own rule (I-305). Session 7 closed the typical-range act's third spelling of the expansion
 * (929a37c2), so the register carries the members the doors give: 182 column concrete lines, 26 on
 * each of GF..6F, every one COMPLETE — against a golden that prints 90.834 m³ over those seven cells
 * (90.833288 m³ unrounded in model.json). With the neck a person enters beneath GF (I-339), the
 * resolver stands every ground-storey column on it too (I-338): 26 more, DERIVED and COMPLETE, sized by
 * the `GF TO 2ND` band — 208 lines in all.
 *
 * WHAT IS COMPARED, AND AT WHAT PRECISION (L-QTY-06, L-QTY-07, AM-01). A numeric assertion names its
 * roster: the COLUMN × RCC_CONCRETE cell of every storey `golden-run.ts` stacks (BNBC_NECK and
 * BNBC_STOREYS, FDN..6F — the neck a person entered beneath GF, which every ground-storey column
 * continues down to, I-338/I-339: 26 members, 3.0596 m³ against the golden's 3.060),
 * read on the register itself — the class, kind and level filters narrowed as a reader narrows them,
 * the count line and the sticky footer's exact total read back (s-takeoff.md §5 rule 1: B-07's exact
 * sum of the lines the filters keep, whole in the figure's `data-value`). Both expected figures are the
 * golden's, through `goldenRows("rcc6-bnbc")`: the count is the members the golden's row for that
 * storey lists, and the band is `0.97 × G − a ≤ S ≤ G + a`, G the golden cell and a its printing
 * allowance — one half-unit per golden row in its own last printed place, from the golden strings
 * alone (`goldenCellAllowance`: the one home of the allowance the tree's arbitrated band, at
 * tests/takeoff/rails/support/slab-wall-stair-stage.ts's `insideBand`, widens each side by and by
 * nothing else; B-07 forbids rounding the register's figure to the golden's precision to make it
 * pass). The same band is read on the three PILE cells — the piles counted, the length bored, the
 * concrete cast — over every level, because a pile stands in the lawful-null FOUNDATION slot: S-05's
 * PILE SCHEDULE types the 89 numbered piles of S-04 by its bare `P` row and states the diameter and
 * the length the rails bind (I-320, I-321, I-322; AM-06 §2), so the count is the golden's 89 members
 * and the concrete is π/4·d² with d the schedule's DIA — the flattened ring's area would stand over
 * the golden, and that is the ceiling's to catch. And on the PILE_CAP concrete cell, over every level
 * for the same reason: S-06 places its 26 caps by the outline each mark stands in (I-333) and its
 * PILE CAP SCHEDULE types and sizes them (I-330..I-332), so the count is the golden's 26 members and the
 * figure is each ring's own plan times the schedule's DEPTH (I-334) — the schedule's rectangle for a
 * chamfered PC2 would stand 5.8 % over. And on the PILE_CAP formwork cell beside it: the same 26 caps,
 * each formed along its SIDES only — a PC2 along its ring's own 6.96 m, a rectangle along `2 × (L + B)`
 * of the sides its concrete binds — times the same depth (I-337, L-FRM-03). The band is read HERE, at register precision, and nowhere else: a document states each line
 * rounded once to its kind's places, so a document's sum is a different figure from the register's,
 * and m3-bill-and-schedules.spec.ts proves the documents faithful to these totals rather than banding
 * them a second time.
 *
 * The count is asserted before the band because it is the sharper witness: the run before 929a37c2
 * published 189 column concrete lines (94.196 m³), and the storey that carried a line too many fails
 * `shown === members` by name before its volume is read — the ceiling G + a catches the same excess
 * wherever the count happened to agree.
 *
 * THE TRACE, BOTH WAYS, ON A REAL LINE (VD-1, R-UI-022, X-2). Before VD-1 no lane followed a
 * rail-published line's link, and walk-0 found every one of them opening a sheet called `Model` the
 * drawing does not hold, and a column held on S-10 answering "No published line cites this
 * selection". So this leg follows the first column concrete line the register shows: the link opens
 * S-10 — the column layout plan whose window frames the column — flies to the column's outline and
 * mark with nothing left over, and the Trace block reads the line; then the column's outline, held on
 * its own, lists that line among the lines that cite it (I-421).
 *
 * Nothing here measures time (AM-10 §3).
 */
import Decimal from "decimal.js";
import { expect, test, type TestInfo } from "@playwright/test";
import { goldenCellAllowance, goldenCellRows, goldenKindOf, goldenRows } from "../../../golden/support/golden-fixture";
import { NOT_ESTABLISHED, QUANTITY_BEARING, SCoveragePage } from "../../pages/s-coverage.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { SViewerTracePage } from "../../pages/s-viewer-trace.page";
import { ShellPage } from "../../pages/shell.page";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../../viewer/s-viewer.page";
import { checkpoint } from "../../support/checkpoint";
import { heldAttribute, steadyCount, steadyText } from "../../support/retrying-read";
import { settled } from "../../support/settled";
import { TESTIDS, testIdSelector } from "../../../../src/ui/testids";
import { BNBC_NECK, BNBC_STOREYS, bnbcMeasured, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** The fixture the golden is read for (AM-01). */
const FIXTURE = "rcc6-bnbc";

/** The cell this leg reads the campaign's figures on, in the product's words (the register's filters). */
const COLUMN = "column";
const RCC_CONCRETE = "rcc.concrete";

/**
 * The pile, and the three kinds its rails bear (R-TO-032): the piles counted, the length bored, the
 * concrete cast. A pile stands in the lawful-null FOUNDATION slot and on no storey (L-CAD-07), so it
 * is read over EVERY level — the level filter's own "any" — and the golden's level for it is read off
 * the golden's own rows rather than spelled here.
 */
const PILE = "pile";
const PILE_KINDS: readonly string[] = Object.freeze(["piling.bored", "piling.boring", RCC_CONCRETE]);
const EVERY_LEVEL = "";

/**
 * The pile cap, and the two kinds its plan and its depth now publish whole: the concrete cast
 * (I-330..I-334) and the formwork its SIDES are cast against (I-337, L-FRM-03 — the ring's own
 * boundary for a chamfered PC2, `2 × (L + B)` of the sides its concrete binds for a rectangle, never a
 * soffit or a top). A cap stands in the FOUNDATION slot as a pile does, so it is read over every level
 * too; its pit and its blinding wait on the site's ground level and the polygon caps' plans (L-FRM-04)
 * and are not banded here.
 */
const PILE_CAP = "pile_cap";
const RCC_FORMWORK = "rcc.formwork";
const PILE_CAP_KINDS: readonly string[] = Object.freeze([RCC_CONCRETE, RCC_FORMWORK]);

/** L-QTY-06's floor: three per cent under the golden, and nothing over it. */
const UNDER_TOLERANCE = "0.97";

/** Exact decimals, at a precision no sum here reaches — a figure never touches a float (B-07). */
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** One storey's reading: what the golden owes, and what the register stated. */
type StoreyReading = {
  readonly level: string;
  readonly goldenRows: number;
  readonly members: number;
  readonly unit: string;
  readonly golden: Decimal;
  readonly allowance: Decimal;
  readonly shown: number;
  readonly statedUnit: string | null;
  readonly total: string | null;
};

/** The sheet a viewer address opens: `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`. */
function sheetOf(address: string): { drawingId: string; layoutName: string } {
  const path = new URL(address).pathname.split("/");
  const at = path.indexOf("viewer");
  expect(at, `${address} is a viewer address`).toBeGreaterThan(0);
  return { drawingId: path[at + 1] ?? "", layoutName: decodeURIComponent(path[at + 2] ?? "") };
}

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

    /* --- the campaign's figures, storey by storey, at the REGISTER's precision (L-QTY-06, L-QTY-07) --- */
    await takeoff.narrow("class", COLUMN);
    await takeoff.narrow("kind", RCC_CONCRETE);
    const readings: StoreyReading[] = [];
    // The neck first, as the stack stands it: every ground-storey column continued down to the cap
    // beneath GF (I-338) — 26, the porch C7 among them and the floating C5 not.
    for (const label of [BNBC_NECK.label, ...BNBC_STOREYS.map((storey) => storey.label)]) {
      const cell = { class: COLUMN.toUpperCase(), kind: goldenKindOf(RCC_CONCRETE), level: label };
      const owed = goldenCellRows(FIXTURE, cell);
      await takeoff.narrow("level", label);
      const kept = await takeoff.kept(`${COLUMN} × ${RCC_CONCRETE} at ${label}`);
      readings.push({
        level: label,
        goldenRows: owed.length,
        members: new Set(owed.flatMap((row) => row.members ?? [])).size,
        unit: owed[0]?.unit ?? "",
        golden: owed.reduce((sum, row) => sum.plus(row.quantity), new Exact(0)),
        allowance: new Exact(goldenCellAllowance(FIXTURE, cell)),
        shown: kept.shown,
        statedUnit: kept.unit,
        total: kept.total,
      });
    }
    await attach(
      testInfo,
      "m3-register-band",
      [
        `${COLUMN} × ${RCC_CONCRETE}, per storey — register lines (golden members) · register total · golden ± allowance`,
        ...readings.map(
          (reading) =>
            `${reading.level}: ${reading.shown} (${reading.members}) · ${reading.total ?? "no footer"} ${reading.statedUnit ?? ""} · ${reading.golden.toString()} ± ${reading.allowance.toString()} ${reading.unit}${
              reading.total === null ? "" : ` · ${new Exact(reading.total).div(reading.golden).minus(1).times(100).toFixed(3)} %`
            }`,
        ),
      ].join("\n"),
    );

    for (const reading of readings) {
      const said = `${COLUMN} × ${RCC_CONCRETE} at ${reading.level}`;
      expect(reading.goldenRows, `${FIXTURE}'s golden carries ${said} — a band over no row is no band (L-QTY-06)`).toBeGreaterThan(0);
      expect(reading.shown, `${said}: the register counts one line per member the golden lists on this storey`).toBe(reading.members);
      expect(reading.statedUnit, `${said}: the footer states the unit the golden is written in`).toBe(reading.unit);
      const figure = new Exact(reading.total ?? "0");
      const ceiling = reading.golden.plus(reading.allowance);
      const floor = reading.golden.times(UNDER_TOLERANCE).minus(reading.allowance);
      expect(
        figure.lte(ceiling),
        `${said}: the register's ${figure.toString()} is not over the golden's ${reading.golden.toString()} widened by its own printed half-unit ${reading.allowance.toString()} — L-QTY-06 allows nothing over, and an over-measured figure is never a disclosure (L-QTY-04)`,
      ).toBe(true);
      expect(
        figure.gte(floor),
        `${said}: the register's ${figure.toString()} is no more than three per cent under the golden's ${reading.golden.toString()} (floor ${floor.toString()}, L-QTY-06)`,
      ).toBe(true);
    }

    /* --- the Trace, followed from a real column concrete line, and back from the column (VD-1) --- */
    // The first column concrete line of the storey the loop left narrowed, followed as a reader does.
    const viewer = new SViewerPage(page);
    const trace = new SViewerTracePage(page);
    const shell = new ShellPage(page);
    const tracedLine = await takeoff.firstTracedLine();
    await takeoff.followTrace(tracedLine);
    await expect(viewer.status, "the sheet the Trace opened paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await trace.settled();
    await expect(viewer.screen, "and the camera flew to what the Trace selects (R-UI-022's fly-to)").toHaveAttribute("data-flyto-flight", /^[1-9]\d*$/);
    await expect(shell.crumb("page"), "the sheet is S-10, the column layout plan the column stands on — never a model space called `Model`").toContainText("S-10");
    const column = trace.addressKeys();
    expect(column.length, `the Trace selects the column itself: its outline and its mark (I-421) — it named ${JSON.stringify(column)}`).toBe(2);
    expect([...(await trace.selectedKeys())].sort(), "both stand on S-10, so both are held").toEqual([...column].sort());
    await expect(viewer.missingKeys, "and nothing the address named is missing from the sheet").toHaveCount(0);
    await expect(trace.trace, "the Trace block reads the line that was followed").toHaveAttribute("data-line", tracedLine);
    await expect(trace.trace, "on a reading that answered").toHaveAttribute("data-state", "ready");
    await settled(page);
    await checkpoint(page, testInfo, "j-000/bnbc-traced");

    // X-2 from the drawing: the column's outline, held on its own, is cited by the line measured off it.
    const traced = sheetOf(page.url());
    await page.goto(S_VIEWER.selecting(run.tenantId, run.bnbc.projectId, traced.drawingId, traced.layoutName, [column[0] as string]));
    await expect(viewer.status, "S-10 paints with the outline held").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect(trace.entities, "the column's outline is what is held").toHaveCount(1);
    await expect(trace.cited, "and the selection tab answers what cites it").toHaveAttribute("data-state", "ready");
    expect(await trace.citedLineIds(), "the column concrete line the Trace came from is among the lines measured off this column (X-2)").toContain(tracedLine);
    await attach(testInfo, "m3-trace", `line=${tracedLine}
sheet=${traced.layoutName}
selected=${column.join(",")}`);

    /* --- the quantities on the sheet (viewer.md Part 6, R-TO-015, R-TO-044): on S-10 every measured
       column is painted, and the legend states the column condition's measured scope — the same exact
       figure the register's footers state for column concrete over every storey, never a second
       addition of it (B-17). The members seen and not billed are hatched only when asked for. --- */
    const legend = page.getByTestId(TESTIDS.viewer.quantityLegend);
    const quantityCanvas = page.getByTestId(TESTIDS.viewer.quantityCanvas);
    await expect(legend, "the overlay opens off: a sheet is a drawing first").toHaveCount(0);
    await page.getByTestId(TESTIDS.viewer.quantityToggle).click();
    await expect(legend, "the legend reads the campaign's quantities on this sheet").toHaveAttribute("data-state", "ready");
    const columnRow = legend.getByTestId(TESTIDS.viewer.quantityLegendRow).and(page.locator('[data-condition="class:column"]'));
    await expect(columnRow, "the column condition stands in the legend").toHaveCount(1);
    const columnConcrete = columnRow.getByTestId(TESTIDS.viewer.quantityLegendTotal).and(page.locator(`[data-kind="${RCC_CONCRETE}"]`));
    const registered = readings.reduce((sum, reading) => sum.plus(reading.total ?? "0"), new Exact(0));
    expect(
      new Exact((await heldAttribute(columnConcrete, "data-value", "the legend's column concrete measured scope")) ?? "0").equals(registered),
      `the legend's column concrete is the register's own: ${registered.toString()} m³ over every storey`,
    ).toBe(true);
    expect(await heldAttribute(columnConcrete, "data-lines"), "one COMPLETE line per member per storey, as the register counts them").toBe(String(readings.reduce((sum, reading) => sum + reading.shown, 0)));
    const measuredColumns = Number(await heldAttribute(columnRow, "data-measured"));
    await expect(quantityCanvas, "every measured member is painted on the sheet").toHaveAttribute("data-filled", /^[1-9]\d*$/);
    expect(Number(await heldAttribute(quantityCanvas, "data-filled")), "each painted member is one the legend counts").toBeGreaterThanOrEqual(measuredColumns);
    await page.getByTestId(TESTIDS.viewer.quantityUnmeasuredToggle).click();
    const unmeasuredRows = legend.getByTestId(TESTIDS.viewer.quantityLegendUnmeasured);
    // What the sheet hatches and what the legend counts as not billed, read together until they agree.
    await expect
      .poll(
        async () => {
          const counted = await unmeasuredRows.evaluateAll((rows) => rows.reduce((sum, row) => sum + Number(row.getAttribute("data-unmeasured") ?? "0"), 0));
          return `${await quantityCanvas.getAttribute("data-hatched")}/${counted}`;
        },
        { message: "every member the legend says was seen and not billed is hatched on the sheet" },
      )
      .toMatch(/^(\d+)\/\1$/u);
    const hatched = await heldAttribute(quantityCanvas, "data-hatched");
    await settled(page);
    await checkpoint(page, testInfo, "j-000/bnbc-quantities");
    await attach(
      testInfo,
      "m3-quantities",
      `sheet=${traced.layoutName}
legend=${(await steadyText(legend, "the legend on the sheet")).replace(/\s+/gu, " ")}
column-measured=${measuredColumns}
filled=${await heldAttribute(quantityCanvas, "data-filled")}
hatched=${hatched}`,
    );

    // Back to the register, which the piles are read on.
    await takeoff.open(run.tenantId, run.bnbc.projectId);

    /* --- the piles, typed by their own schedule and sized by it, per kind (I-320..I-322, AM-06 §2) --- */
    // S-05's PILE SCHEDULE types every numbered pile of S-04 by its bare `P` row and states the
    // diameter and the length the rails bind; the register keeps one line per pile per kind. Read at
    // the register's precision exactly as the columns are, against the golden's own PILE cells.
    await takeoff.narrow("level", EVERY_LEVEL);
    await takeoff.narrow("class", PILE);
    const piles: StoreyReading[] = [];
    for (const kind of PILE_KINDS) {
      const owed = goldenRows(FIXTURE).filter((row) => row.class === PILE.toUpperCase() && row.kind === goldenKindOf(kind));
      const levels = [...new Set(owed.map((row) => row.level))];
      expect(levels.length, `${FIXTURE}'s golden states ${PILE} × ${kind} in one cell — it states it at ${JSON.stringify(levels)}`).toBe(1);
      const cell = { class: PILE.toUpperCase(), kind: goldenKindOf(kind), level: levels[0] as string };
      await takeoff.narrow("kind", kind);
      const kept = await takeoff.kept(`${PILE} × ${kind}`);
      piles.push({
        level: `${kind} @ ${cell.level}`,
        goldenRows: owed.length,
        members: new Set(owed.flatMap((row) => row.members ?? [])).size,
        unit: owed[0]?.unit ?? "",
        golden: owed.reduce((sum, row) => sum.plus(row.quantity), new Exact(0)),
        allowance: new Exact(goldenCellAllowance(FIXTURE, cell)),
        shown: kept.shown,
        statedUnit: kept.unit,
        total: kept.total,
      });
    }
    await attach(
      testInfo,
      "m3-register-band-piles",
      [
        `${PILE}, per kind over every level — register lines (golden members) · register total · golden ± allowance`,
        ...piles.map(
          (reading) =>
            `${reading.level}: ${reading.shown} (${reading.members}) · ${reading.total ?? "no footer"} ${reading.statedUnit ?? ""} · ${reading.golden.toString()} ± ${reading.allowance.toString()} ${reading.unit}${
              reading.total === null ? "" : ` · ${new Exact(reading.total).div(reading.golden).minus(1).times(100).toFixed(3)} %`
            }`,
        ),
      ].join("\n"),
    );
    for (const reading of piles) {
      const said = `${PILE} × ${reading.level}`;
      expect(reading.goldenRows, `${FIXTURE}'s golden carries ${said} — a band over no row is no band (L-QTY-06)`).toBeGreaterThan(0);
      expect(reading.shown, `${said}: the register keeps one line per pile the golden lists — every numbered pile typed by the schedule's \`P\` row (I-321)`).toBe(reading.members);
      expect(reading.statedUnit, `${said}: the footer states the unit the golden is written in`).toBe(reading.unit);
      const figure = new Exact(reading.total ?? "0");
      expect(
        figure.lte(reading.golden.plus(reading.allowance)),
        `${said}: the register's ${figure.toString()} is not over the golden's ${reading.golden.toString()} widened by its printed half-unit ${reading.allowance.toString()} — the shaft is π/4·d² with d the schedule's DIA, never the flattened ring (L-QTY-06, L-QTY-04)`,
      ).toBe(true);
      expect(
        figure.gte(reading.golden.times(UNDER_TOLERANCE).minus(reading.allowance)),
        `${said}: the register's ${figure.toString()} is no more than three per cent under the golden's ${reading.golden.toString()} (L-QTY-06)`,
      ).toBe(true);
    }

    /* --- the pile caps, placed by their outlines and measured over them (I-330..I-334, I-337) --- */
    // S-06 places its 26 caps by the outline each mark stands in — never one per pile circle — and the
    // cap concrete is the ring's own plan (a chamfered PC2's shoelace, a turned PC1's own sides) times
    // the schedule's DEPTH; its formwork is that same plan's SIDES times the same depth (a PC2's ring
    // runs 6.96 m where its schedule's rectangle would say 7.7). Read per kind at the register's
    // precision exactly as the piles are, against the golden's own PILE_CAP cells.
    await takeoff.narrow("class", PILE_CAP);
    const caps: StoreyReading[] = [];
    for (const kind of PILE_CAP_KINDS) {
      const capRows = goldenRows(FIXTURE).filter((row) => row.class === PILE_CAP.toUpperCase() && row.kind === goldenKindOf(kind));
      const capLevels = [...new Set(capRows.map((row) => row.level))];
      expect(capLevels.length, `${FIXTURE}'s golden states ${PILE_CAP} × ${kind} in one cell — it states it at ${JSON.stringify(capLevels)}`).toBe(1);
      const capCell = { class: PILE_CAP.toUpperCase(), kind: goldenKindOf(kind), level: capLevels[0] as string };
      await takeoff.narrow("kind", kind);
      const capKept = await takeoff.kept(`${PILE_CAP} × ${kind}`);
      caps.push({
        level: `${kind} @ ${capCell.level}`,
        goldenRows: capRows.length,
        members: new Set(capRows.flatMap((row) => row.members ?? [])).size,
        unit: capRows[0]?.unit ?? "",
        golden: capRows.reduce((sum, row) => sum.plus(row.quantity), new Exact(0)),
        allowance: new Exact(goldenCellAllowance(FIXTURE, capCell)),
        shown: capKept.shown,
        statedUnit: capKept.unit,
        total: capKept.total,
      });
    }
    await attach(
      testInfo,
      "m3-register-band-pile-caps",
      [
        `${PILE_CAP}, per kind over every level — register lines (golden members) · register total · golden ± allowance`,
        ...caps.map(
          (reading) =>
            `${reading.level}: ${reading.shown} (${reading.members}) · ${reading.total ?? "no footer"} ${reading.statedUnit ?? ""} · ${reading.golden.toString()} ± ${reading.allowance.toString()} ${reading.unit}${
              reading.total === null ? "" : ` · ${new Exact(reading.total).div(reading.golden).minus(1).times(100).toFixed(3)} %`
            }`,
        ),
      ].join("\n"),
    );
    for (const reading of caps) {
      const capsSaid = `${PILE_CAP} × ${reading.level}`;
      expect(reading.goldenRows, `${FIXTURE}'s golden carries ${capsSaid} — a band over no row is no band (L-QTY-06)`).toBeGreaterThan(0);
      expect(reading.shown, `${capsSaid}: the register keeps one line per cap the golden lists — one per cap OUTLINE, never one per pile circle (I-333)`).toBe(reading.members);
      expect(reading.statedUnit, `${capsSaid}: the footer states the unit the golden is written in`).toBe(reading.unit);
      const capFigure = new Exact(reading.total ?? "0");
      expect(
        capFigure.lte(reading.golden.plus(reading.allowance)),
        `${capsSaid}: the register's ${capFigure.toString()} is not over the golden's ${reading.golden.toString()} widened by its printed half-unit ${reading.allowance.toString()} — a PC2 is its shoelace and its own ring, never the schedule's rectangle, and a turned PC1 its own sides, never its box (I-334, I-337, L-QTY-04)`,
      ).toBe(true);
      expect(
        capFigure.gte(reading.golden.times(UNDER_TOLERANCE).minus(reading.allowance)),
        `${capsSaid}: the register's ${capFigure.toString()} is no more than three per cent under the golden's ${reading.golden.toString()} (L-QTY-06)`,
      ).toBe(true);
    }

    /* --- the coverage grid: what the campaign did and did not establish, said in cells (L-QTY-05) --- */
    await coverage.openThroughNav();
    await expect(coverage.screen, "the coverage screen reads the measured campaign").toHaveAttribute("data-state", /ready|partial/);
    await expect(coverage.cells, "with a cell per kind and class the campaign stands on").not.toHaveCount(0);
    await expect(coverage.measuring(QUANTITY_BEARING), "the measured cells bear published quantity").not.toHaveCount(0);
    const unestablished = await steadyCount(coverage.measuring(NOT_ESTABLISHED), "the cells the campaign did not establish", { min: 0 });
    await attach(testInfo, "m3-coverage", `not-established cells=${unestablished}`);
    await expect(coverage.statement("MEASUREMENT"), "the measurement boundary prints in full").toBeVisible();
    /* --- the whole building (COV-ALL, s-coverage I-479/b), moved here from the M2 leg, which walks F-RCC6:
       F-RCC6-BNBC places columns,
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
    await expect(
      coverage.statementRows("MEASUREMENT").and(coverage.preview.locator('[data-class="slab"][data-reason="COVERAGE_CLASS_NOT_PLACED"]')),
      "and the slab stands in the measurement boundary under its reason",
    ).not.toHaveCount(0);
    await settled(page);
    await checkpoint(page, testInfo, "j-000/bnbc-coverage");
  });
});
