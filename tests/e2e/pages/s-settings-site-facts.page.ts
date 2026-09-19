// S-Settings · Site facts as J-305 drives it, and the project settings nav it is drawn in.
//
// Every TEST ID this file reaches for is one of the ids the two Design Decisions close over
// (docs/design/s-settings-site-facts.md § 7, docs/design/s-settings-project-sub-navigation.md § 7)
// read from the one registry — nothing here spells one, in code or in prose (AM-09 §1, and
// src/ui/testids.test.ts, which reads this directory's TEXT). The area key this screen answers for
// is a data-area VALUE and not a test id, and it is taken from the product's own roster rather than
// typed, because the panel's own root carries that same word as its registered id.
//
// The registry keys this page object reads, which the screen publishes (§ 7):
//   TESTIDS.siteFacts.screen · .section · .face · .table · .row · .rowValue · .rowSource · .rowAct ·
//   .rowDeferral · .enter · .value · .unit · .sourceNote · .submit · .refusal
import { type Locator, type Page } from "@playwright/test";
import { PROJECT_SETTINGS_AREA_NAMES } from "../../../src/ui/shell/routes";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** The address this screen answers at, spelled once so a journey never writes a path twice. */
export const S_SITE_FACTS = Object.freeze({
  route: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/settings/${PROJECT_SETTINGS_AREA_NAMES[2]}`,
} as const);

/** This area's key, taken from the product's roster: the panel's root publishes the same word as an id. */
export const SITE_FACTS_AREA = PROJECT_SETTINGS_AREA_NAMES[2];

export class SSiteFactsPage {
  constructor(private readonly page: Page) {}

  /* --- the project settings frame (the sub-navigation Decision) --- */

  /** Every nav row, in the roster's order — read as a whole list, never row by row (the J-304 idiom). */
  get areas(): Locator {
    return this.page.getByTestId(TESTIDS.settings.area);
  }

  /** One nav row, addressed by the area it is for — the row publishes that as `data-area`. */
  area(key: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.settings.area)}[data-area="${key}"]`);
  }

  /** The same row, matched only where it is an ANCHOR: a row with an address is a link (I-259). */
  areaLink(key: string): Locator {
    return this.page.locator(`a${testIdSelector(TESTIDS.settings.area)}[data-area="${key}"]`);
  }

  /** The crumb that names the page a reader is on — the shell's own id, read here and added by none. */
  get crumbPage(): Locator {
    return this.page.getByTestId(TESTIDS.shell.crumbPage);
  }

  /* --- the screen (the Site facts Decision § 1) --- */

  /** The route's root region, carrying the screen's `data-state`. */
  get screen(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.screen);
  }

  get section(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.section);
  }

  /** The screen's one helper line, stating L-MEA-06's consequence (§ 1). */
  get face(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.face);
  }

  get table(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.table);
  }

  /** Every fact row, in the roster's order — one per member of SITE_FACTS. */
  get rows(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.row);
  }

  /** One row, addressed by the fact it is for (`data-fact`). */
  row(fact: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.siteFacts.row)}[data-fact="${fact}"]`);
  }

  /** What one row reads as its entered value — `{value} {unit}`, absent while the fact is. */
  rowValue(fact: string): Locator {
    return this.row(fact).getByTestId(TESTIDS.siteFacts.rowValue);
  }

  /** The note the entry cited, verbatim. */
  rowSource(fact: string): Locator {
    return this.row(fact).getByTestId(TESTIDS.siteFacts.rowSource);
  }

  /** The act that entered the fact, as an IdChip (short form; the id itself on `data-value`). */
  rowAct(fact: string): Locator {
    return this.row(fact).getByTestId(TESTIDS.siteFacts.rowAct);
  }

  /** The named deferral an absent fact renders — the one RefusalState, in the row (R-UI-020). */
  rowDeferral(fact: string): Locator {
    return this.row(fact).getByTestId(TESTIDS.siteFacts.rowDeferral);
  }

  /**
   * The refusal INSIDE a deferral, and the code it carries.
   *
   * The registry declares `TESTIDS.refusal.code`, and the shipped RefusalState draws no such element: its own
   * Decision withdrew the code chip and rules the code machine-readable on `data-code`
   * (s-settings-site-facts.md I-280 and its § Additional test hooks). So the code is read off the
   * renderer's own attribute, and this journey builds no chip of its own to close the gap — that
   * would be the second spelling of a refusal B-17 forbids.
   */
  deferralRefusal(fact: string): Locator {
    return this.rowDeferral(fact).getByTestId(TESTIDS.refusal.state);
  }

  /** The evidence a refusal always carries — the link to what resolves it (R-UI-020). */
  deferralEvidence(fact: string): Locator {
    return this.rowDeferral(fact).getByTestId(TESTIDS.refusal.evidenceLink);
  }

  /** The row's own door: opens the entry form under it, or stands shut for a reader without the permission. */
  enter(fact: string): Locator {
    return this.row(fact).getByTestId(TESTIDS.siteFacts.enter);
  }

  /* --- the entry form, open under the row it belongs to (I-281) --- */

  get value(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.value);
  }

  /** The unit Select's trigger — the shipped primitive, never a native `select` (the Direction's rule). */
  get unit(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.unit);
  }

  /**
   * The unit listbox the trigger opens, and its options by the canon's own spelling. The listbox is
   * the Select primitive's own handle, derived from the trigger's — `${testId}-listbox`, built here
   * from the registry entry rather than spelled (src/ui/primitives/core/select.tsx).
   */
  get unitOptions(): Locator {
    return this.page.locator(`[data-testid="${TESTIDS.siteFacts.unit}-listbox"] [role="option"]`);
  }

  unitOption(unit: string): Locator {
    return this.page.locator(`[data-testid="${TESTIDS.siteFacts.unit}-listbox"] [role="option"][data-value="${unit}"]`);
  }

  get sourceNote(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.sourceNote);
  }

  get submit(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.submit);
  }

  /** The panel's own refusal slot — one RefusalState for a refusal of the whole panel (§ 2). */
  get refusal(): Locator {
    return this.page.getByTestId(TESTIDS.siteFacts.refusal);
  }

  /* --- the one act pattern this screen opens (R-UI-021) --- */

  get dialog(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.dialog);
  }

  get digestLine(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.digestLine);
  }

  get effectLines(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.effectLines);
  }

  get confirm(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.confirm);
  }

  /**
   * The regions a baseline may not compare: the frame wears this worker's own seeded identity — the
   * workspace name in the breadcrumb and the switcher, the address in the top bar — and none of it
   * is a fact these checkpoints assert. The WHOLE top bar is masked, for the reason
   * s-settings-ruleset-author.page.ts records: a mask over the two chips cannot hold what moves
   * BESIDE them, and a picture re-frozen over a drifting region proves nothing (AM-09 (4)).
   */
  masks(): Locator[] {
    return [this.page.getByTestId(TESTIDS.shell.topbar), this.page.getByTestId(TESTIDS.shell.tenantSwitcher)];
  }

  /** The page this screen is driven on, for the assertions that are about the browser itself. */
  at(): Page {
    return this.page;
  }
}
