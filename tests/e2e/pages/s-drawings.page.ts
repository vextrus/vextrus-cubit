// S-Drawings, as a journey addresses it: the project's sheet index at
// `/t/{tenantId}/p/{projectId}/drawings` (docs/design/s-drawings.md §7). Locators only — every
// judgement stays in the journey, so the page object can never quietly decide whether the screen
// passed.
import { type Locator, type Page } from "@playwright/test";

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

  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(drawingsRoute(tenantId, projectId));
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
    await this.at(S_DRAWINGS.dropzoneInput).setInputFiles(path);
  }

  /** Press a group's door and carry its Consequence through the one ConsequenceDialog. */
  async confirmGroup(discipline: string): Promise<void> {
    await this.groupFor(discipline).locator(`[data-testid="${S_DRAWINGS.groupConfirm}"]`).click();
    await this.dialog.waitFor({ state: "visible" });
    await this.dialog.locator(`[data-testid="${S_DRAWINGS.dialogConfirm}"]`).click();
  }
}
