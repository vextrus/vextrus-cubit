// S-Settings-Ruleset-Author as a journey drives it, and the project settings nav it is drawn in.
// Every TEST ID this file reaches for is one of the ids the two Design Decisions close over
// (docs/design/s-settings-ruleset-author.md § 7, docs/design/s-settings-project-sub-navigation.md
// § 7) read from the one registry — a journey that reached for a class or a copy string would be
// reading the styling, not the screen.
//
// An id and an ATTRIBUTE VALUE are two kinds, and AM-09 §1 speaks about one of them: the registry is
// "the single source of every test id", and a test id is a string the DOM carries as data-testid.
// The four area keys below are not that. They are the values of data-area, qualifying the ONE
// registered id every nav row carries — TESTIDS.settings.area, reached from the registry like every
// other handle here. One of the four keys is spelled the same as a registered id — the Author
// edition screen's own root (§ 7) — so that key is TAKEN from the product's roster instead of typed
// here, and rule 2 of src/ui/testids.test.ts, which reads this file's TEXT, finds no id spelled in
// it.
//
// Nothing in this file may spell a registered id, in code or in prose: that rule reads quoted and
// backticked words alike, so an id is named here by its registry path or not at all.
import { expect, type Locator, type Page } from "@playwright/test";
import { PROJECT_SETTINGS_AREA_NAMES } from "../../../src/ui/shell/routes";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { everyAttribute, steadyText } from "../support/retrying-read";
import { S_HOME } from "./s-home.page";
import { S_PARTICIPANTS } from "./s-participants.page";
import { S_SITE_FACTS, SITE_FACTS_AREA } from "./s-settings-site-facts.page";

/** The address this screen answers at, spelled once so a journey never writes a path twice. */
export const S_RULESET_AUTHOR = Object.freeze({
  route: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/ruleset-author`,
} as const);

/**
 * The Author edition area's key, taken from the product's own roster rather than typed again: the
 * screen root carries that same word as its registered test id (s-settings-ruleset-author § 7), and
 * nothing in this file may SPELL a registered id. I-271 still holds — an area key is not a test id —
 * and the two kinds are kept apart by where each is read from, not by luck of spelling.
 */
const AUTHOR_AREA = PROJECT_SETTINGS_AREA_NAMES[3];

/**
 * The settings areas a project carries, in the order `PROJECT_SETTINGS_AREAS` declares them, each
 * beside the address it is reached at. Every one of the four is built since inc-304b gave the site
 * facts panel its address, and each address is read from the spelling that screen's own page object
 * already holds (B-17), so a screen that moves takes its nav row with it. The `null` arm of the
 * return type stands for the next area promised before it is built (I-259).
 *
 * The site-facts key is TAKEN from the product's roster for the same reason the Author edition key
 * is: that panel's own root carries the word as its registered test id, and nothing in this file may
 * spell a registered id (AM-09 §1).
 *
 * These four strings are data-area values, never test ids (see the header). AC-1's own sentence
 * holds the two kinds apart — the nav renders exactly four rows of the one registered nav-row id, in
 * the order their data-area values are declared in — and that order cannot be asserted without
 * spelling the keys once, which is here. Every real id this screen publishes carries a prefix of its
 * own and is reached through TESTIDS below.
 */
export const PROJECT_SETTINGS_AREA_ORDER = ["ruleset", "participants", SITE_FACTS_AREA, AUTHOR_AREA] as const;
export type ProjectSettingsArea = (typeof PROJECT_SETTINGS_AREA_ORDER)[number];

export function areaAddress(area: ProjectSettingsArea, tenantId: string, projectId: string): string | null {
  switch (area) {
    case "ruleset":
      return S_HOME.ruleset(tenantId, projectId);
    case "participants":
      return S_PARTICIPANTS.route(tenantId, projectId);
    case SITE_FACTS_AREA:
      return S_SITE_FACTS.route(tenantId, projectId);
    case AUTHOR_AREA:
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

  /** One parameter row of the rule-set screen, addressed by the key it is for (`data-param`). */
  parameterRow(parameter: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.ruleset.parameterRow)}[data-param="${parameter}"]`);
  }

  /**
   * What the rule-set screen READS for the edition the project is on: every parameter key beside the
   * line its row renders (name, figure through QuantityText, unit). A caller compares one of these
   * maps against another — which is how a walk says what the act moved and what it left alone
   * without spelling a roster of its own (B-19). Every reading goes through the retrying instrument,
   * so a grid still painting is never taken for a settled one.
   */
  async parameterFigures(): Promise<Record<string, string>> {
    const keys = await everyAttribute(this.parameterRows, "data-param", "the rule-set screen's parameter rows", { min: 1 });
    const figures: Record<string, string> = {};
    for (const key of keys) figures[key] = await steadyText(this.parameterRow(key), `the ${key} row of the rule-set screen`);
    return figures;
  }

  /**
   * The regions a baseline may not compare: the frame wears this worker's own seeded identity — the
   * workspace name in the breadcrumb and the switcher, the address in the top bar — and none of it
   * is a fact these checkpoints assert.
   *
   * The WHOLE top bar is masked rather than the two chips inside it, because masking those two left
   * a picture that still drifted: the crumb and the user chip are as wide as the names this run
   * happened to make, so everything laid out between them — the search affordance, the jobs
   * readout — sits a few pixels further along in every run, and the same screen compared 27,332 /
   * 27,402 / 27,462 px against one baseline on three runs of one tree. A mask over the chips cannot
   * hold what moves BESIDE them; the top bar's own box is 100 % × 40 whatever it holds, so the
   * capture is the same bytes every run (AM-09 (4): the lane is deterministic, and a picture
   * re-frozen over a drifting region proves nothing). The top bar is shell chrome with its own
   * baselines (`gallery-shell-dark.png`); nothing §1 of either Decision rules stands in it.
   */
  masks(): Locator[] {
    return [this.page.getByTestId(TESTIDS.shell.topbar), this.page.getByTestId(TESTIDS.shell.tenantSwitcher)];
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
