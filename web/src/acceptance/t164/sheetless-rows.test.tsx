/*
 * Ticket 164's acceptance tests (M0 fix W3, gh issue #164): the Step 1 list's rows for Questions that
 * hold no sheet. Acceptance to pin, verbatim from the issue: "Each row's words come from its own
 * Question code." and "Selecting the row selects its Question in the inspector."
 *
 * The Questions are the ones 21c raises with no sheet (on main, `vextrus/takeoff/services/read_propose/
 * proposals.py`): the numbering-gap Check `engine.register_check.gap` (subject none, params after,
 * before, missing, discipline; no `number`), the drawing-list Check `engine.register_check.not_found`
 * (subject none, param `number`), and the held file's `file_misread` (its subject a file, not a sheet).
 * Their shape is 21c's `Step1QuestionOut` (with `proposals`, `withdrawn_by` and `blocking`).
 *
 * The API is ticket 22's in-memory fake (`../t22/step1.fixture.ts`, KR-01 after reading) with A-04
 * left out of the sheets, so Architectural's numbering skips from A-03 to A-05, and the gap Question
 * added. Words are m0-screens §6.2 (a held file's row "File · NT-ARCH-Details-R1.dwg Held: the two
 * readers disagree · Question Q1"; a drawing-list entry's row "A-28 · …"), §6.6 ("Selection, a file or
 * drawing-list row focused: its Question card"), §6.7 (the card, "Question Q3"), and the codes' English
 * in web/src/messages/engine/register_check/en.po.
 *
 * Chosen by the acceptance writer (the report lists them): a gap row's words name its two numbers
 * (the code's `after` and `before`), whatever else they say; the card is found as the region named
 * "Question Q<n>" (22's card).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type QuestionOut } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'

const GAP = { code: 'engine.register_check.gap', params: { after: 'A-03', before: 'A-05', missing: 1, discipline: 'architectural' } }
const GAP2 = { code: 'engine.register_check.gap', params: { after: 'A-01', before: 'A-03', missing: 1, discipline: 'architectural' } }
const HELD_WORDS = 'the two readers disagree'

type Shape = QuestionOut & { proposals: string[]; withdrawn_by: string | null; blocking: boolean }

/** 21c's numbering-gap Check Question: no subject, no sheet held. */
function gapQuestion(n: number, gap: typeof GAP): QuestionOut {
  return {
    id: `c1640000-0000-4000-8000-00000000000${n}`,
    kind: 'check',
    status: 'open',
    code: gap.code,
    params: gap.params,
    // 21c raises every Check Question with CHECK_OPTIONS, none picked.
    options: ['not_sent_yet', 'not_in_set', 'file_not_added', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline: 'architectural',
    subject_id: null,
    check_code: 'register',
    answer: null,
    answered_at: null,
  }
}

/**
 * KR-01 after reading, as 21c's API answers it, with A-04 missing and its numbering-gap Question; with
 * `twoGaps`, A-02 missing too and a second gap Question (the walk's set had 17 on one file).
 */
function setUp(twoGaps = false): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  step1.proposals = step1.proposals.filter((p) => p.number !== 'A-04' && (!twoGaps || p.number !== 'A-02'))
  const gaps = twoGaps ? [gapQuestion(1, GAP), gapQuestion(2, GAP2)] : [gapQuestion(1, GAP)]
  step1.questions = [...step1.questions, ...gaps].map((q): Shape => {
    const held = q.subject_id ? step1.proposals.filter((p) => p.sheet_id === q.subject_id).map((p) => p.id) : []
    return { ...q, proposals: held, withdrawn_by: null, blocking: true }
  })
  return { api, step1 }
}

async function open(api: FakeApi, found = 23) {
  const app = await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain(`Confirmed 0 / ${found}`))
  return app
}

/** Every list row, innermost (a row holding no other row). */
function rows(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>('[role="row"]')]
  return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
}

/** A row's cells' words, each on its own (the Number cell is one of them, m0-screens §6.2). */
const cells = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')].map((c) => clean(c.textContent))
const hasCell = (row: HTMLElement, words: string) => cells(row).includes(words)

/** The one list row satisfying `match` (on its words, and on the row for its cells). */
function rowWhere(match: (text: string, row: HTMLElement) => boolean, what: string): HTMLElement {
  const found = rows().filter((r) => match(clean(r.textContent), r))
  expect(found, `one row for ${what}`).toHaveLength(1)
  return found[0]!
}

const isGapRow = (text: string) => text.includes('A-03') && text.includes('A-05')
const gapRow = () => rowWhere(isGapRow, 'the numbering gap A-03 to A-05')
const isGap2Row = (text: string) => text.includes('A-01') && text.includes('A-03') && !text.includes('A-05')
const gap2Row = () => rowWhere(isGap2Row, 'the numbering gap A-01 to A-03')
const notFoundRow = () => rowWhere((_, r) => hasCell(r, 'S-13'), 'S-13, on the drawing list and in no file')

/** The Question cards shown (22's card: a region named "Question Q<n>", m0-screens §6.7). */
function cards(): HTMLElement[] {
  return screen.queryAllByRole('region', { name: (name) => /^Question Q\d+$/.test(clean(name)) })
}

/** The card whose words satisfy `match`, once it is shown. */
async function cardShown(match: (text: string) => boolean, what: string): Promise<HTMLElement> {
  let card: HTMLElement | undefined
  await waitFor(() => {
    card = cards().find((c) => match(clean(c.textContent)))
    expect(card, `the card for ${what}`).toBeDefined()
  })
  return card!
}

/** From a sheet row, ↑ until the browser's focus is on the row `target` names (at most once per row). */
async function arrowUpTo(target: () => HTMLElement) {
  await waitFor(() => rowWhere((_, r) => hasCell(r, 'S-01'), 'S-01'))
  await userEvent.click(within(rowWhere((_, r) => hasCell(r, 'S-01'), 'S-01')).getByText('S-01'))
  for (let i = 0; i < rows().length && document.activeElement !== target(); i++) await userEvent.keyboard('{ArrowUp}')
  expect(document.activeElement, 'the keys reach the row').toBe(target())
}

describe('a sheetless Question row is worded by its own code (m0-screens §6.2)', () => {
  it('words the numbering-gap Question’s row by its gap, never as a held file', async () => {
    const { api } = setUp()
    await open(api)
    await waitFor(() => gapRow())
    const text = clean(gapRow().textContent)
    expect(text).not.toContain(HELD_WORDS)
    expect(text).not.toMatch(/\bheld\b/i)
    expect(hasCell(gapRow(), 'File'), 'its Number cell is not a file’s').toBe(false)
    expect(text, 'not the words for a Question Vextrus cannot word').not.toContain('A Question about the sheets')
  })

  it('shows one held-file row, the held file’s, beside the gap Question’s row', async () => {
    const { api } = setUp()
    await open(api)
    await waitFor(() => gapRow())
    expect(rows().filter((r) => clean(r.textContent).includes(HELD_WORDS)), 'one held-file row: the held file’s').toHaveLength(1)
  })

  it('words the drawing-list Question’s row by its number, never as a held file', async () => {
    const { api } = setUp()
    await open(api)
    await waitFor(() => notFoundRow())
    const text = clean(notFoundRow().textContent)
    expect(text).not.toContain(HELD_WORDS)
    expect(text).not.toMatch(/\bheld\b/i)
    expect(hasCell(notFoundRow(), 'File')).toBe(false)
  })

  it('still words the held file’s row "Held: the two readers disagree"', async () => {
    const { api } = setUp()
    await open(api)
    await waitFor(() => rowWhere((t) => t.includes(HELD_WORDS), 'the held file'))
    const row = rowWhere((t) => t.includes(HELD_WORDS), 'the held file')
    expect(hasCell(row, 'File'), 'its Number cell reads "File"').toBe(true)
    expect(isGapRow(clean(row.textContent))).toBe(false)
  })
})

describe('selecting a sheetless Question row selects its Question in the inspector (m0-screens §6.6)', () => {
  it('shows the numbering-gap Question’s card when its row is clicked', async () => {
    const { api } = setUp()
    await open(api)
    await waitFor(() => gapRow())
    expect(cards().filter((c) => isGapRow(clean(c.textContent))), 'no gap card before the row is selected').toHaveLength(0)
    await userEvent.click(gapRow())
    const card = await cardShown(isGapRow, 'the numbering gap')
    expect(clean(card.textContent)).toContain('No drawing list, and the numbering skips from A-03 to A-05')
    expect(clean(card.textContent)).not.toContain('may be misread')
  })

  it('shows the numbering-gap Question’s card when the keys reach its row', async () => {
    const { api } = setUp()
    await open(api)
    await arrowUpTo(gapRow)
    const card = await cardShown(isGapRow, 'the numbering gap')
    expect(clean(card.textContent)).toContain('No drawing list, and the numbering skips from A-03 to A-05')
  })

  it('shows the drawing-list Question’s card when its row is clicked', async () => {
    const { api } = setUp()
    await open(api)
    await waitFor(() => notFoundRow())
    await userEvent.click(notFoundRow())
    const card = await cardShown((t) => t.includes('S-13 is on the drawing list but in no file'), 'S-13')
    expect(clean(card.textContent)).not.toContain('may be misread')
  })

  it('shows the drawing-list Question’s card when the keys reach its row', async () => {
    const { api } = setUp()
    await open(api)
    await arrowUpTo(notFoundRow)
    await cardShown((t) => t.includes('S-13 is on the drawing list but in no file'), 'S-13')
  })

  it('moves the card from the gap Question to the drawing-list Question as the selection moves', async () => {
    const { api } = setUp()
    await open(api)
    await waitFor(() => gapRow())
    await userEvent.click(gapRow())
    await cardShown(isGapRow, 'the numbering gap')
    await userEvent.click(notFoundRow())
    await cardShown((t) => t.includes('S-13 is on the drawing list but in no file'), 'S-13')
    expect(cards().filter((c) => isGapRow(clean(c.textContent))), 'the gap card leaves with its selection').toHaveLength(0)
  })

  it('selects each of two numbering-gap Questions by its own row', async () => {
    const { api } = setUp(true)
    await open(api, 22)
    await waitFor(() => gap2Row())
    await userEvent.click(gap2Row())
    const second = await cardShown(isGap2Row, 'the numbering gap A-01 to A-03')
    expect(clean(second.textContent)).toContain('No drawing list, and the numbering skips from A-01 to A-03')
    expect(cards().filter((c) => isGapRow(clean(c.textContent))), 'not the other gap’s card').toHaveLength(0)
    await userEvent.click(gapRow())
    await cardShown(isGapRow, 'the numbering gap A-03 to A-05')
    expect(cards().filter((c) => isGap2Row(clean(c.textContent))), 'the first gap’s card leaves').toHaveLength(0)
  })
})
