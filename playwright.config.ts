import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright (1.6x) — the journeys, visual baselines and axe checks, driving the same app
 * the customer gets. C-07: web dev on 3210, the e2e build on 3211, per-lane offsets when
 * lanes run in parallel; loopback traffic is local work, never "network".
 *
 * tests/e2e/ arrives with the journey increments; `pnpm e2e` announces the unbuilt lane
 * until then (C-06).
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
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
