/*
 * Ticket S24-A3's acceptance tests, Step 1's layout (G1 walk 51507b85: #663, #670, #672).
 *
 * #663 (layout_broken, takeoff.step1.questions): a numbering-gap Question over 17 gaps put its options
 * below the evidence, off screen at 1440×900. m0-screens §6.7: the card is what answering does, the
 * title, the body, the Trace line, "the options as radio rows with their number keys"; §4.1: the
 * inspector is 320 px, docked; §8 is walked at 1440×900 and 1280×800. Pinned: the card's first option
 * is on screen in the Questions tab without scrolling, at both sizes.
 *
 * #670 (layout_broken, takeoff.step1): the files band wrapped onto three or four lines with seven files.
 * §6.2: "the files band: one chip per file … It wraps to a second line at 1280 and 1440." Pinned: with
 * seven files the band's chips sit on at most two lines, at both sizes. How the rest is reached (a
 * menu, a count) is the builder's: m0-screens gives no words for it, so none are pinned.
 *
 * #672 (misleading_display, takeoff.step1.questions): two copies of one number could not be told apart.
 * §6.7: "for a duplicate, a table of the copies"; "A table: Copy · Date · File". Pinned: the table's
 * three columns and one row per copy, each with its own mark. The copy's place in the drawing ("x
 * 2,460′") has no field in 19a's `Step1ProposalOut` (no contract names one), so it is not pinned.
 *
 * Run at /p/KR-01/takeoff/1 through t22's in-memory API (../t22/step1.fixture.ts) and 14's files list
 * (../t20b/drawings.fixture.ts). Every number, title and file name here is invented.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeDrawingSet, file, msg } from '../t20b/drawings.fixture'
import { FakeStep1, kr01Proposals, type ProposalOut, type QuestionOut } from '../t22/step1.fixture'

const SIZES = [
  [1440, 900],
  [1280, 800],
] as const

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

async function open(api: FakeApi, count: RegExp) {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toMatch(count))
}

async function questionsTab(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('tab', { name: /^Questions/ }))
  return screen.getByRole('tabpanel', { name: /^Questions/ })
}

// #663: a Discipline's numbering-gap Question over 17 gaps -------------------------------------------

const pad = (n: number) => `S-${String(n).padStart(2, '0')}`
/** S-01 to S-57 with every third number from S-03 to S-51 missing: 40 sheets, 17 gaps of one number. */
const MISSING = Array.from({ length: 17 }, (_, i) => 3 * (i + 1))

function seventeenGaps(): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const template = kr01Proposals()[1]!
  const sheets: ProposalOut[] = []
  for (let n = 1; n <= 57; n++) {
    if (MISSING.includes(n)) continue
    sheets.push({ ...template, id: `a24a3000-0000-4000-8000-${String(n).padStart(12, '0')}`, sheet_id: `b24a3000-0000-4000-8000-${String(n).padStart(12, '0')}`, number: pad(n), title: `ZQ PLAN ${n}`, agrees: false })
  }
  const sides = new Set(MISSING.flatMap((m) => [pad(m - 1), pad(m + 1)]))
  const gaps: QuestionOut & { proposals: string[] } = {
    id: 'c24a3000-0000-4000-8000-000000000001',
    kind: 'check',
    status: 'open',
    code: 'engine.register_check.gaps',
    params: { discipline: 'structural', count: 17, missing: 17, gaps: MISSING.map((m) => ({ after: pad(m - 1), before: pad(m + 1), missing: 1 })) },
    options: ['not_sent_yet', 'not_in_set', 'file_not_added', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline: 'structural',
    subject_id: null,
    check_code: 'register',
    answer: null,
    answered_at: null,
    proposals: sheets.filter((s) => s.number !== null && sides.has(s.number)).map((s) => s.id),
  }
  Object.assign(step1, {
    proposals: sheets,
    questions: [gaps],
    lists: {},
    notReceived: [],
    coverage: { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {} },
  })
  return api
}

describe('a Question’s options are on screen (§6.7; #663)', () => {
  for (const [width, height] of SIZES) {
    it(`shows the first answer of a 17-gap Question without scrolling at ${width}×${height}`, async () => {
      await page.viewport(width, height)
      await open(seventeenGaps(), /Confirmed 0 \/ 40/)
      const panel = await questionsTab()
      const answers = await within(panel).findByRole('radiogroup', { name: 'Answers' })
      const first = within(answers).getAllByRole('radio')[0]!
      const scroller = [panel, ...ancestors(panel)].find((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible') ?? panel
      expect(scroller.scrollTop, 'nothing scrolled yet').toBe(0)
      const box = first.getBoundingClientRect()
      const view = scroller.getBoundingClientRect()
      expect(box.top, 'the first answer starts inside the inspector').toBeGreaterThanOrEqual(view.top)
      expect(box.bottom, 'the first answer is on screen without scrolling').toBeLessThanOrEqual(Math.min(view.bottom, window.innerHeight))
    })
  }
})

function ancestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (let p = el.parentElement; p; p = p.parentElement) out.push(p)
  return out
}

// #670: seven files in the files band ----------------------------------------------------------------

const SEVEN = ['ZQ-STRUCTURAL-WORKING-DRAWINGS-R3.dwg', 'ZQ-STRUCTURAL-WORKING-DRAWINGS-R3.pdf', 'ZQ-ARCHITECTURAL-WORKING-DRAWINGS-R2.dwg', 'ZQ-ARCHITECTURAL-PRESENTATION-R1.dwg', 'ZQ-ELECTRICAL-LAYOUTS-R1.dwg', 'ZQ-PLUMBING-AND-SANITARY-R1.dwg', 'ZQ-FIRE-FIGHTING-R0.dwg']

function sevenFiles(): FakeApi {
  const api = new FakeApi()
  const set = new FakeDrawingSet(api, 'KR-01')
  new FakeStep1(api)
  set.files = SEVEN.map((name) =>
    name.endsWith('.pdf')
      ? file({ name, state: 'read', status: msg('drawings.files.plot_matched', { matched: 37, pages: 38 }) })
      : file({ name, state: 'read', status: msg('drawings.files.read', { sheets: 40 }), sheets_found: 40 }),
  )
  return api
}

describe('the files band (§6.2; #670)', () => {
  for (const [width, height] of SIZES) {
    it(`keeps seven files’ chips to at most two lines at ${width}×${height}`, async () => {
      await page.viewport(width, height)
      await open(sevenFiles(), /Confirmed 0 \/ 24/)
      const band = await screen.findByRole('list', { name: /files/ })
      await waitFor(() => expect(within(band).getAllByRole('button').length).toBeGreaterThan(0))
      const shown = within(band)
        .getAllByRole('button')
        .filter((b) => b.getBoundingClientRect().height > 0)
      const lines = new Set(shown.map((b) => Math.round(b.getBoundingClientRect().top)))
      expect(lines.size, `the chips' lines (${[...lines].join(', ')})`).toBeLessThanOrEqual(2)
    })
  }
})

// #672: two copies of one number -----------------------------------------------------------------------

describe('the copies of one number, told apart (§6.7; #672)', () => {
  it('shows "Two sheets, one number" with a table of the copies: Copy, Date, File, a row each', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    await open(api, /Confirmed 0 \/ 24/)
    const panel = await questionsTab()
    const table = await within(panel).findByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => clean(h.textContent))).toEqual(['Copy', 'Date', 'File'])
    const rows = within(table)
      .getAllByRole('row')
      .filter((r) => within(r).queryAllByRole('columnheader').length === 0)
      .map((r) => within(r).getAllByRole('cell').map((c) => clean(c.textContent)))
    expect(rows).toHaveLength(2)
    const [b, a] = rows as [string[], string[]]
    expect(b[0], 'the first copy’s mark').toMatch(/\bB\b/)
    expect(b[1], 'its date').toBe('20 Aug 2026')
    expect(b[2], 'its file').toContain('KR-STR-R0.dwg')
    expect(a[0], 'the second copy’s mark').toMatch(/\bA\b/)
    expect(a[2], 'its file').toContain('KR-STR-R0.dwg')
    expect(new Set(rows.map((r) => r.join(' · '))).size, 'the two rows differ').toBe(2)
  })
})
