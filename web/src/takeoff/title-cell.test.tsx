/*
 * The Title cell at the walk's widths (#322, review round 1): a Question row's kind words never take the
 * titles' room, and the held mark is always inside the cell. Measured in the browser at 1280 and 1440
 * with the Selection open, on 22's fake with T-W322's invented Sheets (read here, never changed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../acceptance/t22/step1.fixture'
import { clean, continuation, numberShared, seriesScene, sheet, stage, titleShared, type Proposal, type Question } from '../acceptance/w322/sheets.fixture'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const held = (p: Proposal): Proposal => ({ ...p, held: true })

async function show(width: number, proposals: readonly Proposal[], questions: readonly Question[] = []) {
  await page.viewport(width, 900)
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  stage(step1, proposals, questions)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(document.querySelectorAll('[role="row"][data-row]').length).toBeGreaterThan(0))
}

function rowFrom(number: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"][data-row]')]
  const found = rows.filter((r) => clean(r.querySelectorAll('[role="gridcell"]')[1]?.textContent).startsWith(number))
  expect(found, `one row from ${number}`).toHaveLength(1)
  return found[0]!
}

const titleCell = (row: HTMLElement) => row.querySelectorAll<HTMLElement>('[role="gridcell"]')[2]!

/** How many px of `el` show inside `cell` (the cell clips what overflows it). */
function shown(el: { getBoundingClientRect(): DOMRect }, cell: Element): number {
  const a = el.getBoundingClientRect()
  const c = cell.getBoundingClientRect()
  return Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left))
}

function expectTitleShown(row: HTMLElement, text: string) {
  const cell = titleCell(row)
  const title = [...cell.querySelectorAll('*')].find((el) => clean(el.textContent) === text && ![...el.children].some((c) => clean(c.textContent) === text))
  expect(title, `“${text}” in the cell`).toBeDefined()
  expect(shown(title!, cell), `px of the title shown in ${cell.getBoundingClientRect().width} px`).toBeGreaterThanOrEqual(40)
}

function expectHeldWhole(row: HTMLElement) {
  const cell = titleCell(row)
  const mark = [...cell.querySelectorAll('span')].find((el) => clean(el.textContent) === 'held' && el.children.length === 0)
  expect(mark, 'a held mark in the cell').toBeDefined()
  const width = mark!.getBoundingClientRect().width
  expect(width).toBeGreaterThan(0)
  expect(shown(mark!, cell), 'the whole held mark is inside the cell').toBeCloseTo(width, 0)
}

describe.each([1280, 1440])('the Title cell at %i px, the Selection open (#322, round 1)', (width) => {
  it('shows a number-shared row’s titles and its held mark', async () => {
    const { sheets, question } = numberShared()
    await show(width, sheets.map(held), [question])
    const row = rowFrom('D-14')
    expectTitleShown(row, sheets[0]!.title)
    expectHeldWhole(row)
  })

  it('shows a title-shared row’s title and its held mark', async () => {
    const { sheets, question } = titleShared()
    await show(width, sheets.map(held), [question])
    const row = rowFrom(sheets[0]!.number!)
    expectTitleShown(row, sheets[0]!.title)
    expectHeldWhole(row)
  })

  it('shows a series row’s title', async () => {
    const { series, alone } = seriesScene()
    await show(width, [...series, alone])
    expectTitleShown(rowFrom('D-81'), series[0]!.title)
  })
})

/** The cell's words as the eye reads them: what is shown inside the cell, screen-reader-only text left out. */
function seen(cell: HTMLElement): string {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
  let out = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement!
    if (el.closest('.sr-only')) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    if (shown(range, cell) > 0) out += node.textContent
  }
  return clean(out)
}

describe.each([1280, 1440])('each row’s count is true of that row, and shown whole, at %i px (#322, round 2)', (width) => {
  it('says a one-sheet series member is of a series of 5, never "5 sheets"', async () => {
    const { series, alone } = seriesScene()
    await show(width, [...series, alone].map((p, i) => (i === 2 ? held(p) : p)))
    const one = rowFrom('D-85')
    const words = seen(titleCell(one))
    expect(words).toContain('series of 5')
    expect(words).not.toMatch(/\b5 sheets\b/)
    expectTitleShown(one, series[2]!.title)
    expectHeldWhole(one)
    const run = seen(titleCell(rowFrom('D-81')))
    expect(run).toContain('2 sheets')
    expect(run).toContain('series of 5')
  })

  it('shows a number-shared row’s count whole beside its titles', async () => {
    const { sheets, question } = numberShared()
    await show(width, sheets, [question])
    const words = seen(titleCell(rowFrom('D-14')))
    expect(words).toMatch(/2 sheets$/)
  })
})

describe('a continuation split by a decision (#322, round 1)', () => {
  it('names each title its part row holds, never one title for sheets titled apart', async () => {
    const parts = continuation(true)
    Object.assign(parts[0]!, { decision: 'confirmed', decided_by: 'Rafiq Hasan', decided_at: '2026-09-30T05:00:00Z' })
    await show(1440, [...parts, sheet('D-90', 'SITE DRAIN PROFILE')])
    const text = clean(titleCell(rowFrom('D-42')).textContent)
    expect(text).toContain(parts[1]!.title)
    expect(text).toContain(parts[2]!.title)
  })
})
