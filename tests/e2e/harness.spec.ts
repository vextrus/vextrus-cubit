/**
 * HARNESS-SELF — the lane's self-proof (AC-5).
 *
 * J-000 is green when the app is fine AND the checks fire. A helper that quietly stopped
 * firing — an axe wrapper that swallows its violations, a screenshot comparison whose
 * tolerance was widened until nothing can fail it — leaves J-000 green and the lane
 * worthless. So each check is exercised here in both directions, in one test: the passing
 * control first (which also proves the baseline exists and the page is clean), then the
 * failure proof against a deliberately damaged render.
 *
 * `expect(...).not.toHaveScreenshot(...)` is not supported by Playwright, and neither is a
 * "this assertion should fail" wrapper, so the failure proof catches the rejection itself.
 * The control runs first for exactly that reason: a caught rejection is only evidence that
 * the check fires if the same call is known to succeed on the undamaged page.
 *
 * These tests run in the default `pnpm e2e` (they are not HARNESS-RED) and are selected on
 * their own by `pnpm e2e --journey HARNESS-SELF`.
 */
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './axe';

/** 120×120 of the viewport (1280×720) is 1.5% of it — well over maxDiffPixelRatio 0.002,
 * and well under a tolerance so wide that nothing could ever be rejected. A perturbation
 * that only just cleared the threshold would be flaky; one that covered the page would
 * prove nothing about the configured ratio. */
const PATCH = 120;

test.describe('HARNESS-SELF', () => {
  test('HARNESS-SELF axe: the helper passes a clean page and rejects an injected violation', async ({
    page,
  }) => {
    await page.goto('/');

    // AC-5(a), control: the served root is clean, so a rejection below can only come from
    // the damage this test does.
    await expectNoAxeViolations(page);

    // An image with no alt text is axe's `image-alt` violation — serious, deterministic,
    // and rendered from a data URI, so nothing in this lane reaches off the loopback.
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      img.width = 100;
      img.height = 100;
      img.id = 'harness-self-no-alt';
      document.body.appendChild(img);
    });
    await expect(page.locator('#harness-self-no-alt')).toBeVisible();

    // AC-5(a), failure proof: the same helper, the same page, one violation added.
    let rejected: unknown;
    try {
      await expectNoAxeViolations(page);
    } catch (error: unknown) {
      rejected = error;
    }
    expect(
      rejected,
      'expectNoAxeViolations accepted a page carrying an image with no alt text: the axe ' +
        'check does not fire, and every "axe-clean" checkpoint in every journey is hollow',
    ).toBeDefined();
  });

  test('HARNESS-SELF visual: the comparison passes the render it baselined and rejects a perturbed one', async ({
    page,
  }) => {
    await page.goto('/');

    // AC-5(b), control: the committed baseline for this spec. An array name, never a
    // string with a slash in it — a string name is flattened and loses its directory.
    await expect(page).toHaveScreenshot(['harness', 'root.png']);

    // A patch the size of a dialog button, painted over the page. It is not "obviously
    // different" by eye-measure: it is different by 1.5% of the pixels, which is what
    // maxDiffPixelRatio 0.002 is supposed to reject.
    await page.evaluate((size: number) => {
      const patch = document.createElement('div');
      patch.style.position = 'fixed';
      patch.style.left = '0px';
      patch.style.top = '0px';
      patch.style.width = `${size}px`;
      patch.style.height = `${size}px`;
      patch.style.background = '#000000';
      patch.style.zIndex = '2147483647';
      patch.id = 'harness-self-patch';
      document.body.appendChild(patch);
    }, PATCH);
    await expect(page.locator('#harness-self-patch')).toBeVisible();

    // AC-5(b), failure proof: the same baseline, the same name — only the render changed.
    // A missing baseline cannot be what is caught here; the control above needed it too.
    let rejected: unknown;
    try {
      await expect(page).toHaveScreenshot(['harness', 'root.png'], { timeout: 5_000 });
    } catch (error: unknown) {
      rejected = error;
    }
    expect(
      rejected,
      `toHaveScreenshot accepted a render differing by a ${PATCH}×${PATCH} block: the ` +
        'visual comparison does not fire at maxDiffPixelRatio 0.002, and every committed ' +
        'baseline in the tree is decoration',
    ).toBeDefined();
  });
});
