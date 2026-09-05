// S-Drawings, as a journey addresses it: the project's sheet index at
// `/t/{tenantId}/p/{projectId}/drawings` (docs/design/s-drawings.md §7). Locators only — every
// judgement stays in the journey, so the page object can never quietly decide whether the screen
// passed.
import { expect, type Locator, type Page } from "@playwright/test";

/** The test ids the screen's closed contract publishes (C-05). */
export const S_DRAWINGS = {
  index: "sheet-index",
  card: "sheet-card",
  thumbnail: "sheet-card-thumbnail",
  title: "sheet-card-title",
  number: "sheet-card-number",
  format: "sheet-card-format",
  scheme: "sheet-card-scheme",
  scale: "sheet-card-scale",
  views: "sheet-card-views",
  discipline: "sheet-card-discipline",
  fact: "sheet-fact",
  disciplineOption: "sheet-discipline-option",
  confirm: "sheet-confirm",
  search: "sheet-search",
  filterOption: "sheet-filter-option",
  empty: "sheets-empty",
  timeline: "job-timeline",
  timelineStep: "job-timeline-step",
  timelineStepTiming: "job-timeline-step-timing",
  jobsTray: "shell-jobs-tray",
  jobsTrayPanel: "shell-jobs-tray-panel",
  jobsTrayItem: "shell-jobs-tray-item",
  jobsTrayEmpty: "shell-jobs-tray-empty",
  groups: "offered-groups",
  group: "offered-group",
  groupCount: "offered-group-count",
  groupConfirm: "offered-group-confirm",
  dropzone: "dropzone",
  dropzoneInput: "dropzone-input",
  dropzoneItem: "dropzone-item",
  dialog: "consequence-dialog",
  dialogSubject: "consequence-subject-row",
  dialogDigest: "consequence-digest-line",
  dialogConfirm: "consequence-confirm",
  dialogStale: "consequence-stale-notice",
} as const;

/** The screen's address (the product's own `drawingsRoute`). */
export function drawingsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/drawings`;
}

export class SDrawingsPage {
  constructor(private readonly page: Page) {}

  private at(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  /**
   * Open the screen and return only once it stands. Every project route is served behind a Suspense
   * skeleton that carries none of the contract's ids, so a caller that returned on `goto` alone would
   * read the shell — the s-audit and s-members precedent is to wait for the screen's own furniture.
   */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(drawingsRoute(tenantId, projectId));
    await expect(this.search, "the sheets section stands: its search field is the screen, not the skeleton").toBeVisible();
    await expect(this.index.or(this.empty), "the index says what it holds, or says why it holds nothing").toBeVisible();
  }

  get index(): Locator {
    return this.at(S_DRAWINGS.index);
  }

  get cards(): Locator {
    return this.at(S_DRAWINGS.card);
  }

  get empty(): Locator {
    return this.at(S_DRAWINGS.empty);
  }

  get timeline(): Locator {
    return this.at(S_DRAWINGS.timeline);
  }

  get timelineSteps(): Locator {
    return this.at(S_DRAWINGS.timelineStep);
  }

  /** The elapsed-time cells, masked in a baseline: they are real time, and never the same twice. */
  get timelineTimings(): Locator {
    return this.at(S_DRAWINGS.timelineStepTiming);
  }

  /* --- the frame's global jobs tray, over the same jobs this screen started (R-UI-024, R-UI-030).
     Its handles live here rather than on the shell's page object, which the J-000 hotfix suite
     byte-freezes: this journey is the only one that drives the tray (shell-top-bar Decision §7). --- */

  get jobsTray(): Locator {
    return this.at(S_DRAWINGS.jobsTray);
  }

  get jobsTrayPanel(): Locator {
    return this.at(S_DRAWINGS.jobsTrayPanel);
  }

  get jobsTrayItems(): Locator {
    return this.at(S_DRAWINGS.jobsTrayItem);
  }

  get jobsTrayEmpty(): Locator {
    return this.at(S_DRAWINGS.jobsTrayEmpty);
  }

  /** The tray's item for one job kind, by the attribute the tray publishes it under. */
  jobsTrayItem(kind: string): Locator {
    return this.page.locator(`[data-testid="${S_DRAWINGS.jobsTrayItem}"][data-kind="${kind}"]`);
  }

  /** The items' elapsed-time cells, masked in a baseline: they are real time, never twice the same. */
  get jobsTrayTimings(): Locator {
    return this.jobsTrayItems.locator(".cx-jobs-tray-item-timing");
  }

  /** Open the tray and return only once its panel stands. */
  async openJobsTray(): Promise<void> {
    await this.jobsTray.click();
    await this.jobsTrayPanel.waitFor({ state: "visible" });
  }

  get dropzone(): Locator {
    return this.at(S_DRAWINGS.dropzone);
  }

  get dropzoneItems(): Locator {
    return this.at(S_DRAWINGS.dropzoneItem);
  }

  get search(): Locator {
    return this.at(S_DRAWINGS.search);
  }

  filterOption(value: string): Locator {
    return this.page.locator(`[data-testid="${S_DRAWINGS.filterOption}"][data-value="${value}"]`);
  }

  get groups(): Locator {
    return this.at(S_DRAWINGS.group);
  }

  /** The offered group keyed on a proposed discipline. */
  groupFor(discipline: string): Locator {
    return this.page.locator(`[data-testid="${S_DRAWINGS.group}"][data-discipline="${discipline}"]`);
  }

  /**
   * The card of one sheet, addressed by the layout it is a reading of: a sheet id is
   * `{ingestId}:{layoutName}`, so the layout's own name is the end of it. Found this way rather than
   * by title because model space carries every sheet's annotations and can propose a paper sheet's
   * title as its own.
   */
  cardForLayout(layoutName: string): Locator {
    return this.page.locator(`[data-testid="${S_DRAWINGS.card}"][data-sheet$=":${layoutName}"]`);
  }

  /** One cell of a card, by the contract's own id. */
  cell(card: Locator, testId: string): Locator {
    return card.locator(`[data-testid="${testId}"]`);
  }

  get dialog(): Locator {
    return this.at(S_DRAWINGS.dialog);
  }

  /** Hand the shipped file input a path — the Dropzone's own door (its Decision §7). */
  async dropFile(path: string): Promise<void> {
    const input = this.at(S_DRAWINGS.dropzoneInput);
    await input.waitFor({ state: "attached" });
    await input.setInputFiles(path);
  }

  /** Press a group's door and carry its Consequence through the one ConsequenceDialog. */
  async confirmGroup(discipline: string): Promise<void> {
    await this.groupFor(discipline).locator(`[data-testid="${S_DRAWINGS.groupConfirm}"]`).click();
    await this.dialog.waitFor({ state: "visible" });
    await this.dialog.locator(`[data-testid="${S_DRAWINGS.dialogConfirm}"]`).click();
  }
}
