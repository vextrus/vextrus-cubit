/*
 * S27-G4, f-12 of session 26's G1 walk (#668): the DWG report's Fonts table is headed as
 * docs/design/m0-screens.md 4.5 heads it: "Table: The drawing asks for · Vextrus draws it with · How close ·
 * Sheets." Its last column holds how many of the file's sheets each font's texts are on: the API's
 * `ReportOut.font_rows[].sheets` (`vextrus/drawings/schemas/files.py`, `FontRowOut.sheets`: "the Fonts
 * table's "Sheets" column"), never the count of texts (`texts`).
 *
 * Run on t20b's in-memory Drawing Set API (../t20b/drawings.fixture.ts); the file name and fonts are invented.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const FILE = 'ZQ-ARC-R0.dwg'

function rowOf(name: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tbody tr')].filter((r) => clean(r.textContent).includes(name))
  expect(rows, `one row for ${name}`).toHaveLength(1)
  return rows[0]!
}

/** A read DWG whose one font's texts (12) lie on 3 of its sheets; its report opened from its row. */
async function fontsTable(): Promise<HTMLElement> {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  const f = file({ name: FILE, state: 'read', status: msg('drawings.files.read') })
  set.files.push(f)
  set.reports.set(f.id, {
    fonts: [msg('engine.font_report.summary', { fonts: 1 })],
    font_rows: [
      Object.assign(
        { asked: msg('engine.font_report.asked', { asked: 'Romans', kind: 'shx' }), how_close: msg('engine.font_report.how_close', { how_close: 'single_stroke', drawn_with: 'Relief SingleLine' }), texts: 12 },
        { sheets: 3 },
      ),
    ],
  })
  await mountApp('/p/KR-01/drawing-set', { as: PEOPLE.qs, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
  await waitFor(() => rowOf(FILE))
  await userEvent.click(rowOf(FILE))
  const panel = await screen.findByRole('region', { name: new RegExp(FILE.replace('.', '\\.')) })
  return within(panel).findByRole('table', { name: 'Fonts' })
}

describe('the DWG report’s Fonts table, as m0-screens 4.5 heads it (f-12, #668)', () => {
  it('heads its columns "The drawing asks for", "Vextrus draws it with", "How close" and "Sheets"', async () => {
    const table = await fontsTable()
    const headings = within(table).getAllByRole('columnheader').map((h) => clean(h.textContent))
    expect(headings, 'the Fonts table headed as 4.5 heads it').toEqual(['The drawing asks for', 'Vextrus draws it with', 'How close', 'Sheets'])
  })

  it('gives under "Sheets" how many sheets the font’s texts are on (3), not how many texts (12)', async () => {
    const table = await fontsTable()
    const cells = within(table).getAllByRole('cell').map((c) => clean(c.textContent))
    expect(cells, 'the Fonts row with its sheets in the last column').toEqual(['Romans (AutoCAD lettering)', 'Relief SingleLine', 'Single-stroke, like the plot', '3'])
  })
})
