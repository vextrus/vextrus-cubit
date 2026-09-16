// S-Settings-Ruleset-Author as a journey drives it, and the project settings nav it is drawn in.
// Every handle is one of the test ids the two Design Decisions close over
// (docs/design/s-settings-ruleset-author.md § 7, docs/design/s-settings-project-sub-navigation.md
// § 7) read from the one registry — a journey that reached for a class or a copy string would be
// reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { S_HOME } from "./s-home.page";
import { S_PARTICIPANTS } from "./s-participants.page";

/** The address this screen answers at, spelled once so a journey never writes a path twice. */
export const S_RULESET_AUTHOR = Object.freeze({
  route: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/ruleset-author`,
} as const);

/**
 * The settings areas a project carries, in the order `PROJECT_SETTINGS_AREAS` declares them, each
 * beside the address it is reached at — `null` for the area the product has promised and not built.
 * The three that are built are read from the spellings their own page objects already hold (B-17),
 * so a screen that moves takes its nav row with it.
 */
export const PROJECT_SETTINGS_AREA_ORDER = ["ruleset", "participants", "site-facts", "ruleset-author"] as const;
export type ProjectSettingsArea = (typeof PROJECT_SETTINGS_AREA_ORDER)[number];

export function areaAddress(area: ProjectSettingsArea, tenantId: string, projectId: string): string | null {
  switch (area) {
    case "ruleset":
      return S_HOME.ruleset(tenantId, projectId);
    case "participants":
      return S_PARTICIPANTS.route(tenantId, projectId);
    case "site-facts":
      return null;
    case "ruleset-author":
      return S_RULESET_AUTHOR.route(tenantId, projectId);
  }
}

export class SRulesetAuthorPage {
  constructor(private readonly page: Page) {}

  /* --- the project settings frame (the sub-navigation Decision) --- */

  /** Every nav row, built or not, in the roster's order. */
  get areas(): Locator {
    return this.page.getByTestId(TESTIDS.settings.area);
  }

  /** One nav row, addressed by the area it is for — the row publishes that as `data-area`. */
  area(key: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.settings.area)}[data-area="${key}"]`);
  }

  /**
   * The same row, matched only where it is an ANCHOR. A row with an address is a link and a row
   * without one is not (I-259), and that is a fact about the element the browser can be asked for as
   * a count — never a one-instant reading of `tagName`.
   */
  areaLink(key: string): Locator {
    return this.page.locator(`a${testIdSelector(TESTIDS.settings.area)}[data-area="${key}"]`);
  }

  /* --- the screen (the Author edition Decision § 1) --- */

  get section(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.section);
  }

  /** The pinned identity this edition is forked from, carrying the parent's digest (I-262). */
  get parent(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.parent);
  }

  get version(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.version);
  }

  get diff(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.diff);
  }

  get diffRows(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.diffRow);
  }

  /** One row of the diff, addressed by the parameter it is for (I-265: the key is `data-param`). */
  row(parameter: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.rulesetAuthor.diffRow)}[data-param="${parameter}"]`);
  }

  /** The authored-value field of one row. */
  value(parameter: string): Locator {
    return this.row(parameter).getByTestId(TESTIDS.rulesetAuthor.value);
  }

  get submit(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.submit);
  }

  get refusal(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.refusal);
  }

  /** The way onward after a commit, and the way out of the unpinned state. */
  get seeRuleset(): Locator {
    return this.page.getByTestId(TESTIDS.rulesetAuthor.seeRuleset);
  }

  /** What the section says when the act has been carried out — the live region, not a toast. */
  get status(): Locator {
    return this.section.getByRole("status");
  }

  /* --- the one act pattern this screen opens (R-UI-021) --- */

  get dialog(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.dialog);
  }

  get subjectRows(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.subjectRow);
  }

  get confirm(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.confirm);
  }

  /** The crumb that names the page a reader is on — the shell's own id, read here and added by none. */
  get crumbPage(): Locator {
    return this.page.getByTestId(TESTIDS.shell.crumbPage);
  }

  /* --- the rule-set screen this walk lands back on (inc-015's contract) --- */

  get editionIdentity(): Locator {
    return this.page.getByTestId(TESTIDS.ruleset.editionIdentity);
  }

  get lineageSteps(): Locator {
    return this.page.getByTestId(TESTIDS.ruleset.lineageStep);
  }

  /** The pin's own digest, whole in the document as I-206 rules it (the chip measure is styling). */
  get editionDigest(): Locator {
    return this.page.getByTestId(TESTIDS.ruleset.editionDigest);
  }

  /** Every parameter row of the pinned edition, as the rule-set screen publishes them. */
  get parameterRows(): Locator {
    return this.page.getByTestId(TESTIDS.ruleset.parameterRow);
  }

  /**
   * The regions a baseline may not compare: the frame wears this worker's own seeded identity — the
   * workspace name in the breadcrumb and the switcher, the address in the top bar — and none of it
   * is a fact these checkpoints assert.
   */
  masks(): Locator[] {
    return [
      this.page.getByTestId(TESTIDS.shell.breadcrumb),
      this.page.getByTestId(TESTIDS.shell.user),
      this.page.getByTestId(TESTIDS.shell.tenantSwitcher),
    ];
  }

  /** Open this screen by its address — for a walk that has already proven the door (R-UI-031). */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_RULESET_AUTHOR.route(tenantId, projectId));
    await expect(this.section, "the authoring section renders").toBeVisible();
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
