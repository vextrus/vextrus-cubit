/**
 * S-Levels, as the journeys walk it (docs/design/s-levels.md §7's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape, and nothing here judges the product. The Builder may edit
 * this file (test contract) — in particular, to read the ids off `src/ui/testids.ts` once the screen
 * publishes its group there, which is where they are spelled for the product itself.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { heldAttribute } from "../support/retrying-read";

/** The address this screen answers at (Decision §7, test contract). */
export const S_LEVELS = Object.freeze({
  levels: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/levels`,
} as const);

/**
 * The ids this screen carries, read from `src/ui/testids.ts` — the product's one home for them, now
 * that the screen publishes its group there (AM-09 §1). The shape is kept so every locator below
 * reads as the closed test contract spells it.
 */
export const LEVELS_IDS = Object.freeze({
  ...TESTIDS.levels,
  navLevels: TESTIDS.takeoff.navLevels,
} as const);

/** The three standings, and the two codes a level's height is read under (L-MEA-07). */
export const AGREED = "AGREED";
export const SUSPENDED = "SUSPENDED";
export const NONE = "NONE";
export const STOREY_HEIGHT_CONTESTED = "STOREY_HEIGHT_CONTESTED";
export const STOREY_HEIGHT_UNSTATED = "STOREY_HEIGHT_UNSTATED";

const id = (name: string): string => `[data-testid="${name}"]`;

export class SLevelsPage {
  constructor(private readonly page: Page) {}

  /** Open the levels address directly and wait for the screen to stand. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_LEVELS.levels(tenantId, projectId));
    await expect(this.screen, "the levels screen renders for a project the workspace holds").toBeVisible();
  }

  /** Reach the stack the way a reader does: the takeoff lane's own third tab. */
  async openThroughNav(): Promise<void> {
    await this.navLevels.click();
    await this.page.waitForURL(/takeoff\/levels/);
    await expect(this.screen, "the tab lands on the levels screen").toBeVisible();
  }

  get screen(): Locator {
    return this.page.getByTestId(LEVELS_IDS.screen);
  }
  get navLevels(): Locator {
    return this.page.getByTestId(LEVELS_IDS.navLevels);
  }
  get navRegister(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.navRegister);
  }
  get navCoverage(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.navCoverage);
  }

  /* --- the grid --- */
  get grid(): Locator {
    return this.page.getByTestId(LEVELS_IDS.grid);
  }
  get rows(): Locator {
    return this.grid.getByTestId(LEVELS_IDS.row);
  }
  /** One row, by the label the level carries — what a reader points at. */
  row(levelId: string): Locator {
    return this.grid.locator(`${id(LEVELS_IDS.row)}[data-level="${levelId}"]`);
  }
  /** One row, by where it physically stands. */
  rowAtOrdinal(ordinal: number): Locator {
    return this.grid.locator(`${id(LEVELS_IDS.row)}[data-ordinal="${ordinal}"]`);
  }
  /** One roll-up cell of a row, by the kind its lines bear. */
  rollup(row: Locator, kind: string): Locator {
    return row.locator(`${id(LEVELS_IDS.rollup)}[data-kind="${kind}"]`);
  }
  get empty(): Locator {
    return this.page.getByTestId(LEVELS_IDS.empty);
  }
  /** How many rows the grid says it drew — the RENDERED contract a read waits on. */
  async rowsRendered(): Promise<string | null> {
    return heldAttribute(this.grid, "data-rows-rendered");
  }

  /* --- the one primary, and the insert form it opens --- */
  get insert(): Locator {
    return this.page.getByTestId(LEVELS_IDS.insert);
  }
  get insertLabel(): Locator {
    return this.page.getByTestId(LEVELS_IDS.insertLabel);
  }
  get insertOrdinal(): Locator {
    return this.page.getByTestId(LEVELS_IDS.insertOrdinal);
  }
  get insertConfirm(): Locator {
    return this.page.getByTestId(LEVELS_IDS.insertConfirm);
  }

  /** Propose one level: open the form, write what it is called and where it stands, and preview. */
  async proposeLevel(label: string, ordinal: number): Promise<void> {
    await this.insert.click();
    await this.insertLabel.fill(label);
    await this.insertOrdinal.fill(String(ordinal));
    await this.insertConfirm.click();
  }

  /* --- the shell's one inspector --- */
  get inspector(): Locator {
    return this.page.getByTestId(LEVELS_IDS.inspector);
  }
  get readings(): Locator {
    return this.inspector.getByTestId(LEVELS_IDS.reading);
  }
  /** The reading of one basis, whatever it was written as. */
  reading(basis: string): Locator {
    return this.inspector.locator(`${id(LEVELS_IDS.reading)}[data-basis="${basis}"]`);
  }
  /** Every reading a later reading under the same key superseded (L-MEA-07). */
  get supersededReadings(): Locator {
    return this.inspector.locator(`${id(LEVELS_IDS.reading)}[data-superseded="true"]`);
  }
  get repudiate(): Locator {
    return this.inspector.getByTestId(LEVELS_IDS.repudiate);
  }
  get authorHeight(): Locator {
    return this.inspector.getByTestId(LEVELS_IDS.authorHeight);
  }

  /** Read a height into the form and press the door that previews it. */
  async authorStoreyHeight(value: string, unit: string, basis: string): Promise<void> {
    await this.inspector.getByTestId(LEVELS_IDS.heightValue).fill(value);
    await this.chooseIn(this.inspector.getByTestId(LEVELS_IDS.heightUnit), unit);
    await this.chooseIn(this.inspector.getByTestId(LEVELS_IDS.heightBasis), basis);
    await this.authorHeight.click();
  }

  /** Choose one value at a shipped Select: it opens, and the option is clicked by its own value. */
  async chooseIn(control: Locator, value: string): Promise<void> {
    await control.click();
    await this.page.locator(`[role="option"][data-value="${value}"], [role="option"][value="${value}"]`).first().click();
  }

  /* --- the index rail --- */
  get ranges(): Locator {
    return this.page.getByTestId(LEVELS_IDS.ranges);
  }
  rangeRow(viewKey: string): Locator {
    return this.ranges.locator(`${id(LEVELS_IDS.rangeRow)}[data-view="${viewKey}"]`);
  }

  /* --- the one ConsequenceDialog (R-UI-021, the pattern's own ids) --- */
  get dialog(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.dialog);
  }
  get dialogSubjects(): Locator {
    return this.dialog.getByTestId(TESTIDS.consequence.subjectRow);
  }
  get dialogLines(): Locator {
    return this.dialog.getByTestId(TESTIDS.consequence.effectLines);
  }
  get dialogSignatures(): Locator {
    return this.dialog.getByTestId(TESTIDS.consequence.effectSignatures);
  }
  get dialogDigestLine(): Locator {
    return this.dialog.getByTestId(TESTIDS.consequence.digestLine);
  }
  get dialogConfirm(): Locator {
    return this.dialog.getByTestId(TESTIDS.consequence.confirm);
  }

  /** Confirm the act the dialog shows, and wait for it to close. */
  async confirmAct(): Promise<void> {
    await expect(this.dialog, "a door opens a preview of exactly what it changes, and commits nothing itself").toBeVisible();
    await this.dialogConfirm.click();
    await expect(this.dialog, "and the dialog closes once the act is carried").not.toBeVisible();
  }

  /** What the frame paints differently on every run, masked for the design pictures. */
  masks(): Locator[] {
    return [
      this.page.locator(testIdSelector(TESTIDS.shell.breadcrumb)),
      this.page.locator(testIdSelector(TESTIDS.shell.user)),
      this.page.locator(testIdSelector(TESTIDS.shell.tenantSwitcher)),
      this.page.locator(id(TESTIDS.consequence.digestLine)),
    ];
  }
}
