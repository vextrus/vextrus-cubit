/**
 * S-Coverage, as the journeys walk it (docs/design/s-coverage.md §7's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape, and nothing here judges the product. The Builder may edit
 * this file (test contract).
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** The address this screen answers at, and the parameter one cell widens it by (Decision §7). */
export const S_COVERAGE = Object.freeze({
  coverage: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/coverage`,
  cell: (tenantId: string, projectId: string, kind: string, klass: string, levelId: string): string =>
    `/t/${tenantId}/p/${projectId}/takeoff/coverage?cell=${encodeURIComponent(`${kind}:${klass}:${levelId}`)}`,
} as const);

/** The two readings a cell may wear that are not causes. */
export const QUANTITY_BEARING = "QUANTITY_BEARING";
export const IN_BILL = "IN_BILL";
export const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL";
export const NOT_ESTABLISHED = "NOT_ESTABLISHED";

export class SCoveragePage {
  constructor(private readonly page: Page) {}

  /** Open the coverage address directly and wait for the screen to stand. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_COVERAGE.coverage(tenantId, projectId));
    await expect(this.root, "the coverage screen renders for a project the workspace holds").toBeVisible();
  }

  /** Reach the coverage grid the way a reader does: the takeoff lane's own nav entry. */
  async openThroughNav(): Promise<void> {
    await this.navCoverage.click();
    await this.page.waitForURL(/takeoff\/coverage/);
    await expect(this.root, "the nav entry lands on the coverage screen").toBeVisible();
  }

  get root(): Locator {
    return this.page.getByTestId("coverage-screen");
  }
  /** The screen root, under the name the journey reads it by. */
  get screen(): Locator {
    return this.root;
  }

  /* --- the lane's own navigation (Decision §1) --- */
  get navCoverage(): Locator {
    return this.page.getByTestId("takeoff-nav-coverage");
  }
  get navRegister(): Locator {
    return this.page.getByTestId("takeoff-nav-register");
  }

  /* --- the grid --- */
  get grid(): Locator {
    return this.page.getByTestId("coverage-grid");
  }
  get cells(): Locator {
    return this.grid.getByTestId("coverage-cell");
  }
  get kindRows(): Locator {
    return this.grid.getByTestId("coverage-kind-row");
  }
  /** Every cell whose measurement axis reads a given code. */
  measuring(reading: string): Locator {
    return this.grid.locator(`[data-testid="coverage-cell"][data-measurement="${reading}"]`);
  }
  /** Every cell whose bill axis reads a given code. */
  billing(reading: string): Locator {
    return this.grid.locator(`[data-testid="coverage-cell"][data-bill="${reading}"]`);
  }
  /** One cell, by the three coordinates it carries. */
  cell(kind: string, klass: string, levelId: string): Locator {
    return this.grid.locator(`[data-testid="coverage-cell"][data-kind="${kind}"][data-class="${klass}"][data-level="${levelId}"]`);
  }
  get legend(): Locator {
    return this.page.getByTestId("coverage-legend");
  }
  legendEntry(cause: string): Locator {
    return this.legend.locator(`[data-testid="coverage-legend-entry"][data-cause="${cause}"]`);
  }

  /* --- the inspector, and the two doors it carries --- */
  get inspector(): Locator {
    return this.page.getByTestId("coverage-inspector");
  }
  get cause(): Locator {
    return this.inspector.getByTestId("coverage-inspector-cause");
  }
  get inspectorCause(): Locator {
    return this.cause;
  }
  get remedy(): Locator {
    return this.inspector.getByTestId("coverage-inspector-remedy");
  }
  get inspectorRemedy(): Locator {
    return this.remedy;
  }
  get sightings(): Locator {
    return this.inspector.getByTestId("coverage-inspector-sighting");
  }
  get observations(): Locator {
    return this.inspector.getByTestId("coverage-inspector-observation");
  }
  get holdOut(): Locator {
    return this.inspector.getByTestId("coverage-hold-out");
  }
  get declareOutOfScope(): Locator {
    return this.inspector.getByTestId("coverage-declare-out-of-scope");
  }
  get answer(): Locator {
    return this.page.getByTestId("coverage-answer");
  }
  get empty(): Locator {
    return this.page.getByTestId("coverage-empty");
  }
  get retry(): Locator {
    return this.page.getByTestId("coverage-retry");
  }

  /* --- the certificate preview --- */
  get preview(): Locator {
    return this.page.getByTestId("coverage-certificate-preview");
  }
  get statements(): Locator {
    return this.preview.getByTestId("coverage-statement");
  }
  /** One statement block, by the axis it states — `MEASUREMENT` or `BILL` (the test contract). */
  statement(axis: string): Locator {
    return this.preview.locator(`[data-testid="coverage-statement"][data-axis="${axis}"]`);
  }
  statementRows(axis: string): Locator {
    return this.statement(axis).getByTestId("coverage-statement-row");
  }
  statementNone(axis: string): Locator {
    return this.statement(axis).getByTestId("coverage-statement-none");
  }

  /* --- the shipped ConsequenceDialog the two doors open (Decision I-167) --- */
  get dialog(): Locator {
    return this.page.getByTestId("consequence-dialog");
  }
  get dialogConfirm(): Locator {
    return this.dialog.getByTestId("consequence-confirm");
  }

  /** Select one cell and wait for the inspector to answer for it. */
  async select(cell: Locator): Promise<void> {
    await cell.click();
    await expect(this.inspector, "the inspector answers for the cell that was selected").toBeVisible();
  }

  /** Press a door and carry its Consequence through the one shipped dialog. */
  async carry(door: Locator): Promise<void> {
    await door.click();
    await this.dialog.waitFor({ state: "visible" });
    await this.dialogConfirm.click();
    await expect(this.dialog, "the dialog closes once the act is carried").toBeHidden();
  }

  /** The three coordinates one cell carries, read off the element rather than assumed. */
  async coordinatesOf(cell: Locator): Promise<{ kind: string; class: string; levelId: string }> {
    return {
      kind: (await cell.getAttribute("data-kind")) ?? "",
      class: (await cell.getAttribute("data-class")) ?? "",
      levelId: (await cell.getAttribute("data-level")) ?? "",
    };
  }

  /**
   * The per-run texts a design picture may not freeze (Decision §7, B-20): the shell's own three, and
   * this screen's three model values that differ on every run — the pinned revision, an act id and a
   * source key. They exist to be masked and are found by their classes, because the id contract is
   * closed and no id is added for a mask.
   */
  masks(): Locator[] {
    return [
      this.page.getByTestId("shell-breadcrumb"),
      this.page.getByTestId("shell-user"),
      this.page.getByTestId("shell-tenant-switcher"),
      this.page.locator(".cx-coverage-revision"),
      this.page.locator(".cx-coverage-act-id"),
      this.page.locator(".cx-coverage-source-key"),
    ];
  }

  at(): Page {
    return this.page;
  }
}
