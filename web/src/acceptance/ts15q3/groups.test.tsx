/*
 * S15-Q3's acceptance on Step 1's list (T-W322's screen half; #232, #321, #334), mounted through the app
 * on 22's fake (`../t22/step1.fixture.ts`) with invented Sheets (groups.fixture.ts).
 *
 * The promises, in the authority's words:
 * - m0-screens §6.2: a continuation is "one continuation and one row: Number "S-09–S-11", Title "Column
 *   schedule, 3 sheets""; titles equal but for a member-mark range are one continuation too, titled
 *   with "the ranges joined first to last" (the owner's "In M0", 5 Oct 2026). The server names the
 *   group (`continuation`, `continuation_title`, T-W334's contract).
 * - The owner's ruling of 5 Oct 2026 (#334): "one title on several runs that draw different storeys,
 *   marks or members is one series ("N sheets share this title"), no Question".
 * - #232: a title on several sheets is never called "copies".
 *
 * Not pinned: where in its row a series' words sit (cell or badge), a same_title row's other words, and
 * that a series asks nothing (the server's promise, pinned in vextrus/takeoff/tests/acceptance/w334).
 * The Number cell is the row's second grid cell (m0-screens §6.2's columns: mark, Number, Title).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { GROUP_TITLE, SERIES_TITLE, SHARED_TITLE, clean, continuation, seriesScene, stage, titleShared, type Proposal, type Question } from './groups.fixture'

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
const text = (row: HTMLElement) => clean(row.textContent)

describe('a continuation the server names is one row (m0-screens §6.2; #334 "In M0")', () => {
  it('shows three Sheets of one `continuation` as one row numbered D-41–D-43, titled by `continuation_title`, "3 sheets"', async () => {
    await show(continuation())
    const held = rows().filter((r) => /D-4[123]/.test(numberCell(r)))
    expect(held, 'one row holds D-41 to D-43').toHaveLength(1)
    const row = held[0]!
    expect(numberCell(row)).toMatch(/^D-41\s*[–-]\s*D-43$/)
    expect(text(row)).toContain(GROUP_TITLE)
    expect(text(row)).toContain('3 sheets')
  })
})

describe('a series is told, never asked (the owner, 5 Oct 2026, #334)', () => {
  it('says "5 sheets share this title" on each of the series’ rows, never "copies"', async () => {
    const { series, alone } = seriesScene()
    await show([...series, alone])
    const ofSeries = rows().filter((r) => /^D-(81|85|88|93)/.test(numberCell(r)))
    expect(ofSeries, 'four rows: D-81–D-82, D-85, D-88, D-93').toHaveLength(4)
    for (const row of ofSeries) {
      expect(text(row)).toContain(SERIES_TITLE)
      expect(text(row)).toContain('5 sheets share this title')
      expect(text(row)).not.toMatch(/copies/i)
    }
  })

  it('says no such words on a Sheet in no series', async () => {
    const { series, alone } = seriesScene()
    await show([...series, alone])
    const row = await waitFor(() => {
      const found = rows().filter((r) => numberCell(r) === 'D-90')
      expect(found).toHaveLength(1)
      return found[0]!
    })
    expect(text(row)).not.toContain('share this title')
  })
})

describe('a title on many sheets is never "copies" (#232)', () => {
  it('words a same_title Question over twelve Sheets with its count, never "copies"', async () => {
    const { sheets, question } = titleShared()
    await show(sheets, [question])
    const row = rows().find((r) => numberCell(r).startsWith(sheets[0]!.number!))!
    expect(text(row)).toContain(SHARED_TITLE)
    expect(text(row)).toContain('12 sheets')
    expect(text(row)).not.toMatch(/copies/i)
  })
})
