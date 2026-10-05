/*
 * The bar's ghost bulk act words a count of one in the singular (PR #419 review, round 1): with one
 * Sheet that agrees selected, the ghost reads "Confirm 1 sheet that agrees" (BulkWhat's words, m0-screens
 * 6.4), never "Confirm all 1 that agree"; with two it keeps m0-screens 6.4's "Confirm all 2 that agree".
 * Every number and title here is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, kr01Proposals } from '../acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

/** `agreeing` Structural Sheets that agree, and one that does not. */
function sheets(agreeing: number): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  const all = kr01Proposals()
  const base = all[0]!
  step1.proposals = [
    ...Array.from({ length: agreeing }, (_, i) => ({ ...all[i]!, number: `W-1${i}`, title: `GATE PIER DETAIL ${i}`, agrees: true })),
    { ...base, id: `${base.id}-x`, sheet_id: `${base.sheet_id}-x`, number: 'W-30', title: 'BOUNDARY WALL ELEVATION', agrees: false },
  ]
  step1.questions = []
  return api
}

async function selectFirstAgreeing(): Promise<void> {
  await waitFor(() => expect(bodyText()).toContain('GATE PIER DETAIL 0'))
  const row = [...document.querySelectorAll<HTMLElement>('[role="row"]')].find(
    (r) => clean(r.textContent).includes('GATE PIER DETAIL 0') && !r.querySelector('[role="row"]'),
  )
  expect(row, 'the agreeing Sheet’s row').toBeDefined()
  await userEvent.click(row!)
  await userEvent.keyboard(' ')
  await waitFor(() => expect(bodyText()).toContain('Enter confirms it and opens the next open sheet.'))
}

describe('the ghost bulk act counts one in the singular', () => {
  it('reads "Confirm 1 sheet that agrees" for one', async () => {
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: sheets(1) })
    await selectFirstAgreeing()
    expect(bodyText()).toContain('Confirm 1 sheet that agrees')
    expect(bodyText()).not.toMatch(/Confirm all 1\b/)
  })

  it('keeps "Confirm all 2 that agree" for two', async () => {
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: sheets(2) })
    await selectFirstAgreeing()
    expect(bodyText()).toContain('Confirm all 2 that agree')
  })
})
