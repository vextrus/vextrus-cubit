/*
 * Ticket S25-D1's acceptance tests (G1 walk A f-1, FL9, misleading; #672): the "Two sheets, one number"
 * Question's card must tell its copies apart. m0-screens §6.7 (1439): "A table: Copy · Date · File,
 * where: "R1 · 14 Sep 2026 · NT-STR-R1.dwg, laid out in the drawing, x 2,460′"; "R0 · 02 Aug 2026 ·
 * NT-STR-R1.dwg, laid out in the drawing, x −1,180′"", and its options name each copy ("Keep R1
 * (14 Sep 2026); leave R0 out as superseded"). §6.6 (1395) words a sheet's place in its file
 * "laid out in the drawing" or "layout "A-24"" (the product writes the layout's name in “ ”).
 *
 * Run at /p/KR-01/takeoff/1 through t22's in-memory API (../t22/step1.fixture.ts). Its two S-07 copies are
 * made alike: one file (KR-STR-R0.dwg), one revision mark (R0), one date (20 Aug 2026), so only their
 * place (`layout`, Step1ProposalOut's existing field: null when laid out in the drawing) or their title
 * differs. The Question offers the read job's own options (`keep_latest`, `keep_all`, `keep_open`),
 * none pre-picked. Every title is invented.
 *
 * Not pinned: the x position of a copy laid out in the drawing (m0-screens' ", x 2,460′"): the API names no
 * field for it, so the File cell is pinned up to the place and may go on.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '../t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

const FILE = 'KR-STR-R0.dwg'
const DATE = '20 Aug 2026'

/** A Proposal with its place in its file (`layout`, which t22's fixture type leaves out). */
type Placed = ProposalOut & { layout: string | null }

/**
 * KR-01 with its two S-07 copies alike in file, mark and date: `places` and `titles` set each copy's
 * layout (null: laid out in the drawing) and title. The S-07 Question offers the read job's options.
 */
function kr01(places: [string | null, string | null], titles: [string, string]): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const copies = step1.proposals.filter((p) => p.number === 'S-07')
  expect(copies).toHaveLength(2)
  const file = step1.proposals.find((p) => p.file_name === FILE)!
  copies.forEach((p, i) =>
    Object.assign(p as Placed, {
      title: titles[i]!,
      revision_mark: 'R0',
      revision_mark_source: 'title_block',
      issue_date: '2026-08-20',
      file_id: file.file_id,
      file_name: FILE,
      layout: places[i]!,
    }),
  )
  for (const p of step1.proposals) if (!('layout' in p)) Object.assign(p as Placed, { layout: null })
  const q = step1.questions.find((x) => x.code === 'engine.conflicts.same_number')!
  q.options = ['keep_latest', 'keep_all', 'keep_open'].map((key) => ({ key, picked: false }))
  return api
}

/** The S-07 Question's card, opened from the S-07 row. */
async function card(api: FakeApi): Promise<HTMLElement> {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  const rows = () => {
    const all = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes('S-07'))
    return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
  }
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
  await userEvent.click(within(rows()[0]!).getAllByText('S-07')[0]!)
  await waitFor(() => expect(bodyText()).toContain('Two sheets are numbered S-07'))
  const section = [...document.querySelectorAll<HTMLElement>('section[data-question]')].find((s) => clean(s.textContent).includes('Two sheets are numbered S-07'))
  expect(section, 'the S-07 Question card').toBeDefined()
  return section!
}

/** The card's copies table: its column headers and, per copy, its cells' words. */
function copiesTable(section: HTMLElement): { headers: string[]; rows: string[][] } {
  const table = within(section).getByRole('table')
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((h) => clean(h.textContent))
  const rows = within(table)
    .getAllByRole('row')
    .map((r) => within(r).queryAllByRole('cell').map((c) => clean(c.textContent)))
    .filter((cells) => cells.length > 0)
  return { headers, rows }
}

/** Each answer's words, in the card's order. */
function optionWords(section: HTMLElement): string[] {
  return within(section)
    .getAllByRole('radio')
    .map((r) => clean(r.closest('label')?.textContent ?? ''))
}

describe('m0-screens §6.7: a "Two sheets, one number" card tells its copies apart', () => {
  it('shows the copies as a table with the columns Copy, Date and File', async () => {
    const section = await card(kr01([null, 'Layout2'], ['TYPICAL FLOOR SLAB LAYOUT', 'TYPICAL FLOOR SLAB LAYOUT']))
    const { headers, rows } = copiesTable(section)
    expect(headers).toEqual(['Copy', 'Date', 'File'])
    expect(rows).toHaveLength(2)
  })

  it('tells two copies in one file apart by where each sits: "laid out in the drawing" and its layout', async () => {
    const section = await card(kr01([null, 'Layout2'], ['TYPICAL FLOOR SLAB LAYOUT', 'TYPICAL FLOOR SLAB LAYOUT']))
    const { rows } = copiesTable(section)
    expect(rows).toHaveLength(2)
    for (const [copy, date] of rows) {
      expect(copy).toBe('R0')
      expect(date).toBe(DATE)
    }
    const files = rows.map((r) => r[2] ?? '')
    // m0-screens 1439: "<file>, laid out in the drawing, x 2,460′"; the x is not pinned (see the header).
    const drawn = files.filter((f) => f === `${FILE}, laid out in the drawing` || f.startsWith(`${FILE}, laid out in the drawing, `))
    const onLayout = files.filter((f) => f === `${FILE}, layout “Layout2”`)
    expect(drawn, files.join(' | ')).toHaveLength(1)
    expect(onLayout, files.join(' | ')).toHaveLength(1)
    expect(rows[0]!.join(' · ')).not.toBe(rows[1]!.join(' · '))
    // Alike but for their place, the options cannot name them by place in the list either.
    for (const w of optionWords(section)) {
      expect(w).not.toMatch(/\bfirst copy\b/i)
      expect(w).not.toMatch(/\bsecond copy\b/i)
    }
  })

  it('names the kept copy by what differs, never "the first copy" or "the second copy"', async () => {
    const titles: [string, string] = ['ZQ SLAB LAYOUT, BLOCK NORTH', 'ZQ SLAB LAYOUT, BLOCK SOUTH']
    const section = await card(kr01([null, null], titles))
    const words = optionWords(section)
    expect(words.length).toBeGreaterThanOrEqual(3)
    for (const w of words) {
      expect(w).not.toMatch(/\bfirst copy\b/i)
      expect(w).not.toMatch(/\bsecond copy\b/i)
    }
    const keep = words.find((w) => /superseded/.test(w))
    expect(keep, words.join(' | ')).toBeDefined()
    expect(titles.some((t) => keep!.toUpperCase().includes(t)), keep).toBe(true)
  })
})
