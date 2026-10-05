/*
 * Ticket T-235b's acceptance test for B's keyboard half (issue #235, "Clicks under the bar"): a row
 * focused with ↓ is scrolled clear of the floating Confirmation bar, never left behind it. On main a row
 * focused near the foot of the visible list sits under the bar (the list scrolls it only to its own
 * edge), so the QS acts on a row they cannot see.
 *
 * Step 0 (the ticket's section 3), on main at 1440 × 900: a real click on the visible half of a row half
 * under the bar does focus that row, so B's click case (case 8) is not pinned; ↓ near the bar does leave
 * the focused row under it, which this pins (case 9).
 *
 * KR-01's 24 sheets fit above the bar at 1440 × 900, so the list is lengthened with 26 invented
 * Architectural sheets laid over ticket 22's fake (`../t22/step1.fixture.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

/** 26 invented Architectural sheets, A-61 to A-86, each agreeing (so each joins the bulk act). */
function lengthen(step1: FakeStep1) {
  const like = step1.proposals.find((p) => p.discipline === 'architectural' && p.agrees && !p.proposed_exclusion)!
  const more: ProposalOut[] = Array.from({ length: 26 }, (_, i) => {
    const n = String(61 + i)
    const tail = String(i + 1).padStart(12, '0')
    return { ...like, id: `a2350000-0000-4000-8000-${tail}`, sheet_id: `b2350000-0000-4000-8000-${tail}`, number: `A-${n}`, title: `MOCK PANEL ${n}` }
  })
  const at = step1.proposals.lastIndexOf(like) + 1
  step1.proposals.splice(at, 0, ...more)
}

/** The bar's copper button: the one whose key is Enter. */
function enterButton(): HTMLElement {
  const buttons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-keyshortcuts') === 'Enter')
  expect(buttons, 'one button whose key is Enter').toHaveLength(1)
  return buttons[0]!
}

/** The Confirmation bar: the copper button's widest ancestor still within the bar's 820 px. */
function bar(): HTMLElement {
  let el = enterButton()
  while (el.parentElement && el.parentElement.getBoundingClientRect().width <= 821) el = el.parentElement
  return el
}

describe('a row focused with ↓ is clear of the bar (issue #235; m0-screens §6.4)', () => {
  it('scrolls each row focused with ↓ wholly above the bar’s top', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api, 'KR-01')
    lengthen(step1)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    const grid = await screen.findByRole('grid', { name: 'Sheets' })
    // The rows ↓ moves through: every focusable row (a section's heading is not one).
    const focusable = () => within(grid).getAllByRole('row').filter((r) => r.hasAttribute('tabindex'))
    await waitFor(() => expect(focusable().length).toBeGreaterThan(40))
    const rows = focusable()
    // From the first row, ↓ through every row of the list.
    await userEvent.click(rows[0]!)
    const under: string[] = []
    for (let i = 1; i < rows.length; i++) {
      await userEvent.keyboard('{ArrowDown}')
      await waitFor(() => expect(document.activeElement).toBe(rows[i]))
      const r = rows[i]!.getBoundingClientRect()
      const top = bar().getBoundingClientRect().top
      if (r.bottom > top + 0.5) under.push(`${clean(within(rows[i]!).getAllByRole('gridcell')[1]?.textContent)}: bottom ${Math.round(r.bottom)} > bar ${Math.round(top)}`)
    }
    expect(under, 'rows focused with ↓ left under the bar').toEqual([])
  })
})
