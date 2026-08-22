/**
 * J-004 — "Design gallery renders both themes; visual baselines; axe" (Bible J-004, Q-06,
 * Q-11, R-UI-011, R-UI-012, AM-03(4)).
 *
 * AM-03(4) makes the `/design` gallery gate evidence rather than a courtesy page: it is
 * "screenshotted in both themes and diffed across increments through the visual-baseline
 * suite". This journey is that suite. It renders nothing and decides nothing — the screen is
 * settled in docs/design/s-design.md — it photographs, scans and operates what is already
 * merged, and it fails when any of the three stops being true.
 *
 * Thirty-six checkpoints, in both themes: the live sheet, the seven forced R-UI-050 states,
 * and the ten overlays that are drawn closed and have to be opened to be seen. Each one is
 * compared with its committed Linux baseline under the lane's own config — maxDiffPixelRatio
 * 0.002, updateSnapshots 'none', so a missing baseline is a failure and not a first write
 * (Q-06) — and each one is handed to the lane's axe helper, which asserts zero violations of
 * any impact and so subsumes Q-11's zero serious/critical.
 *
 * Every overlay is opened with a key on a focused element and never with a pointer, because
 * the second half of Q-11 is a keyboard journey and a surface that only answers a mouse is a
 * defect rather than a screenshot problem. When one of these fails on something rooted in a
 * merged primitive, it blocks per AM-03 and is cured against the surface that owns it (C-03):
 * not here, not by narrowing axe, and not by masking a region.
 *
 * The describe carries `J-004` so that Playwright's grep — which matches the full title path
 * — selects this journey and nothing else.
 */
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './axe';
import { DesignPage, MODULE_SECTIONS, OVERLAY_ENTRIES, SCREEN_STATES } from './pages/design';
import type { DesignTheme } from './pages/design';

/**
 * Light is the fresh navigation — no `data-theme` is the light default (s-design.md §10) —
 * and dark is entered by operating the toggle after it (Design Decision, interpretation 2).
 */
const THEMES: readonly DesignTheme[] = ['light', 'dark'];

/** The rail anchor AC-4 activates: one link, proving the whole rail's grammar. */
const ANCHORED_ENTRY = 'dialog';

/** R-UI-012's focus ring: "2 px cobalt outer outline". Read off the computed style. */
const RING_WIDTH = 2;

test.describe('J-004', () => {
  for (const theme of THEMES) {
    test(`live-gallery (${theme}): the sheet is axe-clean and its module sections hold their baselines`, async ({
      page,
    }) => {
      const design = new DesignPage(page);
      await design.gotoLive(theme);

      // R-UI-011's "the visual baseline suite screenshots it", read as one shot per module
      // section rather than one for the page: a section shot names the component that moved.
      for (const module of MODULE_SECTIONS) {
        await expect(design.section(module)).toHaveScreenshot(['design', theme, `${module}.png`]);
      }

      // R-UI-012 / Q-11 on the whole sheet: every component of the design system, in every
      // state its entry declares, scanned at once.
      await expectNoAxeViolations(page);
    });
  }

  for (const state of SCREEN_STATES) {
    for (const theme of THEMES) {
      test(`state-${state} (${theme}): the forced R-UI-050 state holds its baseline and is axe-clean`, async ({
        page,
      }) => {
        const design = new DesignPage(page);
        await design.gotoState(state, theme);

        // The viewport as the navigation left it: chrome always rendered, scroll at the top,
        // and for partial and offline the notice above the sheet it did not replace.
        await expect(page).toHaveScreenshot(['design', theme, `state-${state}.png`]);
        await expectNoAxeViolations(page);
      });
    }
  }

  for (const entry of OVERLAY_ENTRIES) {
    for (const theme of THEMES) {
      test(`overlay-${entry} (${theme}): opened by keyboard, photographed and axe-clean`, async ({
        page,
      }) => {
        const design = new DesignPage(page);
        await design.gotoLive(theme);

        // AC-4: a key on a focused trigger, and the open is polled for — never asserted
        // synchronously, so the shot below is of a settled surface.
        await design.openOverlayByKeyboard(entry);
        await expect(page).toHaveScreenshot(['design', theme, `overlay-${entry}.png`]);

        // The scan wants the surface up too, and the toast leaves on its own clock.
        await design.keepOverlayOpen(entry);
        await expectNoAxeViolations(page);
      });
    }
  }

  test('keyboard: the theme toggle is Tab-reachable, ringed, and flips data-theme both ways', async ({
    page,
  }) => {
    const design = new DesignPage(page);
    await design.gotoLive('light');

    // §10: light is the absence of the attribute, not a value written on arrival.
    expect(await design.themeAttribute()).toBeNull();

    await design.focusThemeToggleByTab();
    await expect(design.themeToggle).toBeFocused();

    // R-UI-012: "focus ring (2 px cobalt outer)". The colour is the token sheet's claim; what
    // a journey can say is that the ring is drawn, and drawn thick enough to see.
    const ring = await design.focusRing(design.themeToggle);
    expect(ring.style, 'the focused theme toggle draws no outline').not.toBe('none');
    expect(ring.width, 'the focus ring is thinner than R-UI-012 allows').toBeGreaterThanOrEqual(
      RING_WIDTH,
    );

    await design.toggleThemeByKeyboard();
    expect(await design.themeAttribute()).toBe('dark');
    await design.toggleThemeByKeyboard();
    expect(await design.themeAttribute()).toBe('light');
  });

  test('keyboard: Escape dismisses every dismissible surface and hands the focus back', async ({
    page,
  }) => {
    const design = new DesignPage(page);
    await design.gotoLive('light');

    for (const entry of OVERLAY_ENTRIES) {
      if (!DesignPage.dismissible(entry)) continue;
      await design.openOverlayByKeyboard(entry);
      // Dialog, sheet and consequence-dialog are modal: R-UI-012 puts the focus back where it
      // was taken from, and the page object asserts that for the surfaces that promise it.
      await design.dismissOverlayByKeyboard(entry);
    }
  });

  test('keyboard: a rail anchor activated by Enter moves the URL to its entry', async ({ page }) => {
    const design = new DesignPage(page);
    await design.gotoLive('light');

    const anchor = design.railAnchor(ANCHORED_ENTRY);
    await anchor.focus();
    await expect(anchor).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(new RegExp(`#${ANCHORED_ENTRY}$`));
  });
});
