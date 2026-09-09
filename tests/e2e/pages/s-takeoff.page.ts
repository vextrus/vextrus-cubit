/**
 * S-Takeoff, as the journey walks it (docs/design/s-takeoff.md §7's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape. The Builder may edit this file (test contract).
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** The two addresses this screen answers at (test contract: routes). */
export const S_TAKEOFF = Object.freeze({
  takeoff: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff`,
  register: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/register`,
} as const);

export class STakeoffPage {
  constructor(private readonly page: Page) {}

  /** Open the takeoff address and be carried to the register, which is what it answers with. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_TAKEOFF.takeoff(tenantId, projectId));
    await this.page.waitForURL(new RegExp(`${S_TAKEOFF.register(tenantId, projectId)}$`));
    await expect(this.root, "the register workspace renders for a project the workspace holds").toBeVisible();
  }

  get root(): Locator {
    return this.page.getByTestId("register-workspace");
  }

  /* --- the lane's own navigation (Decision §1) --- */

  get nav(): Locator {
    return this.page.getByTestId("takeoff-nav");
  }

  get navRegister(): Locator {
    return this.page.getByTestId("takeoff-nav-register");
  }

  /* --- the three regions of the body --- */

  get tree(): Locator {
    return this.page.getByTestId("register-tree");
  }

  /** One item of the tree, by the label a reader reads on it. */
  treeItem(label: string): Locator {
    return this.tree.getByRole("treeitem", { name: label, exact: false });
  }

  get inspector(): Locator {
    return this.page.getByTestId("register-inspector");
  }

  get objectCorroboration(): Locator {
    return this.page.getByTestId("register-object-corroboration");
  }

  get lines(): Locator {
    return this.page.getByTestId("register-lines");
  }

  get linesCount(): Locator {
    return this.page.getByTestId("register-lines-count");
  }

  /** One of the five filters, by the field it narrows on (`class`, `kind`, `level`, `basis`, `coverage`). */
  filter(name: string): Locator {
    return this.page.getByTestId(`register-filter-${name}`);
  }

  /* --- what produced no line, and what a door answered --- */

  get refusals(): Locator {
    return this.page.getByTestId("register-refusals");
  }

  get refusalRows(): Locator {
    return this.page.getByTestId("register-refusal");
  }

  get answer(): Locator {
    return this.page.getByTestId("register-answer");
  }

  /* --- the doors --- */

  get measure(): Locator {
    return this.page.getByTestId("register-measure");
  }

  get timeline(): Locator {
    return this.page.getByTestId("register-timeline");
  }

  /** The measure step of the timeline beneath the door — the run this screen started (R-UI-024). */
  get measureStep(): Locator {
    return this.timeline.getByTestId("job-timeline-step").filter({ has: this.page.locator('[data-kind="measure"]') }).or(this.timeline.locator('[data-testid="job-timeline-step"][data-kind="measure"]'));
  }

  get levelStack(): Locator {
    return this.page.getByTestId("register-level-stack");
  }

  /** The per-run texts a design picture may not freeze (Decision §7). */
  masks(): Locator[] {
    return [
      this.page.getByTestId("shell-breadcrumb"),
      this.page.getByTestId("shell-user"),
      this.page.getByTestId("register-timeline"),
      this.page.getByTestId("register-source-key"),
    ];
  }

  at(): Page {
    return this.page;
  }
}
