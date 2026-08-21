/**
 * J-004 — "Design gallery renders both themes; visual baselines; axe."
 *
 * R-UI-011: "A living gallery at `/design` renders every component in every state in both
 * themes with sample data; the visual baseline suite screenshots it; a component without a
 * gallery entry fails a test." AM-03 (4): "The /design gallery (R-UI-011) is gate evidence:
 * screenshotted in both themes and diffed across increments through the visual-baseline
 * suite."
 *
 * Two named checkpoints, as the Increment Spec's journey names them: `gallery-light` and
 * `gallery-dark`. Each is the whole page — every entry, every state — scanned by axe (Q-11,
 * zero serious or critical) and compared against its committed Linux baseline (Q-06,
 * maxDiffPixelRatio 0.002, animations disabled, an empty mask because the gallery is static).
 *
 * The roster is not written here. It is read from the Design Decision's §3 table, so this
 * journey follows the document rather than a list that was true the day it was written: a
 * component added to a barrel is added to §3 and to the registry, and this file finds it.
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { rosterRows } from '../../src/app/design/__tests__/design-doc';
import { expectNoSeriousOrCritical } from './axe';
import { DesignGalleryPage } from './setup/design-gallery';

/** The tree, from this file rather than from a working directory the lane happens to pick. */
const REPO = fileURLToPath(new URL('../..', import.meta.url));

/** Every entry the Design Decision decides, and the states each must render (§3, §10). */
const ROSTER = rosterRows(REPO);

/** What a checkpoint asserts about the page before it is scanned and screenshotted. */
function assertRoster(rendered: readonly { slug: string; states: readonly string[] }[]): void {
  expect(ROSTER.length, 'AM-03: the Design Decision §3 roster is the contract').toBeGreaterThan(0);
  const bySlug = new Map(rendered.map((entry) => [entry.slug, entry.states]));

  for (const row of ROSTER) {
    const states = bySlug.get(row.slug);
    expect(states, `R-UI-011: /design renders an entry for ${row.slug}`).toBeDefined();
    for (const state of row.states) {
      expect(states ?? [], `R-UI-011: ${row.slug} renders its "${state}" state`).toContain(state);
    }
  }
  // The rule, not today's roster: whatever the page shows, it shows it in states.
  for (const entry of rendered) {
    expect(entry.states.length, `R-UI-011: ${entry.slug} renders at least one state`).toBeGreaterThan(
      0,
    );
  }
}

test.describe('J-004 — the living gallery in both themes (R-UI-011, AM-03)', () => {
  test('checkpoints gallery-light and gallery-dark: every entry, axe clean, baselines match', async ({
    page,
  }) => {
    const gallery = new DesignGalleryPage(page);

    await test.step('checkpoint gallery-light', async () => {
      await gallery.open('light');
      // AC-1: ?theme=light renders light.
      expect(await gallery.theme(), 'AC-1: ?theme=light sets data-theme="light"').toBe('light');
      assertRoster(await gallery.rendered());

      // Q-11: axe on every journey checkpoint page, zero serious or critical.
      await expectNoSeriousOrCritical(page, 'gallery-light');

      // Q-06 / AC-4: the committed Linux baseline, no platform suffix, no volatile mask.
      await expect(page).toHaveScreenshot('design/gallery-light.png', {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
        mask: [],
      });
    });

    await test.step('checkpoint gallery-dark', async () => {
      await gallery.open('dark');
      // AC-1: ?theme=dark sets data-theme="dark" on <html> — a total flip, same entry set.
      expect(await gallery.theme(), 'AC-1: ?theme=dark sets data-theme="dark"').toBe('dark');
      assertRoster(await gallery.rendered());

      await expectNoSeriousOrCritical(page, 'gallery-dark');

      await expect(page).toHaveScreenshot('design/gallery-dark.png', {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
        mask: [],
      });
    });
  });

  test('AC-1: no query and an unknown theme both render light', async ({ page }) => {
    const gallery = new DesignGalleryPage(page);

    await gallery.open();
    expect(await gallery.theme(), 'AC-1: no query renders light').toBe('light');

    await gallery.open('midnight');
    expect(await gallery.theme(), 'AC-1: an unknown value renders light').toBe('light');
    // A refused theme still renders the gallery — the page never goes blank (R-UI-020).
    await expect(gallery.root).toBeVisible();
  });

  test('AC-1: the Dialog example has a visible trigger, opens, and closes on Escape', async ({
    page,
  }) => {
    const gallery = new DesignGalleryPage(page);
    await gallery.open();

    // The test contract: "Interactive examples on the page include at least one Dialog with a
    // visible trigger." The Design Decision §3 makes gallery-entry-dialog that example.
    const trigger = gallery.entry('dialog').getByRole('button').first();
    await expect(trigger, 'AC-1: the dialog entry has a visible trigger').toBeVisible();

    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog, 'R-UI-030: the dialog opens on its trigger').toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog, 'R-UI-030: Escape dismisses it').toBeHidden();
  });
});
