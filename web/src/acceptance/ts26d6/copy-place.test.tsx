/*
 * S26-D6, finding 2 of #774's design-gate re-walk (session 26, 13 Oct 2026): the inspector's "Proposal: where
 * each was read" File row said "KR-STR-R0.dwg / laid out in the drawing" with no x, while the Question card above
 * said "…, x 22′-11⅝″". A copy's place is worded one way wherever it is worded: m0-screens 6.7's copies table
 * ("NT-STR-R1.dwg, laid out in the drawing, x 2,460′"), its words table ("laid out in the drawing, x 2,460′" in
 * "where" and the copies table), 6.6's File row ("NT-STR-R1.dwg" / "laid out in the drawing") and 6.2's File
 * cell ("tooltip adds where in it"). The x is a coordinate in the project's Display Units (1.2).
 *
 * The two copies of S-07 (KR-01, §7) are laid out in KR-STR-R0.dwg, each with its frame's x (the API's `x_mm`,
 * which t22's fixture type leaves out). The expected x is computed from the formatter the screen uses, so a
 * change of notation does not break the test; what is pinned is that every place says the same.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
/** Where each S-07 copy's frame sits: rev B at 7000 mm (22′-11⅝″, the gate's), rev A at 749808 mm (2460′-0″, 6.7's). */
const X_MM = { B: 7000, A: 749808 } as const
/** The x as the screen words it in Imperial (KR-01's Display Units). */
const xOf = (mm: number) => coordinateText(lengthFromMm(mm), 'feet-inches').screen

type Placed = ProposalOut & { layout: string | null; x_mm?: number | null }

/** KR-01 with S-07's two copies laid out in KR-STR-R0.dwg at X_MM; `settled`: Structural settled (S-07 B confirmed, A excluded). */
function kr01(settled: boolean): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  for (const p of step1.proposals) if (!('layout' in p)) Object.assign(p as Placed, { layout: null })
  const copies = step1.proposals.filter((p) => p.number === 'S-07')
  expect(copies.map((p) => p.revision_mark).sort()).toEqual(['A', 'B'])
  for (const p of copies) Object.assign(p as Placed, { file_name: FILE, layout: null, x_mm: X_MM[p.revision_mark as 'A' | 'B'] })
  if (settled) step1.settleAllBut('electrical')
  return api
}

async function open(api: FakeApi) {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed \d+ \/ 24/))
}

/** The innermost row holding `text` and `also`. */
function rowOf(text: string, also = ''): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(text) && clean(r.textContent).includes(also))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text} ${also}`).toHaveLength(1)
  return inner[0]!
}

/** The inspector's "File" fact, in "Proposal: where each was read". */
async function inspectorFile(): Promise<HTMLElement> {
  const inspector = screen.getByRole('complementary')
  await waitFor(() => expect(clean(inspector.textContent)).toContain('Proposal: where each was read'))
  const label = [...inspector.querySelectorAll('dt')].find((dt) => clean(dt.textContent) === 'File')
  expect(label, 'the File row').toBeDefined()
  return label!.nextElementSibling as HTMLElement
}

describe('a copy laid out in the drawing is placed by its x wherever its place is worded (#774 gate re-walk, finding 2)', () => {
  it('says "laid out in the drawing, x 22′-11⅝″" in the inspector’s File row of the confirmed S-07 rev B (the gate’s case)', async () => {
    await open(kr01(true))
    const row = rowOf('S-07', 'B, 20 Aug 2026')
    await userEvent.click(within(row).getAllByText('S-07')[0]!)
    const file = await inspectorFile()
    expect(clean(file.textContent)).toContain(FILE)
    expect(clean(file.textContent)).toContain(`laid out in the drawing, x ${xOf(X_MM.B)}`)
    expect(file.querySelector('[data-notation="coordinate"]'), 'x is isolated as a figure').not.toBeNull()
  })

  it('says "laid out in the drawing, x 2460′-0″" in the inspector’s File row of the excluded S-07 rev A', async () => {
    await open(kr01(true))
    const row = rowOf('S-07', 'Excluded')
    await userEvent.click(within(row).getAllByText('S-07')[0]!)
    const file = await inspectorFile()
    expect(clean(file.textContent)).toContain(`laid out in the drawing, x ${xOf(X_MM.A)}`)
  })

  it('words the inspector’s File row as the Question card’s copies table words the same copy', async () => {
    await open(kr01(false))
    const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes('S-07'))
    const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
    await userEvent.click(within(inner[0]!).getAllByText('S-07')[0]!)
    await waitFor(() => expect(bodyText()).toContain('Two sheets are numbered S-07'))
    const card = [...document.querySelectorAll<HTMLElement>('section[data-question]')].find((s) => clean(s.textContent).includes('Two sheets are numbered S-07'))!
    const cells = [...within(card).getByRole('table').querySelectorAll('tbody tr')].map((r) => clean(r.querySelectorAll('td')[2]!.textContent))
    const file = clean((await inspectorFile()).textContent)
    const place = /laid out in the drawing, x \S+/.exec(file)
    expect(place, `the File row "${file}" gives the copy's x`).not.toBeNull()
    // The same copy, the same words: the File row's place is one of the table's two.
    expect(cells.some((c) => c === `${FILE}, ${place![0]}`), `${file} | ${cells.join(' | ')}`).toBe(true)
  })

  it('adds "laid out in the drawing, x 22′-11⅝″" to the File cell’s tooltip in the sheet list (6.2)', async () => {
    await open(kr01(true))
    const row = rowOf('S-07', 'B, 20 Aug 2026')
    const cell = [...row.querySelectorAll<HTMLElement>('[tabindex="-1"]')].find((el) => clean(el.textContent) === FILE)
    expect(cell, 'the File cell').toBeDefined()
    await userEvent.hover(cell!)
    const tip = await screen.findByRole('tooltip')
    expect(clean(tip.textContent)).toBe(`${FILE}, laid out in the drawing, x ${xOf(X_MM.B)}`)
  })
})
