// The ⌘K palette as a journey drives it. Every handle is one of the ten test ids the Design
// Decision closes over (docs/design/command-palette.md § 7) — a journey that reached for a class or
// a copy string would be reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

export class CommandPalettePage {
  constructor(private readonly page: Page) {}

  /* --- the bar's occupant (I-135) --- */

  get trigger(): Locator {
    return this.page.getByTestId(TESTIDS.shell.commandPalette);
  }

  /* --- the dialog and its parts (Decision § 1) --- */

  get dialog(): Locator {
    return this.page.getByTestId(TESTIDS.command.palette);
  }

  get input(): Locator {
    return this.page.getByTestId(TESTIDS.command.paletteInput);
  }

  get list(): Locator {
    return this.page.getByTestId(TESTIDS.command.paletteList);
  }

  get items(): Locator {
    return this.page.getByTestId(TESTIDS.command.paletteItem);
  }

  get loading(): Locator {
    return this.page.getByTestId(TESTIDS.command.paletteLoading);
  }

  get empty(): Locator {
    return this.page.getByTestId(TESTIDS.command.paletteEmpty);
  }

  get refusal(): Locator {
    return this.page.getByTestId(TESTIDS.command.paletteRefusal);
  }

  /** One group of the list, by the `data-group` the Decision fixes for it. */
  group(id: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.command.paletteGroup)}[data-group="${id}"]`);
  }

  /** The rows of one group, in document order. */
  rows(id: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.command.paletteGroup)}[data-group="${id}"] ${testIdSelector(TESTIDS.command.paletteItem)}`);
  }

  /** The one row the palette states as active — what Enter would take. */
  get activeRow(): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.command.paletteItem)}[aria-selected="true"]`);
  }

  /** The reason an unavailable row gives in place (R-UI-020). */
  get reason(): Locator {
    return this.page.getByTestId(TESTIDS.command.paletteItemReason);
  }

  /* --- the ? sheet --- */

  get sheet(): Locator {
    return this.page.getByTestId(TESTIDS.shortcut.sheet);
  }

  get sheetRows(): Locator {
    return this.page.getByTestId(TESTIDS.shortcut.sheetRow);
  }

  /** The keycaps of one roster entry's row, found by the id the roster names it with. */
  sheetKeys(shortcutId: string): Locator {
    return this.page.locator(`${testIdSelector(TESTIDS.shortcut.sheetRow)}[data-shortcut="${shortcutId}"] ${testIdSelector(TESTIDS.shortcut.sheetKeys)}`);
  }

  /* --- driving --- */

  /** Open the palette with the chord R-UI-032 binds, from wherever focus happens to be. */
  async openWithChord(): Promise<void> {
    await this.page.keyboard.press("ControlOrMeta+k");
    await expect(this.dialog, "⌘K opens the palette over the frame").toBeVisible();
    await expect(this.input, "…with focus in its input (I-137)").toBeFocused();
  }

  /** Type a query and wait for the palette to have settled on rows or on an empty answer. */
  async search(query: string): Promise<void> {
    await this.input.fill(query);
    await expect(this.loading, "the wait ends").toHaveCount(0);
  }

  /** Open the ? sheet from wherever focus happens to be, which must not be a text field. */
  async openSheet(): Promise<void> {
    await this.page.keyboard.press("?");
    await expect(this.sheet, "? opens the shortcut sheet").toBeVisible();
  }
}
