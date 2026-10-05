/*
 * Ticket T-235b's acceptance tests for D (issue #235, "Sheets found shows a dash while reading"): a DWG
 * still being read already says "Reading sheet 9 of 41", so its Sheets found cell shows the total it
 * knows (41), not "—". A file whose status has no total, and a PDF (a Plot: its pages are not sheets),
 * keep "—"; a read DWG shows the sheets it found. The page's one-line summary stays the server's: it
 * counts the sheets of read files only (m0-screens §4.5, "Layout").
 *
 * The Drawing Set through ticket 20b's in-memory fake (`../t20b/drawings.fixture.ts`); every file name
 * and figure is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '../t20b/drawings.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const DASH = '—'

function drawingSet() {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  set.files.push(
    file({ name: 'KR-STR-R2.dwg', state: 'read', status: msg('drawings.files.read'), sheets_found: 14 }),
    file({ name: 'KR-ARC-R1.dwg', discipline: 'architectural', state: 'reading', status: msg('drawings.files.reading_sheet', { position: 9, total: 41 }) }),
    file({ name: 'KR-ELE-R1.dwg', discipline: 'electrical', state: 'reading', status: msg('drawings.files.reading_drawing') }),
    file({ name: 'KR-STR-R2.pdf', state: 'read', status: msg('drawings.files.read') }),
  )
  set.summary = msg('drawings.files.summary', { files: 4, sheets: 14, reading: 2, failed: 0, held: 0, refused: 0 })
  return { api, set }
}

async function open(api: FakeApi) {
  await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
}

function rowOf(name: string): HTMLElement {
  const table = screen.getByRole('table', { name: 'Files' })
  const rows = within(table)
    .getAllByRole('row')
    .filter((r) => within(r).queryAllByRole('cell').some((c) => clean(c.textContent) === name))
  expect(rows, `the row of ${name}`).toHaveLength(1)
  return rows[0]!
}

/** The row's cell under the "Sheets found" heading. */
function sheetsFound(name: string): string {
  const table = screen.getByRole('table', { name: 'Files' })
  const at = within(table)
    .getAllByRole('columnheader')
    .findIndex((h) => clean(h.textContent) === 'Sheets found')
  expect(at, 'the "Sheets found" column').toBeGreaterThanOrEqual(0)
  return clean(within(rowOf(name)).getAllByRole('cell')[at]!.textContent)
}

describe('Sheets found while a file is read (issue #235; m0-screens §4.5)', () => {
  it('shows the total a reading DWG’s status already gives, not a dash', async () => {
    const { api } = drawingSet()
    await open(api)
    await waitFor(() => rowOf('KR-ARC-R1.dwg'))
    expect(clean(rowOf('KR-ARC-R1.dwg').textContent)).toContain('Reading sheet 9 of 41')
    expect(sheetsFound('KR-ARC-R1.dwg')).toBe('41')
  })

  it('keeps the dash for a reading file whose status gives no total, and for a PDF; a read DWG shows its sheets found', async () => {
    const { api } = drawingSet()
    await open(api)
    await waitFor(() => rowOf('KR-ELE-R1.dwg'))
    expect(sheetsFound('KR-ELE-R1.dwg')).toBe(DASH)
    expect(sheetsFound('KR-STR-R2.pdf')).toBe(DASH)
    expect(sheetsFound('KR-STR-R2.dwg')).toBe('14')
  })
})

describe('the summary line counts read files only (a guard)', () => {
  it('says the server’s summary, without the reading file’s sheets', async () => {
    const { api } = drawingSet()
    await open(api)
    await waitFor(() => rowOf('KR-ARC-R1.dwg'))
    const text = clean(document.body.textContent)
    expect(text).toContain('4 files: 14 sheets read, 2 files reading')
    expect(text).not.toContain('55 sheets')
  })
})
