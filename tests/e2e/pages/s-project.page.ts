// S-Project as a journey drives it. Every handle is one of the test ids the screen's Design Decision
// closes over (docs/design/s-project.md § 7) — a journey that reached for a class or a copy string
// would be reading the styling, not the screen. The two masked handles are the exception the
// Decision itself names: they are the per-run texts a committed picture may not compare.
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { appears } from "../support/retrying-read";

/** The addresses the test contract names, spelled once so a journey never writes a path twice. */
export const S_PROJECT = Object.freeze({
  home: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}`,
  drawings: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/drawings`,
  // The Takeoff area became live in inc-214-register-workspace: its tab is an anchor to the address
  // the register workspace redirects from (B-20 — this increment owns the acceptance that froze it).
  takeoff: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff`,
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
    return this.page.getByTestId(TESTIDS.project.home);
  }

  /* --- the header (I-127) --- */

  get header(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeHeader);
  }

  get name(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeName);
  }

  get client(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeClient);
  }

  get district(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeDistrict);
  }

  get zones(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeZones);
  }

  get zoneBadges(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeZoneBadge);
  }

  get gfa(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeGfa);
  }

  get gfaSft(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeGfaSft);
  }

  /* --- the areas and the quick actions (I-125/I-126) --- */

  get tabs(): Locator {
    return this.page.getByTestId(TESTIDS.project.tabs);
  }

  get allTabs(): Locator {
    return this.page.getByTestId(TESTIDS.project.tab);
  }

  tab(area: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.project.tab)}[data-area="${area}"]`);
  }

  get quickActions(): Locator {
    return this.page.getByTestId(TESTIDS.project.quickAction);
  }

  quickAction(action: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.project.quickAction)}[data-action="${action}"]`);
  }

  /* --- AI cost so far (R-AI-005) --- */

  get aiSpend(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeAiSpend);
  }

  get aiCost(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeAiCost);
  }

  get aiCostUnit(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeAiCostUnit);
  }

  get aiCalls(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeAiCalls);
  }

  get aiOutcomes(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeAiOutcomes);
  }

  get aiNone(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeAiNone);
  }

  get aiLedger(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeAiLedger);
  }

  /* --- recent activity (I-132) --- */

  get activity(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeActivity);
  }

  get activityRows(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeActivityRow);
  }

  get activityEmpty(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeActivityEmpty);
  }

  get activityAll(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeActivityAll);
  }

  /* --- participants (I-129) --- */

  get participants(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeParticipants);
  }

  get participantRows(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeParticipant);
  }

  get participantRoles(): Locator {
    return this.page.getByTestId(TESTIDS.project.homeParticipantRole);
  }

  get refusal(): Locator {
    return this.participants.getByTestId(TESTIDS.refusal.state);
  }

  /** The drawings screen's own index — the door this home is the visible navigation into. */
  get sheetIndex(): Locator {
    return this.page.getByTestId(TESTIDS.sheet.index);
  }

  /**
   * Travel to one area's tab with the keyboard alone and activate it (R-UI-031, R-UI-012): a tab a
   * person cannot reach by Tab is a door only a mouse holds. The walk is bounded, never timed.
   */
  async activateTabFromKeyboard(area: string): Promise<void> {
    const focused = this.page.locator(`${testIdSelector(TESTIDS.project.tab)}[data-area="${area}"]:focus`);
    await expect(this.tab(area), `the \`${area}\` tab stands on the screen before anyone tabs to it`).toBeVisible();
    // A retrying read per press (`locator.waitFor`), not a one-shot count: focus arrives with the
    // browser's own event loop, and the tab that has just been pressed may not have landed yet.
    for (let travel = 0; travel < TAB_TRAVEL_LIMIT && !(await appears(focused, 250)); travel += 1) {
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
      this.page.getByTestId(TESTIDS.shell.breadcrumb),
      this.page.getByTestId(TESTIDS.shell.user),
      this.page.locator(".cx-project-activity-when"),
      this.page.locator(".cx-project-member-label"),
    ];
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
