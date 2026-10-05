/*
 * T-W322's acceptance tests, the list's rows (issue #322 FL9 f-28; #334's "In M0" groups and series):
 * mounted through the app on 22's fake (`../t22/step1.fixture.ts`) with invented Sheets (sheets.fixture.ts).
 *
 * The words are the ticket's, verbatim: a number shared by different titles reads "2 sheets share the
 * number, titles differ" with both titles; "copies" stays for one number and one title; a `same_title`
 * Question's row counts its Sheets and says they may draw the same thing; the server's `continuation`
 * groups Sheets into one row titled by `continuation_title`; a `series` is told on each of its rows as
 * "N sheets share this title", with no Question.
 *
 * Chosen by the acceptance writer: a row's Title cell is its third grid cell (m0-screens §6.2's column
 * order: mark, Number, Title); a group's Number cell reads its first and last number.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { COPY_TITLE, GROUP_TITLE, PART_TITLES, SERIES_TITLE, SHARED_TITLE, SPLIT_TITLES, clean, continuation, copies, numberShared, seriesScene, stage, titleShared, type Proposal, type Question } from './sheets.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const PATH = '/p/KR-01/takeoff/1'

async function show(proposals: readonly Proposal[], questions: readonly Question[] = []) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  stage(step1, proposals, questions)
  await mountApp(PATH, { as: PEOPLE.qs, api })
  const first = proposals[0]!.number!
  await waitFor(() => expect(rows().some((r) => numberCell(r).startsWith(first))).toBe(true))
}

/** Every list row, innermost (a row holding no other row). */
function rows(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>('[role="row"]')]
  return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
}

const cells = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')].map((c) => clean(c.textContent))
const numberCell = (row: HTMLElement) => cells(row)[1] ?? ''
const titleCell = (row: HTMLElement) => cells(row)[2] ?? ''

/** The one row whose Number cell reads `number` exactly. */
function rowNumbered(number: string): HTMLElement {
  const found = rows().filter((r) => numberCell(r) === number)
  expect(found, `one row numbered ${number}`).toHaveLength(1)
  return found[0]!
}

describe('a Question row says what its Sheets are (T-W322, FL9 f-28)', () => {
  it('words one number on two titles "2 sheets share the number, titles differ", with both titles and never "copies"', async () => {
    const { sheets, question } = numberShared()
    await show(sheets, [question])
    const text = clean(rowNumbered('D-14').textContent)
    expect(text).toContain('2 sheets share the number, titles differ')
    expect(text).toContain(SPLIT_TITLES[0])
    expect(text).toContain(SPLIT_TITLES[1])
    expect(text).not.toMatch(/copies/i)
  })

  it('still words one number and one title "2 copies"', async () => {
    const { sheets, question } = copies()
    await show(sheets, [question])
    const text = clean(rowNumbered('D-15').textContent)
    expect(text).toContain(COPY_TITLE)
    expect(text).toContain('2 copies')
  })

  it('words a same_title Question over twelve Sheets as twelve sheets that may draw the same thing, never copies', async () => {
    const { sheets, question } = titleShared()
    await show(sheets, [question])
    const text = clean(rowNumbered(sheets[0]!.number!).textContent)
    expect(text).toContain(SHARED_TITLE)
    expect(text).toContain('12 sheets')
    expect(text).toContain('may draw the same thing')
    expect(text).not.toMatch(/copies/i)
    expect(text, 'a series’ words, not a Question’s').not.toContain('share this title')
  })
})

describe('a continuation groups by the server’s id (T-W322 4a, #334)', () => {
  it('makes three Sheets of one `continuation` one row of 3, titled by `continuation_title`, numbered D-41 to D-43', async () => {
    await show(continuation(true))
    const group = rows().filter((r) => numberCell(r).includes('D-41'))
    expect(group, 'one row holds D-41').toHaveLength(1)
    const row = group[0]!
    expect(numberCell(row)).toMatch(/^D-41\s*[–-]\s*D-43$/)
    expect(titleCell(row)).toContain(GROUP_TITLE)
    expect(rows().filter((r) => /D-4[123]/.test(numberCell(r))), 'no other row for D-42 or D-43').toHaveLength(1)
  })

  it('keeps three rows when no Proposal carries `continuation` (an older server)', async () => {
    await show(continuation(false))
    for (const [i, n] of ['D-41', 'D-42', 'D-43'].entries()) expect(titleCell(rowNumbered(n))).toContain(PART_TITLES[i]!)
  })

  it('splits the group where one Sheet is decided, as before', async () => {
    const parts = continuation(true)
    Object.assign(parts[2]!, { decision: 'confirmed', decided_by: 'Rafiq Hasan', decided_at: '2026-09-30T05:00:00Z' })
    await show(parts)
    const row = rows().find((r) => numberCell(r).startsWith('D-41'))
    expect(row, 'the undecided two are one row').toBeDefined()
    expect(numberCell(row!)).toMatch(/^D-41\s*[–-]\s*D-42$/)
    expect(titleCell(rowNumbered('D-43'))).toContain(PART_TITLES[2])
  })

  it('still groups one title on consecutive numbers with no `continuation` field', async () => {
    const { series } = seriesScene()
    const plain = series.slice(0, 2).map((p) => ({ ...p, series: undefined }))
    await show(plain)
    const row = rows().find((r) => numberCell(r).startsWith('D-81'))
    expect(numberCell(row!)).toMatch(/^D-81\s*[–-]\s*D-82$/)
  })
})

describe('a series is told, not asked (T-W322 4a, #334)', () => {
  it('ends each of the series’ rows with "5 sheets share this title", a continuation of two counted in the five', async () => {
    const { series, alone } = seriesScene()
    await show([...series, alone])
    const ofSeries = rows().filter((r) => /^D-(81|85|88|93)/.test(numberCell(r)))
    expect(ofSeries, 'four rows: D-81–D-82, D-85, D-88, D-93').toHaveLength(4)
    for (const row of ofSeries) {
      expect(titleCell(row)).toContain(SERIES_TITLE)
      expect(titleCell(row)).toMatch(/5 sheets share this title$/)
    }
    expect(rows().filter((r) => /Question Q\d/.test(clean(r.textContent))), 'no Question row').toHaveLength(0)
  })

  it('shows no such words on a Sheet in no series', async () => {
    const { series, alone } = seriesScene()
    await show([...series, alone])
    await waitFor(() => rowNumbered('D-90'))
    expect(titleCell(rowNumbered('D-90'))).not.toContain('share this title')
  })
})
