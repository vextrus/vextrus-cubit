import { defineConfig, devices } from '@playwright/test';

/**
 * V-E2E — traces on, video on failure, axe at every checkpoint (support/axe.ts)
 * and visual comparison against the committed Linux baselines under
 * `tests/e2e/baselines/auth/`. `scripts/e2e.mjs` builds, seeds and hands the run
 * its environment; this file only knows how to drive the browser.
 */
const PORT = process.env.E2E_PORT ?? '3211';
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e/journeys',
  snapshotPathTemplate: 'tests/e2e/baselines/auth/{arg}{ext}',
  outputDir: 'test-results',

  // journeys are stories: one at a time, in order, no retries hiding a flake
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 240_000,
  reporter: [['list']],

  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' },
  },

  use: {
    baseURL: BASE_URL,
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'Asia/Dhaka',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `pnpm exec next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
