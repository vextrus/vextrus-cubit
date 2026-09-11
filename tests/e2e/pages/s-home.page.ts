// S-Home as a journey drives it. Every handle is one of the test ids the screen's Design Decision
// closes over (docs/design/s-home.md § 7) — a journey that reached for a class or a copy string
// would be reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** The addresses the test contract names, spelled once so a journey never writes a path twice. */
export const S_HOME = Object.freeze({
  workspace: (tenantId: string): string => `/t/${tenantId}`,
  settings: (tenantId: string): string => `/t/${tenantId}/settings`,
  ruleset: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/ruleset`,
} as const);

/** The four quick stats the S-Home clause lists, by the id each one carries. */
export const QUICK_STATS = [TESTIDS.sHome.statSheets, TESTIDS.sHome.statCampaigns, TESTIDS.sHome.statEstimates, TESTIDS.sHome.statBids] as const;

/** What a draft carries into the form — the fields R-SPINE-010 names, by their contract test ids. */
export interface ProjectDraftInput {
  name: string;
  code?: string;
  client?: string;
  siteAddress?: string;
  district?: string;
  /** Which of the offered building types to press, by position in the group. */
  buildingType?: number;
  storeys?: string;
  gfaM2?: string;
  notes?: string;
}

export class SHomePage {
  constructor(private readonly page: Page) {}

  /* --- the grid and its cards --- */

  get grid(): Locator {
    return this.page.getByTestId(TESTIDS.sHome.grid);
  }

  get cards(): Locator {
    return this.page.getByTestId(TESTIDS.sHome.projectCard);
  }

  /** One card, addressed by the project it is for — the card carries the id as a data attribute. */
  card(projectId: string): Locator {
    return this.cards.filter({ has: this.page.locator(`[data-project="${projectId}"]`) }).or(this.page.locator(`${testIdSelector(TESTIDS.sHome.projectCard)}[data-project="${projectId}"]`));
  }

  /** The one card whose name row reads this text — how a person finds a project they just made. */
  cardNamed(name: string): Locator {
    return this.cards.filter({ hasText: name });
  }

  /**
   * The card's name, as the door it became when the project home shipped (I-131 amends I-32): every
   * card's name is a link to `/t/{tenantId}/p/{projectId}`, which is R-UI-031 paid for the card.
   */
  projectOpen(projectId: string): Locator {
    return this.card(projectId).getByTestId(TESTIDS.sHome.projectOpen);
  }

  /** Every card's door, in grid order — for the assertion that no card is left without one. */
  get projectOpens(): Locator {
    return this.page.getByTestId(TESTIDS.sHome.projectOpen);
  }

  get recentDocuments(): Locator {
    return this.page.getByTestId(TESTIDS.sHome.recentDocuments);
  }

  get createProject(): Locator {
    return this.page.getByTestId(TESTIDS.sHome.createProject);
  }

  /* --- the form, one component serving create and edit --- */

  get form(): Locator {
    return this.page.getByTestId(TESTIDS.project.form);
  }

  field(id: string): Locator {
    return this.page.getByTestId(id);
  }

  /** The building types on offer, found by the behavioural hook § 7 names rather than by a tag. */
  get buildingTypes(): Locator {
    return this.page.getByTestId(TESTIDS.project.buildingType).locator("[aria-pressed]");
  }

  get submit(): Locator {
    return this.page.getByTestId(TESTIDS.project.formSubmit);
  }

  get formRefusal(): Locator {
    return this.page.getByTestId(TESTIDS.project.formRefusal);
  }

  async open(route: string): Promise<void> {
    await this.page.goto(route);
  }

  /** Fill the form as it stands, leaving untouched every field the draft does not name. */
  async fill(draft: ProjectDraftInput): Promise<void> {
    const entries: [string, string | undefined][] = [
      [TESTIDS.project.name, draft.name],
      [TESTIDS.project.code, draft.code],
      [TESTIDS.project.client, draft.client],
      [TESTIDS.project.siteAddress, draft.siteAddress],
      [TESTIDS.project.district, draft.district],
      [TESTIDS.project.storeys, draft.storeys],
      [TESTIDS.project.gfaM2, draft.gfaM2],
      [TESTIDS.project.notes, draft.notes],
    ];
    for (const [id, value] of entries) {
      if (value === undefined) continue;
      await this.field(id).fill(value);
    }
    if (draft.buildingType !== undefined) {
      await expect(this.buildingTypes.nth(draft.buildingType), "the building type group offers the type this draft chooses").toBeVisible();
      await this.buildingTypes.nth(draft.buildingType).click();
    }
  }

  /** Open the create door, fill the form and submit it — the whole create leg, as a person walks it. */
  async createWith(draft: ProjectDraftInput): Promise<void> {
    await this.createProject.click();
    await expect(this.form, "the create door opens the project form").toBeVisible();
    await this.fill(draft);
    await this.submit.click();
  }

  /** The regions a baseline may not compare: the last-activity dates and the per-run address. */
  masks(): Locator[] {
    return [this.page.getByTestId(TESTIDS.sHome.projectLastActivity), this.page.getByTestId(TESTIDS.shell.user)];
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
