/**
 * S-BOQ, as the journey walks it (docs/design/s-boq.md §7's closed hook contract).
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
import { TESTIDS, isTestId, testIdSelector, type TestId } from "../../../src/ui/testids";
import { heldAttribute } from "../support/retrying-read";

/** The address this screen answers at (Decision §7, test contract). */
export const S_BOQ = Object.freeze({
  boq: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/boq`,
  documents: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/documents`,
} as const);

/** The group this screen publishes its ids under, as the registry holds it today. */
const group = (TESTIDS as unknown as { boq?: Record<string, string> }).boq ?? {};
const takeoffGroup = TESTIDS.takeoff as unknown as Record<string, string>;

/** One id of this screen, by the key the registry files it under — never a literal in a test. */
function idOf(key: string): TestId {
  const id = group[key];
  if (typeof id !== "string" || !isTestId(id)) {
    throw new Error(`src/ui/testids.ts publishes no TESTIDS.boq.${key} — S-BOQ has not landed its ids yet`);
  }
  return id;
}

/** The lane's own fifth tab, from the same registry. */
function navId(): TestId {
  const id = takeoffGroup["navBoq"];
  if (typeof id !== "string" || !isTestId(id)) {
    throw new Error("src/ui/testids.ts publishes no TESTIDS.takeoff.navBoq — the lane's fifth tab has not landed yet");
  }
  return id;
}

export class SBoqPage {
  constructor(private readonly page: Page) {}

  /** Open the draft's address directly and wait for the screen to stand. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_BOQ.boq(tenantId, projectId));
    await expect(this.screen, "the draft BOQ screen renders for a project the workspace holds").toBeVisible();
  }

  /** Reach the screen the way a reader does: the takeoff lane's own fifth tab. */
  async openThroughNav(): Promise<void> {
    await this.navBoq.click();
    await this.page.waitForURL(/takeoff\/boq/);
    await expect(this.screen, "the fifth tab lands on the draft BOQ").toBeVisible();
  }

  get screen(): Locator {
    return this.page.getByTestId(idOf("screen"));
  }
  get grid(): Locator {
    return this.page.getByTestId(idOf("grid"));
  }
  get answer(): Locator {
    return this.page.getByTestId(idOf("answer"));
  }
  get empty(): Locator {
    return this.page.getByTestId(idOf("empty"));
  }
  get exportButton(): Locator {
    return this.page.getByTestId(idOf("export"));
  }
  /** The two quantity channels beside the primary, and the link a press hands back (R-TO-070). */
  get exportXlsxButton(): Locator {
    return this.page.getByTestId(idOf("exportXlsx"));
  }
  get exportCsvButton(): Locator {
    return this.page.getByTestId(idOf("exportCsv"));
  }
  get exportLink(): Locator {
    return this.page.getByTestId(idOf("exportLink"));
  }
  get jobs(): Locator {
    return this.page.getByTestId(idOf("jobs"));
  }
  get documentLink(): Locator {
    return this.page.getByTestId(idOf("documentLink"));
  }
  get revision(): Locator {
    return this.page.getByTestId(idOf("revision"));
  }
  get taxonomyVersion(): Locator {
    return this.page.getByTestId(idOf("taxonomyVersion"));
  }
  get navBoq(): Locator {
    return this.page.getByTestId(navId());
  }
  get takeoffNav(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.nav);
  }
  get crumbPage(): Locator {
    return this.page.getByTestId(TESTIDS.shell.crumbPage);
  }
  get main(): Locator {
    return this.page.getByTestId(TESTIDS.shell.main);
  }

  /** What state the screen says it is in — the RENDERED contract a read waits on (R-UI-050). */
  async state(): Promise<string | null> {
    return heldAttribute(this.screen, "data-state");
  }

  /* --- the sections --- */
  get bills(): Locator {
    return this.page.getByTestId(idOf("bill"));
  }
  bill(bill: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("bill"))}[data-bill="${bill}"]`);
  }
  get lines(): Locator {
    return this.page.getByTestId(idOf("line"));
  }
  line(lineId: string): Locator {
    return this.page.locator(`${testIdSelector(idOf("line"))}[data-line="${lineId}"]`);
  }
  linesIn(bill: Locator): Locator {
    return bill.getByTestId(idOf("line"));
  }
  subtotals(bill: Locator): Locator {
    return bill.getByTestId(idOf("subtotal"));
  }
  get allSubtotals(): Locator {
    return this.page.getByTestId(idOf("subtotal"));
  }
  header(bill: Locator): Locator {
    return bill.getByTestId(TESTIDS.datatable.header);
  }
  groupRows(bill: Locator): Locator {
    return bill.getByTestId(TESTIDS.datatable.groupRow);
  }
  groupSubtotals(bill: Locator): Locator {
    return bill.getByTestId(TESTIDS.datatable.groupSubtotal);
  }
  basisChips(line: Locator): Locator {
    return line.getByTestId(TESTIDS.basis.chip);
  }
  coverageChips(line: Locator): Locator {
    return line.getByTestId(TESTIDS.coverage.chip);
  }
  unitBadges(line: Locator): Locator {
    return line.getByTestId(TESTIDS.unit.badge);
  }

  /**
   * What a picture of this screen must not compare: the shell's per-run identities and the two
   * chips whose values change with every staged run.
   */
  masks(): Locator[] {
    return [
      this.page.getByTestId(TESTIDS.shell.crumbPage),
      this.page.getByTestId(TESTIDS.shell.user),
      this.page.getByTestId(TESTIDS.shell.tenantSwitcher),
      this.page.locator(".cx-boq-revision"),
      this.page.locator(".cx-boq-taxonomy"),
    ];
  }
}
