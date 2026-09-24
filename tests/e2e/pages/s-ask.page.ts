/**
 * S-Ask, as the journey walks it (docs/design/s-ask.md §6's closed hook contract).
 *
 * Every locator is found by the id the Decision fixes or by the role and name a reader uses; nothing
 * here knows a class name or a DOM shape, and nothing here judges the product. The ids are READ from
 * `src/ui/testids.ts` — the product's one home for them (AM-09 §1).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { idChipMasks, shellMasks } from "./shell.page";
import { heldAttribute } from "../support/retrying-read";

/** The address this screen answers at (Decision §6, test contract). */
export const S_ASK = Object.freeze({
  ask: (tenantId: string, projectId: string): string => `/t/${tenantId}/p/${projectId}/takeoff/ask`,
} as const);

export class SAskPage {
  constructor(private readonly page: Page) {}

  /** Open the screen's address directly and wait for the screen to stand. */
  async open(tenantId: string, projectId: string): Promise<void> {
    await this.page.goto(S_ASK.ask(tenantId, projectId));
    await expect(this.screen, "the ask screen renders for a project the workspace holds").toBeVisible();
  }

  /** Reach the screen the way a reader does: the takeoff lane's own seventh tab. */
  async openThroughNav(): Promise<void> {
    await this.navAsk.click();
    await this.page.waitForURL(/takeoff\/ask/);
    await expect(this.screen, "the seventh tab lands on the ask screen").toBeVisible();
  }

  /**
   * Ask one question through the band, the way a reader does: typed, then the one primary. The
   * field is live only once the client has hydrated — the crumb the screen claims is the fact only
   * the client renders (journeys.md: hydration).
   */
  async ask(question: string): Promise<Locator> {
    await expect(this.crumbPage, "the screen has hydrated and claimed its crumb").toHaveText(/.+/u);
    const before = Number((await heldAttribute(this.screen, "data-answers")) ?? "0");
    await this.field.fill(question);
    await this.submit.click();
    await expect(this.screen, "the question was kept as a new answer").toHaveAttribute("data-answers", String(before + 1));
    await expect(this.screen, "and it has been answered").not.toHaveAttribute("data-answering", "true");
    return this.newest;
  }

  get screen(): Locator {
    return this.page.getByTestId(TESTIDS.ask.screen);
  }
  get navAsk(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.navAsk);
  }
  get takeoffNav(): Locator {
    return this.page.getByTestId(TESTIDS.takeoff.nav);
  }
  get crumbPage(): Locator {
    return this.page.getByTestId(TESTIDS.shell.crumbPage);
  }
  get main(): Locator {
    return this.page.getByTestId(TESTIDS.shell.main);
  }
  get revision(): Locator {
    return this.page.getByTestId(TESTIDS.ask.revision);
  }
  get form(): Locator {
    return this.page.getByTestId(TESTIDS.ask.form);
  }
  get field(): Locator {
    return this.page.getByTestId(TESTIDS.ask.field);
  }
  get submit(): Locator {
    return this.page.getByTestId(TESTIDS.ask.submit);
  }
  get thread(): Locator {
    return this.page.getByTestId(TESTIDS.ask.thread);
  }
  get empty(): Locator {
    return this.page.getByTestId(TESTIDS.ask.empty);
  }
  get example(): Locator {
    return this.page.getByTestId(TESTIDS.ask.example);
  }
  get answers(): Locator {
    return this.page.getByTestId(TESTIDS.ask.answer);
  }
  /** The newest answer: the thread reads newest first (I-405). */
  get newest(): Locator {
    return this.answers.first();
  }

  /** One answer's parts. */
  question(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.question);
  }
  understood(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.understood);
  }
  body(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.body);
  }
  partial(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.partial);
  }
  evidence(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.evidence);
  }
  shows(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.show);
  }
  clarify(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.clarify);
  }
  readings(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.reading);
  }
  readingNone(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.ask.readingNone);
  }
  refusal(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.refusal.state);
  }
  refusalLink(answer: Locator): Locator {
    return answer.getByTestId(TESTIDS.refusal.evidenceLink);
  }
  /** Every figure an answer states: an EvidenceLink carrying its exact value (I-398, I-404). */
  figures(answer: Locator): Locator {
    return answer.locator(`${testIdSelector(TESTIDS.evidence.link)}[data-figure]`);
  }

  /** What state the screen says it is in — the RENDERED contract a read waits on (R-UI-050). */
  async state(): Promise<string | null> {
    return heldAttribute(this.screen, "data-state");
  }

  /**
   * What a picture of this screen must not compare: the shell's per-run identities, the revision
   * chip whose value changes with every staged run, and every "Asked …" time.
   */
  masks(): Locator[] {
    return [...shellMasks(this.page), ...idChipMasks(this.page), this.revision, this.page.getByTestId(TESTIDS.ask.asked)];
  }
}
