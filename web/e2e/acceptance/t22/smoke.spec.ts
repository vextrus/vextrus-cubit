/*
 * Ticket 22's browser smoke test (was 27; docs/plans/M0.md "22 Step 1 screen and the browser smoke
 * test"): "sign in, upload a synthetic DWG, see the sheet list, open a sheet, confirm; in CI and in the
 * cloud if Chromium runs there, else locally". It needs the served product (web/e2e/playwright.config.ts's
 * header: migrate, seed_demo, runserver, the CAD worker `uv run manage.py worker --queue cad`, `npm
 * --prefix web run dev`) and reaches the sheet list only once 21c's job proposes sheets (the plan: "not
 * reachable until 21c: ... the smoke test's upload").
 *
 * The DWG is 13's synthetic set A (engine/fixtures/dwg/sheet_set_layouts.py: S-101, S-102, S-103 on
 * layouts), built by the repo's writer into a temporary folder; never a real drawing. It goes to SG-03
 * (empty on the seed) as Nusrat Jahan, the seed's QS.
 *
 * Chosen by the acceptance writer: the file name `smoke-set-a.dwg`; 22 adds this folder to the
 * Playwright config (`testMatch`) and `.github/workflows/e2e.yml` runs it.
 *
 *   VEXTRUS_DEMO_PASSWORD=… npx --prefix web playwright test -c web/e2e/playwright.config.ts acceptance/t22
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const PASSWORD = process.env.VEXTRUS_DEMO_PASSWORD ?? ''
const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const QS = 'nusrat@shapla-homes.example'

function syntheticDwg(): string {
  const folder = mkdtempSync(join(tmpdir(), 'vextrus-smoke-'))
  const script = [
    'import shutil, sys',
    'from pathlib import Path',
    'from engine.fixtures import dwg',
    'folder = Path(sys.argv[1])',
    'writer = dwg.build_writer(folder)',
    'built = dwg.build("sheet_set_layouts", folder, writer)',
    'shutil.copy(built, folder / "smoke-set-a.dwg")',
  ].join('\n')
  const run = spawnSync('uv', ['run', 'python', '-c', script, folder], { cwd: ROOT, encoding: 'utf8' })
  expect(run.status, run.stderr).toBe(0)
  return join(folder, 'smoke-set-a.dwg')
}

test('signs in, uploads a synthetic DWG, sees its sheets, opens one and confirms', async ({ page }) => {
  expect(PASSWORD, 'VEXTRUS_DEMO_PASSWORD').not.toBe('')
  const drawing = syntheticDwg()
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(QS)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

  await page.goto('/p/SG-03/drawing-set')
  await page.locator('input[type="file"]').setInputFiles(drawing)
  await expect(page.getByText('smoke-set-a.dwg').first()).toBeVisible()

  await page.goto('/p/SG-03/takeoff/1')
  // The read job runs on the CAD queue; its sheets join the list as they are read (§6.13).
  await expect(page.getByText('Confirmed 0 / 3')).toBeVisible({ timeout: 90_000 })
  for (const n of ['S-101', 'S-102', 'S-103']) await expect(page.getByText(n, { exact: true }).first()).toBeVisible()

  await page.getByText('S-101', { exact: true }).first().click()
  await page.keyboard.press('Space')
  await expect(page.getByRole('group', { name: /S-101/ })).toBeVisible()
  await page.keyboard.press('Space')

  await page.keyboard.press('Enter')
  await expect(page.getByText(/Confirmed [1-3] \/ 3/)).toBeVisible()
})
