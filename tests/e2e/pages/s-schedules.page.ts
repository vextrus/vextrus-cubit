/**
 * S-Schedules, as the journey walks it (docs/design/s-schedules.md §7's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape, and nothing here judges the product. The ids are READ from
 * `src/ui/testids.ts` — the product's one home for them (AM-09 §1) — under the group this screen
 * publishes, so no id is spelled twice in the tree. Until that group lands, every lookup fails by
 * name, which is the red this increment is owed.
 *
 * The Builder may edit this file (test contract).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { heldAttribute } from "../support/retrying-read";

/** The address this screen answers at (Decision §7, test contract). */
export const S_SCHEDULES = Object.freeze({
  schedules: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/schedules`,
} as const);

/** The group this screen publishes its ids under, as the registry holds it today. */
const group = (TESTIDS as unknown as { schedules?: Record<string, string> }).schedules ?? {};
const takeoffGroup = TESTIDS.takeoff as unknown as Record<string, string>;

/** One id of this screen, by the key the registry files it under — never a literal in a test. */
function idOf(key: string): string {
  const id = group[key];
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`src/ui/testids.ts publishes no TESTIDS.schedules.${key} — S-Schedules has not landed its ids yet`);
  }
  return id;
}

/** The lane's own nav entry for this screen, from the same registry. */
function navId(): string {
  const id = takeoffGroup["navSchedules"];
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("src/ui/testids.ts publishes no TESTIDS.takeoff.navSchedules — the lane's fourth tab has not landed yet");
  }
  return id;
}

/** The standings, the acceptances and the one basis this screen renders (test contract). */
export const AGREED = "AGREED";
export const SUSPENDED = "SUSPENDED";
export const ACCEPTED = "ACCEPTED";
export const EDITED = "EDITED";
export const TRANSCRIBED = "TRANSCRIBED";

export class SSchedulesPage {
  constructor(private readonly page: Page) {}

  /** Open the schedules address directly and wait for the screen to stand. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_SCHEDULES.schedules(tenantId, projectId));
    await expect(this.screen, "the schedules screen renders for a project the workspace holds").toBeVisible();
  }

  /** Reach the screen the way a reader does: the takeoff lane's own fourth tab. */
  async openThroughNav(): Promise<void> {
    await this.navSchedules.click();
    await this.page.waitForURL(/takeoff\/schedules/);
    await expect(this.screen, "the tab lands on the schedules screen").toBeVisible();
  }

  get screen(): Locator {
    return this.page.getByTestId(idOf("screen"));
  }
  get navSchedules(): Locator {
    return this.page.getByTestId(navId());
  }
  get navRegister(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.navRegister);
  }
  get crumbPage(): Locator {
    return this.page.getByTestId(TESTIDS.shell.crumbPage);
  }
  get empty(): Locator {
    return this.page.getByTestId(idOf("empty"));
  }

  /** What state the screen says it is in — the RENDERED contract a read waits on (R-UI-050). */
  async state(): Promise<string | null> {
    return heldAttribute(this.screen, "data-state");
  }

  /* --- the sheet rail --- */
  get sheets(): Locator {
    return this.page.getByTestId(idOf("sheets"));
  }
  get sheetRows(): Locator {
    return this.sheets.getByTestId(idOf("sheetRow"));
  }
  /** One sheet of the pinned revision, by the drawing and layout it is (test contract). */
  sheetRow(drawingId: string, layoutName: string): Locator {
    return this.sheets.locator(`${testIdSelector(idOf("sheetRow"))}[data-drawing="${drawingId}"][data-layout="${layoutName}"]`);
  }

  /* --- the reconstructed tables --- */
  get tables(): Locator {
    return this.page.getByTestId(idOf("table"));
  }
  /** One stored schedule's table, by the key it was stored under. */
  table(scheduleKey: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("table"))}[data-schedule="${scheduleKey}"]`);
  }
  /** Every cell of one table. */
  cells(table: Locator): Locator {
    return table.getByTestId(idOf("cell"));
  }
  /** One cell, where it stands in the stored table. */
  cell(table: Locator, rowIndex: number, columnIndex: number): Locator {
    return table.locator(`${testIdSelector(idOf("cell"))}[data-row="${rowIndex}"][data-column="${columnIndex}"]`);
  }
  /** How many rows the table says it drew — the RENDERED contract a read waits on. */
  async rowsRendered(table: Locator): Promise<string | null> {
    return heldAttribute(table, "data-rows-rendered");
  }
  get deferrals(): Locator {
    return this.page.getByTestId(idOf("deferral"));
  }

  /* --- the member-type registry --- */
  get registry(): Locator {
    return this.page.getByTestId(idOf("registry"));
  }
  get families(): Locator {
    return this.registry.getByTestId(idOf("family"));
  }
  family(family: string): Locator {
    return this.registry.locator(`${testIdSelector(idOf("family"))}[data-family="${family}"]`);
  }
  get variants(): Locator {
    return this.registry.getByTestId(idOf("variant"));
  }
  variant(variantKey: string): Locator {
    return this.registry.locator(`${testIdSelector(idOf("variant"))}[data-variant="${variantKey}"]`);
  }
  /** One variant row that says, verbatim, the band and the section the store holds for it (I-251). */
  variantSaying(variantKey: string, said: readonly string[]): Locator {
    return said.reduce((locator, words) => locator.filter({ hasText: words }), this.variant(variantKey));
  }
  get zones(): Locator {
    return this.registry.getByTestId(idOf("zone"));
  }
  zone(zone: string): Locator {
    return this.registry.locator(`${testIdSelector(idOf("zone"))}[data-zone="${zone}"]`);
  }
  /** One rebar zone row that says, verbatim, what the store holds for it. */
  zoneSaying(zone: string, said: string): Locator {
    return this.zone(zone).filter({ hasText: said });
  }

  /* --- the notes panel: what was read, what stands, and what is offered --- */
  get notes(): Locator {
    return this.page.getByTestId(idOf("notes"));
  }
  get proposals(): Locator {
    return this.notes.getByTestId(idOf("proposal"));
  }
  proposal(kind: string): Locator {
    return this.notes.locator(`${testIdSelector(idOf("proposal"))}[data-kind="${kind}"]`);
  }
  proposalValue(kind: string): Locator {
    return this.proposal(kind).getByTestId(idOf("proposalValue"));
  }
  get transcribe(): Locator {
    return this.notes.getByTestId(idOf("transcribe"));
  }
  get readings(): Locator {
    return this.notes.getByTestId(idOf("reading"));
  }
  reading(kind: string): Locator {
    return this.notes.locator(`${testIdSelector(idOf("reading"))}[data-kind="${kind}"]`);
  }
  /** One reading of a kind, by the verdict the seam gave it (test contract: `data-acceptance`). */
  readingJudged(kind: string, acceptance: string): Locator {
    return this.notes.locator(`${testIdSelector(idOf("reading"))}[data-kind="${kind}"][data-acceptance="${acceptance}"]`);
  }
  get standings(): Locator {
    return this.notes.getByTestId(idOf("standing"));
  }
  standing(kind: string): Locator {
    return this.notes.locator(`${testIdSelector(idOf("standing"))}[data-kind="${kind}"]`);
  }

  /** Read the figure a proposal offers, and press the one act door. */
  async transcribeWith(kind: string, value: string): Promise<void> {
    await this.proposalValue(kind).fill(value);
    await this.transcribe.click();
  }

  /* --- the trace every cell and every reading carries (R-UI-022) --- */
  evidence(within: Locator): Locator {
    return within.getByTestId(TESTIDS.evidence.link);
  }
  refusals(within: Locator): Locator {
    return within.getByTestId(TESTIDS.refusal.state);
  }
  refusalEvidence(within: Locator): Locator {
    return within.getByTestId(TESTIDS.refusal.evidenceLink);
  }

  /* --- the shell's one inspector --- */
  get inspector(): Locator {
    return this.page.getByTestId(idOf("inspector"));
  }

  /* --- the one ConsequenceDialog (R-UI-021, the pattern's own ids) --- */
  get dialog(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.dialog);
  }
  get dialogSubjects(): Locator {
    return this.dialog.getByTestId(TESTIDS.consequence.subjectRow);
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

  /** What the frame paints differently on every run, masked for the design pictures (Decision §7). */
  masks(): Locator[] {
    return [
      this.page.locator(testIdSelector(TESTIDS.shell.breadcrumb)),
      this.page.locator(testIdSelector(TESTIDS.shell.user)),
      this.page.locator(testIdSelector(TESTIDS.shell.tenantSwitcher)),
      this.page.locator(testIdSelector(TESTIDS.consequence.digestLine)),
    ];
  }
}
