/**
 * J-004 — "Design gallery renders both themes; visual baselines; axe" (Bible J-004).
 *
 * The checkpoint order is the Design Decision's (§2), and it is fixed so that every
 * assertion is deterministic: open, gallery-light, theme flip, gallery-dark, keyboard.
 * `/design` is visited with no `?state=` query — the gallery J-004 names is the live sheet;
 * the screen's own seven forced states are proved by inc-007b's acceptance and are not
 * checkpoints here (recorded interpretation 1).
 *
 * The titles carry `J-004` so that `pnpm e2e --journey J-004` — which is Playwright's own
 * `--grep` over the full title path — selects this file and nothing else.
 */
import { expect, test } from '@playwright/test';
import { DesignGalleryPage, expectNoSeriousOrCriticalAxeViolations } from './pages/design';
import type { GalleryGroup } from './pages/design';

/** The three module blocks, each framed by a baseline of its own in each theme (Decision §1). */
const GROUPS: readonly GalleryGroup[] = ['primitives', 'patterns', 'data'];

/**
 * Six screenshots and two full-page axe scans do not fit the config's 60 s default, and the
 * config is not this increment's to change. `test.setTimeout` raises this test alone.
 */
const VISUAL_BUDGET_MS = 240_000;

/** The keyboard walk crosses the rail and every entry before the Select one; give it room. */
const KEYBOARD_BUDGET_MS = 180_000;

/** An upper bound on Tab presses, not an expectation: the walk fails on arrival, not on count. */
const TAB_LIMIT = 500;

test.describe('J-004', () => {
  test('J-004 gallery: both themes match their committed baselines and carry no serious axe finding', async ({
    page,
  }) => {
    test.setTimeout(VISUAL_BUDGET_MS);
    const gallery = new DesignGalleryPage(page);

    // Checkpoint "open" (Decision §2.1): the sheet is up and the document element carries no
    // theme attribute at all — the initial render is light by the token sheet's `:root`, not
    // by anything this journey did.
    await gallery.open();
    expect(await gallery.theme(), 'the initial render already carries a data-theme').toBeNull();

    // Checkpoint "gallery-light" (Q-06, V-E2E): each module section against its committed
    // Linux baseline at maxDiffPixelRatio 0.002. The names are arrays, never slash-containing
    // strings — a string is flattened to dashes and misses tests/e2e/baselines/design/.
    for (const group of GROUPS) {
      await expect(gallery.group(group)).toHaveScreenshot(['design', `${group}-light.png`]);
    }
    // REHEARSAL MARKER
    // Q-11 at the light checkpoint, with no overlay open: an open menu, select or popover
    // trips rules that belong to the overlay and not to this sheet (Decision §4).
    await expectNoSeriousOrCriticalAxeViolations(page);

    // Checkpoint "theme flip" (Decision §2.3, §10): the toggle is the attribute's only writer.
    await gallery.toggleTheme();
    expect(await gallery.theme(), 'operating the toggle did not put the sheet in dark').toBe(
      DesignGalleryPage.dark,
    );

    // Checkpoint "gallery-dark" (R-UI-011: "every state in both themes"; Q-06).
    for (const group of GROUPS) {
      await expect(gallery.group(group)).toHaveScreenshot(['design', `${group}-dark.png`]);
    }

    // Q-11 again — the flip is total or the dark scan says which rule it stranded.
    await expectNoSeriousOrCriticalAxeViolations(page);
  });

  test('J-004 keyboard: the toggle and the Select are reachable, ringed and operable by key alone', async ({
    page,
  }) => {
    test.setTimeout(KEYBOARD_BUDGET_MS);
    const gallery = new DesignGalleryPage(page);

    // The keyboard step starts where checkpoint gallery-dark left the sheet (Decision §5):
    // in dark, no overlay open. The flip is by pointer here on purpose — what this test
    // proves is the *keyboard* path, and it should not depend on the gesture that set it up.
    await gallery.open();
    await gallery.toggleTheme();
    expect(await gallery.theme()).toBe(DesignGalleryPage.dark);

    // §5.1 — Tab until focus stands on the toggle, and the ring R-UI-012 requires is there:
    // 2 px solid in the dark theme's own --cobalt-500.
    const toggle = gallery.themeToggle();
    await gallery.tabTo(toggle, TAB_LIMIT);
    await gallery.expectFocusRing(toggle);

    // §5.2 — Space flips it back. The toggle writes both directions, so the attribute is now
    // the explicit `light`, not the absence it started at (R-UI-012: keyboard operable).
    await page.keyboard.press('Space');
    await expect.poll(() => gallery.theme()).toBe('light');

    // §5.3 — the Select trigger in the placeholder card, reached by Tab alone from where the
    // focus already is, with the ring resolved against the *light* theme's cobalt this time.
    const trigger = gallery.selectPlaceholderTrigger();
    await expect(trigger).toBeVisible();
    await gallery.tabTo(trigger, TAB_LIMIT);
    await gallery.expectFocusRing(trigger);

    // §5.4 — a keyboard open is not synchronous, so the surface is polled for rather than
    // assumed. No axe scan runs while it is open (Decision §4).
    await page.keyboard.press('ArrowDown');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    // §5.5 — Escape closes it and the focus comes back to the trigger. Radix restores focus
    // in its unmount cleanup, which resolves *after* the surface is hidden, so this polls for
    // the focus rather than asserting it on the next line.
    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden();
    await expect.poll(() => gallery.isFocused(trigger)).toBe(true);
    await gallery.expectFocusRing(trigger);
  });
});
