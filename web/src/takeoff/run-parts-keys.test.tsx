/*
 * S29-M0a (f-1, #322): the rows a run splits into are walked by keyboard like any other row (m0-screens
 * §8: ↓ ↑ Home End, each row the focus reaches draws its ring), each part titled only by what it holds.
 * Every number and title here is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { clean, sheet, stage } from '@/acceptance/ts15q3/groups.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await page.viewport(1280, 800)
})

afterEach(() => {
  vi.useRealTimers()
})

const active = () => document.activeElement as HTMLElement | null
const ringed = (el: Element | null) => !!el && getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) >= 2
const cell = (row: HTMLElement | null, i: number) => clean(row?.querySelectorAll('[role="gridcell"]')[i]?.textContent)

describe('a run split by a decision, by keyboard', () => {
  it('steps ↓ through each part, ringed, each titled by its own sheets; Home and End reach the ends', async () => {
    const of = { continuation: 'rk', continuation_title: 'FIN WALL FW1-FW6 DETAILS' }
    const confirmed = { decision: 'confirmed' as const, decided_at: '2026-09-30T06:00:00Z', decided_by: 'qs' }
    const sheets = ['K-11', 'K-12', 'K-13', 'K-14'].map((n, i) =>
      sheet(n, `FIN WALL FW${i + 1}-FW${i + 2} DETAILS`, { ...of, ...(i === 1 || i === 2 ? confirmed : {}) }),
    )
    const api = new FakeApi()
    const step1 = new FakeStep1(api, 'KR-01')
    stage(step1, sheets)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(clean(document.body.textContent)).toContain('K-14'))

    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const seen: [string, string][] = []
    for (let i = 0; i < 3; i++) {
      await userEvent.keyboard('{ArrowDown}')
      await waitFor(() => expect(active()?.getAttribute('role')).toBe('row'))
      expect(ringed(active()), `row ${cell(active(), 1)}`).toBe(true)
      seen.push([cell(active(), 1).replace(/\s/g, ''), cell(active(), 2)])
    }
    expect(seen).toEqual([
      ['K-11', 'FIN WALL FW1-FW2 DETAILS'],
      ['K-12–K-13', 'FIN WALL FW2-FW3 DETAILS, 2 sheets'],
      ['K-14', 'FIN WALL FW4-FW5 DETAILS'],
    ])
    expect(document.body.textContent).not.toContain('FW1-FW6')

    await userEvent.keyboard('{ArrowUp}')
    await waitFor(() => expect(cell(active(), 1).replace(/\s/g, '')).toBe('K-12–K-13'))
    expect(ringed(active())).toBe(true)
    await userEvent.keyboard('{Home}')
    await waitFor(() => expect(cell(active(), 1)).toBe('K-11'))
    await userEvent.keyboard('{End}')
    await waitFor(() => expect(cell(active(), 1)).toBe('K-14'))
    expect(ringed(active())).toBe(true)
  })
})
