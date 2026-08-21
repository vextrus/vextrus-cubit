import { defineConfig, devices } from '@playwright/test';

/**
 * The e2e lane. C-07 puts the dev server on 3210 and the e2e build on 3211,
 * with per-lane offsets when lanes run in parallel — so the port is read from
 * the environment and never hard-coded into a test.
 *
 * tests/e2e/ does not exist yet: `pnpm e2e` skips with LANE_NOT_YET_BUILT
 * until a later foundation-series increment lands the first journey.
 */
const port = Number(process.env.E2E_PORT ?? 3211);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm run start',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
