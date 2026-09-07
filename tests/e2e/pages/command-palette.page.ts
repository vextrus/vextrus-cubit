// The command palette and the ? sheet as a journey drives them. Every handle is one of the ten
// test ids the Design Decisions close over (docs/design/command-palette.md § 7,
// docs/design/shortcut-sheet.md § 7) — a journey that reached for a class or a copy string would be
// reading the styling, not the screen.
import { expect, type Locator, type Page } from "@playwright/test";

/** The chords R-UI-032 names, spelled once so a journey never writes a key twice. */
export const PALETTE_KEYS = Object.freeze({
  open: "Meta+k",
  openControl: "Control+k",
  sheet: "?",
  close: "Escape",
  down: "ArrowDown",
  choose: "Enter",
} as const);

export class CommandPalettePage {
  constructor(private readonly page: Page) {}

  /* --- the frame's occupant --- */

  get trigger(): Locator {
    return this.page.getByTestId("shell-command-palette");
  }

  /* --- the dialog --- */

  get dialog(): Locator {
    return this.page.getByTestId("command-palette");
  }

  get input(): Locator {
    return this.page.getByTestId("command-palette-input");
  }

  get list(): Locator {
    return this.page.getByTestId("command-palette-list");
  }

  get items(): Locator {
    return this.page.getByTestId("command-palette-item");
  }

  get empty(): Locator {
    return this.page.getByTestId("command-palette-empty");
  }

  get refusal(): Locator {
    return this.page.getByTestId("command-palette-refusal");
  }

  /** One group of the list, by the `data-group` the Decision § 1 fixes. */
  group(name: string): Locator {
    return this.page.locator(`[data-testid="command-palette-group"][data-group="${name}"]`);
  }

  /** The rows of one group, in document order. */
  itemsOf(name: string): Locator {
    return this.page.locator(`[data-testid="command-palette-group"][data-group="${name}"] [data-testid="command-palette-item"]`);
  }

  /** One row by the words a person reads on it. */
  itemNamed(label: string): Locator {
    return this.items.filter({ hasText: label });
  }

  /** The option the combobox says is active (WAI-ARIA: aria-activedescendant). */
  activeOption(): Locator {
    return this.page.locator('[data-testid="command-palette-item"][aria-selected="true"]');
  }

  /* --- the ? sheet --- */

  get sheet(): Locator {
    return this.page.getByTestId("shortcut-sheet");
  }

  get sheetRows(): Locator {
    return this.page.getByTestId("shortcut-sheet-row");
  }

  /** The keys one row documents. */
  keysOf(row: Locator): Locator {
    return row.getByTestId("shortcut-sheet-keys");
  }

  /* --- gestures --- */

  /** Open the palette the way R-UI-032 promises it opens, and wait for its input to take focus. */
  async openWithChord(chord: string = PALETTE_KEYS.open): Promise<void> {
    await this.page.keyboard.press(chord);
    await expect(this.dialog, "the chord opens the command palette").toBeVisible();
    await expect(this.input, "the palette opens with focus in its input").toBeFocused();
  }

  /** Open it by pressing the bar's trigger instead. */
  async openFromTrigger(): Promise<void> {
    await this.trigger.click();
    await expect(this.dialog, "activating the trigger opens the command palette").toBeVisible();
  }

  /** Type a query into the palette's own input. */
  async type(query: string): Promise<void> {
    await this.input.fill(query);
  }

  /**
   * Arrow down until the named row is the active option, then press Enter on it. The presses are
   * bounded by the rows on screen, so a palette that never activates the row fails as an assertion
   * rather than as a hung journey.
   */
  async chooseNamed(label: string): Promise<void> {
    const row = this.itemNamed(label).first();
    await expect(row, `the list holds a row reading ${label}`).toBeVisible();
    const bound = await this.items.count();
    for (let step = 0; step <= bound; step += 1) {
      if ((await row.getAttribute("aria-selected")) === "true") break;
      await this.page.keyboard.press(PALETTE_KEYS.down);
    }
    await expect(row, `ArrowDown reaches the row reading ${label}`).toHaveAttribute("aria-selected", "true");
    await this.page.keyboard.press(PALETTE_KEYS.choose);
  }

  /** Open the ? sheet. */
  async openSheet(): Promise<void> {
    await this.page.keyboard.press(PALETTE_KEYS.sheet);
    await expect(this.sheet, "pressing ? opens the shortcut sheet").toBeVisible();
  }

  /** Dismiss whichever surface stands open. */
  async close(): Promise<void> {
    await this.page.keyboard.press(PALETTE_KEYS.close);
  }
}
