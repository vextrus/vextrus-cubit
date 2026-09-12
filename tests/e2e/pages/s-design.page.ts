// S-Design as a journey drives it. Every handle is one of the four test ids the screen's Design
// Decision closes over (§ 7); nothing here reads a class or a copy string, because what the journey
// judges is the correspondence between the page and the derivation, not the styling.
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS } from "../../../src/ui/testids";
import { heldAttribute, readWhen, steadyCount } from "../support/retrying-read";

/** The route the gallery introduces. */
export const S_DESIGN_ROUTE = "/design";

export class SDesignPage {
  constructor(private readonly page: Page) {}

  /** The chrome region the visual baselines capture: the heading and its caption, nothing else. */
  get shell(): Locator {
    return this.page.getByTestId(TESTIDS.gallery.shell);
  }

  /** One section per barrel the derivation names, each carrying its id in `data-barrel`. */
  get barrels(): Locator {
    return this.page.getByTestId(TESTIDS.gallery.barrel);
  }

  /** Every catalogued component on the page, each carrying its `"<barrelId>/<ExportName>"` key. */
  get entries(): Locator {
    return this.page.getByTestId(TESTIDS.gallery.entry);
  }

  /** The theme the document resolved, read off the root element rather than from what was emulated. */
  async theme(): Promise<string | null> {
    return heldAttribute(this.page.locator("html"), "data-theme");
  }

  /**
   * READ THE GALLERY ONCE, AFTER THE GALLERY HAS SAID IT STANDS (AM-09 §4, P4b §4).
   *
   * The lane's general spelling for a single lawful reading is `afterSettled`, which waits for the
   * page-wide settle contract. This screen may not use it: the gallery RENDERS A SKELETON on
   * purpose — a bone whose pulse never ends is one of the states the wall is there to show — so the
   * page-wide "nothing is still arriving" is a promise this screen is right never to keep, and a
   * grade that waited for it waited 15 s and failed on a screen that was correct.
   *
   * Its readiness is its own, and it is already declared: `assertPopulated` is the gallery's
   * "bones rendered" — every barrel holds an entry and every entry holds a state cell, each read
   * through the retrying counts. So the single reading is taken after THAT, and the rule knows this
   * wrapper by name exactly as it knows `afterSettled`.
   */
  async afterPopulated<T>(checkpoint: string, read: () => Promise<T>): Promise<T> {
    await this.assertPopulated(checkpoint);
    return await read();
  }

  /**
   * The gallery is populated: every barrel section holds at least one entry, and every entry holds
   * at least one state cell. Read off the page, so a derivation that grew moves this by itself.
   */
  async assertPopulated(checkpoint: string): Promise<void> {
    await expect(this.shell, `${checkpoint}: the gallery chrome is on the page`).toBeVisible();

    const barrelCount = await steadyCount(this.barrels, `${checkpoint}: the gallery's barrel sections`);
    expect(barrelCount, `${checkpoint}: the page renders the derivation's barrel sections`).toBeGreaterThan(0);

    // WHAT IS ASSERTED HERE IS ASSERTED WITH A RETRYING MATCHER, NOT WITH A NUMBER READ FIRST.
    // "This section holds at least one entry" is `not.toHaveCount(0)` — one retrying assertion that
    // says what it wants. Reading the count into a variable and then judging it is a second, weaker
    // thing: it insists the count HOLD STILL, and this screen is the one place in the product where
    // that is the wrong demand — the wall renders bones and cycling states on purpose, so a per-entry
    // count taken while the gallery animates never agrees with itself three times (P4b §3's readers
    // are for a screen that ARRIVES, and the wall never finishes arriving). The identifying key is
    // still read, because the failure messages name the entry — through `readWhen`, which polls for
    // a value rather than for stillness.
    for (let index = 0; index < barrelCount; index += 1) {
      const section = this.barrels.nth(index);
      const barrelId = await readWhen(
        () => section.getAttribute("data-barrel"),
        (value) => value !== null && value !== "",
        `${checkpoint}: a barrel section names the barrel it renders`,
      );
      await expect(section.getByTestId(TESTIDS.gallery.entry), `${checkpoint}: the ${String(barrelId)} section holds at least one gallery-entry`).not.toHaveCount(0);
    }

    const entryCount = await steadyCount(this.entries, `${checkpoint}: the gallery's entries`);
    expect(entryCount, `${checkpoint}: the barrels publish components, so entries are rendered`).toBeGreaterThan(0);

    for (let index = 0; index < entryCount; index += 1) {
      const entry = this.entries.nth(index);
      const key = await readWhen(
        () => entry.getAttribute("data-entry"),
        (value) => value !== null && value !== "",
        `${checkpoint}: a gallery entry names the component it renders`,
      );
      await expect(entry.getByTestId(TESTIDS.gallery.state), `${checkpoint}: the ${String(key)} entry holds at least one gallery-state cell`).not.toHaveCount(0);
    }
  }
}
