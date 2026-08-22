import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

/**
 * The baseline's font resolution belongs to the suite, not to whoever launched it.
 *
 * tests/e2e/fonts.conf assigns every family src/ui/tokens.css names — none of which this
 * repository ships a face for — onto the DejaVu faces both this lane and CI carry, so the
 * committed PNGs are a property of the tree rather than of the host's font installation.
 * scripts/e2e.mjs used to be the only thing that pointed FONTCONFIG_FILE at it, which made the
 * pinning conditional on the entry point: `pnpm exec playwright test tests/e2e/…` rendered
 * through the host's own fonts and could redden — or, with --update-snapshots, rewrite — a
 * baseline for a reason that has nothing to do with the tree. Setting it here covers every way
 * the runner can be started, because the config is loaded before any browser is launched and
 * each browser is a child of this process.
 *
 * The file's absence is a hard stop rather than a silent fallback: an unpinned run's verdict on
 * a committed baseline means nothing, so the suite refuses to produce one.
 */
const FONTS_CONF = join(dirname(fileURLToPath(import.meta.url)), 'tests', 'e2e', 'fonts.conf');
if (!existsSync(FONTS_CONF)) {
  throw new Error(
    `playwright.config.ts: ${FONTS_CONF} is missing — the visual baselines (Q-06) are drawn ` +
      'through it, and a run that resolved fonts from this host instead could neither judge ' +
      'nor update them',
  );
}
process.env['FONTCONFIG_FILE'] = FONTS_CONF;

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
