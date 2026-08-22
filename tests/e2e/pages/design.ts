/**
 * The `/design` gallery, as J-004 drives it (R-UI-011, AM-03(4), Design Decision
 * docs/design/s-design.md, and the evidence decision committed beside it).
 *
 * Everything the journey knows about the screen lives here: the routes, the roster of
 * framings that become baselines, and the keyboard gesture that opens each closed-by-default
 * overlay. The spec then reads as the checkpoint list the Design Decision writes down, and a
 * gallery entry that changes its trigger changes one row of a table rather than ten tests.
 *
 * Three rules this object keeps on the journey's behalf:
 *
 *   Nothing is pointed at. Every gesture is a key pressed on a focused element (AC-4), so a
 *   surface that only opens to a mouse is a defect this journey reports rather than routes
 *   around.
 *
 *   Nothing is asserted synchronously. An overlay open is polled for through a web-first
 *   `toBeVisible`, which is what makes the shot that follows it a photograph of a settled
 *   surface rather than a race.
 *
 *   Dark is entered, never assumed. `data-theme` is written by the screen's own toggle and is
 *   in memory only (s-design.md §3), so every navigation lands in light and dark is re-entered
 *   by operating `design-theme-toggle` (Design Decision, interpretation 2).
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The route the gallery answers on (s-design.md §11). */
const ROUTE = '/design';

/** The attribute the toggle writes on the document element, and its two values (§3). */
const THEME_ATTRIBUTE = 'data-theme';
const DARK = 'dark';
const LIGHT = 'light';

/** The two themes every checkpoint is photographed and scanned in. */
export type DesignTheme = typeof LIGHT | typeof DARK;

/** The screen's seven R-UI-050 states, forced through `?state=`, in the decision's order (§2). */
export const SCREEN_STATES = [
  'loading',
  'empty',
  'error',
  'refusal',
  'partial',
  'offline',
  'permission-denied',
] as const;

export type ScreenState = (typeof SCREEN_STATES)[number];

/** The ten entries whose overlay is drawn closed and has to be opened to be photographed. */
export const OVERLAY_ENTRIES = [
  'dialog',
  'sheet',
  'consequence-dialog',
  'dropdown-menu',
  'context-menu',
  'popover',
  'tooltip',
  'select',
  'combobox',
  'toaster',
] as const;

export type OverlayEntry = (typeof OVERLAY_ENTRIES)[number];

/** The three module sections of the sheet, in the order the registry reads them (§1, §5). */
export const MODULE_SECTIONS = ['primitives', 'patterns', 'data'] as const;

export type ModuleSection = (typeof MODULE_SECTIONS)[number];

/**
 * AC-2's roster: the twenty framings committed per theme under
 * `tests/e2e/baselines/design/<theme>/`. Three element shots of the live sheet's module
 * sections, seven forced-state viewports, ten open-overlay viewports.
 */
export const DESIGN_BASELINES: readonly string[] = [
  ...MODULE_SECTIONS.map((section) => `${section}.png`),
  ...SCREEN_STATES.map((state) => `state-${state}.png`),
  ...OVERLAY_ENTRIES.map((entry) => `overlay-${entry}.png`),
];

/**
 * How one overlay is reached and recognised.
 *
 * `keys` is the gesture pressed on the focused trigger — empty for the tooltip, which opens on
 * the focus itself. `surface` is the class the primitive paints its open surface with, so what
 * the journey polls for is the product's own element and not a role a portal might share.
 */
interface OverlayGesture {
  /** The state cell the trigger sits in: `gallery-entry-<id>-<state>` (§5). */
  readonly cell: string;
  /** The focusable trigger inside that cell. */
  readonly trigger: string;
  /** The keys pressed on it, in order. */
  readonly keys: readonly string[];
  /** The open surface, wherever it is portalled to. */
  readonly surface: string;
  /** Escape closes it (everything but the toast, which is announced and then leaves). */
  readonly dismissible: boolean;
  /** Radix returns focus to the trigger on close — the modal surfaces do (R-UI-012). */
  readonly returnsFocus: boolean;
}

const OVERLAY_GESTURES: Readonly<Record<OverlayEntry, OverlayGesture>> = {
  dialog: {
    cell: 'default',
    trigger: 'button',
    keys: ['Enter'],
    surface: '.datum-dialog',
    dismissible: true,
    returnsFocus: true,
  },
  sheet: {
    cell: 'default',
    trigger: 'button',
    keys: ['Enter'],
    surface: '.datum-sheet',
    dismissible: true,
    returnsFocus: true,
  },
  'consequence-dialog': {
    cell: 'default',
    trigger: 'button',
    keys: ['Enter'],
    surface: '[data-testid="consequence-dialog"]',
    dismissible: true,
    returnsFocus: true,
  },
  'dropdown-menu': {
    cell: 'default',
    trigger: 'button',
    keys: ['Enter'],
    surface: '.datum-menu',
    dismissible: true,
    returnsFocus: false,
  },
  'context-menu': {
    cell: 'default',
    // The region itself holds the tab stop: Shift+F10 raises the context menu at whatever has
    // the focus, so the trigger is the target region and not a control inside it.
    trigger: '.datum-context-trigger',
    keys: ['Shift+F10'],
    surface: '.datum-menu',
    dismissible: true,
    returnsFocus: false,
  },
  popover: {
    cell: 'default',
    trigger: 'button',
    keys: ['Enter'],
    surface: '.datum-popover-surface',
    dismissible: true,
    returnsFocus: false,
  },
  tooltip: {
    cell: 'default',
    trigger: 'button',
    keys: [],
    surface: '.datum-tooltip',
    dismissible: true,
    returnsFocus: false,
  },
  select: {
    cell: 'placeholder',
    trigger: 'button',
    keys: ['Enter'],
    surface: '.datum-select-content',
    dismissible: true,
    returnsFocus: false,
  },
  combobox: {
    cell: 'default',
    trigger: 'input',
    keys: ['ArrowDown'],
    surface: '[data-testid="combobox-list"]',
    dismissible: true,
    returnsFocus: false,
  },
  toaster: {
    cell: 'default',
    trigger: 'button',
    keys: ['Enter'],
    surface: '.datum-toast',
    // Nothing to dismiss: sonner takes the card away itself, which is also why the journey
    // photographs it the moment it is visible.
    dismissible: false,
    returnsFocus: false,
  },
};

/** How many tab stops the toggle may be behind — it is the top bar's only control (§1). */
const TAB_BUDGET = 12;

export class DesignPage {
  constructor(private readonly page: Page) {}

  /** The screen's root, present in every state including `loading`. */
  get root(): Locator {
    return this.page.getByTestId('design-gallery-root');
  }

  /** The one control in the top bar (§1, §3). */
  get themeToggle(): Locator {
    return this.page.getByTestId('design-theme-toggle');
  }

  /** The live gallery at `/design`, settled in `theme`. */
  async gotoLive(theme: DesignTheme): Promise<void> {
    await this.visit(ROUTE, theme);
  }

  /** One forced R-UI-050 state at `/design?state=<state>`, settled in `theme` (§2). */
  async gotoState(state: ScreenState, theme: DesignTheme): Promise<void> {
    await this.visit(`${ROUTE}?state=${state}`, theme);
    await expect(this.page.getByTestId(`design-screen-state-${state}`)).toBeVisible();
  }

  /**
   * Operate `design-theme-toggle` with the keyboard: tab to it if the focus is elsewhere, then
   * Space. Radix's Switch refuses Enter (a switch in a form would submit it), so Space is the
   * gesture, and it is the one AC-4 names.
   */
  async toggleThemeByKeyboard(): Promise<void> {
    await this.focusThemeToggleByTab();
    await expect(this.themeToggle).toBeFocused();
    await this.page.keyboard.press('Space');
  }

  /**
   * Tab from wherever the focus is until the toggle holds it — R-UI-012's "keyboard
   * reachable", proved by travelling rather than by calling `focus()`. Already-focused is
   * reached in no presses, so a caller may flip the theme twice without leaving the control.
   */
  async focusThemeToggleByTab(): Promise<void> {
    for (let step = 0; step <= TAB_BUDGET; step += 1) {
      if (await this.themeToggle.evaluate((element) => element === document.activeElement)) return;
      await this.page.keyboard.press('Tab');
    }
  }

  /** The theme the document is currently painted in, read off the root element (§3). */
  themeAttribute(): Promise<string | null> {
    return this.page.evaluate(
      (attribute) => document.documentElement.getAttribute(attribute),
      THEME_ATTRIBUTE,
    );
  }

  /** The computed focus ring of the focused element — R-UI-012's 2 px outer outline. */
  focusRing(target: Locator): Promise<{ style: string; width: number }> {
    return target.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        style: computed.outlineStyle,
        width: Number.parseFloat(computed.outlineWidth),
      };
    });
  }

  /** One module section of the live sheet, for its element shot (§1). */
  section(module: ModuleSection): Locator {
    return this.page.locator('.datum-gallery-section').nth(MODULE_SECTIONS.indexOf(module));
  }

  /** The left rail's anchor for one entry — `href="#<entry-id>"` (§1). */
  railAnchor(entryId: string): Locator {
    return this.page.locator(`.datum-gallery-rail a[href="#${entryId}"]`);
  }

  /** The trigger of one overlay entry, inside its own state cell. */
  overlayTrigger(entry: OverlayEntry): Locator {
    const gesture = OVERLAY_GESTURES[entry];
    return this.page
      .getByTestId(`gallery-entry-${entry}-${gesture.cell}`)
      .locator(gesture.trigger)
      .first();
  }

  /** The surface that entry paints when it is open, wherever the portal put it. */
  overlaySurface(entry: OverlayEntry): Locator {
    return this.page.locator(OVERLAY_GESTURES[entry].surface).first();
  }

  /**
   * Open one overlay with the keyboard and poll until its surface is on the screen. Resolves
   * to the surface, so a caller can go on asserting about the thing it just opened.
   */
  async openOverlayByKeyboard(entry: OverlayEntry): Promise<Locator> {
    const gesture = OVERLAY_GESTURES[entry];
    await this.overlayTrigger(entry).focus();
    for (const key of gesture.keys) {
      await this.page.keyboard.press(key);
    }
    const surface = this.overlaySurface(entry);
    await expect(surface).toBeVisible();
    return surface;
  }

  /**
   * The surface is still open when the caller looks again — and open once more if it is not.
   *
   * Only the toast needs this: sonner takes its card away after about four seconds, which is
   * long enough for a screenshot and not always long enough for the axe scan behind it. Firing
   * a second notification is the same keyboard gesture, and by then the pixels are captured.
   */
  async keepOverlayOpen(entry: OverlayEntry): Promise<void> {
    const surface = this.overlaySurface(entry);
    if (await surface.isVisible()) return;
    await this.openOverlayByKeyboard(entry);
  }

  /** Escape closes it, and the modal surfaces hand the focus back where they took it from. */
  async dismissOverlayByKeyboard(entry: OverlayEntry): Promise<void> {
    const gesture = OVERLAY_GESTURES[entry];
    await this.page.keyboard.press('Escape');
    await expect(this.overlaySurface(entry)).toBeHidden();
    if (gesture.returnsFocus) await expect(this.overlayTrigger(entry)).toBeFocused();
  }

  /** Whether Escape is this surface's way out (everything but the toast). */
  static dismissible(entry: OverlayEntry): boolean {
    return OVERLAY_GESTURES[entry].dismissible;
  }

  /**
   * Navigate, reduce motion, and enter the theme this checkpoint is photographed in.
   *
   * `emulateMedia` is applied after the navigation because it is a page-level setting that a
   * fresh document does not reset — applying it here keeps every checkpoint's first paint under
   * the same rule, which is what lets AC-2 declare no masks.
   */
  private async visit(url: string, theme: DesignTheme): Promise<void> {
    await this.page.goto(url);
    await this.page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(this.root).toBeVisible();
    if (theme === LIGHT) return;
    await this.toggleThemeByKeyboard();
    await expect(this.page.locator('html')).toHaveAttribute(THEME_ATTRIBUTE, DARK);
    // The toggle keeps the focus it was tabbed to, and a focus ring is paint: a dark shot
    // would then differ from its light twin by a ring nobody asked about. Let it go.
    await this.themeToggle.blur();
  }
}
