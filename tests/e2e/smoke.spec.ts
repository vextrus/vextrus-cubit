/**
 * J-000 — the lane's own health, proved against the served app root (V-E2E, Q-03, C-09).
 *
 * AC-2: `pnpm e2e --journey J-000` runs exactly the specs whose titles match `J-000`. The
 * slice is deliberately independent of product screens: it exists so that a red J-000 means
 * "the lane is broken", never "a screen changed" (C-09 halts every lane on a red J-000, so
 * the thing it watches has to be the lane itself). The real Golden Path steps supersede it
 * when the screens land.
 *
 * The title carries `J-000` on the describe so that Playwright's grep — which matches the
 * full title path — selects this file and nothing else.
 */
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './axe';

test.describe('J-000', () => {
  test('J-000 root: the served root is app-root, axe-clean and matches its Linux baseline', async ({
    page,
  }) => {
    // V-E2E checkpoint "root": the app root served by `next start` on 3211 (C-07, AC-1).
    // A relative goto is the baseURL's own claim — it can only resolve if the lane really
    // started a server on the port playwright.config.ts names.
    await page.goto('/');

    // AC-2: the test contract's only testid, on the only route this increment serves.
    const root = page.getByTestId('app-root');
    await expect(root).toBeVisible();

    // AC-2 / V-E2E: "axe on every checkpoint page". The helper is the lane's, so a journey
    // never has to remember how to build an AxeBuilder.
    await expectNoAxeViolations(page);

    // AC-2 / V-E2E: "visual comparisons against committed Linux baselines
    // (toHaveScreenshot, maxDiffPixelRatio 0.002)". The name is an array on purpose: a
    // string 'smoke/root.png' is flattened to 'smoke-root.png' and the directory is lost.
    await expect(page).toHaveScreenshot(['smoke', 'root.png']);
  });
});
