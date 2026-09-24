/**
 * J-043 — ask the drawings: a quantity surveyor opens the takeoff lane's seventh tab, asks in their
 * own words, and reads answers whose every figure links back to the entities it was read from; a
 * reading the question leaves open is put back to them, and a question about cost is refused by name
 * (R-AI-003, X-7, docs/design/s-ask.md §6).
 *
 * The walk is a customer's: a tab is clicked, a question is typed, a link is followed, Back is
 * pressed. Nothing is staged mid-walk. Every question but the last is read by the grammar — no model
 * is asked; the last is a paraphrase no cue of the grammar reads, routed by Jev from the recording
 * made over this stage's transcription (s-ask I-625), so the walk is what holds that transcription
 * to the stage. The three design checkpoints are taken here and nowhere else; the pictures are the
 * gate's to re-take.
 *
 * Nothing here measures time (AM-10 §3).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Request } from "@playwright/test";
import { formatUserFigure } from "../../../src/core/format";
import { statedAt } from "../../../src/modules/takeoff/bbs-ui/present";
import { fill, strings } from "../../../src/ui/strings";
import { TESTIDS } from "../../../src/ui/testids";
import { SAskPage } from "../pages/s-ask.page";
import { STakeoffPage } from "../pages/s-takeoff.page";
import { VIEWER_BUDGETS, SViewerPage } from "../viewer/s-viewer.page";
import { stageAsk } from "../takeoff/ask-stage";
import { MARKS } from "../takeoff/register-stage";
import { checkpoint } from "../support/checkpoint";
import { emulateTheme, restoreLaneTheme } from "../support/lane-theme";
import { everyAttribute, heldAttribute, steadyText } from "../support/retrying-read";
import { signInAsSeededTenant } from "../support/seeded-session";
import { settled } from "../support/settled";

/**
 * The paraphrase the walk has Jev route (s-ask I-625): the first of the recorded corpus, read off
 * the corpus itself so the walk asks exactly what was recorded over this stage's transcription.
 */
const ROUTED_PARAPHRASE: string = (JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../ai/ask/paraphrases.json"), "utf8")) as { paraphrases: { question: string }[] }).paraphrases[0]?.question ?? "";

/** The width the frame paints the lane at (R-UI-030). */
test.use({ viewport: { width: 1440, height: 900 } });

/** A server action is a POST carrying its action id — how a question leaves the browser. */
function isAction(request: Request): boolean {
  return request.method() === "POST" && request.headers()["next-action"] !== undefined;
}

test.describe("J-043 — ask the drawings", () => {
  test("J-043: four cited answers — one of them in the QS's own words, routed by Jev — and one named refusal, each figure one click from the members it counts", async ({ page }, testInfo) => {
    await signInAsSeededTenant(page, testInfo.parallelIndex);
    const staged = await stageAsk(page, { label: "j043" });

    const takeoff = new STakeoffPage(page);
    const ask = new SAskPage(page);
    const viewer = new SViewerPage(page);

    /* --- the seventh tab: clicked, never typed --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    await settled(page);
    await expect(ask.navAsk, "the takeoff lane carries a seventh tab for asking the drawings").toBeVisible();
    await expect(ask.navAsk, "and it says what the crumb says").toHaveText(strings.takeoff_nav_ask);
    const tabs = await everyAttribute(ask.takeoffNav.getByRole("link"), "data-testid", "the takeoff lane's tabs", { min: 2 });
    expect(tabs.indexOf(TESTIDS.takeoff.navAsk), `the ask tab stands immediately after the bar schedule — the lane reads ${tabs.join(" · ")}`).toBe(tabs.indexOf(TESTIDS.takeoff.navBbs) + 1);
    await ask.openThroughNav();
    await settled(page);
    expect(await steadyText(ask.crumbPage, "the page crumb")).toBe(strings.takeoff_nav_ask);
    await expect(ask.navAsk, "the tab a reader is standing on says so").toHaveAttribute("aria-current", "page");

    /* --- (1) the empty state, and the example built from this project's own register --- */
    expect(await ask.state(), "nothing asked yet in this tab").toBe("empty");
    expect(await heldAttribute(ask.revision, "data-value"), "the tabs aside names the revision every answer reads").toBe(staged.setRevisionId);
    const firstMark = [...MARKS].sort()[0] as string;
    await expect(ask.example, "the example asks what this register can answer").toHaveText(fill(strings.ask_example_count, { classes: strings.ask_class_column_other, mark: firstMark, level: staged.level }));
    await expect(ask.main.locator("select, input[type=date]"), "no native select and no native date input (R-UI-083)").toHaveCount(0);
    await checkpoint(page, testInfo, "s-ask/empty");
    await expect.soft(page, "empty.png pictures the screen before anything is asked").toHaveScreenshot(["s-ask", "empty.png"], { mask: ask.masks(), animations: "disabled" });

    /* --- (2) a count, answered by the grammar, its figure followed to the members it counts --- */
    const counted = await ask.ask(`How many ${staged.countedMark} columns are on ${staged.level}?`);
    await settled(page);
    await expect(counted, "the count is answered").toHaveAttribute("data-answer", "answered");
    await expect(counted, "by the grammar — no model was asked").toHaveAttribute("data-routed-by", "GRAMMAR");
    await expect(counted).toHaveAttribute("data-intent", "COUNT");
    const count = ask.figures(counted).first();
    await expect(count, "the count is a figure inside an EvidenceLink").toHaveAttribute("data-value", "1");
    await expect(ask.body(counted)).toContainText(fill(strings.ask_count, { count: "1", class: strings.ask_class_column_one, marked: fill(strings.ask_marked, { mark: staged.countedMark }), where: fill(strings.ask_where_level, { level: staged.level }) }));
    const countHref = (await heldAttribute(count, "href")) ?? "";
    expect(countHref, "one member on one sheet: the figure opens the viewer there").toContain(`/t/${staged.tenantId}/p/${staged.projectId}/viewer/`);
    expect(/[?&]v=/u.test(countHref), "with no camera, so the viewer flies to what it selects").toBe(false);

    await count.click();
    await page.waitForURL(/\/viewer\//u);
    await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await settled(page);
    await expect(viewer.missingKeys, "every key the figure named stands on this sheet").toHaveCount(0);
    await expect(viewer.screen, "the camera flew to the member counted").toHaveAttribute("data-flyto-flight", /^[1-9]\d*$/u);

    /* --- Back: the thread stands as it was, the origin marked, and nothing is asked again --- */
    const sent: Request[] = [];
    page.on("request", (request) => {
      if (isAction(request)) sent.push(request);
    });
    await page.goBack();
    await page.waitForURL(/takeoff\/ask$/u);
    await settled(page);
    await expect(ask.answers, "the thread stands as it was left").toHaveCount(1);
    await expect(ask.newest, "the answer the link was followed from wears the origin mark").toHaveAttribute("data-origin", "true");
    await expect(ask.figures(ask.newest).first()).toHaveAttribute("data-value", "1");
    expect(sent.length, "returning re-asked nothing: no question left the browser").toBe(0);

    /* --- (3) a quantity: the register's figure for the same lines, and what it leaves out --- */
    const measured = await ask.ask("What is the column concrete?");
    await settled(page);
    await expect(measured, "an answer that leaves a column out says so — partial, never hidden").toHaveAttribute("data-answer", "partial");
    const figure = ask.figures(measured).first();
    await expect(figure, "the exact figure is the register's own sum of the complete lines").toHaveAttribute("data-value", staged.columnConcrete);
    await expect(figure, "and its face is the register footer's, at the kind's three places").toHaveText(new RegExp(formatUserFigure(statedAt(staged.columnConcrete, 3)).replace(/[.,]/gu, "\\$&"), "u"));
    await expect(figure).toHaveAttribute("data-unit", "m3");
    await expect(ask.body(measured), "summed from the complete lines alone").toContainText(fill(strings.ask_lines_other, { lines: String(staged.completeLines) }));
    await expect(ask.partial(measured), "the column registered with no line is named").toContainText(staged.lineless);
    await expect(ask.partial(measured), "in the registry's words for why").toContainText(fill(strings.ask_partial_objects_one, { class: strings.ask_class_column_one }));
    await expect(ask.evidence(measured), "the answer names where its evidence stands").toBeVisible();

    /* --- (4) a level the stack does not spell: the reading is put back to the reader --- */
    const levelled = await ask.ask(`How many ${staged.countedMark} columns are on level 1?`);
    await settled(page);
    await expect(levelled, "\"level 1\" is never read silently").toHaveAttribute("data-answer", "clarify");
    const readings = ask.readings(levelled);
    await expect(readings, "only the count the stack holds is offered").toHaveCount(1);
    await expect(readings.first(), "and it names the level the stack holds").toContainText(staged.level);
    await expect(ask.readingNone(levelled)).toHaveText(strings.ask_reading_none);
    await readings.first().click();
    await expect(ask.screen).not.toHaveAttribute("data-answering", "true");
    await settled(page);
    await expect(ask.newest, "the choice answers in the same article").toHaveAttribute("data-answer", "answered");
    await expect(ask.newest, "routed by the person who chose it").toHaveAttribute("data-routed-by", "PERSON");
    await expect(ask.figures(ask.newest).first()).toHaveAttribute("data-value", "1");

    /* --- (5) a cost: refused by name, with the draft BOQ as where to go --- */
    const priced = await ask.ask("What will the column concrete cost?");
    await settled(page);
    await expect(priced, "a cost is never answered as a quantity").toHaveAttribute("data-answer", "refused");
    await expect(priced).toHaveAttribute("data-code", "ASK_ESTIMATE_NOT_BUILT");
    await expect(ask.refusal(priced), "the registered refusal, in its own words").toHaveAttribute("data-code", "ASK_ESTIMATE_NOT_BUILT");
    await expect(ask.refusalLink(priced), "and its evidence is the draft BOQ").toHaveAttribute("href", `/t/${staged.tenantId}/p/${staged.projectId}/takeoff/boq`);
    expect(await ask.state(), "the newest answer is refused, so the screen stands refused").toBe("refused");
    await expect(ask.answers, "four answers kept, newest first").toHaveCount(4);

    /* --- the asserted absences (§6) --- */
    await expect(ask.main.locator('[data-rendered-region="inspector"], [role="complementary"]'), "nothing here is selected, so no inspector and no second right column (R-UI-080)").toHaveCount(0);

    await checkpoint(page, testInfo, "s-ask/thread");
    await expect.soft(page, "thread.png pictures the thread a reader has asked").toHaveScreenshot(["s-ask", "thread.png"], { mask: ask.masks(), animations: "disabled" });

    await emulateTheme(page, "light");
    await settled(page);
    await checkpoint(page, testInfo, "s-ask/thread-light");
    await expect.soft(page, "thread-light.png pictures the same thread on the other paper").toHaveScreenshot(["s-ask", "thread-light.png"], { mask: ask.masks(), animations: "disabled" });
    await restoreLaneTheme(page, testInfo);
    await settled(page);

    /* --- (6) the QS's own words, no cue the grammar reads: Jev routes it, from its recorded answer --- */
    // Asked after the pictures, so the thread they hold is the grammar's alone — and in a cleared
    // conversation: beside an answered reading, words that name a subject and no intent are a
    // follow-up the grammar reads against it (§1 Follow-ups), and I-623 routes no follow-up. The
    // paraphrase was recorded as a question read on its own (I-625), so it is asked as one.
    await ask.clear.click();
    await expect(ask.answers, "the conversation cleared").toHaveCount(0);
    expect(await ask.state(), "and the screen stands empty again").toBe("empty");
    const routed = await ask.ask(ROUTED_PARAPHRASE);
    await settled(page);
    await expect(routed, "the paraphrase is answered, not refused").toHaveAttribute("data-answer", "answered");
    await expect(routed, "by the machine's reading").toHaveAttribute("data-routed-by", "MODEL");
    await expect(routed, "read as the count the words ask").toHaveAttribute("data-intent", "COUNT");
    await expect(routed, "naming the ledger row of the one call it cost").toHaveAttribute("data-call", /^[0-9a-f-]{36}$/u);
    await expect(ask.figures(routed).first(), "the same cited count the grammar gives").toHaveAttribute("data-value", "1");
    await expect(routed.getByTestId(TESTIDS.ask.understood), "and it says whose reading it is").toContainText(strings.ask_understood_machine);
    await expect(ask.answers, "the one answer the cleared conversation keeps").toHaveCount(1);
  });
});
