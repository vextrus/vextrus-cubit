// S-Viewer's views/grid region as a journey drives it (inc-203's test contract): the closed test ids
// of the Design Decision §7, and the gestures J-021 walks — spelled once so no journey writes a
// selector or a theme flip twice (C-05, B-17).
//
// It holds no opinion about the sheet beside it: the camera, the address and the status line are
// `tests/e2e/viewer/s-viewer.page.ts`'s, and a journey that reads both opens both.
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** S-Viewer's views/grid panel and the overlay canvas over the sheet. */
export class SViewerPartitionPage {
  constructor(private readonly page: Page) {}

  get panel(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partition);
  }

  get heading(): Locator {
    return this.panel.getByRole("heading", { level: 2 });
  }

  get viewsToggle(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionViewsToggle);
  }

  get gridToggle(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionGridToggle);
  }

  get viewRows(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionView);
  }

  get axisRows(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionAxis);
  }

  get deferralRows(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionGridDeferral);
  }

  get overlayCanvas(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionCanvas);
  }

  get groups(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionGroups);
  }

  get offeredGroups(): Locator {
    return this.page.getByTestId(TESTIDS.offered.groups);
  }

  get retry(): Locator {
    return this.page.getByTestId(TESTIDS.viewer.partitionRetry);
  }

  get dialog(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.dialog);
  }

  get subjectRows(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.subjectRow);
  }

  get digestLine(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.digestLine);
  }

  get confirm(): Locator {
    return this.page.getByTestId(TESTIDS.consequence.confirm);
  }

  /** One stored view's row, by the view key it names. */
  viewRow(viewKey: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.viewer.partitionView)}[data-view-key="${viewKey}"]`);
  }

  /** One offered group, by the class it proposes. */
  group(viewType: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.offered.group)}[data-view-type="${viewType}"]`);
  }

  /** The door of one offered group — the one that opens the dialog, never the act itself (I-81). */
  groupConfirm(viewType: string): Locator {
    return this.group(viewType).getByTestId(TESTIDS.offered.groupConfirm);
  }

  /** A `data-` hook off the overlay canvas, as a number — what the machine says it drew. */
  async count(name: string): Promise<number> {
    const raw = await this.overlayCanvas.getAttribute(name);
    expect(raw, `the overlay canvas publishes ${name} (Decision §1)`).not.toBeNull();
    return Number(raw);
  }

  /** The test id the focused element carries, and the classes it wears — the keyboard walk's reading. */
  async focused(): Promise<{ testId: string; classes: string }> {
    return this.page.evaluate(() => {
      const active = document.activeElement;
      return { testId: active?.getAttribute("data-testid") ?? "", classes: active?.className ?? "" };
    });
  }

  /** Flip the document's theme the way the shell does, and wait for the root to say so. */
  async setTheme(theme: "light" | "dark"): Promise<void> {
    await this.page.evaluate((asked) => document.documentElement.setAttribute("data-theme", asked), theme);
    await expect(this.page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", theme);
  }

  /** One computed style of an element, read in the page (no colour is ever spelled here). */
  computed(on: Locator, property: string): Promise<string> {
    return on.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
  }
}
