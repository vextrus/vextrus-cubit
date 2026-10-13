/** S25-D1 round 1 (#774): see the describe below. */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

const FILE = 'KR-STR-R0.dwg'

/** A Proposal with its place in its file (`layout`, which t22's fixture type leaves out). */
type Placed = ProposalOut & { layout: string | null }

/**
 * KR-01 with its two S-07 copies alike in file, mark and date: `places` and `titles` set each copy's
 * layout (null: laid out in the drawing) and title. The S-07 Question offers the read job's options.
 */
function kr01(places: [string | null, string | null], titles: [string, string], files: [string, string] = [FILE, FILE]): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const copies = step1.proposals.filter((p) => p.number === 'S-07')
  expect(copies).toHaveLength(2)
  const fileOf = (name: string) => step1.proposals.find((p) => p.file_name === name) ?? step1.proposals.find((p) => p.file_name === FILE)!
  copies.forEach((p, i) =>
    Object.assign(p as Placed, {
      title: titles[i]!,
      revision_mark: 'R0',
      revision_mark_source: 'title_block',
      issue_date: '2026-08-20',
      file_id: files[i] === FILE ? fileOf(FILE).file_id : `other-file-${i}`,
      file_name: files[i]!,
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

/*
 * S25-D1 round 1: the copies table and the options tell two copies apart by what differs, and say so when
 * nothing does. The ts25d1 acceptance pins the File cell and the option words; these pin the table's rows.
 */
describe('a "Two sheets, one number" card: the table shows what the options name a copy by', () => {
  it('shows each copy\'s title in its row when only the titles differ (the G1 walk A f-1 case)', async () => {
    const titles: [string, string] = ['ZQ SLAB LAYOUT, BLOCK NORTH', 'ZQ SLAB LAYOUT, BLOCK SOUTH']
    const section = await card(kr01([null, null], titles))
    const { rows } = copiesTable(section)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.join(' · ')).not.toBe(rows[1]!.join(' · '))
    const copyCells = rows.map((r) => r[0]!.toUpperCase())
    for (const t of titles) expect(copyCells.filter((c) => c.includes(t))).toHaveLength(1)
  })

  it('names copies in two files by their file when all else is alike, never by the table\'s order', async () => {
    const section = await card(kr01([null, null], ['TYPICAL FLOOR SLAB LAYOUT', 'TYPICAL FLOOR SLAB LAYOUT'], [FILE, 'KR-STR-R0B.dwg']))
    const words = optionWords(section)
    for (const w of words) expect(w).not.toMatch(/upper copy|lower copy/i)
    const keep = words.find((w) => /superseded/.test(w))
    expect(keep, words.join(' | ')).toMatch(/KR-STR-R0B?\.dwg/)
  })

  it('says the copies are alike when they tie on every field, and the options go by the table\'s order', async () => {
    const section = await card(kr01([null, null], ['TYPICAL FLOOR SLAB LAYOUT', 'TYPICAL FLOOR SLAB LAYOUT']))
    expect(clean(section.textContent)).toContain('The copies are alike in every field the table shows.')
    const keep = optionWords(section).find((w) => /superseded/.test(w))
    expect(keep, optionWords(section).join(' | ')).toMatch(/upper copy in the table|lower copy in the table/)
  })

  it('does not say they are alike when one field differs', async () => {
    const section = await card(kr01([null, 'Layout2'], ['TYPICAL FLOOR SLAB LAYOUT', 'TYPICAL FLOOR SLAB LAYOUT']))
    expect(clean(section.textContent)).not.toContain('alike in every field')
  })
})
