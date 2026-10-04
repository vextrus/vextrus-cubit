/*
 * Ticket 167's acceptance tests (M0 fix W9, gh issue #167, "Step 1 words bundle"): the words of Step 1
 * that were empty, false or short. Acceptance to pin, verbatim from the issue: "No empty quoted title or
 * field in any message.", "The conflict heading fits the sheets' kind.", "'Held file first' only when
 * one is held.", "The summary counts every sheet, unassigned ones included." (F1 and F2 are in
 * bulk.test.tsx.)
 *
 * The API is ticket 22's in-memory fake (`../t22/step1.fixture.ts`, KR-01 after reading: 24 sheets,
 * five Questions, the held file KR-STR-old.dwg first), each case changed only as its test says. Words
 * are m0-screens §5 and §6.3 ("Answer 5 Questions: the held file first, then those holding the most
 * sheets"; the Question kind "Two plans draw one thing" is §5's for same-storey plans) and the codes'
 * English in web/src/messages/engine/conflicts/en.po.
 *
 * Not pinned (the builder's and the words gate's): what a card says in place of an empty title, the
 * heading a same-title conflict takes, the overview's line with no held file beyond its count, and how
 * the summary words the sheets of no Discipline beyond their count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut, type QuestionOut } from '../t22/step1.fixture'

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

type Shape = QuestionOut & { proposals: string[]; withdrawn_by: string | null; blocking: boolean }

function kr01(): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  return { api, step1: new FakeStep1(api, 'KR-01') }
}

/** 21c's Question shape: each Question lists the Proposals it holds (its subject's, if any). */
function as21c(step1: FakeStep1, extra: Shape[] = []): void {
  step1.questions = [
    ...step1.questions.map((q): Shape => {
      const held = q.subject_id ? step1.proposals.filter((p) => p.sheet_id === q.subject_id || (q.kind === 'conflict' && p.number === q.params.number)).map((p) => p.id) : []
      return { ...q, proposals: held, withdrawn_by: null, blocking: true }
    }),
    ...extra,
  ]
}

async function open(api: FakeApi, found = 24) {
  const app = await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain(`Confirmed 0 / ${found}`))
  return app
}

const byNumber = (step1: FakeStep1, n: string | null): ProposalOut => step1.proposals.find((p) => p.number === n)!

/** The Question cards on the Questions tab (22's card: a region named "Question Q<n>", m0-screens §6.7). */
async function questionCards(): Promise<HTMLElement[]> {
  await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
  return screen.findAllByRole('region', { name: (name) => /^Question Q\d+$/.test(clean(name)) })
}

/** The card whose words satisfy `match`. */
async function cardWhere(match: (text: string) => boolean, what: string): Promise<string> {
  const cards = await questionCards()
  const found = cards.map((c) => clean(c.textContent)).filter(match)
  expect(found, `one card for ${what}`).toHaveLength(1)
  return found[0]!
}

/** An empty quotation ("" or “”, nothing or only spaces between the marks). */
const EMPTY_QUOTE = /“\s*”|"\s*"|‘\s*’/

/** Words with a gap where a name was: "the title block of (", "titled in", "in has". */
const MISSING_NAME = /\b(?:of|titled|in)\s+(?:\(|\.|,|in\b|has\b)/

function expectNoEmptyField(text: string) {
  expect(text, 'no empty quotation').not.toMatch(EMPTY_QUOTE)
  expect(text, 'no gap where a name was').not.toMatch(MISSING_NAME)
}

describe('no empty quoted title or field in any message (issue #167)', () => {
  it('words the no-number Question of a sheet with no title without an empty quotation', async () => {
    const { api, step1 } = kr01()
    byNumber(step1, null).title = ''
    await open(api)
    const text = await cardWhere((t) => t.includes('KR-ARC-R0.dwg') && !t.includes('may be misread'), 'the sheet with no number')
    expectNoEmptyField(text)
  })

  it('words the no-number Question’s Trace without a gap where the title was ("Trace: the title block of (the number field is empty)")', async () => {
    const { api, step1 } = kr01()
    byNumber(step1, null).title = '   '
    await open(api)
    const text = await cardWhere((t) => t.includes('KR-ARC-R0.dwg') && !t.includes('may be misread'), 'the sheet with no number')
    expect(text).toContain('Trace:')
    expect(text).not.toMatch(/the title block of\s*\(/)
    expectNoEmptyField(text)
  })

  it('words the sheet-kind Question of a numbered sheet with no title without an empty quotation', async () => {
    const { api, step1 } = kr01()
    byNumber(step1, 'A-05').title = ''
    await open(api)
    const text = await cardWhere((t) => t.includes('A-05'), 'A-05')
    expectNoEmptyField(text)
  })

  it('words two copies of one number with no title without an empty quotation', async () => {
    const { api, step1 } = kr01()
    for (const p of step1.proposals.filter((x) => x.number === 'S-07')) p.title = ''
    await open(api)
    const text = await cardWhere((t) => t.includes('S-07') && t.includes('rev A'), 'the two copies of S-07')
    expectNoEmptyField(text)
  })

  it('shows no empty quotation anywhere on Step 1 when the untitled sheets’ cards are open', async () => {
    const { api, step1 } = kr01()
    byNumber(step1, null).title = ''
    byNumber(step1, 'A-05').title = ''
    for (const p of step1.proposals.filter((x) => x.number === 'S-07')) p.title = ''
    await open(api)
    await questionCards()
    expectNoEmptyField(bodyText())
  })
})

/** A same-title conflict (engine.conflicts.same_title) over `numbers`, all retitled `title`. */
function sameTitle(step1: FakeStep1, numbers: string[], title: string): Shape {
  const held = numbers.map((n) => byNumber(step1, n))
  for (const p of held) p.title = title
  return {
    id: 'c1670000-0000-4000-8000-000000000001',
    kind: 'conflict',
    status: 'open',
    code: 'engine.conflicts.same_title',
    params: { sheets: held.length, title },
    options: ['keep_both', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline: held[0]!.discipline,
    subject_id: held[0]!.sheet_id,
    check_code: null,
    answer: null,
    answered_at: null,
    proposals: held.map((p) => p.id),
    withdrawn_by: null,
    blocking: true,
  }
}

describe('the conflict heading fits the sheets’ kind (issue #167; m0-screens §5)', () => {
  it('does not head a same-title conflict over two schedules "Two plans draw one thing"', async () => {
    const { api, step1 } = kr01()
    as21c(step1, [sameTitle(step1, ['S-09', 'S-11'], 'COLUMN SCHEDULE')])
    await open(api)
    const text = await cardWhere((t) => t.includes('COLUMN SCHEDULE') && t.includes('S-11'), 'the two schedules')
    expect(text).not.toContain('Two plans draw one thing')
    expect(bodyText()).not.toContain('Two plans draw one thing')
  })

  it('does not head a same-title conflict over two elevations "Two plans draw one thing"', async () => {
    const { api, step1 } = kr01()
    as21c(step1, [sameTitle(step1, ['A-02', 'A-06'], 'FRONT ELEVATION')])
    await open(api)
    const text = await cardWhere((t) => t.includes('FRONT ELEVATION') && t.includes('A-06'), 'the two elevations')
    expect(text).not.toContain('Two plans draw one thing')
    expect(bodyText()).not.toContain('Two plans draw one thing')
  })

  it('still heads two plans of one storey "Two plans draw one thing" (m0-screens §5)', async () => {
    const { api, step1 } = kr01()
    const [a, b] = [byNumber(step1, 'S-04'), byNumber(step1, 'S-11')]
    as21c(step1, [
      {
        id: 'c1670000-0000-4000-8000-000000000002',
        kind: 'conflict',
        status: 'open',
        code: 'engine.conflicts.same_storey',
        params: { first: 'S-04', first_named: 'number', second: 'S-11', second_named: 'number', plan: '', other: '', titled: 'none', layer: 'bottom', views: 2 },
        options: ['keep_both', 'keep_open'].map((key) => ({ key, picked: false })),
        discipline: 'structural',
        subject_id: a.sheet_id,
        check_code: null,
        answer: null,
        answered_at: null,
        proposals: [a.id, b.id],
        withdrawn_by: null,
        blocking: true,
      },
    ])
    await open(api)
    await questionCards()
    await waitFor(() => expect(bodyText()).toContain('Two plans draw one thing'))
  })
})

describe('"the held file first" only when a file is held (issue #167; m0-screens §6.3)', () => {
  const HELD_FIRST = 'the held file first'

  it('still says "Answer 5 Questions: the held file first, then those holding the most sheets" with KR-STR-old.dwg held', async () => {
    const { api } = kr01()
    await open(api)
    expect(bodyText()).toContain('Answer 5 Questions: the held file first, then those holding the most sheets')
  })

  it('counts the Questions without "the held file first" when no file is held', async () => {
    const { api, step1 } = kr01()
    step1.questions = step1.questions.filter((q) => q.kind !== 'file_misread')
    await open(api)
    await waitFor(() => expect(bodyText()).toContain('Answer 4 Questions'))
    expect(bodyText()).not.toContain(HELD_FIRST)
  })

  it('drops "the held file first" once the held file’s Question is answered', async () => {
    const { api, step1 } = kr01()
    const held = step1.questions.find((q) => q.kind === 'file_misread')!
    Object.assign(held, { status: 'answered', answer: 'read_anyway', answered_at: '2026-09-27T05:00:00Z' })
    await open(api)
    await waitFor(() => expect(bodyText()).toContain('Answer 4 Questions'))
    expect(bodyText()).not.toContain(HELD_FIRST)
  })
})

describe('the sheets summary counts every sheet, unassigned ones included (issue #167; m0-screens §6.6)', () => {
  /** KR-01 with a fourth file, KR-MEP-R0.dwg, of no Discipline: its five sheets M-01 to M-05. */
  function withUnassigned(): { api: FakeApi; step1: FakeStep1 } {
    const { api, step1 } = kr01()
    const base = step1.proposals.find((p) => p.number === 'E-01')!
    const file_id = 'd1670000-0000-4000-8000-000000000001'
    for (let i = 1; i <= 5; i++) {
      step1.proposals.push({
        ...base,
        id: `a1670000-0000-4000-8000-00000000000${i}`,
        sheet_id: `b1670000-0000-4000-8000-00000000000${i}`,
        number: `M-0${i}`,
        title: `PLUMBING LAYOUT ${i}`,
        discipline: null,
        file_id,
        file_name: 'KR-MEP-R0.dwg',
      })
    }
    // 19a's progress answers a row for the sheets of no Discipline, last (vextrus/takeoff/services/step1.py `progress`).
    const fake = step1 as unknown as { progress: () => { disciplines: Record<string, unknown>[]; not_received: string[] } }
    const own = fake.progress.bind(step1)
    Object.defineProperty(step1, 'progress', {
      value: () => {
        const p = own()
        return { ...p, disciplines: [...p.disciplines, { discipline: null, confirmed: 0, found: 5, listed: null, lists_disagree: false, total: 5, open_questions: 0 }] }
      },
    })
    return { api, step1 }
  }

  /** The overview's "<Project>’s sheets" block (m0-screens §6.6), with nothing focused. */
  function summary(): string {
    const heading = [...document.querySelectorAll('h3')].find((h) => clean(h.textContent).endsWith('’s sheets'))
    expect(heading, 'the overview’s sheets summary').toBeDefined()
    return clean(heading!.parentElement!.textContent)
  }

  it('counts all 29 sheets in the toolbar', async () => {
    const { api } = withUnassigned()
    await open(api, 29)
  })

  it('names the five sheets of no Discipline in the summary', async () => {
    const { api } = withUnassigned()
    await open(api, 29)
    await waitFor(() => expect(summary()).toMatch(/\b5\b/))
    expect(summary()).toContain('Structural')
  })
})
