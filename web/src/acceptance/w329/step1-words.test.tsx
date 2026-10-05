/*
 * Ticket W329's acceptance test for Step 1's words (M0-FL13, gh issue #329): "Step 1 reads as
 * docs/design/m0-screens.md words it". The ticket's section 3, item 12: with one of each (one Sheet,
 * one Question open for a Discipline, one view, one Sheet with no Discipline, one source), the
 * rendered Step 1 text (rows, bar, Inspector, Coverage) never reads "1 sheets": none of
 * /\b1 (sheets|Questions|copies|views|files|pages|Sheets)\b/.
 *
 * The API is ticket 22's in-memory fake (`../t22/step1.fixture.ts`) laid over the seed's FakeApi, its
 * rows replaced by two Sheets: one Structural Sheet on one source with one Question open, and one Sheet
 * with no Discipline. Every number and title here is invented.
 *
 * Not pinned (the report says why): the ticket's item 11, one test per Step 0 row, because the Step 0
 * table reached the writer unfilled ("(orchestrator fills)"): no msgid and no m0-screens sentence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, kr01Proposals, type QuestionOut } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'
const ONE_PLURAL = /\b1 (sheets|Questions|copies|views|files|pages|Sheets)\b/

const STRUCTURAL_NUMBER = 'S-27'
const STRUCTURAL_TITLE = 'CANOPY BEAM SECTIONS'
const LOOSE_NUMBER = 'Q-04'
const LOOSE_TITLE = 'BALCONY RAILING DETAILS'

type Shape = QuestionOut & { proposals: string[]; withdrawn_by: string | null; blocking: boolean }

/** One of each: one Structural Sheet on one source with one Question open, one Sheet of no Discipline, one view. */
function oneOfEach(): FakeApi {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  const [structural, , , , , , , , , , , , , architectural] = kr01Proposals()
  const sheet = { ...structural!, number: STRUCTURAL_NUMBER, title: STRUCTURAL_TITLE, agrees: false }
  const loose = { ...architectural!, discipline: null, number: LOOSE_NUMBER, title: LOOSE_TITLE, agrees: false }
  step1.proposals = [sheet, loose]
  const question: Shape = {
    id: 'c3290000-0000-4000-8000-000000000001',
    kind: 'low_confidence',
    status: 'open',
    code: 'takeoff.step1.which_kind',
    params: { number: STRUCTURAL_NUMBER },
    options: ['elevation', 'section', 'floor_plan', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline: 'structural',
    subject_id: sheet.sheet_id,
    check_code: null,
    answer: null,
    answered_at: null,
    proposals: [sheet.id],
    withdrawn_by: null,
    blocking: true,
  }
  step1.questions = [question]
  step1.coverage = { views: 1, assigned: 0, excluded: 0, proposed: 1, unaccounted: 0, used: 0, by_step: { '1': 1 }, by_reason: {} }
  step1.notReceived = ['plumbing']
  step1.lists = {
    structural: { source: 'sheet', numbers: [STRUCTURAL_NUMBER], entered_by: null, entered_at: null, read_numbers: [STRUCTURAL_NUMBER] },
  }
  return api
}

/** Every list row, innermost (a row holding no other row). */
function rows(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>('[role="row"]')]
  return all.filter((r) => !all.some((o) => o !== r && r.contains(o)))
}

describe('Step 1 never reads "1 sheets" (M0-FL13; the ticket’s item 12)', () => {
  it('words every count of one in the singular, in the rows, the bar, the Inspector and Coverage', async () => {
    await mountApp(PATH, { as: PEOPLE.qs, api: oneOfEach() })
    await waitFor(() => expect(bodyText()).toMatch(/Confirmed 0 \/ \d/))
    await waitFor(() => expect(bodyText()).toContain(STRUCTURAL_TITLE))
    expect(bodyText(), 'the Sheet of no Discipline is counted').toContain('1 with no Discipline')
    const seen: string[] = [`at rest: ${bodyText()}`]

    // Each row once, the rows a selected group shows among them.
    const visited = new Set<string>()
    for (let next = rows().find((r) => !visited.has(r.getAttribute('data-row') ?? '')); next; next = rows().find((r) => !visited.has(r.getAttribute('data-row') ?? ''))) {
      const key = next.getAttribute('data-row') ?? ''
      visited.add(key)
      await userEvent.click(next)
      seen.push(`row ${key} selected: ${bodyText()}`)
    }
    expect(visited.size, 'the list shows its rows').toBeGreaterThan(1)

    const coverage = screen.getAllByRole('button').find((b) => clean(b.textContent).startsWith('Coverage 1 view'))
    expect(coverage, 'the status bar’s Coverage, of one view').toBeDefined()
    await userEvent.click(coverage!)
    await screen.findByText('Coverage, every view on every sheet read')
    seen.push(`Coverage open: ${bodyText()}`)

    for (const text of seen) expect(text, text.slice(0, 40)).not.toMatch(ONE_PLURAL)
  })
})
