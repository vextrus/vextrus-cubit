/**
 * J-000 SEGMENTS: ask the drawings a question
 *
 * The fourth of AM-17's M4 segments — AM-09 §3's "a question asked of the drawings", X-7 — walked on
 * the F-RCC6-BNBC project the M3 legs measured (`bnbcMeasured`), the way a quantity surveyor asks:
 * from ⌘K first, typing a question anywhere in the project and taking "Ask the drawings" (the
 * command palette's I-679, S-Ask's I-402), then in the ask screen's own band.
 *
 * It walks, in order: a count ("How many pile caps are there?"); a quantity by storey (the column
 * concrete on GF); a sheet question (which sheet holds the column schedule); a click from the count's
 * figure to the drawing, where the viewer selects every cap it counts; and one named refusal (a cost,
 * ASK_ESTIMATE_NOT_BUILT). The questions are `tests/ai/ask/golden-questions.ts`'s — one home, which
 * the unit lane proves over the J-000 read-back to be read by the grammar with no model asked (s-ask
 * §6, I-680), so no recording ties this leg to a register M3 keeps moving.
 *
 * Every figure the walk expects is read off the store as the product states it — the register's own
 * count line and exact footer, narrowed as a reader narrows it — never a constant: the cap count
 * against the register's cap concrete lines (one per registered cap, which the unit lane proves on
 * the read-back), the storey's quantity against the footer on that storey.
 *
 * THE LAW. C-13 (cubit.bible.xml:800). L-AI-01 (:263): one path, replayed from fixtures; this leg asks
 * nothing a fixture answers. L-AI-03 (:265): the model may "answer questions with citations" and
 * never writes a register row. R-AI-003 (:558): every number in an answer is a query result rendered
 * by the formatter. X-7 (:662): every number clickable back to a sheet or a row (s-ask I-404).
 *
 * Nothing here measures time (AM-10 §3).
 */
import Decimal from "decimal.js";
import { expect, test } from "@playwright/test";
import { GOLDEN_ASK, GOLDEN_ASK_STOREY } from "../../../ai/ask/golden-questions";
import { CommandPalettePage } from "../../pages/command-palette.page";
import { SAskPage } from "../../pages/s-ask.page";
import { STakeoffPage } from "../../pages/s-takeoff.page";
import { SViewerPage, VIEWER_BUDGETS } from "../../viewer/s-viewer.page";
import { TESTIDS } from "../../../../src/ui/testids";
import { checkpoint } from "../../support/checkpoint";
import { everyAttribute, heldAttribute } from "../../support/retrying-read";
import { settled } from "../../support/settled";
import { bnbcMeasured, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

/** The register's words for what the leg reads it on (the catalogue's class and kind ids). */
const PILE_CAP = "pile_cap";
const COLUMN = "column";
const RCC_CONCRETE = "rcc.concrete";

/** Exact decimals, at a precision no sum here reaches — a figure never touches a float (B-07). */
const Exact = Decimal.clone({ precision: 60 });

test.describe.serial("J-000 — Golden Path: M4's question of the drawings (AM-09 §3, AM-17)", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m4-ask-the-drawings: the QS asks the BNBC set a count from ⌘K, a storey's quantity and a sheet question, clicks the count to the drawing, and meets a named refusal", async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    const run = await bnbcMeasured(page);
    const tenantId = run.tenantId;
    const projectId = run.bnbc.projectId;
    const takeoff = new STakeoffPage(page);
    const palette = new CommandPalettePage(page);
    const ask = new SAskPage(page);
    const viewer = new SViewerPage(page);

    /* --- what the register states, read as a reader reads it: the figures the answers must match --- */
    await takeoff.open(tenantId, projectId);
    await settled(page);
    await takeoff.narrow("class", PILE_CAP);
    await takeoff.narrow("kind", RCC_CONCRETE);
    const caps = await takeoff.kept(`${PILE_CAP} × ${RCC_CONCRETE}`);
    expect(caps.shown, "the register holds the measured caps' concrete lines").toBeGreaterThan(0);
    await takeoff.narrow("class", COLUMN);
    await takeoff.narrow("level", GOLDEN_ASK_STOREY);
    const storey = await takeoff.kept(`${COLUMN} × ${RCC_CONCRETE} at ${GOLDEN_ASK_STOREY}`);
    expect(storey.total, `the register states a column concrete figure on ${GOLDEN_ASK_STOREY}`).not.toBeNull();

    /* --- (1) a count, asked from ⌘K where the reader stands: "Ask the drawings: …" --- */
    await expect(ask.crumbPage, "the register has hydrated and claimed its crumb").toHaveText(/.+/u);
    await palette.openWithChord();
    await palette.search(GOLDEN_ASK.count.question);
    await expect(palette.askRow, "inside a project, the palette offers the words typed as a question to its drawings").toHaveCount(1);
    await expect(palette.askRow).toHaveAttribute("data-kind", "ask");
    await expect(palette.askRow, "naming the question as typed").toContainText(GOLDEN_ASK.count.question);
    await palette.askRow.click();
    await page.waitForURL(/takeoff\/ask/u);
    await expect(ask.screen, "the ask screen stands").toBeVisible();
    await expect(ask.answers, "the question the palette carried is asked once, on arrival").toHaveCount(1);
    await expect(ask.screen).not.toHaveAttribute("data-answering", "true");
    await settled(page);
    const counted = ask.newest;
    await expect(ask.question(counted), "the thread keeps the words asked").toContainText(GOLDEN_ASK.count.question);
    await expect(counted, "the count is answered").toHaveAttribute("data-answer", "answered");
    await expect(counted, "by the grammar — no model was asked").toHaveAttribute("data-routed-by", "GRAMMAR");
    await expect(counted).toHaveAttribute("data-intent", GOLDEN_ASK.count.intent);
    const count = ask.figures(counted).first();
    await expect(count, "the count is the register's caps, one concrete line each").toHaveAttribute("data-value", String(caps.shown));

    /* --- (2) a quantity by storey: the register footer's figure on that storey --- */
    const measured = await ask.ask(GOLDEN_ASK.storey.question);
    await settled(page);
    await expect(measured, "the storey's quantity is answered, whole or saying what it leaves out").toHaveAttribute("data-answer", /^(answered|partial)$/u);
    await expect(measured).toHaveAttribute("data-routed-by", "GRAMMAR");
    await expect(measured).toHaveAttribute("data-intent", GOLDEN_ASK.storey.intent);
    const figure = ask.figures(measured).first();
    const stated = (await heldAttribute(figure, "data-value")) ?? "";
    expect(new Exact(stated).equals(new Exact(storey.total as string)), `the answer's ${stated} is the register footer's ${String(storey.total)} on ${GOLDEN_ASK_STOREY}`).toBe(true);

    /* --- (3) a sheet question: the schedule's sheet, linked to its caption on the drawing --- */
    const sheet = await ask.ask(GOLDEN_ASK.sheet.question);
    await settled(page);
    await expect(sheet, "the sheet question is answered").toHaveAttribute("data-answer", "answered");
    await expect(sheet).toHaveAttribute("data-routed-by", "GRAMMAR");
    await expect(sheet).toHaveAttribute("data-intent", GOLDEN_ASK.sheet.intent);
    const sheetLinks = await everyAttribute(ask.body(sheet).getByTestId(TESTIDS.evidence.link), "href", "the sheets the schedule's caption stands on", { min: 1 });
    for (const href of sheetLinks) expect(href, "each sheet named opens the viewer on the caption").toContain(`/t/${tenantId}/p/${projectId}/viewer/`);

    /* --- (4) one named refusal: a cost is never answered as a quantity --- */
    const priced = await ask.ask(GOLDEN_ASK.refused.question);
    await settled(page);
    await expect(priced, "a cost is refused").toHaveAttribute("data-answer", "refused");
    await expect(priced).toHaveAttribute("data-code", GOLDEN_ASK.refused.code);
    await expect(ask.refusal(priced), "by the registered refusal, in its own words").toHaveAttribute("data-code", GOLDEN_ASK.refused.code);
    await expect(ask.answers, "four answers kept, newest first").toHaveCount(4);
    await checkpoint(page, testInfo, "j-000/bnbc-ask");

    /* --- (5) the count's figure, clicked to the drawing: every cap it counts, selected there --- */
    const capsFigure = ask.figures(ask.answers.last()).first();
    const capsHref = (await heldAttribute(capsFigure, "href")) ?? "";
    expect(capsHref, "the caps stand on one sheet, so the figure opens the viewer there").toContain(`/t/${tenantId}/p/${projectId}/viewer/`);
    await capsFigure.click();
    await page.waitForURL(/\/viewer\//u);
    await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await settled(page);
    await expect(viewer.missingKeys, "every key the figure named stands on this sheet").toHaveCount(0);
    await expect(viewer.screen, "the camera flew to the caps counted").toHaveAttribute("data-flyto-flight", /^[1-9]\d*$/u);
  });
});
