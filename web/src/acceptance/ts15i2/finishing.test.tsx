/*
 * S15-I2's acceptance tests (#440): while a DWG's read is in its Finishing step the row offers no
 * "Cancel reading"; a cancel then can only come too late.
 *
 * m0-screens §4.5, "Reading a DWG": "Opening the file" → … → "Reading sheet 12 of 38" → "Finishing". The
 * files API sends a file in that step as state `reading` with the words `drawings.files.finishing`
 * ("Finishing"; vextrus/drawings/tests/acceptance/ts15i2/test_finishing_row.py). Every earlier step keeps
 * "Cancel reading"; the 409 `drawings.files.cancel_too_late` stays for the race (../tw327). The MD and a
 * Guest never had it (§4.5 "MD or Guest"). Every file name here is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeDrawingSet, file, msg, type Msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const NAME = 'KR-PLB-R2.dwg'
const CANCEL = 'Cancel reading'

function rowOf(name: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"]')].filter((r) => clean(r.textContent).includes(name))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${name}`).toHaveLength(1)
  return inner[0]!
}

async function shown(status: Msg, as: string = PEOPLE.qs): Promise<HTMLElement> {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  set.files.push(file({ name: NAME, discipline: 'plumbing', state: 'reading', status }))
  set.summary = msg('drawings.files.summary', { files: 1, sheets: 0, held_sheets: 0, held_files_read: 0, reading: 1, failed: 0, held: 0, refused: 0 })
  await mountApp('/p/KR-01/drawing-set', { as, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
  await waitFor(() => rowOf(NAME))
  return rowOf(NAME)
}

const buttons = (r: HTMLElement) => within(r).queryAllByRole('button').map((b) => clean(b.textContent))

describe('the Finishing step offers no "Cancel reading" (#440)', () => {
  it('shows "Finishing" on the row of a DWG in its Finishing step, with no "Cancel reading"', async () => {
    const r = await shown(msg('drawings.files.finishing'))
    await waitFor(() => expect(clean(r.textContent)).toContain('Finishing'))
    expect(within(r).queryByRole('button', { name: CANCEL })).toBeNull()
  })

  it('offers no act at all on the row in its Finishing step', async () => {
    const r = await shown(msg('drawings.files.finishing'))
    await waitFor(() => expect(clean(r.textContent)).toContain('Finishing'))
    expect(buttons(r)).toEqual([])
  })

  it.each([
    ['Opening the file', msg('drawings.files.opening_file')],
    ['Reading the drawing', msg('drawings.files.reading_drawing')],
    ['Checking it with a second reader', msg('drawings.files.second_reader')],
    ['Finding the sheets', msg('drawings.files.finding_sheets')],
    ['Reading sheet 11 of 11', msg('drawings.files.reading_sheet', { position: 11, total: 11 })],
  ])('still offers "Cancel reading" at "%s"', async (words, status) => {
    const r = await shown(status)
    await waitFor(() => expect(clean(r.textContent)).toContain(words))
    expect(within(r).getByRole('button', { name: CANCEL })).toBeVisible()
  })

  it.each([
    ['MD', PEOPLE.md],
    ['Guest', PEOPLE.guest],
  ])('shows the %s "Finishing" with no act', async (_, who) => {
    const r = await shown(msg('drawings.files.finishing'), who)
    await waitFor(() => expect(clean(r.textContent)).toContain('Finishing'))
    expect(buttons(r)).toEqual([])
  })
})
