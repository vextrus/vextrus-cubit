// S-Settings-Participants as a journey drives it, and the one act pattern it opens. Every handle is
// one of the test ids the two Design Decisions close over (docs/design/s-settings-participants.md
// § 7, docs/design/consequence-dialog.md § 7) — a journey that reached for a class or a copy string
// would be reading the styling, not the screen.
//
// The two masks are the exception the Decision itself names: the digest and the subject label are
// per-run values, and the baseline of the open dialog is a picture of chrome, not of one run's data.
import { expect, type Locator, type Page } from "@playwright/test";

/** The address the test contract names, spelled once so a journey never writes a path twice. */
export const S_PARTICIPANTS = Object.freeze({
  route: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/participants`,
} as const);

/** The class the Decision puts on the per-run subject label — masked, never read (§ 7). */
const SUBJECT_LABEL_CLASS = ".cx-consequence-subject-label";

export class SParticipantsPage {
  constructor(private readonly page: Page) {}

  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_PARTICIPANTS.route(tenantId, projectId));
    await expect(this.list, "the screen renders the project's current roles").toBeVisible();
  }

  /* --- the three sections --- */

  get list(): Locator {
    return this.page.getByTestId("participants-list");
  }

  get rows(): Locator {
    return this.page.getByTestId("participants-row");
  }

  get history(): Locator {
    return this.page.getByTestId("participants-history");
  }

  get historyRows(): Locator {
    return this.page.getByTestId("participants-history-row");
  }

  get form(): Locator {
    return this.page.getByTestId("participants-assign-form");
  }

  get refusal(): Locator {
    return this.page.getByTestId("participants-refusal");
  }

  /* --- the assign form's three single-selection groups (I-48) --- */

  /**
   * One chip of a group, addressed by the text it carries: enum values are content, not styling
   * (I-47), and a member is offered under the label the screen shows them by (I-51).
   */
  chip(group: "subject" | "role" | "direction", label: string): Locator {
    return this.page.getByTestId(`participants-assign-${group}`).locator("[aria-pressed]").filter({ hasText: label });
  }

  /**
   * Choose a chip of a single-selection group. A chip already pressed is left alone: pressing the
   * selected member of a single-select group is not a thing a person does, and what a walk needs is
   * the selection, not the click.
   */
  async choose(group: "subject" | "role" | "direction", label: string): Promise<void> {
    const chosen = this.chip(group, label);
    await expect(chosen, `${label} stands in the ${group} group`).toHaveCount(1);
    if ((await chosen.getAttribute("aria-pressed")) !== "true") await chosen.click();
    await expect(chosen, `${label} is the ${group} group's selection`).toHaveAttribute("aria-pressed", "true");
  }

  /** The submit, found by role and name — the contract is closed, so it carries no test id. */
  submit(label: string): Locator {
    return this.page.getByRole("button", { name: label });
  }

  /* --- the one act pattern this screen opens (R-UI-021) --- */

  get dialog(): Locator {
    return this.page.getByTestId("consequence-dialog");
  }

  /** The primitive's own card, which is the crop the committed baseline holds. */
  get dialogCard(): Locator {
    return this.page.getByTestId("dialog-content");
  }

  get subjectRows(): Locator {
    return this.page.getByTestId("consequence-subject-row");
  }

  get digestLine(): Locator {
    return this.page.getByTestId("consequence-digest-line");
  }

  get confirm(): Locator {
    return this.page.getByTestId("consequence-confirm");
  }

  /** The two per-run texts the open dialog's baseline masks (consequence-dialog Decision § 7). */
  dialogMasks(): Locator[] {
    return [this.digestLine, this.page.locator(SUBJECT_LABEL_CLASS)];
  }

  /** Every history row's direction and role, as the rows themselves carry them. */
  async historyOf(): Promise<{ direction: string | null; role: string | null }[]> {
    const total = await this.historyRows.count();
    const read: { direction: string | null; role: string | null }[] = [];
    for (let index = 0; index < total; index += 1) {
      const row = this.historyRows.nth(index);
      read.push({ direction: await row.getAttribute("data-direction"), role: await row.getAttribute("data-role") });
    }
    return read;
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
