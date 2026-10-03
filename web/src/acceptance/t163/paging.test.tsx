/*
 * Ticket 163 (issue #163, W2): in Step 1's sheet mode, Next and Previous walk every sheet once.
 * "A list where one sheet is in two Questions: Next visits every distinct sheet in list order and stops
 * at the last; Previous mirrors it." docs/design/m0-screens.md §6.1 ("`↑ ↓` move ... through sheets
 * (sheet rows only, in list order) in sheet mode"), §6.5 (the toolbar's "‹ ›"), the key table
 * ("`[` `]` ... Previous / next sheet in the list's order"). Paging does not wrap: §6.5 names wrapping
 * only for the act's "opens the next one needing the QS", never for "‹ ›" or `[ ]`.
 *
 * The API is 19a's Step 1 as ticket 22's acceptance fake answers it (../t22/step1.fixture.ts), with the
 * Proposals and Questions replaced here: nine sheets, S-03 held by two open Questions (so it is in two
 * "Needs you" rows), S-06 by one, three sheets with no title, one proposed to leave out.
 *
 * "Fast" (the walk's 60 ms per step) is made deterministic: every sheet's render is held unanswered
 * while the keys are pressed, so each step lands before the sheet it left has drawn. "Slow" waits for
 * each sheet's canvas ("Sheet S-0n", 16's viewer label) before the next step.
 *
 * The open sheet is read from the toolbar's sheet label (§6.5: the sheet label as a button opening the
 * sheet picker), by the sheet number it shows; every sheet here has its own number.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, kr01Proposals, type ProposalOut, type QuestionOut } from '../t22/step1.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

/** The sheets, in 19a's order; `title: ''` is a sheet whose title block gave none. */
const SHEETS: { number: string; title: string; discipline: 'structural' | 'architectural'; out?: string }[] = [
  { number: 'S-01', title: 'GENERAL NOTES', discipline: 'structural' },
  { number: 'S-02', title: 'PILE LAYOUT', discipline: 'structural' },
  { number: 'S-03', title: 'PILE CAP LAYOUT', discipline: 'structural' },
  { number: 'S-04', title: '', discipline: 'structural' },
  { number: 'S-05', title: '', discipline: 'structural' },
  { number: 'S-06', title: 'ROOF BEAM LAYOUT', discipline: 'structural' },
  { number: 'S-07', title: 'TYPICAL FLOOR BEAM LAYOUT', discipline: 'structural' },
  { number: 'S-08', title: 'TYPICAL FLOOR BEAM LAYOUT', discipline: 'structural' },
  { number: 'S-09', title: 'TYPICAL FLOOR BEAM LAYOUT', discipline: 'structural' },
  { number: 'A-01', title: 'SITE PLAN', discipline: 'architectural' },
  { number: 'A-02', title: '', discipline: 'architectural' },
  { number: 'A-03', title: '3D VIEW', discipline: 'architectural', out: 'for_information' },
]
const NUMBERS = SHEETS.map((s) => s.number)

/**
 * List order (m0-screens §5, §6.2): "Needs you" first, its Questions by kind then sheet (the "missing"
 * Question on S-03, the "low confidence" one on S-03, the one on S-06), then "Proposed to leave out"
 * (A-03), then each Discipline's sheets by number; S-07 to S-09 share a title, so one row
 * "S-07–S-09" holds them and each is still its own stop.
 */
const ORDER = ['S-03', 'S-06', 'A-03', 'S-01', 'S-02', 'S-04', 'S-05', 'S-07', 'S-08', 'S-09', 'A-01', 'A-02']

function question(id: string, kind: string, code: string, params: Record<string, unknown>, options: string[], subject: string): QuestionOut {
  return { id, kind, status: 'open', code, params, options: options.map((key) => ({ key, picked: false })), discipline: 'structural', subject_id: subject, check_code: null, answer: null, answered_at: null }
}

interface Setup {
  api: FakeApi
  step1: FakeStep1
  /** Answers every render held so far, and every later one at once. */
  release: () => void
}

/** The project with S-03 in two Questions; `hold` keeps every sheet's render unanswered until `release`. */
function setUp(hold: boolean): Setup {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  const kr = kr01Proposals()
  const str = kr[0]!
  const arc = kr[13]!
  step1.proposals = SHEETS.map((s, i): ProposalOut => {
    const base = s.discipline === 'structural' ? str : arc
    return {
      ...kr[i]!,
      file_id: base.file_id,
      file_name: base.file_name,
      number: s.number,
      title: s.title,
      discipline: s.discipline,
      revision_mark: 'R0',
      revision_mark_source: 'file_name',
      proposed_exclusion: s.out ?? null,
      agrees: true,
    }
  })
  const of = (n: string) => step1.proposals.find((p) => p.number === n)!
  step1.questions = [
    question('c1630000-0000-4000-8000-000000000001', 'low_confidence', 'takeoff.step1.which_kind', { number: 'S-03' }, ['floor_plan', 'details', 'keep_open'], of('S-03').sheet_id),
    question('c1630000-0000-4000-8000-000000000002', 'missing', 'takeoff.step1.discipline_unknown', {}, ['structural', 'architectural', 'keep_open'], of('S-03').sheet_id),
    question('c1630000-0000-4000-8000-000000000003', 'low_confidence', 'takeoff.step1.which_kind', { number: 'S-06' }, ['floor_plan', 'roof_plan', 'keep_open'], of('S-06').sheet_id),
  ]
  step1.lists = {}
  step1.coverage = { views: 9, assigned: 0, excluded: 0, proposed: 9, unaccounted: 0, used: 0, by_step: {}, by_reason: {} }
  step1.notReceived = []

  let held = hold
  const waiting: (() => void)[] = []
  const inner = api.handle
  api.handle = async (request: Request) => {
    const url = new URL(request.url, location.origin)
    if (held && url.pathname.includes('/drawings/sheets/') && url.pathname.endsWith('/render')) {
      await new Promise<void>((go) => waiting.push(go))
    }
    return inner(request)
  }
  const release = () => {
    held = false
    for (const go of waiting.splice(0)) go()
  }
  return { api, step1, release }
}

async function openList(api: FakeApi) {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(clean(document.body.textContent)).toContain(`Confirmed 0 / ${SHEETS.length}`))
}

/** The list's rows in document order, each as the sheet numbers it shows. */
function listRows(): string[][] {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')]
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  return inner.map((r) => NUMBERS.filter((n) => clean(r.textContent).includes(n))).filter((ns) => ns.length > 0)
}

/** List order as the list shows it: each sheet at its first row. */
function listOrder(): string[] {
  const seen: string[] = []
  for (const ns of listRows()) for (const n of ns) if (!seen.includes(n)) seen.push(n)
  return seen
}

/** The sheet the toolbar's sheet label names (§6.5), by its number. */
function openSheet(): string | null {
  const labels = [...document.querySelectorAll<HTMLElement>('button[aria-haspopup], button[aria-expanded]')].filter(
    (b) => b.offsetParent !== null && !b.closest('[role="dialog"]') && NUMBERS.some((n) => clean(b.textContent).startsWith(n)),
  )
  const shown = new Set(labels.map((b) => NUMBERS.find((n) => clean(b.textContent).startsWith(n))!))
  expect(shown.size, 'at most one sheet label in the toolbar').toBeLessThanOrEqual(1)
  return [...shown][0] ?? null
}

/** Focus the row of `number` (a click on its number, as ticket 22's tests do) and open it with Space. */
async function openFromList(number: string) {
  const row = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].find((r) => {
    const ns = NUMBERS.filter((n) => clean(r.textContent).includes(n))
    return ns.length === 1 && ns[0] === number
  })
  expect(row, `a row for ${number}`).toBeTruthy()
  await userEvent.click(within(row!).getAllByText(number)[0]!)
  await userEvent.keyboard(' ')
  await waitFor(() => expect(openSheet()).toBe(number))
}

async function drawn(number: string) {
  await screen.findByRole('group', { name: new RegExp(`Sheet\\s*⁨?${number}⁩?`) })
}

/** Presses `step` `times` times, reading the open sheet after each; `slow` waits for each canvas. */
async function walk(step: () => Promise<unknown>, times: number, slow: boolean): Promise<string[]> {
  const seen: string[] = []
  for (let i = 0; i < times; i++) {
    const before = openSheet()
    await step()
    if (slow) {
      await waitFor(() => expect(openSheet()).not.toBe(before))
      const now = openSheet()!
      await drawn(now)
      seen.push(now)
    } else {
      seen.push(openSheet()!)
    }
  }
  return seen
}

const nextButton = () => screen.getByRole('button', { name: /^Next sheet/ })
const previousButton = () => screen.getByRole('button', { name: /^Previous sheet/ })
const click = (button: () => HTMLElement) => () => userEvent.click(button())
const press = (keys: string) => () => userEvent.keyboard(keys)

describe('the list this ticket pages through', () => {
  it('shows S-03 in two rows (two Questions hold it), in the list order this ticket walks', async () => {
    const { api } = setUp(false)
    await openList(api)
    expect(listRows().filter((ns) => ns.includes('S-03')).length, 'S-03 in two rows').toBe(2)
    expect(listOrder()).toEqual(ORDER.filter((n) => n !== 'S-08'))
  })
})

describe('Next sheet visits every distinct sheet once, in list order, and stops at the last (#163)', () => {
  it('"Next sheet", one step at a time with each sheet drawn, visits each sheet once in list order', async () => {
    const { api, release } = setUp(false)
    release()
    await openList(api)
    const order = ORDER
    await openFromList(order[0]!)
    await drawn(order[0]!)
    const seen = await walk(click(nextButton), order.length - 1, true)
    expect([order[0]!, ...seen]).toEqual(order)
  })

  it('"Next sheet" pressed faster than the sheets draw visits each sheet once in list order', async () => {
    const { api } = setUp(true)
    await openList(api)
    const order = ORDER
    await openFromList(order[0]!)
    const seen = await walk(click(nextButton), order.length - 1, false)
    expect([order[0]!, ...seen]).toEqual(order)
  })

  it('`]` pressed faster than the sheets draw visits each sheet once in list order', async () => {
    const { api } = setUp(true)
    await openList(api)
    const order = ORDER
    await openFromList(order[0]!)
    const seen = await walk(press(']'), order.length - 1, false)
    expect([order[0]!, ...seen]).toEqual(order)
  })

  it('`↓` in sheet mode, faster than the sheets draw, visits each sheet once in list order', async () => {
    const { api } = setUp(true)
    await openList(api)
    const order = ORDER
    await openFromList(order[0]!)
    const seen = await walk(press('{ArrowDown}'), order.length - 1, false)
    expect([order[0]!, ...seen]).toEqual(order)
  })

  it('stops at the last sheet: Next there leaves it open and never wraps to the first', async () => {
    const { api, release } = setUp(true)
    await openList(api)
    const order = ORDER
    await openFromList(order[0]!)
    await walk(press(']'), order.length - 1, false)
    expect(openSheet()).toBe(order.at(-1))
    await userEvent.click(nextButton())
    await userEvent.keyboard(']')
    await userEvent.keyboard('{ArrowDown}')
    expect(openSheet()).toBe(order.at(-1))
    release()
    await drawn(order.at(-1)!)
    expect(openSheet()).toBe(order.at(-1))
  })
})

describe('Previous sheet mirrors it (#163)', () => {
  it('"Previous sheet", one step at a time with each sheet drawn, visits each sheet once in reverse list order', async () => {
    const { api, release } = setUp(false)
    release()
    await openList(api)
    const order = ORDER
    await openFromList(order.at(-1)!)
    await drawn(order.at(-1)!)
    const seen = await walk(click(previousButton), order.length - 1, true)
    expect([order.at(-1)!, ...seen]).toEqual([...order].reverse())
  })

  it('`[` pressed faster than the sheets draw visits each sheet once in reverse list order', async () => {
    const { api } = setUp(true)
    await openList(api)
    const order = ORDER
    await openFromList(order.at(-1)!)
    const seen = await walk(press('[['), order.length - 1, false)
    expect([order.at(-1)!, ...seen]).toEqual([...order].reverse())
  })

  it('`↑` in sheet mode, faster than the sheets draw, visits each sheet once in reverse list order', async () => {
    const { api } = setUp(true)
    await openList(api)
    const order = ORDER
    await openFromList(order.at(-1)!)
    const seen = await walk(press('{ArrowUp}'), order.length - 1, false)
    expect([order.at(-1)!, ...seen]).toEqual([...order].reverse())
  })

  it('stops at the first sheet: Previous there leaves it open and never wraps to the last', async () => {
    const { api } = setUp(true)
    await openList(api)
    const order = ORDER
    await openFromList(order.at(-1)!)
    await walk(press('[['), order.length - 1, false)
    expect(openSheet()).toBe(order[0])
    await userEvent.click(previousButton())
    await userEvent.keyboard('[[')
    await userEvent.keyboard('{ArrowUp}')
    expect(openSheet()).toBe(order[0])
  })

  it('from the second Question’s S-03, Next then Previous comes back to S-03, and Next goes on past it', async () => {
    const { api } = setUp(true)
    await openList(api)
    const order = ORDER
    const at = order.indexOf('S-03')
    await openFromList(order[0]!)
    await walk(press(']'), at, false)
    expect(openSheet()).toBe('S-03')
    await userEvent.keyboard(']')
    expect(openSheet()).toBe(order[at + 1])
    await userEvent.keyboard('[[')
    expect(openSheet()).toBe('S-03')
    await userEvent.keyboard(']')
    await userEvent.keyboard(']')
    expect(openSheet()).toBe(order[at + 2])
  })
  it('opened at S-03 from "Open in Step 1" (?sheet=), Next walks on from S-03 to every later sheet once', async () => {
    const { api, step1 } = setUp(true)
    const s03 = step1.proposals.find((p) => p.number === 'S-03')!
    await mountApp(`/p/KR-01/takeoff/1?sheet=${s03.sheet_id}`, { as: PEOPLE.qs, api })
    await waitFor(() => expect(openSheet()).toBe('S-03'))
    const seen = await walk(click(nextButton), ORDER.length - 1, false)
    expect(['S-03', ...seen]).toEqual(ORDER)
  })
})
