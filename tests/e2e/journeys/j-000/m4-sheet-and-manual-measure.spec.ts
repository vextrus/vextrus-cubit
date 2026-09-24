/**
 * J-000 SEGMENTS: measure a manual condition
 *
 * The second of AM-17's four M4 segments — AM-09 §3's "a manual condition measured" — beside
 * m4-pdf-sheet.spec.ts, m4-rooms-and-finishes.spec.ts and m4-ask-the-drawings.spec.ts. It stands on the
 * F-RCC6-BNBC project the golden run already ingested, confirmed, scale-affirmed and measured
 * (`bnbcMeasured`), and walks docs/design/s-measure.md § 10 as a QS does:
 *
 * 1. S-08 is opened from its card on the drawings screen. Its view "GRADE BEAM LAYOUT & GF
 *    SLAB-ON-GRADE" holds the scale of record the golden run affirmed.
 * 2. In the chest, "75 CC blinding under SOG" (slab · blinding · t 75 mm) is found, or authored.
 * 3. Its row is picked, which arms Area; the five vertices of POLYLINE 81D, the SOG's own outline
 *    (I-393), are clicked where the viewer draws them, each meeting the drawn point, and Enter closes
 *    the ring. The card opens at the closing point (S6).
 * 4. X on the card cuts out; the lift pit's four corners (LWPOLYLINE 830) are clicked and Enter
 *    finishes it: the card opens again over the outline less the opening.
 * 5. On the card: the level is the caption's, Ground floor (I-377); t is taken from note 828 — "75 THK
 *    BLINDING UNDER" — TRANSCRIBED (§ 2.5); the blinding's figure is the gate's own evaluation with its
 *    formula (I-384), and Confirm records it.
 * 6. The outline clears with Area still armed; the campaign's measure run publishes the line; the
 *    register holds one slab · blinding line at the figure the card showed, and the draft BOQ lists it.
 *
 * SAFE TO RUN AGAIN. A second identical trace of one scope is refused by the act (DUPLICATE_IDENTITY,
 * I-378), so a run that finds the condition already measured in this campaign (the chest's own
 * count, I-575) skips to the read-back and asserts the line stands.
 *
 * THE LAW IT WALKS. C-13 (cubit.bible.xml:800); R-TO-040 (:475): every measurement is an act with
 * geometry citing the entities snapped to, and its results are offers to the gate under a chosen kind,
 * never lines the tool writes; L-MEA-08 (:224): one rail per quantity kind; J-041 (:752). It asserts no
 * COMPLETE figure of its own and never the golden's informational 23.615 m³
 * (fixtures/rcc6-bnbc/takeoff.golden.json): the figure asserted is the gate's evaluation the card
 * previewed, which the published line must equal (s-measure I-389, I-393).
 */
import { expect, test } from "@playwright/test";
import { TESTIDS } from "../../../../src/ui/testids";
import { SBoqPage } from "../../pages/s-boq.page";
import { SDrawingsPage, S_DRAWINGS } from "../../pages/s-drawings.page";
import { SMeasurePage } from "../../pages/s-measure.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { checkpoint } from "../../support/checkpoint";
import { everyAttribute, heldAttribute, steadyCount } from "../../support/retrying-read";
import { settled } from "../../support/settled";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../../viewer/s-viewer.page";
import { bnbcMeasured, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** The sheet, the condition and the entities the leg measures (s-measure § 10, I-393). */
/** S-08's layout as the drawing names it: a card is found by its layout (`cardForLayout`), never by the number alone. */
const SHEET = "S-08 GRADE BEAM LAYOUT & GF SLAB-ON-GRADE";
const CONDITION = "75 CC blinding under SOG";
const THICKNESS = "75";
const SOG = "DXF_HANDLE:81D";
const PIT = "DXF_HANDLE:830";
/** S-08's drawn slab outline since Rev C: the SOG's polyline and the five blinding LINEs on its edges (I-393). */
const OUTLINE: readonly string[] = [SOG, "DXF_HANDLE:824", "DXF_HANDLE:825", "DXF_HANDLE:826", "DXF_HANDLE:827", "DXF_HANDLE:2309"];
const NOTE = "DXF_HANDLE:828";
const NOTE_WORDS = /75 THK BLINDING UNDER/;
/** The level S-08's caption states, as the stack labels it (I-377). */
const GROUND = "GF";
/** The register's filters, by the values the screen publishes. */
const SLAB = "slab";
const BLINDING = "pcc.blinding";
/** How long the campaign's measure run may take to publish the line after Confirm (a BNBC run is under a second, plus the worker's pick-up). */
const PUBLISH_BUDGET_MS = 120_000;

/** Whether a figure stated once rounded is its exact source within half a unit of its own last place. */
function withinHalfUnit(stated: string, exact: string): boolean {
  const places = (stated.split(".")[1] ?? "").length;
  const [whole = "0", fraction = ""] = exact.split(".");
  const scale = 10n ** BigInt(places + 1);
  const tenths = (text: string, digits: string): bigint => BigInt(text) * scale + BigInt((digits + "0".repeat(places + 1)).slice(0, places + 1) || "0");
  const [statedWhole = "0", statedFraction = ""] = stated.split(".");
  const difference = tenths(statedWhole, statedFraction) - tenths(whole, fraction);
  return difference <= 5n && difference >= -5n;
}

/** The sheet a viewer address opens: `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`. */
function sheetOf(address: string): { drawingId: string; layoutName: string } {
  const path = new URL(address).pathname.split("/");
  const at = path.indexOf("viewer");
  expect(at, `${address} is a viewer address`).toBeGreaterThan(0);
  return { drawingId: path[at + 1] ?? "", layoutName: decodeURIComponent(path[at + 2] ?? "") };
}

test.describe.serial("J-000 — Golden Path: M4's manual condition (AM-09 §3, AM-17)", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m4-sheet-and-manual-measure: a manual condition is measured on S-08 at its card, and lands in the register and the draft BOQ", async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    const run = await bnbcMeasured(page);
    const projectId = run.bnbc.projectId;

    // 1. S-08, opened from its card.
    const drawings = new SDrawingsPage(page);
    await drawings.open(run.tenantId, projectId);
    await drawings.cell(drawings.cardForLayout(SHEET), S_DRAWINGS.open).click();
    await page.waitForURL(/\/viewer\//u);
    const viewer = new SViewerPage(page);
    await expect(viewer.status, "S-08 paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    const { drawingId, layoutName } = sheetOf(page.url());

    // 2. The condition, found or authored.
    const measure = new SMeasurePage(page);
    await expect(measure.chest, "the chest is read (§ 3)").toHaveAttribute("data-state", /^(ready|empty)$/u);
    await settled(page);
    if ((await steadyCount(measure.condition(CONDITION), "the blinding's row in the chest", { min: 0 })) === 0) await measure.author(CONDITION, THICKNESS);
    await expect(measure.condition(CONDITION), "the blinding stands in the chest").toHaveCount(1);

    let previewed: string | null = null;
    if ((await measure.measured(CONDITION)) === 0) {
      // 3. The camera over the SOG's outline, so each vertex is a click of its own; the condition picked, Area armed.
      const records = await measure.records({ tenantId: run.tenantId, drawingId, layoutName });
      const sog = SMeasurePage.ringOf(records, SOG);
      const pit = SMeasurePage.ringOf(records, PIT);
      expect(sog.length, "81D is the SOG's five-point outline (I-393)").toBe(5);
      const box = await viewer.canvasBox();
      await page.goto(S_VIEWER.at(run.tenantId, projectId, drawingId, layoutName, SMeasurePage.viewportOver(sog, box)));
      await expect(viewer.status).toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
      // The snap meets only what has arrived: the first paint is a layer or two, and 81D stands on the
      // Slab layer, so every layer is waited for before a vertex is clicked (the leg's first walk traced
      // while the status read "Layers 2 of …" and every point stood on nothing).
      await expect
        .poll(async () => {
          const total = await viewer.statusNumber("data-total-layers");
          return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
        }, { timeout: VIEWER_BUDGETS.firstPaintColdMs, message: "every layer of S-08 arrives before a vertex is clicked" })
        .toBe(true);
      await expect(measure.chest).toHaveAttribute("data-state", "ready");
      await measure.pick(CONDITION);
      await expect(page.getByTestId(TESTIDS.viewer.toolArea), "picking an area condition arms Area (§ 2.6)").toHaveAttribute("aria-pressed", "true");

      await measure.trace(viewer, sog);
      // TEST_AMENDED (R0 Rev C, D-BLIND W-40; s-measure I-393 as amended): Rev C draws the blinding
      // outline — LINEs 824–827 and 2309 — on 81D's own edges, so every vertex of the ring is a drawn
      // point of 81D AND the endpoint of two blinding LINEs, and the snap meets whichever it meets
      // first. Each point is held to what R-TO-040 asks: it cites an entity of S-08's drawn slab
      // outline, and that entity draws the very vertex clicked.
      const cited = await everyAttribute(measure.points, "data-source", "the placed points", { min: 5 });
      expect(cited.length, "one point per vertex of the ring").toBe(sog.length);
      cited.forEach((key, index) => {
        const vertex = sog[index] as [number, number];
        expect(OUTLINE, `point ${String(index + 1)} cites the slab's drawn outline, 81D or the blinding LINEs on its edges (R-TO-040)`).toContain(key);
        const drawn = records.find((record) => record.key === key)?.points ?? [];
        expect(drawn.some((point) => point[0] === vertex[0] && point[1] === vertex[1]), `${key} draws the vertex ${vertex.join(", ")} the point was placed on`).toBe(true);
      });
      await page.keyboard.press("Enter");
      await expect(measure.card, "Enter under a condition opens the card at the closing point (S6)").toHaveAttribute("data-presentation", "anchored");
      await expect(measure.card).toHaveAttribute("data-act-type", "RECORD_MANUAL_MEASUREMENT");
      await expect(measure.confirm, "the preview answered").toBeVisible();

      // 4. The lift pit, cut out from the card.
      await page.keyboard.press("x");
      await expect(measure.draft, "X gives the card way to the cut-out ring").toHaveAttribute("data-state", "cutting");
      await measure.trace(viewer, pit);
      await page.keyboard.press("Enter");
      await expect(measure.confirm, "the card opens again over the outline less the opening").toBeVisible();

      // 5. The level the caption states; t from note 828; the gate's figure.
      await expect(measure.level, "the level is the caption's (I-377)").toContainText(GROUND);
      await measure.choose(measure.readingChoice, NOTE_WORDS);
      await expect(measure.reading, "t is read off note 828 (§ 2.5)").toHaveAttribute("data-basis", "TRANSCRIBED");
      await expect(measure.reading).toHaveAttribute("data-source", NOTE);
      await expect(measure.confirm).toBeVisible();
      await expect(measure.quantity, "the blinding is offered and the gate publishes it (I-384)").toHaveAttribute("data-arm", "published");
      previewed = await heldAttribute(measure.quantity, "data-value", "the blinding's previewed figure");
      expect(previewed, "the card states the gate's figure").not.toBeNull();
      await checkpoint(page, testInfo, "j-000/manual-card");

      await measure.confirm.click();
      await expect(measure.card, "Confirm records and the card closes").toHaveCount(0);
      await expect(measure.draft, "the outline clears; the tool stays armed").toHaveAttribute("data-state", "idle");
      await expect(page.getByTestId(TESTIDS.viewer.toolArea)).toHaveAttribute("aria-pressed", "true");
    }

    // 6. The line the measure run published: one slab · blinding line, at the card's figure.
    const takeoff = new STakeoffPage(page);
    await expect
      .poll(
        async () => {
          await takeoff.open(run.tenantId, projectId);
          await takeoff.narrow("class", SLAB);
          await takeoff.narrow("kind", BLINDING);
          return takeoff.shownLines();
        },
        { message: "the campaign's measure run publishes the hand measurement's one line", timeout: PUBLISH_BUDGET_MS, intervals: [2_000, 5_000] },
      )
      .toBe(1);
    const total = await heldAttribute(takeoff.linesTotal, "data-value", "the blinding lines' total");
    if (previewed !== null) expect(total, "the published line is the figure the QS confirmed").toBe(previewed);
    else expect(Number(total), "a measurement standing from an earlier run still bills").toBeGreaterThan(0);
    const lineId = await heldAttribute(takeoff.lines.locator('[role="row"][data-line]').first(), "data-line", "the blinding line's id");
    await testInfo.attach("manual-line", { body: `line ${lineId ?? "(none)"} = ${total ?? "(none)"} m³`, contentType: "text/plain" });

    // …and the draft BOQ lists it.
    const boq = new SBoqPage(page);
    await boq.open(run.tenantId, projectId);
    await settled(page);
    // TEST_AMENDED (the leg's first walk, s-boq I-528): a row of the draft is an ITEM — the register's
    // sum for one description and level, rounded once — and only a line the taxonomy could not place
    // is kept as a row of its own naming its line. The hand line is classified, so the draft lists it
    // as the slab · blinding item it alone makes up, at its figure stated once.
    const item = page.locator(`[data-testid="${TESTIDS.boq.line}"][data-class="${SLAB}"][data-kind="${BLINDING}"]`);
    await expect(item, "the draft BOQ lists the hand measurement as its slab · blinding item").toHaveCount(1);
    await expect(item, "summed from that one line").toHaveAttribute("data-members", "1");
    const stated = await heldAttribute(item, "data-quantity", "the item's figure");
    expect(stated !== null && withinHalfUnit(stated, total ?? ""), `the item states the line's ${String(total)} m³ once rounded (${String(stated)})`).toBe(true);
  });
});
