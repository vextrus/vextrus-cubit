/**
 * J-031 — the level stack is edited: a level is inserted mid-stack with its consequences, a storey
 * height is contested and the lines measured through it publish as partial, and a re-affirmation
 * under the same key settles it (R-TO-033, L-MEA-07, L-QTY-02, R-UI-021, docs/design/s-levels.md).
 *
 * The journey walks the product as a person does: from the register, through the third tab this
 * increment adds, into the stack; through the one primary and its consequence dialog; into the
 * inspector, where a height is read and then read again; and back onto the roll-up, which states the
 * stored lines and never a figure this screen derived.
 *
 * The three design checkpoints are taken here and nowhere else; the picture itself is the gate's to
 * re-take (v16.2 §1).
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { STakeoffPage } from "../pages/s-takeoff.page";
import { checkpoint } from "../support/checkpoint";
import { heldAttribute } from "../support/retrying-read";

/** The width the frame paints the rail, the grid and the inspector side by side at (R-UI-030). */
test.use({ viewport: { width: 1440, height: 900 } });

/** The kind the staged campaign's lines are published under, and the act types this walk confirms. */
const RCC_CONCRETE = "rcc.concrete";
const INSERT_LEVEL = "INSERT_LEVEL";
const AUTHOR_STOREY_HEIGHT = "AUTHOR_STOREY_HEIGHT";

/** The readings this walk makes, and the standings they leave behind (L-MEA-07). */
const ENTERED = "ENTERED";
const AGREED = "AGREED";
const SUSPENDED = "SUSPENDED";
const STOREY_HEIGHT_CONTESTED = "STOREY_HEIGHT_CONTESTED";
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The level the walk inserts, where it stands, and the level it pushes up (AC-4). */
const INSERTED = "MEZZ";
const INSERTED_ORDINAL = 1;

/** The height GF is contested at, and the metres the re-affirmation settles it on. */
const CONTESTED_VALUE = "3.2";
const SETTLED_VALUE = "3.048";
const METRE = "m";

/** The screen's page object, through the surface this journey drives (test contract). */
interface LevelsPage {
  readonly navLevels: Locator;
  readonly navRegister: Locator;
  readonly navCoverage: Locator;
  openThroughNav(): Promise<void>;
  open(tenantId: string, projectId: string): Promise<void>;
  readonly screen: Locator;
  readonly grid: Locator;
  readonly rows: Locator;
  readonly ranges: Locator;
  readonly inspector: Locator;
  readonly readings: Locator;
  readonly supersededReadings: Locator;
  readonly dialog: Locator;
  readonly dialogSubjects: Locator;
  readonly dialogLines: Locator;
  readonly dialogDigestLine: Locator;
  readonly dialogConfirm: Locator;
  row(levelId: string): Locator;
  rowAtOrdinal(ordinal: number): Locator;
  rollup(row: Locator, kind: string): Locator;
  reading(basis: string): Locator;
  proposeLevel(label: string, ordinal: number): Promise<void>;
  authorStoreyHeight(value: string, unit: string, basis: string): Promise<void>;
  confirmAct(): Promise<void>;
  masks(): Locator[];
}

/**
 * The staging this journey is walked over (test contract: `tests/e2e/takeoff/levels-stage.ts`,
 * `stageLevels(page, { label })` / `publishLines(staged)`): the register stage's project with GF
 * (ordinal 0, one TRANSCRIBED reading written as `3048` `mm` by a SECOND actor) and L1 (ordinal 1),
 * a register object under the placeholder label `MEZZ`, and NO published lines — the campaign's
 * lines are published through the gate, by `publishLines`, AFTER the contest.
 */
interface StagedLevels {
  tenantId: string;
  projectId: string;
  /** The ground floor, whose height this walk contests and then settles. */
  groundLevelId: string;
  /** The level standing at ordinal 1 before the insert, which the insert moves to 2. */
  upperLevelId: string;
}

interface LevelsStage {
  stageLevels(page: Page, options: { label: string }): Promise<StagedLevels>;
  /** Publishes the campaign's lines through the gate, and answers the line ids it published. */
  publishLines(staged: StagedLevels): Promise<string[]>;
}

/**
 * The page object and the stage are loaded when the walk begins rather than when the file is
 * collected: a journey that cannot be COLLECTED takes every other journey down with it, and J-000
 * runs on this tree as it stands. Until this screen's own surfaces land, J-031 fails alone.
 */
async function surfaces(page: Page): Promise<{ levels: LevelsPage; stage: LevelsStage }> {
  // The stage is named rather than spelled inline: it is the Builder's to deliver under the test
  // contract's own names, and a specifier this file resolved at compile time would make the whole
  // journey lane a type error until it lands.
  const specifier = "../takeoff/levels-stage";
  const stage = (await import(/* @vite-ignore */ specifier)) as unknown as LevelsStage;
  const pages = (await import("../pages/s-levels.page")) as unknown as { SLevelsPage: new (page: Page) => LevelsPage };
  return { levels: new pages.SLevelsPage(page), stage };
}

test.describe("J-031 — the level stack editor", () => {
  test("J-031: a level is inserted with its consequences, a storey height is contested, and a re-affirmation settles it", async ({ page }, testInfo) => {
    const { levels, stage } = await surfaces(page);
    const staged = await stage.stageLevels(page, { label: "j031-levels" });
    const takeoff = new STakeoffPage(page);

    /* --- the third tab of the lane, beside the two that stood there (AC-4) --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    await expect(levels.navRegister, "the register tab stands where it stood").toBeVisible();
    await expect(levels.navCoverage, "and the coverage tab beside it").toBeVisible();
    await expect(levels.navLevels, "and the levels tab this increment adds, third").toBeVisible();
    await levels.openThroughNav();
    await expect(levels.screen, "the level stack reads beneath the takeoff tabs row").toHaveAttribute("data-state", /ready|partial/);
    await expect(levels.navLevels, "and the tab for the address in the browser says so").toHaveAttribute("aria-current", "page");
    await expect(levels.ranges, "the campaign's index stands beside the grid, never under it (I-240)").toBeVisible();
    await expect(levels.inspector, "and nothing is selected, so no inspector stands at all (R-UI-080)").toHaveCount(0);

    /* --- the insert, whole: what it proposes, what it moves, and what it carries (AC-4) --- */
    await levels.proposeLevel(INSERTED, INSERTED_ORDINAL);
    await expect(levels.dialog, "the one primary previews rather than committing (R-UI-021)").toHaveAttribute("data-act-type", INSERT_LEVEL);

    const subjects = levels.dialogSubjects;
    await expect(subjects, "the proposed level, the live level it moves, and the object carried onto it").toHaveCount(3);
    await expect(subjects.filter({ hasText: INSERTED }), `the level proposed at ordinal ${INSERTED_ORDINAL}`).toHaveCount(1);
    await expect(subjects.filter({ hasText: `ordinal:${INSERTED_ORDINAL + 1}` }), "and the level whose ordinal moves up one — an insert re-keys nothing (L-MEA-07)").toHaveCount(1);
    await expect(levels.dialogLines, "no line is published yet, so the act names none as re-deriving").toContainText("none");

    const digest = await heldAttribute(levels.dialogConfirm, "data-digest");
    expect(digest, "confirm is the act button, and it carries the digest of what was shown").toBeTruthy();
    await expect(levels.dialogDigestLine, "which is the digest the dialog states to the person confirming it").toContainText(String(digest).slice(0, 12));
    await levels.confirmAct();

    await expect(levels.rowAtOrdinal(INSERTED_ORDINAL), `${INSERTED} stands at ordinal ${INSERTED_ORDINAL}`).toContainText(INSERTED);
    await expect(levels.row(staged.upperLevelId), "and the level that stood there moved up one").toHaveAttribute("data-ordinal", String(INSERTED_ORDINAL + 1));

    await checkpoint(page, testInfo, "stack");
    await expect(page).toHaveScreenshot(["j-031-levels", "stack.png"], { mask: levels.masks(), animations: "disabled" });

    /* --- the contest: a second reader's height, disagreeing with the transcribed one (AC-4) --- */
    const ground = levels.row(staged.groundLevelId);
    await ground.click();
    await expect(levels.inspector, "the level a reader chose fills the shell's one inspector").toHaveAttribute("data-level", staged.groundLevelId);
    await expect(levels.readings, "which lists the reading the stage transcribed from the sheet").toHaveCount(1);

    await levels.authorStoreyHeight(CONTESTED_VALUE, METRE, ENTERED);
    await expect(levels.dialog, "reading a height is an act, and opens the same one dialog").toHaveAttribute("data-act-type", AUTHOR_STOREY_HEIGHT);
    await levels.confirmAct();

    await expect(ground, "two readings that disagree suspend the height").toHaveAttribute("data-standing", SUSPENDED);
    await expect(ground, "and the level reports the absence under the code a line would").toHaveAttribute("data-code", STOREY_HEIGHT_CONTESTED);
    await expect(ground, "a suspended height stands at no figure at all (I-242)").toHaveAttribute("data-metres", "");
    await expect(levels.readings, "the inspector lists both competing readings — nothing is overwritten (R-TO-051)").toHaveCount(2);

    /* --- the lines, published through the gate AFTER the contest: the roll-up reads them (AC-4) --- */
    const published = await stage.publishLines(staged);
    expect(published.length, `the campaign published its ${RCC_CONCRETE} lines: ${JSON.stringify(published)}`).toBeGreaterThan(0);
    // The read after the gate is a fresh read of THIS increment's own address — never a bare reload,
    // whose target no assertion here names (the root is another increment's screen).
    await levels.open(staged.tenantId, staged.projectId);
    await expect(levels.screen, "the stack reads again once the campaign has measured").toBeVisible();

    const rollup = levels.rollup(levels.row(staged.groundLevelId), RCC_CONCRETE);
    await expect(rollup, "a line measured through a contested height is published as partial, never complete (L-QTY-02)").toHaveAttribute("data-coverage", PARTIAL_DECLARED);
    await expect(rollup, "and enumerates what it omitted, by name").toHaveAttribute("data-code", STOREY_HEIGHT_CONTESTED);

    await levels.row(staged.groundLevelId).click();
    await checkpoint(page, testInfo, "contested");
    await expect(page).toHaveScreenshot(["j-031-levels", "contested.png"], { mask: levels.masks(), animations: "disabled" });

    /* --- the re-affirmation: the same key, read again, which is the only thing that settles it --- */
    await levels.authorStoreyHeight(SETTLED_VALUE, METRE, ENTERED);
    await expect(levels.dialog, "the re-affirmation is the same act, under the same key").toHaveAttribute("data-act-type", AUTHOR_STOREY_HEIGHT);
    for (const lineId of published) {
      await expect(levels.dialogLines, `and it names the stored line ${lineId} as one that re-derives (R-TO-020)`).toContainText(lineId);
    }
    await levels.confirmAct();

    const settled = levels.row(staged.groundLevelId);
    await expect(settled, "the readings now agree on the metres they carry to").toHaveAttribute("data-standing", AGREED);
    await expect(settled, `so the level stands at ${SETTLED_VALUE} m`).toHaveAttribute("data-metres", SETTLED_VALUE);
    await expect(
      levels.supersededReadings,
      "and the figure the same reader wrote first is superseded — superseded, never erased",
    ).toHaveCount(1);
    await expect(levels.rollup(settled, RCC_CONCRETE), "while the roll-up still states the STORED lines: this screen re-derives nothing (I-241)").toHaveAttribute(
      "data-coverage",
      PARTIAL_DECLARED,
    );

    await checkpoint(page, testInfo, "reaffirmed");
    await expect(page).toHaveScreenshot(["j-031-levels", "reaffirmed.png"], { mask: levels.masks(), animations: "disabled" });
  });
});
