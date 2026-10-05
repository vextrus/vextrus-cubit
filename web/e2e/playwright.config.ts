/*
 * The end-to-end walks (docs/design/m0-screens.md §8: the design gate walks the served product on the
 * seed). They drive the dev server and the API it proxies, as served locally (CLAUDE.md, "Commands"):
 *
 *   uv run manage.py ensure_database && uv run manage.py migrate
 *   VEXTRUS_DEMO_PASSWORD=… uv run manage.py seed_demo
 *   VEXTRUS_DEBUG=1 uv run manage.py runserver 127.0.0.1:8000
 *   npm --prefix web run dev
 *   VEXTRUS_DEMO_PASSWORD=… WALK_SHOTS=… npx --prefix web playwright test -c web/e2e/playwright.config.ts
 *
 * Ticket 22's browser smoke test (acceptance/t22/smoke.spec.ts) also needs the CAD worker
 * (`uv run manage.py worker --queue cad`) and reaches the sheet list only once 21c's job proposes
 * sheets; .github/workflows/e2e.yml serves the whole stack and runs it:
 *
 *   VEXTRUS_DEMO_PASSWORD=… npx --prefix web playwright test -c web/e2e/playwright.config.ts acceptance/t22
 *
 * Screenshots go to WALK_SHOTS (never into git or a PR); the walk changes the database (it invites,
 * creates a project and revokes), so run it on a demo seed, never on real data. It makes its staff
 * account through manage.py, so set VEXTRUS_DB_NAME as the API has it when that serves another database.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: [/.*\.walk\.ts$/, /acceptance\/t22\/.*\.spec\.ts$/],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['../scripts/failure-reporter.mjs']],
  use: {
    baseURL: process.env.WALK_URL ?? 'http://127.0.0.1:5410',
    ...devices['Desktop Chrome'],
    trace: 'off',
  },
})
