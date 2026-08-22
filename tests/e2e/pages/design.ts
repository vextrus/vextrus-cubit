/**
 * The `/design` gallery, as journey J-004 operates it (Design Decision
 * docs/design/design-gallery-design-exercised-end-to-end-not-changed.md §11; C-05).
 *
 * A page object rather than selectors sprinkled through the spec: the screen's structure is
 * one screen's business, and the journey should read as the checkpoint order the decision
 * fixes — open, light, flip, dark, keyboard.
 *
 * The axe helper lives here too, and deliberately not in tests/e2e/axe.ts: that file is the
 * lane's any-impact harness check, proved in both directions by tests/e2e/harness.spec.ts,
 * and this journey's gate is the Q-11 threshold — impact serious or critical — settled in
 * this increment's spec. Widening or narrowing the lane's helper to suit one journey would
 * quietly change what every other journey is judged by.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The three module blocks of the main column, in the order the sheet reads (Decision §1). */
export type GalleryGroup = 'primitives' | 'patterns' | 'data';

/** Barrel order — Primitives, Patterns, Data — which is the order the sections render in. */
const GROUP_ORDER: readonly GalleryGroup[] = ['primitives', 'patterns', 'data'];

/** The attribute the toggle writes on the document element, and its dark value (Decision §10). */
const THEME_ATTRIBUTE = 'data-theme';
const DARK = 'dark';

/** One frame of slack on top of the token's own duration, so the last step has landed. */
const SETTLE_MARGIN_MS = 60;

/** Q-11's threshold for this journey: everything else is printed, never blocking (AC-3). */
const BLOCKING_IMPACTS: ReadonlySet<string> = new Set(['serious', 'critical']);

/** What axe calls a violation, read off the builder rather than off a package of its own. */
type AxeViolation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

/** Every violation in the words axe used, whatever its impact — AC-3's "prints every finding". */
function describeViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map((violation) => {
      const where = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      return `  ${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} — ${where}`;
    })
    .join('\n');
}

/**
 * Q-11 for J-004 (R-UI-012, AC-3): zero violations of impact serious or critical on the page
 * as it stands, with no overlay open.
 *
 * Everything axe saw is printed first, at every impact, so a minor finding owned by another
 * increment (the DataTable selection columnheader, inc-006) is visible in the journey's
 * output and blocks nothing — and so that a *serious* finding is already in the log before
 * the assertion that refuses it.
 *
 * The page must come from a browser *context*: `@axe-core/playwright` refuses a page made by
 * `browser.newPage()`. Playwright's own `page` fixture is always context-made.
 */
export async function expectNoSeriousOrCriticalAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const seen = results.violations;
  const where = page.url();
  if (seen.length === 0) {
    console.log(`axe on ${where}: no violations at any impact`);
  } else {
    console.log(`axe on ${where}: ${String(seen.length)} finding(s) at all impacts:\n${describeViolations(seen)}`);
  }

  const blocking = seen.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));
  expect(
    blocking.map((violation) => violation.id),
    `Q-11: axe found ${String(blocking.length)} serious/critical violation(s) on ${where}:\n${describeViolations(blocking)}`,
  ).toEqual([]);
}

/** The gallery screen, spoken to through the test ids the C-05 contract fixes. */
export class DesignGalleryPage {
  readonly page: Page;

  /**
   * A field assigned in the body, not a parameter property: `constructor(readonly page: Page)`
   * is the one TypeScript construct node's strip-only loader refuses, and this file is loaded
   * outside vitest by the baseline-capture script as well as by Playwright.
   */
  constructor(page: Page) {
    this.page = page;
  }

  /** The screen's root (Decision §11). */
  root(): Locator {
    return this.page.getByTestId('design-gallery-root');
  }

  /** The one control in the top bar; the only writer of `data-theme` (Decision §10). */
  themeToggle(): Locator {
    return this.page.getByTestId('design-theme-toggle');
  }

  /** Checkpoint "open": goto /design and wait for the root to be there (AC-2). */
  async open(): Promise<void> {
    await this.page.goto('/design');
    await expect(this.root()).toBeVisible();
  }

  /** What the document element currently says the theme is — `null` before any flip. */
  theme(): Promise<string | null> {
    return this.page.evaluate(
      (attribute) => document.documentElement.getAttribute(attribute),
      THEME_ATTRIBUTE,
    );
  }

  /**
   * Operate the toggle, wait for the attribute the operation writes, and then let the sheet
   * finish repainting.
   *
   * Two waits, because there are two things happening. The attribute is React state followed
   * by a DOM write, and a screenshot taken between the two frames the old theme. The repaint
   * that follows is not instant either: the theme flip carries no transition of its own
   * (Decision §3), but every `.datum-control` transitions its own background, border and text
   * over `--motion-state-duration`, so for that long the fields are painted part-way between
   * the themes — long enough for an axe colour-contrast scan to report an interpolated colour
   * that neither theme ever shows. The duration is read from the token sheet rather than
   * written here, so it stays the one the motion decision fixes (R-UI-004).
   */
  async toggleTheme(): Promise<void> {
    const before = await this.theme();
    await this.themeToggle().click();
    await expect.poll(() => this.theme()).not.toBe(before);
    await this.page.waitForTimeout(await this.stateDurationMs());
  }

  /** `--motion-state-duration` in milliseconds, plus a frame — zero under reduced motion. */
  async stateDurationMs(): Promise<number> {
    const declared = await this.page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--motion-state-duration').trim(),
    );
    const seconds = declared.endsWith('ms') ? Number(declared.slice(0, -2)) : Number(declared.replace('s', '')) * 1000;
    return (Number.isFinite(seconds) ? seconds : 0) + SETTLE_MARGIN_MS;
  }

  /**
   * One module block's section — the unit the baselines frame (Decision §1): its bounding box
   * holds that module's every entry card and nothing of the chrome.
   */
  group(name: GalleryGroup): Locator {
    return this.root()
      .locator('main')
      .locator('section.datum-gallery-section')
      .nth(GROUP_ORDER.indexOf(name));
  }

  /** The Select entry drawn in its placeholder state — the keyboard step's overlay (AC-3). */
  selectPlaceholderTrigger(): Locator {
    return this.page.getByTestId('gallery-entry-select-placeholder').locator('button');
  }

  /** True when the given locator's element is the document's active element. */
  isFocused(locator: Locator): Promise<boolean> {
    return locator.evaluate((element) => element === document.activeElement);
  }

  /**
   * Tab until the focus stands on `target`, keyboard only. Returns how many presses it took,
   * so a step that never arrives fails on the count rather than on a later assertion.
   */
  async tabTo(target: Locator, limit: number): Promise<number> {
    for (let presses = 1; presses <= limit; presses += 1) {
      await this.page.keyboard.press('Tab');
      if (await this.isFocused(target)) return presses;
    }
    throw new Error(`R-UI-012: focus never reached the element after ${String(limit)} Tab presses`);
  }

  /**
   * The focus ring R-UI-012 requires: 2 px solid, in the active theme's own `--cobalt-500`.
   *
   * The colour is resolved from the token at run time and never written as a literal — the
   * two themes carry different cobalt values, and a hard-coded one would pass in light and
   * be wrong in dark (R-UI-001).
   */
  async expectFocusRing(target: Locator): Promise<void> {
    const ring = await target.evaluate((element) => {
      const style = getComputedStyle(element);
      const token = getComputedStyle(document.documentElement)
        .getPropertyValue('--cobalt-500')
        .trim();
      // The token is resolved through the browser's own colour parser rather than by hand:
      // `outline-color` is serialised as `rgb(...)`, and comparing that to a hex string is
      // how a green assertion is written that never compares anything.
      const probe = document.createElement('span');
      probe.style.color = token;
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return {
        width: style.outlineWidth,
        style: style.outlineStyle,
        colour: style.outlineColor,
        expected,
        focusVisible: element.matches(':focus-visible'),
        token,
      };
    });

    expect(ring.token, 'the active theme resolves no --cobalt-500').not.toBe('');
    expect(ring.focusVisible, 'the element does not match :focus-visible').toBe(true);
    expect(ring.width, 'the focus ring is not 2 px (R-UI-012)').toBe('2px');
    expect(ring.style, 'the focus ring is not a solid outline (R-UI-012)').toBe('solid');
    expect(ring.colour, 'the focus ring is not the theme’s --cobalt-500 (R-UI-012)').toBe(
      ring.expected,
    );
  }

  /** The dark value, exported so the journey never spells the attribute itself. */
  static get dark(): string {
    return DARK;
  }
}
