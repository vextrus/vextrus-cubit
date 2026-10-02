/*
 * #159 (fix round 1, F1): a Discipline the QS chose while the file read, refused once its sheet numbers
 * were read (`drawings.files.discipline_choice_undone`, kept as the read file's finding), is said at the
 * report's top line, in words, beside a limit that cut the reading.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

describe('a Discipline choice undone at read time, on its row and in the report', () => {
  it('says the refusal and the limit that cut the reading, each once', async () => {
    const api = new FakeApi()
    const set = new FakeDrawingSet(api, 'KR-01')
    const f = file({
      name: 'KR-SET3-R0.dwg',
      discipline: 'general',
      state: 'read',
      status: msg('drawings.files.read'),
      sheets_found: 3,
      finding: msg('drawings.files.discipline_choice_undone', { discipline: 'Structural', sheet: '01' }),
    })
    set.files.unshift(f)
    set.reports.set(f.id, {
      readers: [msg('drawings.reports.readers_agree')],
      sheets: [
        msg('drawings.reports.sheets_found_layouts', { sheets: 3 }),
        msg('takeoff.read_file.not_read_in_full', { limit: 'sheets_capped' }),
      ],
    })
    await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    // The row says it before the report is opened (the words gate's may).
    const row = (await screen.findByText('KR-SET3-R0.dwg')).closest('tr')
    expect(clean(row?.textContent)).toContain('Your Discipline choice was undone')
    await userEvent.click(await screen.findByText('KR-SET3-R0.dwg'))
    const refused =
      'Structural already has a sheet 01 from another file, so your choice of Structural for this file was undone once its sheets were read.'
    const cut = 'This file holds more sheets than Vextrus lists from one file'
    await waitFor(() => expect(clean(document.body.textContent)).toContain(refused))
    const report = clean(screen.getByRole('region', { name: /KR-SET3-R0\.dwg/ }).textContent)
    expect(report.split(refused)).toHaveLength(2)
    expect(report.split(cut)).toHaveLength(2)
  })
})
