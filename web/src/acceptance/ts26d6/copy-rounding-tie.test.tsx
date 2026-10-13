/*
 * S26-D6, finding 3 (#774's review round 5, score 50): a copy laid out in the drawing was told apart from the
 * other by its raw `x_mm`, while the words show x rounded (to ⅛″ in feet and inches, to 1 mm in metres;
 * m0-screens 1.2). Two copies whose x rounds alike then got two options worded the same. Copies are told apart
 * on the words shown (m0-screens 6.7: the options name each copy so the QS can tell which is kept): a rounding
 * tie falls through to "the copy in row N", as any other tie does (#774 round 4).
 *
 * The two S-07 copies of KR-01 (§7) are made alike in mark, date, title and file, laid out in the drawing; only
 * their x differs. Each case first checks, with the screen's own formatter, that the two x read alike (or not),
 * so the test says so if the notation ever changes.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '@/acceptance/t22/step1.fixture'
import { lengthFromMm } from '@/format'
import { coordinateText } from '@/format/notation'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏⁠]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const FILE = 'KR-STR-R0.dwg'
const TITLE = 'TYPICAL FLOOR SLAB LAYOUT'

type Placed = ProposalOut & { layout: string | null; x_mm?: number | null }
type Units = 'imperial' | 'metric'
const xOf = (mm: number, units: Units) => coordinateText(lengthFromMm(mm), units === 'imperial' ? 'feet-inches' : 'metric').screen

/** KR-01 with its two S-07 copies alike but for x (`xs`), in `units`; the Question offers the read job's options. */
function kr01(xs: [number, number], units: Units = 'imperial'): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  if (units === 'metric') Object.assign(api.project('KR-01'), { unitSystem: 'metric' })
  for (const p of step1.proposals) if (!('layout' in p)) Object.assign(p as Placed, { layout: null })
  const copies = step1.proposals.filter((p) => p.number === 'S-07')
  expect(copies).toHaveLength(2)
  const fileId = step1.proposals.find((p) => p.file_name === FILE)?.file_id ?? copies[0]!.file_id
  copies.forEach((p, i) =>
    Object.assign(p as Placed, { title: TITLE, revision_mark: 'R0', revision_mark_source: 'title_block', issue_date: '2026-08-20', file_id: fileId, file_name: FILE, layout: null, x_mm: xs[i]! }),
  )
  const q = step1.questions.find((x) => x.code === 'engine.conflicts.same_number')!
  q.options = ['keep_latest', 'keep_all', 'keep_open'].map((key) => ({ key, picked: false }))
  return api
}

/** The S-07 Question's card, opened from the S-07 row. */
async function card(api: FakeApi): Promise<HTMLElement> {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed 0 \/ \d+/))
  const rows = () => {
    const all = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes('S-07'))
    return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
  }
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
  await userEvent.click(within(rows()[0]!).getAllByText('S-07')[0]!)
  await waitFor(() => expect(bodyText()).toContain('Two sheets are numbered S-07'))
  const section = [...document.querySelectorAll<HTMLElement>('section[data-question]')].find((s) => clean(s.textContent).includes('Two sheets are numbered S-07'))
  expect(section, 'the S-07 Question card').toBeDefined()
  return section!
}

/** Each answer's words, in the card's order (its digit first). */
function optionWords(section: HTMLElement): string[] {
  return within(section)
    .getAllByRole('radio')
    .map((r) => clean(r.closest('label')?.textContent ?? ''))
}

/** The option that keeps one copy and leaves the other out (6.7: "Keep R1 (14 Sep 2026); leave R0 out as superseded"). */
function keep(section: HTMLElement): string {
  const found = optionWords(section).filter((w) => /superseded/.test(w))
  expect(found, optionWords(section).join(' | ')).toHaveLength(1)
  return found[0]!
}

/** The kept copy's name and the left-out copy's name in the keep option. */
function named(words: string): [string, string] {
  const m = /Keep (.+?); leave (.+?) out as superseded/.exec(words)
  expect(m, words).not.toBeNull()
  return [m![1]!, m![2]!]
}

describe('copies whose x reads alike are told apart by their row, never named the same in one option (#774 review round 5)', () => {
  it('names two copies 0.5 mm apart (both x 22′-11⅝″) "Keep the copy in row 1; leave the copy in row 2 out as superseded"', async () => {
    const xs: [number, number] = [7000, 7000.5]
    expect(xOf(xs[0], 'imperial'), 'the two x read alike').toBe(xOf(xs[1], 'imperial'))
    const words = keep(await card(kr01(xs)))
    const [kept, left] = named(words)
    expect(kept, words).not.toBe(left)
    expect(words).toContain('Keep the copy in row 1; leave the copy in row 2 out as superseded')
    expect(words).not.toContain('at x ')
  })

  it('names two copies whose x differ only by float noise (7000 and 7000.0000001 mm) by their row', async () => {
    const xs: [number, number] = [7000, 7000.0000001]
    expect(xOf(xs[0], 'imperial')).toBe(xOf(xs[1], 'imperial'))
    const words = keep(await card(kr01(xs)))
    const [kept, left] = named(words)
    expect(kept, words).not.toBe(left)
    expect(words).toContain('Keep the copy in row 1; leave the copy in row 2 out as superseded')
  })

  it('names two copies 0.4 mm apart in metres (both x 7.000 m) by their row', async () => {
    const xs: [number, number] = [7000, 7000.4]
    expect(xOf(xs[0], 'metric'), 'the two x read alike').toBe(xOf(xs[1], 'metric'))
    const words = keep(await card(kr01(xs, 'metric')))
    const [kept, left] = named(words)
    expect(kept, words).not.toBe(left)
    expect(words).toContain('Keep the copy in row 1; leave the copy in row 2 out as superseded')
    expect(words).not.toContain('at x ')
  })

  it('says the copies are alike when the table shows the same x for both', async () => {
    const section = await card(kr01([7000, 7000.5]))
    const cells = [...within(section).getByRole('table').querySelectorAll('tbody tr')].map((r) => clean(r.querySelectorAll('td')[2]!.textContent))
    expect(cells[0]).toBe(cells[1])
    expect(clean(section.textContent)).toContain('The copies are alike in every field the table shows.')
  })

  it('still tells copies apart by x when their x read differently (7000 and 7100 mm)', async () => {
    const xs: [number, number] = [7000, 7100]
    expect(xOf(xs[0], 'imperial')).not.toBe(xOf(xs[1], 'imperial'))
    const section = await card(kr01(xs))
    const words = keep(section)
    const [kept, left] = named(words)
    expect(kept, words).not.toBe(left)
    expect(words).toContain(`the copy laid out in the drawing at x ${xOf(xs[0], 'imperial')}`)
    expect(words).toContain(`the copy laid out in the drawing at x ${xOf(xs[1], 'imperial')}`)
    expect(clean(section.textContent)).not.toContain('alike in every field')
  })
})
