import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright (1.6x) — the journeys, visual baselines and axe checks, driving the same app
 * the customer gets. C-07: web dev on 3210, the e2e build on 3211, per-lane offsets when
 * lanes run in parallel; loopback traffic is local work, never "network".
 *
 * There is no `webServer` here: `pnpm e2e` builds once, provisions and seeds the scratch
 * database, starts the server itself and tears it down (scripts/e2e.mjs). A server this
 * config started would come up before the database it reads existed.
 */
const E2E_PORT = Number(process.env['E2E_PORT'] ?? 3211);

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    // V-E2E: "visual comparisons against committed Linux baselines … maxDiffPixelRatio
    // 0.002". Two thousandths of the viewport is a change a person would notice and a font
    // hint would not.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },
  /**
   * V-E2E: the baselines are committed, so they live in one directory of their own rather
   * than in a `*-snapshots` folder beside every spec.
   *
   * `{arg}` is the snapshot name with its extension taken off, and it keeps the separators
   * of an *array* name — `['smoke', 'root.png']` becomes `smoke/root`. A string name
   * `'smoke/root.png'` is flattened to `smoke-root` before it ever reaches this template,
   * which is why the journeys pass arrays and tests/toolchain/e2e-lane.test.ts refuses a
   * spec that does not. Neither `{platform}` nor `{projectName}` is in the path: the
   * baselines are Linux-rendered and compared on Linux (AS-01, ubuntu-24.04 in CI), and a
   * per-platform suffix would silently write a second baseline instead of failing.
   */
  snapshotPathTemplate: 'tests/e2e/baselines/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
