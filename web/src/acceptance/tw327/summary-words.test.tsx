/*
 * T-W327's acceptance tests (#327, G1 walk item FL4): the Drawing Set's summary line names the sheets
 * that come from a held file read anyway.
 *
 * The ticket's seam: the API's summary `drawings.files.summary` gains `held_sheets` and `held_files_read`
 * (how many held files were read anyway); the line reads "<files>: <sheets> sheets read (<held_sheets> of
 * them from a held file), <held> held", "from <n> held files" when more than one held file was read
 * anyway, "(all from a held file)" / "(all from <n> held files)" when every sheet read came from them,
 * and no parenthesis when `held_sheets` is 0. A summary without `held_files_read` (an older reply) reads
 * as one held file. The page shows the API's summary word for word (14's ruling). Every count here is
 * invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

async function summaryOf(params: Record<string, number>) {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  set.files.push(
    file({ name: 'KR-ARC-R4.dwg', state: 'read', status: msg('drawings.files.read'), sheets_found: 12 }),
    file({ name: 'KR-PLB-old.dwg', state: 'held', status: msg('drawings.files.held_read_anyway'), sheets_found: 17 }),
  )
  set.summary = msg('drawings.files.summary', params)
  await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
  await waitFor(() => expect(bodyText()).toMatch(/\d+ files?: /))
  return bodyText()
}

describe('the summary names the sheets of a held file (§4.5 "Layout")', () => {
  it('says how many of the sheets read come from a held file', async () => {
    const text = await summaryOf({ files: 6, sheets: 143, held_sheets: 17, held_files_read: 1, reading: 0, failed: 0, held: 1, refused: 0 })
    expect(text).toContain('6 files: 143 sheets read (17 of them from a held file), 1 held')
  })

  it('says nothing of a held file when none of the sheets come from one', async () => {
    const text = await summaryOf({ files: 6, sheets: 126, held_sheets: 0, held_files_read: 0, reading: 0, failed: 0, held: 1, refused: 0 })
    expect(text).toContain('6 files: 126 sheets read, 1 held')
    expect(text).not.toMatch(/of them from|all from|held files? read|undefined|NaN/)
  })

  it('says "all from a held file" when every sheet read comes from the one held file, in the singular', async () => {
    const text = await summaryOf({ files: 1, sheets: 1, held_sheets: 1, held_files_read: 1, reading: 0, failed: 0, held: 1, refused: 0 })
    expect(text).toContain('1 file: 1 sheet read (all from a held file), 1 held')
    expect(text).not.toContain('of them')
  })

  it('keeps the other counts after the held part', async () => {
    const text = await summaryOf({ files: 9, sheets: 40, held_sheets: 6, held_files_read: 1, reading: 1, failed: 1, held: 2, refused: 1 })
    expect(text).toContain('9 files: 40 sheets read (6 of them from a held file), 1 file reading, 1 could not be read, 2 held, 1 refused')
  })

  it('names the number of held files when more than one was read anyway', async () => {
    const text = await summaryOf({ files: 7, sheets: 58, held_sheets: 23, held_files_read: 2, reading: 0, failed: 0, held: 2, refused: 0 })
    expect(text).toContain('7 files: 58 sheets read (23 of them from 2 held files), 2 held')
    expect(text).not.toContain('from a held file')
  })

  it('says "all from 2 held files" when every sheet read comes from two held files', async () => {
    const text = await summaryOf({ files: 2, sheets: 29, held_sheets: 29, held_files_read: 2, reading: 0, failed: 0, held: 2, refused: 0 })
    expect(text).toContain('2 files: 29 sheets read (all from 2 held files), 2 held')
    expect(text).not.toContain('of them')
  })

  it('reads a summary without held_files_read as one held file', async () => {
    const text = await summaryOf({ files: 6, sheets: 143, held_sheets: 17, reading: 0, failed: 0, held: 1, refused: 0 })
    expect(text).toContain('6 files: 143 sheets read (17 of them from a held file), 1 held')
    expect(text).not.toMatch(/undefined|NaN/)
  })
})
