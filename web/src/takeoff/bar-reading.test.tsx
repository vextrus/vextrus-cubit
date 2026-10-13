/*
 * S25-D2 round 1 (#773; m0-screens §4.7, §6.4): Step 1 is not confirmed while a file is still being read,
 * and not while any row is open; the confirmed sheet's bar then keeps "Next open item".
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})
afterEach(() => vi.useRealTimers())

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const STEP1_CONFIRMED = 'Step 1 is confirmed: every sheet is confirmed or excluded'

async function focusS05(api: FakeApi) {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('S-05'))
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes('S-05'))
  await userEvent.click(within(rows.at(-1)!).getByText('S-05'))
  await waitFor(() => expect(bodyText()).toContain('S-05 is confirmed by Nusrat Jahan'))
}

it('keeps "Next open item" on a confirmed sheet while a file is still being read', async () => {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  const step1 = new FakeStep1(api)
  step1.settleAllBut('no discipline')
  set.files = [file({ name: 'KR-ELE-R0.dwg', state: 'reading', status: msg('drawings.files.reading_sheet', { at: 1, of: 3 }), sheets_found: 0 })]
  await focusS05(api)
  expect(screen.queryByRole('button', { name: /Next open item/ })).not.toBeNull()
  expect(bodyText()).not.toContain(STEP1_CONFIRMED)
})
