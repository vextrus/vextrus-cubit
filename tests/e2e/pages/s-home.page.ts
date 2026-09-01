// S-Home as a journey drives it. Every handle is one of the test ids the screen's Design Decision
// closes over (docs/design/s-home.md § 7) — a journey that reached for a class or a copy string
// would be reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";

/** The addresses the test contract names, spelled once so a journey never writes a path twice. */
export const S_HOME = Object.freeze({
  workspace: (tenantId: string): string => `/t/${tenantId}`,
  settings: (tenantId: string): string => `/t/${tenantId}/settings`,
  ruleset: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/ruleset`,
} as const);

/** The four quick stats the S-Home clause lists, by the id each one carries. */
export const QUICK_STATS = ["s-home-stat-sheets", "s-home-stat-campaigns", "s-home-stat-estimates", "s-home-stat-bids"] as const;

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
    return this.page.getByTestId("s-home-grid");
  }

  get cards(): Locator {
    return this.page.getByTestId("s-home-project-card");
  }

  /** One card, addressed by the project it is for — the card carries the id as a data attribute. */
  card(projectId: string): Locator {
    return this.cards.filter({ has: this.page.locator(`[data-project="${projectId}"]`) }).or(this.page.locator(`[data-testid="s-home-project-card"][data-project="${projectId}"]`));
  }

  /** The one card whose name row reads this text — how a person finds a project they just made. */
  cardNamed(name: string): Locator {
    return this.cards.filter({ hasText: name });
  }

  get recentDocuments(): Locator {
    return this.page.getByTestId("s-home-recent-documents");
  }

  get createProject(): Locator {
    return this.page.getByTestId("s-home-create-project");
  }

  /* --- the form, one component serving create and edit --- */

  get form(): Locator {
    return this.page.getByTestId("project-form");
  }

  field(id: string): Locator {
    return this.page.getByTestId(id);
  }

  /** The building types on offer, found by the behavioural hook § 7 names rather than by a tag. */
  get buildingTypes(): Locator {
    return this.page.getByTestId("project-building-type").locator("[aria-pressed]");
  }

  get submit(): Locator {
    return this.page.getByTestId("project-form-submit");
  }

  get formRefusal(): Locator {
    return this.page.getByTestId("project-form-refusal");
  }

  async open(route: string): Promise<void> {
    await this.page.goto(route);
  }

  /** Fill the form as it stands, leaving untouched every field the draft does not name. */
  async fill(draft: ProjectDraftInput): Promise<void> {
    const entries: [string, string | undefined][] = [
      ["project-name", draft.name],
      ["project-code", draft.code],
      ["project-client", draft.client],
      ["project-site-address", draft.siteAddress],
      ["project-district", draft.district],
      ["project-storeys", draft.storeys],
      ["project-gfa-m2", draft.gfaM2],
      ["project-notes", draft.notes],
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
    return [this.page.getByTestId("s-home-project-last-activity"), this.page.getByTestId("shell-user")];
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
