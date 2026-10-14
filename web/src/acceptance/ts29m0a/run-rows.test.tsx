/*
 * S29-M0a's acceptance (G1 walk #1, f-1; #322): a Step 1 row of a continuation shows only what it holds.
 * Mounted through the app on 22's fake (`../t22/step1.fixture.ts`) with S15-Q3's invented Sheets
 * (`../ts15q3/groups.fixture.ts`). Every number, title and mark here is invented for its shape only.
 *
 * The promises, in the authority's words:
 * - m0-screens §6.2, "Continuation sheets": a continuation is "one continuation and one row: Number
 *   "S-09–S-11", Title "Column schedule, 3 sheets""; titles equal but for a member-mark range are titled
 *   with "the ranges joined first to last".
 * - The ticket (f-1): a row shows a title as drawn on its own sheets, or a range built from the sheets it
 *   holds; a number range never spans sheets the row does not hold. So a row holding part of a run (its
 *   other sheets decided apart, or held by a Question) never shows the whole run's `continuation_title`.
 *
 * The input class (each a test): a run wholly in one state; a run split across two states (part at the
 * start, part at the end) or three; a middle part alone in a state; a row holding one sheet of a run;
 * members drawn with one title (the run's); a run whose middle number a Question holds and whose next
 * number does not exist; a run broken by a copy decided apart from its twin; two adjacent runs in one state.
 *
 * Not pinned: whether a part shows one held sheet's drawn title or the range joined over the sheets it
 * holds (either is allowed); how a run broken by a Question's sheets is laid out (one row or two), so
 * long as no Number range spans the Question's number; the State column's words.
 * The Number cell is the row's second grid cell, the Title its third (§6.2's columns: mark, Number, Title).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { clean, sheet, stage, type Proposal, type Question } from '../ts15q3/groups.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const PATH = '/p/KR-01/takeoff/1'
/** Every failure of the promise says this, so the stated reason names the promise, not a typo. */
const CLAIMS = 'a row claims sheets it does not hold'

async function show(proposals: readonly Proposal[], questions: readonly Question[] = []) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  stage(step1, proposals, questions)
  await mountApp(PATH, { as: PEOPLE.qs, api })
  const last = proposals.at(-1)!.number!
  await waitFor(() => expect(rows().some((r) => numbersIn(numberCell(r)).includes(last))).toBe(true))
}

/** Every list row, innermost (a row holding no other row). */
function rows(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>('[role="row"]')]
  return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
}

const cells = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')].map((c) => clean(c.textContent))
const numberCell = (row: HTMLElement) => cells(row)[1] ?? ''
const titleCell = (row: HTMLElement) => cells(row)[2] ?? ''
const numbersIn = (text: string): string[] => text.match(/D-\d+/g) ?? []
const running = (n: string) => Number(n.slice(2))

/** The one row whose Number cell starts with `first`. */
function rowOf(first: string): HTMLElement {
  const found = rows().filter((r) => numbersIn(numberCell(r))[0] === first)
  expect(found, `one row starts at ${first}`).toHaveLength(1)
  return found[0]!
}

// A run of six Sheets, each drawn with its own member-mark range; the server titles the run with the
// ranges joined first to last (T-W334's `continuation_title`).
const RUN_TITLE = 'RETAINING WALL RW1-RW12 SECTIONS'
const NUMBERS = ['D-61', 'D-62', 'D-63', 'D-64', 'D-65', 'D-66'] as const
const own = (i: number) => `RETAINING WALL RW${2 * i + 1}-RW${2 * i + 2} SECTIONS`
/** The range joined over the run's sheets i..j (the first's low mark to the last's high mark). */
const joined = (i: number, j: number) => `RETAINING WALL RW${2 * i + 1}-RW${2 * j + 2} SECTIONS`

type State = Pick<Proposal, 'decision' | 'excluded_reason' | 'decided_at' | 'decided_by'>
const UNDECIDED: State = { decision: null, excluded_reason: null, decided_at: null, decided_by: null }
const CONFIRMED: State = { decision: 'confirmed', excluded_reason: null, decided_at: '2026-09-30T06:00:00Z', decided_by: 'qs' }
const SUPERSEDED: State = { decision: 'excluded', excluded_reason: 'superseded', decided_at: '2026-09-30T06:00:00Z', decided_by: 'qs' }

/** The run, each Sheet in the state given (by its place in the run). */
function run(states: readonly State[]): Proposal[] {
  return NUMBERS.map((n, i) => sheet(n, own(i), { continuation: 'r61', continuation_title: RUN_TITLE, ...states[i]! }))
}

/**
 * A row holding the run's sheets `from`..`to` (places in the run): numbered by its first and last, titled
 * by a sheet it holds as drawn or by the range joined over them, and never by the whole run's title.
 */
function expectPart(from: number, to: number) {
  const row = rowOf(NUMBERS[from]!)
  const count = to - from + 1
  const number = count > 1 ? `${NUMBERS[from]}–${NUMBERS[to]}` : NUMBERS[from]!
  expect(numberCell(row).replace(/\s/g, ''), `the row of ${number}`).toBe(number)
  const allowed = [joined(from, to), ...Array.from({ length: count }, (_, k) => own(from + k))]
  const words = allowed.map((t) => (count > 1 ? `${t}, ${count} sheets` : t))
  const title = titleCell(row)
  expect(words.includes(title), `${CLAIMS}: ${number} is titled "${title}", not one of ${JSON.stringify(words)}`).toBe(true)
}

describe('a run wholly in one state keeps the run’s title (m0-screens §6.2)', () => {
  it('shows the six undecided Sheets as one row D-61–D-66, titled by the run, "6 sheets"', async () => {
    await show(run(NUMBERS.map(() => UNDECIDED)))
    const row = rowOf('D-61')
    expect(numberCell(row).replace(/\s/g, '')).toBe('D-61–D-66')
    expect(titleCell(row)).toBe(`${RUN_TITLE}, 6 sheets`)
  })
})

describe('a row holding part of a run shows only what it holds (f-1)', () => {
  it('titles a confirmed part at the start, and the undecided rest, by their own sheets', async () => {
    await show(run([CONFIRMED, CONFIRMED, UNDECIDED, UNDECIDED, UNDECIDED, UNDECIDED]))
    expectPart(0, 1)
    expectPart(2, 5)
  })

  it('titles a confirmed part at the end, and the undecided start, by their own sheets', async () => {
    await show(run([UNDECIDED, UNDECIDED, UNDECIDED, UNDECIDED, CONFIRMED, CONFIRMED]))
    expectPart(0, 3)
    expectPart(4, 5)
  })

  it('titles each of three parts (confirmed, left out as superseded, undecided) by its own sheets', async () => {
    await show(run([CONFIRMED, CONFIRMED, SUPERSEDED, SUPERSEDED, UNDECIDED, UNDECIDED]))
    expectPart(0, 1)
    expectPart(2, 3)
    expectPart(4, 5)
  })

  it('titles a confirmed middle part, and each undecided end, by their own sheets', async () => {
    await show(run([UNDECIDED, CONFIRMED, CONFIRMED, CONFIRMED, UNDECIDED, UNDECIDED]))
    expectPart(0, 0)
    expectPart(1, 3)
    expectPart(4, 5)
  })

  it('titles a row holding one sheet of a run as that sheet is drawn, and the parts around it by theirs', async () => {
    await show(run([UNDECIDED, UNDECIDED, CONFIRMED, UNDECIDED, UNDECIDED, UNDECIDED]))
    expectPart(0, 1)
    expectPart(2, 2)
    expectPart(3, 5)
  })
})

describe('a run drawn with one title keeps it on each part', () => {
  it('titles an undecided part of a run of one drawn title with that title, "2 sheets"', async () => {
    const title = 'PERGOLA SLAT DETAILS'
    const sheets = ['D-71', 'D-72', 'D-73'].map((n, i) => sheet(n, title, { continuation: 'r71', continuation_title: title, ...(i === 0 ? CONFIRMED : UNDECIDED) }))
    await show(sheets)
    expect(titleCell(rowOf('D-71'))).toBe(title)
    const rest = rowOf('D-72')
    expect(numberCell(rest).replace(/\s/g, '')).toBe('D-72–D-73')
    expect(titleCell(rest)).toBe(`${title}, 2 sheets`)
  })
})

describe('a number range never spans sheets the row does not hold (f-1)', () => {
  // D-81, two copies of D-82 (a Question holds them) and D-84 (no D-83 exists), all one run.
  const BROKEN_TITLE = 'CANOPY BEAM CB1-CB9 DETAILS'
  function broken(): { sheets: Proposal[]; question: Question } {
    const of = { continuation: 'r81', continuation_title: BROKEN_TITLE }
    const sheets = [
      sheet('D-81', 'CANOPY BEAM CB1-CB3 DETAILS', of),
      sheet('D-82', 'CANOPY BEAM CB4-CB6 DETAILS', { ...of, revision_mark: 'R1' }),
      sheet('D-82', 'CANOPY BEAM CB4-CB5 DETAILS', of),
      sheet('D-84', 'CANOPY BEAM CB7-CB9 DETAILS', of),
    ]
    const copies = [sheets[1]!, sheets[2]!]
    const question: Question = {
      id: 'c29a0000-0000-4000-8000-000000000001',
      kind: 'conflict',
      status: 'open',
      code: 'engine.conflicts.same_number',
      params: { number: 'D-82' },
      options: ['keep_first', 'keep_second', 'keep_both', 'keep_open'].map((key) => ({ key, picked: false })),
      discipline: 'architectural',
      subject_id: copies[0]!.sheet_id,
      check_code: null,
      answer: null,
      answered_at: null,
      proposals: copies.map((p) => p.id),
      withdrawn_by: null,
      blocking: true,
    }
    return { sheets, question }
  }

  it('numbers no row with a range over D-82, which a Question holds', async () => {
    const { sheets, question } = broken()
    await show(sheets, [question])
    const listed = rows().map((r) => numbersIn(numberCell(r)))
    for (const [k, numbers] of listed.entries()) {
      if (numbers.length !== 2 || !/[–-]\s*D-\d+$/.test(numberCell(rows()[k]!))) continue
      const [low, high] = numbers.map(running) as [number, number]
      // Strictly inside: a copy of a range's own last number, decided apart, is the next row, not a sheet skipped over.
      const inside = listed.flatMap((other, m) => (m === k ? [] : other)).filter((n) => running(n) > low && running(n) < high)
      expect(inside, `${CLAIMS}: ${numbers.join('–')} spans ${inside.join(', ')}`).toEqual([])
    }
  })

  it('titles neither D-81 nor D-84 with the run’s title, which names the members D-82 draws', async () => {
    const { sheets, question } = broken()
    await show(sheets, [question])
    const outside = rows().filter((r) => numbersIn(numberCell(r)).some((n) => n === 'D-81' || n === 'D-84'))
    expect(outside.length).toBeGreaterThan(0)
    for (const row of outside) expect(titleCell(row).includes(BROKEN_TITLE), `${CLAIMS}: ${numberCell(row)} is titled "${titleCell(row)}"`).toBe(false)
  })
})

describe('a copy decided apart from its twin breaks the run (f-1, as the walk saw it)', () => {
  // One run: D-81, D-82 R1 confirmed; D-82 R0 left out as superseded; D-84 undecided (no D-83 exists).
  it('titles the confirmed D-81–D-82 by the sheets it holds, and D-82 R0 and D-84 each as drawn', async () => {
    const title = 'CANOPY BEAM CB1-CB9 DETAILS'
    const of = { continuation: 'r85', continuation_title: title }
    const sheets = [
      sheet('D-81', 'CANOPY BEAM CB1-CB3 DETAILS', { ...of, ...CONFIRMED }),
      sheet('D-82', 'CANOPY BEAM CB4-CB6 DETAILS', { ...of, ...CONFIRMED, revision_mark: 'R1' }),
      sheet('D-82', 'CANOPY BEAM CB4-CB5 DETAILS', { ...of, ...SUPERSEDED }),
      sheet('D-84', 'CANOPY BEAM CB7-CB9 DETAILS', of),
    ]
    await show(sheets)
    const confirmed = rowOf('D-81')
    expect(numberCell(confirmed).replace(/\s/g, ''), 'the confirmed row').toBe('D-81–D-82')
    const words = ['CANOPY BEAM CB1-CB6 DETAILS', 'CANOPY BEAM CB1-CB3 DETAILS', 'CANOPY BEAM CB4-CB6 DETAILS'].map((t) => `${t}, 2 sheets`)
    const got = titleCell(confirmed)
    expect(words.includes(got), `${CLAIMS}: D-81–D-82 is titled "${got}", not one of ${JSON.stringify(words)}`).toBe(true)
    const left = rows().filter((r) => numberCell(r) === 'D-82')
    expect(left, 'one row holds D-82 R0 alone').toHaveLength(1)
    expect(titleCell(left[0]!), `${CLAIMS}: D-82 R0`).toBe('CANOPY BEAM CB4-CB5 DETAILS')
    expect(titleCell(rowOf('D-84')), `${CLAIMS}: D-84`).toBe('CANOPY BEAM CB7-CB9 DETAILS')
  })
})

describe('two adjacent runs in one state stay two rows, each with its own run’s title', () => {
  it('shows D-91–D-92 and D-93–D-94, both confirmed, each titled by its own run', async () => {
    const a = 'SUNSHADE SS1-SS8 DETAILS'
    const b = 'PLINTH BEAM PB1-PB8 DETAILS'
    const sheets = [
      sheet('D-91', 'SUNSHADE SS1-SS4 DETAILS', { continuation: 'r91', continuation_title: a, ...CONFIRMED }),
      sheet('D-92', 'SUNSHADE SS5-SS8 DETAILS', { continuation: 'r91', continuation_title: a, ...CONFIRMED }),
      sheet('D-93', 'PLINTH BEAM PB1-PB4 DETAILS', { continuation: 'r93', continuation_title: b, ...CONFIRMED }),
      sheet('D-94', 'PLINTH BEAM PB5-PB8 DETAILS', { continuation: 'r93', continuation_title: b, ...CONFIRMED }),
      sheet('D-99', 'GATE ELEVATION'),
    ]
    await show(sheets)
    expect(numberCell(rowOf('D-91')).replace(/\s/g, '')).toBe('D-91–D-92')
    expect(titleCell(rowOf('D-91'))).toBe(`${a}, 2 sheets`)
    expect(numberCell(rowOf('D-93')).replace(/\s/g, '')).toBe('D-93–D-94')
    expect(titleCell(rowOf('D-93'))).toBe(`${b}, 2 sheets`)
  })
})
