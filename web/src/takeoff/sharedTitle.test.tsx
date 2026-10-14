/*
 * #670, design gate of S27-G5's round 1: on a series row with a long title the note "N sheets share this
 * title" is cut to nothing beside the title, so it must stay told: in the Title cell's tooltip (the
 * title attribute) and in the inspector's Selection header (m0-screens 6.2; the owner, 5 Oct 2026, #334).
 * Invented Sheets, 22's fake, 1280 wide.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../acceptance/t22/step1.fixture'
import { clean, sheet, stage } from '../acceptance/ts15q3/groups.fixture'

const LONG_TITLE = 'STAIR CORE SECTIONS AND LANDING BEAM REINFORCEMENT DETAILS'
const NOTE = '4 sheets share this title'

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await page.viewport(1280, 800)
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  stage(step1, ['D-51', 'D-52', 'D-55', 'D-58'].map((n) => sheet(n, LONG_TITLE, { series: 's51' })))
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
})

const rows = () => [...document.querySelectorAll<HTMLElement>('[role="row"]')]

async function row(number: RegExp): Promise<HTMLElement> {
  return waitFor(() => {
    const found = rows().filter((r) => number.test(clean(r.querySelectorAll('[role="gridcell"]')[1]?.textContent)))
    expect(found).toHaveLength(1)
    return found[0]!
  })
}

describe('a long-title series row keeps its note told', () => {
  it('shows the note, or carries it in the Title cell tooltip', async () => {
    const r = await row(/^D-55$/)
    const cell = r.querySelectorAll<HTMLElement>('[role="gridcell"]')[2]!
    const holder = [...cell.querySelectorAll<HTMLElement>('*')].find((el) => clean(el.textContent) === NOTE)
    const visible = !!holder && holder.getBoundingClientRect().width > 0
    expect(visible || clean(cell.getAttribute('title')).includes(NOTE), clean(cell.textContent)).toBe(true)
    expect(clean(cell.getAttribute('title'))).toContain(LONG_TITLE)
    // The drawing's title is isolated in the plain-text tooltip (m0-screens 1.8), so a right-to-left one cannot reorder the count.
    expect(cell.getAttribute('title')).toContain(`\u2068${LONG_TITLE}\u2069 · `)
  })

  it("tells the note in the inspector's Selection header for the selected series sheet", async () => {
    const r = await row(/^D-55$/)
    await userEvent.click(r)
    await waitFor(() => {
      const told = [...document.querySelectorAll<HTMLElement>('span')].filter((el) => !el.closest('[role="row"]') && clean(el.textContent) === NOTE)
      expect(told.length).toBeGreaterThan(0)
    })
  })
})
