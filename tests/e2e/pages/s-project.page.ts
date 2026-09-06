// S-Project as a journey drives it. Every handle is one of the test ids the screen's Design Decision
// closes over (docs/design/s-project.md § 7) — a journey that reached for a class or a copy string
// would be reading the styling, not the screen. The two masked handles are the exception the
// Decision itself names: they are the per-run texts a committed picture may not compare.
import { expect, type Locator, type Page } from "@playwright/test";

/** The addresses the test contract names, spelled once so a journey never writes a path twice. */
export const S_PROJECT = Object.freeze({
  home: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}`,
  drawings: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings`,
  sets: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings/sets`,
  audit: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/audit`,
  ruleset: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/ruleset`,
  participants: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`,
} as const);

/** S-Project's clause order: "Drawings · Takeoff · Assure · Estimate · Bid · Activity · Settings". */
export const PROJECT_AREA_KEYS = ["drawings", "takeoff", "assure", "estimate", "bid", "activity", "settings"] as const;

/** The three quick actions the screen offers, by the `data-action` each one carries. */
export const PROJECT_QUICK_ACTIONS = ["upload-drawings", "browse-sets", "manage-participants"] as const;

/** How many Tab presses a keyboard walk of this screen is allowed before it has plainly failed. */
const TAB_TRAVEL_LIMIT = 80;

export class SProjectPage {
  constructor(private readonly page: Page) {}

  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_PROJECT.home(tenantId, projectId));
    await expect(this.root, "the project home renders for a project the workspace holds").toBeVisible();
  }

  get root(): Locator {
    return this.page.getByTestId("project-home");
  }

  /* --- the header (I-127) --- */

  get header(): Locator {
    return this.page.getByTestId("project-home-header");
  }

  get name(): Locator {
    return this.page.getByTestId("project-home-name");
  }

  get client(): Locator {
    return this.page.getByTestId("project-home-client");
  }

  get district(): Locator {
    return this.page.getByTestId("project-home-district");
  }

  get zones(): Locator {
    return this.page.getByTestId("project-home-zones");
  }

  get zoneBadges(): Locator {
    return this.page.getByTestId("project-home-zone-badge");
  }

  get gfa(): Locator {
    return this.page.getByTestId("project-home-gfa");
  }

  get gfaSft(): Locator {
    return this.page.getByTestId("project-home-gfa-sft");
  }

  /* --- the areas and the quick actions (I-125/I-126) --- */

  get tabs(): Locator {
    return this.page.getByTestId("project-tabs");
  }

  get allTabs(): Locator {
    return this.page.getByTestId("project-tab");
  }

  tab(area: string): Locator {
    return this.page.locator(`[data-testid="project-tab"][data-area="${area}"]`);
  }

  get quickActions(): Locator {
    return this.page.getByTestId("project-quick-action");
  }

  quickAction(action: string): Locator {
    return this.page.locator(`[data-testid="project-quick-action"][data-action="${action}"]`);
  }

  /* --- AI cost so far (R-AI-005) --- */

  get aiSpend(): Locator {
    return this.page.getByTestId("project-home-ai-spend");
  }

  get aiCost(): Locator {
    return this.page.getByTestId("project-home-ai-cost");
  }

  get aiCostUnit(): Locator {
    return this.page.getByTestId("project-home-ai-cost-unit");
  }

  get aiCalls(): Locator {
    return this.page.getByTestId("project-home-ai-calls");
  }

  get aiOutcomes(): Locator {
    return this.page.getByTestId("project-home-ai-outcomes");
  }

  get aiNone(): Locator {
    return this.page.getByTestId("project-home-ai-none");
  }

  get aiLedger(): Locator {
    return this.page.getByTestId("project-home-ai-ledger");
  }

  /* --- recent activity (I-132) --- */

  get activity(): Locator {
    return this.page.getByTestId("project-home-activity");
  }

  get activityRows(): Locator {
    return this.page.getByTestId("project-home-activity-row");
  }

  get activityEmpty(): Locator {
    return this.page.getByTestId("project-home-activity-empty");
  }

  get activityAll(): Locator {
    return this.page.getByTestId("project-home-activity-all");
  }

  /* --- participants (I-129) --- */

  get participants(): Locator {
    return this.page.getByTestId("project-home-participants");
  }

  get participantRows(): Locator {
    return this.page.getByTestId("project-home-participant");
  }

  get participantRoles(): Locator {
    return this.page.getByTestId("project-home-participant-role");
  }

  get refusal(): Locator {
    return this.participants.getByTestId("refusal-state");
  }

  /** The drawings screen's own index — the door this home is the visible navigation into. */
  get sheetIndex(): Locator {
    return this.page.getByTestId("sheet-index");
  }

  /**
   * Travel to one area's tab with the keyboard alone and activate it (R-UI-031, R-UI-012): a tab a
   * person cannot reach by Tab is a door only a mouse holds. The walk is bounded, never timed.
   */
  async activateTabFromKeyboard(area: string): Promise<void> {
    const focused = this.page.locator(`[data-testid="project-tab"][data-area="${area}"]:focus`);
    await expect(this.tab(area), `the \`${area}\` tab stands on the screen before anyone tabs to it`).toBeVisible();
    for (let travel = 0; travel < TAB_TRAVEL_LIMIT && (await focused.count()) === 0; travel += 1) {
      await this.page.keyboard.press("Tab");
    }
    await expect(focused, `the \`${area}\` tab is reachable from the keyboard`).toHaveCount(1);
    await this.page.keyboard.press("Enter");
  }

  /**
   * The regions a baseline may not compare: the workspace name in the frame's breadcrumb, the
   * signed-in address in the top bar, and the two per-run texts the Decision § 7 freezes by name —
   * an act's date and a member's label.
   */
  masks(): Locator[] {
    return [
      this.page.getByTestId("shell-breadcrumb"),
      this.page.getByTestId("shell-user"),
      this.page.locator(".cx-project-activity-when"),
      this.page.locator(".cx-project-member-label"),
    ];
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
