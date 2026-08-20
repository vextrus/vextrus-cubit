import { expect, type Locator, type Page } from '@playwright/test';
import { expectNoSeriousAxeViolations } from './axe';

/**
 * V-E2E — a named checkpoint is three things at once: a trace-visible marker,
 * an axe scan (Q-11) and a visual comparison against the committed Linux
 * baseline (maxDiffPixelRatio 0.002, volatile regions masked).
 */
export async function checkpoint(
  page: Page,
  name: string,
  options: { mask?: Locator[] } = {},
): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expectNoSeriousAxeViolations(page, name);

  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.002,
    mask: options.mask ?? [],
  });
}

/** Regions whose pixels legitimately change run to run. */
export function volatileRegions(page: Page): Locator[] {
  return [
    page.locator('[data-volatile]'),
    page.locator('time'),
    page.getByTestId('session-row').locator('[data-session-id]'),
  ];
}
