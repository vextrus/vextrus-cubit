// S-Audit as a journey drives it. Every handle is one of the test ids the screen's Design Decision
// closes over (docs/design/s-audit.md § 7) — a journey that reached for a class or a copy string
// would be reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";

/** The address the test contract names, spelled once so a journey never writes a path twice. */
export const S_AUDIT = Object.freeze({
  route: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/audit`,
} as const);

export class SAuditPage {
  constructor(private readonly page: Page) {}

  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_AUDIT.route(tenantId, projectId));
    await expect(this.filterType, "the explorer's filters stay the screen's content, acts or none").toBeVisible();
  }

  /* --- the explorer --- */

  get acts(): Locator {
    return this.page.getByTestId("audit-acts");
  }

  get rows(): Locator {
    return this.page.getByTestId("audit-act-row");
  }

  get empty(): Locator {
    return this.page.getByTestId("audit-acts-empty");
  }

  get filterType(): Locator {
    return this.page.getByTestId("audit-filter-type");
  }

  get filterActor(): Locator {
    return this.page.getByTestId("audit-filter-actor");
  }

  get filterSubject(): Locator {
    return this.page.getByTestId("audit-filter-subject");
  }

  /* --- the two panels, each wearing the posture its live probe answered --- */

  get modelLedger(): Locator {
    return this.page.getByTestId("audit-panel-model-ledger");
  }

  get jobs(): Locator {
    return this.page.getByTestId("audit-panel-jobs");
  }

  /**
   * The regions a baseline may not compare: the workspace name in the frame's breadcrumb and the
   * signed-in address in the top bar, and — defensively, should a reused project ever hold acts —
   * the occurred-at column, which is the one value of a row that moves with the calendar.
   */
  masks(): Locator[] {
    return [this.page.getByTestId("shell-breadcrumb"), this.page.getByTestId("shell-user"), this.page.locator(".cx-audit-act-when")];
  }
}
