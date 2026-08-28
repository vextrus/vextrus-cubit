// S-Design as a journey drives it. Every handle is one of the four test ids the screen's Design
// Decision closes over (§ 7); nothing here reads a class or a copy string, because what the journey
// judges is the correspondence between the page and the derivation, not the styling.
import { expect, type Locator, type Page } from "@playwright/test";

/** The route the gallery introduces. */
export const S_DESIGN_ROUTE = "/design";

export class SDesignPage {
  constructor(private readonly page: Page) {}

  /** The chrome region the visual baselines capture: the heading and its caption, nothing else. */
  get shell(): Locator {
    return this.page.getByTestId("gallery-shell");
  }

  /** One section per barrel the derivation names, each carrying its id in `data-barrel`. */
  get barrels(): Locator {
    return this.page.getByTestId("gallery-barrel");
  }

  /** Every catalogued component on the page, each carrying its `"<barrelId>/<ExportName>"` key. */
  get entries(): Locator {
    return this.page.getByTestId("gallery-entry");
  }

  /** The theme the document resolved, read off the root element rather than from what was emulated. */
  async theme(): Promise<string | null> {
    return this.page.locator("html").getAttribute("data-theme");
  }

  /**
   * The gallery is populated: every barrel section holds at least one entry, and every entry holds
   * at least one state cell. Read off the page, so a derivation that grew moves this by itself.
   */
  async assertPopulated(checkpoint: string): Promise<void> {
    await expect(this.shell, `${checkpoint}: the gallery chrome is on the page`).toBeVisible();

    const barrelCount = await this.barrels.count();
    expect(barrelCount, `${checkpoint}: the page renders the derivation's barrel sections`).toBeGreaterThan(0);

    for (let index = 0; index < barrelCount; index += 1) {
      const section = this.barrels.nth(index);
      const barrelId = await section.getAttribute("data-barrel");
      expect(barrelId, `${checkpoint}: a barrel section names the barrel it renders`).not.toBeNull();
      expect(
        await section.getByTestId("gallery-entry").count(),
        `${checkpoint}: the ${String(barrelId)} section holds at least one gallery-entry`,
      ).toBeGreaterThan(0);
    }

    const entryCount = await this.entries.count();
    expect(entryCount, `${checkpoint}: the barrels publish components, so entries are rendered`).toBeGreaterThan(0);

    for (let index = 0; index < entryCount; index += 1) {
      const entry = this.entries.nth(index);
      const key = await entry.getAttribute("data-entry");
      expect(
        await entry.getByTestId("gallery-state").count(),
        `${checkpoint}: the ${String(key)} entry holds at least one gallery-state cell`,
      ).toBeGreaterThan(0);
    }
  }
}
