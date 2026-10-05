/*
 * T-W322's acceptance tests, the held mark (issue #322 FL4 f-9): the Drawing Set's chip promises "Held,
 * read anyway: its sheets are marked" (`drawings.files.held_read_anyway`; m0-screens: "each marked
 * held"). So every list row of a Sheet with `held: true` carries an element reading "held", no other row
 * does, and the Selection's "Proposal: where each was read" says "Held: the file was read anyway; its
 * figures are flagged later". The bulk act still leaves held Sheets out (guard).
 *
 * Mounted through the app on 22's fake (`../t22/step1.fixture.ts`) with invented Sheets (sheets.fixture.ts):
 * three of a read-anyway file (two of them one continuation row) and two of an ordinary file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { clean, heldScene, stage } from './sheets.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const PATH = '/p/KR-01/takeoff/1'
const HELD_LINE = 'Held: the file was read anyway; its figures are flagged later'

async function show() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  const { held, free } = heldScene()
  stage(step1, [...held, ...free])
  await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(clean(document.body.textContent)).toContain('Confirmed 0 / 5'))
}

function rows(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>('[role="row"]')]
  return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
}

const numberCell = (row: HTMLElement) => clean(row.querySelectorAll<HTMLElement>('[role="gridcell"]')[1]?.textContent)
const rowStarting = (number: string) => {
  const found = rows().filter((r) => numberCell(r).startsWith(number))
  expect(found, `one row from ${number}`).toHaveLength(1)
  return found[0]!
}

/** The elements in a row that read "held" and nothing else. */
const heldMarks = (row: HTMLElement) => within(row).queryAllByText((_, el) => !!el && clean(el.textContent).toLowerCase() === 'held' && ![...el.children].some((c) => clean(c.textContent).toLowerCase() === 'held'))

/** The Selection's "Proposal: where each was read" block. */
function proposalBlock(): HTMLElement {
  const heading = screen.getAllByText((_, el) => !!el && /^h\d$/i.test(el.tagName) && clean(el.textContent) === 'Proposal: where each was read')
  expect(heading).toHaveLength(1)
  return heading[0]!.closest('section') ?? heading[0]!.parentElement!
}

describe('a read-anyway file’s Sheets are marked held (T-W322, FL4 f-9)', () => {
  it('marks every row of a held Sheet "held", the continuation row of two among them', async () => {
    await show()
    const continued = rowStarting('D-61')
    expect(numberCell(continued), 'D-61 and D-62 are one row').toMatch(/^D-61\s*[–-]\s*D-62$/)
    for (const row of [continued, rowStarting('D-65')]) expect(heldMarks(row), numberCell(row)).toHaveLength(1)
  })

  it('marks no row of a Sheet that is not held', async () => {
    await show()
    for (const n of ['D-70', 'D-71']) expect(heldMarks(rowStarting(n)), n).toHaveLength(0)
  })

  it('says "Held: the file was read anyway; its figures are flagged later" in the Selection of a held Sheet', async () => {
    await show()
    await userEvent.click(within(rowStarting('D-65')).getByText('D-65'))
    await waitFor(() => expect(clean(proposalBlock().textContent)).toContain('D-65'))
    await waitFor(() => expect(clean(proposalBlock().textContent)).toContain(HELD_LINE))
  })

  it('says nothing of held in the Selection of a Sheet that is not held', async () => {
    await show()
    await userEvent.click(within(rowStarting('D-70')).getByText('D-70'))
    await waitFor(() => expect(clean(proposalBlock().textContent)).toContain('D-70'))
    expect(clean(proposalBlock().textContent)).not.toContain('read anyway')
  })

  it('still leaves held Sheets out of the bulk act: it confirms the two that are not held', async () => {
    await show()
    const text = clean(document.body.textContent)
    expect(text).toMatch(/Confirm (all )?2\b/)
    expect(text).not.toMatch(/Confirm (all )?5\b/)
  })
})
