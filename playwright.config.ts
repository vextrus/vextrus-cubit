import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright (1.6x) — the journeys, visual baselines and axe checks, driving the same app
 * the customer gets. C-07: web dev on 3210, the e2e build on 3211, per-lane offsets when
 * lanes run in parallel; loopback traffic is local work, never "network".
 *
 * Baselines are committed Linux PNGs under tests/e2e/baselines/ (Q-06). The path template
 * carries neither {platform} nor {projectName}: one machine shape runs this suite — this
 * WSL2 Ubuntu 24.04 lane and CI's ubuntu-24.04 — so a suffix would only make the committed
 * file unfindable from the other one.
 */
const E2E_PORT = Number(process.env['E2E_PORT'] ?? 3211);

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  snapshotPathTemplate: '{snapshotDir}/baselines/{arg}{ext}',
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
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
