/*
 * S15-W3 (issue #547, superseding #222): a drawing-list answer that keeps a sheet "in the count as
 * missing" leaves a row for it on Step 1.
 *
 * docs/design/m0-screens.md §6.2: rows that are not sheets include "a drawing-list entry with no sheet
 * ("A-28 · A-28 is on the drawing list but in no file · Question Q2", after its answer "missing, in the
 * count")"; §6.3, inside each Discipline: "drawing-list entries with no sheet close it"; §5: ""Not sent
 * yet" answers it, and the sheet stays in the count as missing"; §6.7's first line for options 1 and 3:
 * "Answering keeps A-28 in the count as missing." #222: "After "Not sent yet" on S-13, the only trace is
 * "13 on the drawing list" and "2 / 13 settled" in the Structural header; there is no row to open or
 * revisit."
 *
 * KR-01 (22's fake) with 156's drawing-list Check on S-13 (`engine.register_check.not_found`), alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { page } from 'vitest/browser'
import { answerByKeys, idle, openWith, rowText, sectionRows } from './w3.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const MISSING = 'missing, in the count'

async function rowTexts(): Promise<string[]> {
  const grid = await screen.findByRole('grid', { name: 'Sheets' })
  return within(grid)
    .getAllByRole('row')
    .map(rowText)
}

/** S-13's Check answered with `key`; the row of S-13 once the list shows it so. */
async function answered(key: string): Promise<{ row: string }> {
  const { fake, question } = await openWith('check')
  await answerByKeys(question, key)
  await waitFor(() => expect(fake.posted).toHaveLength(1))
  await idle()
  let all: string[] = []
  let row = ''
  await waitFor(async () => {
    all = await rowTexts()
    row = all.find((t) => /\bS-13\b/.test(t) && t.includes(MISSING)) ?? ''
    expect(row, `a row of S-13 reading "${MISSING}"; the rows: ${all.join(' / ').slice(0, 600)}`).not.toBe('')
  })
  return { row }
}

describe('a sheet kept in the count as missing shows a row (§6.2, §6.3; #222)', () => {
  it('keeps a row for S-13 reading "missing, in the count" after "Not sent yet"', async () => {
    const { row } = await answered('not_sent_yet')
    expect(row).not.toContain('Question Q1')
  })

  it('keeps the row after "It is in a file I haven’t added yet" too', async () => {
    await answered('file_not_added')
  })

  it('closes the Structural section with the row', async () => {
    const { row } = await answered('not_sent_yet')
    const structural = await sectionRows('Structural')
    expect(structural.at(-1), 'the last row under the Structural heading').toBe(row)
  })
})
