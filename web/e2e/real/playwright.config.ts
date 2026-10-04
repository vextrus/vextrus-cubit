/*
 * G1's scripted walk on the real Development Sets (docs/specs/factory.md 5 "G1"): its own config, never
 * the old walks' (web/e2e/playwright.config.ts matches only `*.walk.ts` and t22). It runs only under
 * `python -m scripts.walk.run <sha40>`, which serves the head on its own ports and sets:
 *
 *   WALK_URL   the served web (never the owner's dev server)
 *   WALK_OUT   Playwright's outputDir: traces and screenshots, inside the walk's private folder
 *
 * and the spec's own inputs (WALK_JSON, WALK_SETS, WALK_SHA, WALK_API_URL, VEXTRUS_DEMO_PASSWORD).
 * The real walk never runs in GitHub Actions (5, item 9). Its own headless Chromium, never the shared
 * chrome-devtools browser.
 */
import { defineConfig, devices } from '@playwright/test'

const outputDir = process.env.WALK_OUT ?? ''
const baseURL = process.env.WALK_URL ?? ''
if (!outputDir || !baseURL) throw new Error('WALK_OUT and WALK_URL are set by scripts/walk/run.py')

export default defineConfig({
  testDir: '.',
  testMatch: /walk\.spec\.ts$/,
  outputDir,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 4 * 60 * 60 * 1000,
  reporter: [['list']],
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
