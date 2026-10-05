/*
 * The bulk act's ghost beside a focused one-source row in list mode (T-235b, review round 1): it words
 * each case as the bulk button does, never "Confirm 0, leave out 1". KR-01 through ticket 22's fake,
 * its sheets' `agrees` and proposed exclusions reshaped per case; E-01 has one source in every case.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T04:30:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

function enterButton(): HTMLElement {
  const buttons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-keyshortcuts') === 'Enter')
  expect(buttons).toHaveLength(1)
  return buttons[0]!
}

function bar(): HTMLElement {
  let el = enterButton()
  while (el.parentElement && el.parentElement.getBoundingClientRect().width <= 821) el = el.parentElement
  return el
}

/** The bar's buttons other than its copper one, by name. */
const ghosts = () =>
  within(bar())
    .getAllByRole('button')
    .filter((b) => b !== enterButton())
    .map((b) => clean(b.getAttribute('aria-label') ?? b.textContent))

function row(number: string): HTMLElement {
  const grid = screen.getByRole('grid', { name: 'Sheets' })
  return within(grid)
    .getAllByRole('row')
    .find((r) => within(r).queryAllByRole('gridcell').some((c) => clean(c.textContent) === number))!
}

/** KR-01 reshaped: `agreeing` the numbers that still agree (all others one-source), `leaveOut` whether A-07 keeps its proposed exclusion. */
async function openOn(agreeing: (number: string | null) => boolean, leaveOut: boolean) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  for (const p of step1.proposals) {
    if (p.proposed_exclusion) {
      if (!leaveOut) p.proposed_exclusion = null
      else continue
    }
    if (!agreeing(p.number)) p.agrees = false
  }
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await screen.findByRole('grid', { name: 'Sheets' })
  await userEvent.click(row('E-01'))
  await waitFor(() => expect(clean(bar().textContent)).toMatch(/^E-01 has one source/))
}

describe('the bulk ghost beside a focused one-source row', () => {
  it('reads "Leave out 1" when nothing left agrees but one exclusion is proposed', async () => {
    await openOn(() => false, true)
    expect(ghosts()).toEqual(['Leave out 1'])
  })

  it('reads "Confirm all 3 that agree" when nothing is left out', async () => {
    await openOn((n) => ['S-01', 'S-02', 'A-01'].includes(n ?? ''), false)
    expect(ghosts()).toEqual(['Confirm all 3 that agree'])
  })

  it('words one sheet that agrees as the sheet-mode ghost does', async () => {
    await openOn((n) => n === 'S-01', false)
    const list = ghosts()
    expect(list).toHaveLength(1)
    expect(list[0]).not.toMatch(/Confirm 0|leave out 0/)
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /^Sheet\s*⁨?E-01⁩?$/ })
    await waitFor(() => expect(clean(enterButton().textContent)).toMatch(/^Confirm E-01/))
    expect(ghosts()).toEqual(list)
  })

  it('shows no ghost when there is no bulk act', async () => {
    await openOn(() => false, false)
    expect(ghosts()).toEqual([])
    expect(clean(enterButton().textContent)).toMatch(/^Open E-01/)
  })
})
