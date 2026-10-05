/*
 * Ticket T-235b's acceptance tests for A (issue #235, "Bar contradicts its button"): in list mode, with a
 * row focused whose sheet has one source, the Confirmation bar says "E-01 has one source: …" and so its
 * copper button, and Enter, open that sheet ("Open E-01 ↵"); the bulk act stays one click away as a ghost
 * with no key ("Confirm 16, leave out 1"). Before, the button beside that line was the bulk act, and
 * Enter confirmed 16 sheets and left out one that the line did not name. Nothing else Enter does changes
 * (m0-screens §6.4: "the bar always says what Enter will do").
 *
 * KR-01 after reading, through ticket 22's in-memory fake (`../t22/step1.fixture.ts`): its Electrical
 * sheets have `agrees: false`, the bulk act is "Confirm 16, leave out 1", toast "Confirmed 16 sheets;
 * left out 1, each with its reason." (§6.4), Count "Confirmed 16 / 24, 1 excluded".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'
const BULK = 'Confirm 16, leave out 1'
const TOAST = 'Confirmed 16 sheets; left out 1, each with its reason.'
const BEFORE = 'Confirmed 0 / 24'
const AFTER = 'Confirmed 16 / 24, 1 excluded'

async function open() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain(BEFORE))
  await screen.findByRole('grid', { name: 'Sheets' })
  return step1
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

/** The list's row of a sheet number, as the list shows it. */
function row(number: string): HTMLElement {
  const grid = screen.getByRole('grid', { name: 'Sheets' })
  const rows = within(grid)
    .getAllByRole('row')
    .filter((r) => within(r).queryAllByRole('gridcell').some((c) => clean(c.textContent) === number))
  expect(rows, `the row of ${number}`).toHaveLength(1)
  return rows[0]!
}

async function focusRow(number: string) {
  await userEvent.click(row(number))
  await waitFor(() => expect(document.activeElement).toBe(row(number)))
}

const acts = (step1: FakeStep1) => step1.calls().filter((c) => !c.startsWith('GET '))

describe('a focused one-source row in list mode (issue #235; m0-screens §6.4)', () => {
  it('says "E-01 has one source" with a copper button that opens E-01, not the bulk act', async () => {
    await open()
    await focusRow('E-01')
    await waitFor(() => expect(clean(bar().textContent)).toMatch(/^E-01 has one source/))
    const button = enterButton()
    const name = clean(button.getAttribute('aria-label') ?? button.textContent)
    expect(name, 'the copper button’s name').toMatch(/^Open\b/)
    expect(name).toContain('E-01')
    expect(name).not.toMatch(/Confirm|Leave out/)
  })

  it('opens E-01 in sheet mode on Enter and confirms nothing', async () => {
    const step1 = await open()
    await focusRow('E-01')
    await waitFor(() => expect(clean(bar().textContent)).toMatch(/^E-01 has one source/))
    await userEvent.keyboard('{Enter}')
    const canvas = await screen.findByRole('group', { name: /^Sheet\s*⁨?E-01⁩?$/ })
    expect(canvas).toBeVisible()
    expect(bodyText()).toContain(BEFORE)
    expect(bodyText()).not.toContain(TOAST)
    expect(acts(step1), 'no act sent').toEqual([])
  })

  it('keeps the bulk act one click away: a ghost "Confirm 16, leave out 1" with no key, which runs it', async () => {
    const step1 = await open()
    await focusRow('E-01')
    await waitFor(() => expect(clean(bar().textContent)).toMatch(/^E-01 has one source/))
    const ghosts = within(bar())
      .getAllByRole('button')
      .filter((b) => b !== enterButton() && clean(b.getAttribute('aria-label') ?? b.textContent) === BULK)
    expect(ghosts, `a ghost named "${BULK}" on the bar`).toHaveLength(1)
    const ghost = ghosts[0]!
    expect(ghost.getAttribute('aria-keyshortcuts'), 'no key on the ghost').toBeNull()
    expect(ghost.querySelector('kbd'), 'no key shown on the ghost').toBeNull()
    await userEvent.click(ghost)
    await waitFor(() => expect(bodyText()).toContain(TOAST))
    await waitFor(() => expect(bodyText()).toContain(AFTER))
    expect(acts(step1).sort()).toEqual(['POST /confirm', 'POST /exclude'])
  })
})

describe('what Enter does elsewhere is unchanged (a guard)', () => {
  it('runs the bulk act with nothing focused', async () => {
    await open()
    await waitFor(() => expect(enterButton()).toHaveAccessibleName(BULK))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain(TOAST))
    await waitFor(() => expect(bodyText()).toContain(AFTER))
  })

  it('runs the bulk act with a sheet that agrees focused', async () => {
    await open()
    await focusRow('S-04')
    await waitFor(() => expect(enterButton()).toHaveAccessibleName(BULK))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain(TOAST))
    await waitFor(() => expect(bodyText()).toContain(AFTER))
  })

  it('in sheet mode on E-01, still says "E-01 has one source" and confirms E-01 alone on Enter', async () => {
    const step1 = await open()
    await focusRow('E-01')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /^Sheet\s*⁨?E-01⁩?$/ })
    await waitFor(() => expect(clean(bar().textContent)).toMatch(/^E-01 has one source/))
    expect(clean(enterButton().textContent)).toMatch(/^Confirm E-01\s*↵?$/)
    const e01 = step1.proposals.find((p) => p.number === 'E-01')!
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(acts(step1)).toEqual(['POST /confirm']))
    expect(step1.seen.find((s) => s.call === 'POST /confirm')?.body).toMatchObject({ proposals: [e01.id] })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 1 / 24'))
  })
})
