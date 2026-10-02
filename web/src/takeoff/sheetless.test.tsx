/*
 * Questions holding no sheet, past ticket 164's acceptance tests: the gap card's Trace names the title
 * blocks either side of the gap, never a drawing list there is none of (the refuter's finding); a
 * Question with no sheet and no number shows "—" in its Number cell, not a sheet's "none"; a Check
 * whose code has no kind line is not called a Check against the drawing list (the words gate's may).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type QuestionOut } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

function check(id: string, code: string, params: QuestionOut['params']): QuestionOut {
  return {
    id,
    kind: 'check',
    status: 'open',
    code,
    params,
    options: ['not_sent_yet', 'not_in_set', 'file_not_added', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline: 'architectural',
    subject_id: null,
    check_code: 'register',
    answer: null,
    answered_at: null,
  }
}

async function open(extra: QuestionOut[]) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  step1.proposals = step1.proposals.filter((p) => p.number !== 'A-04')
  step1.questions = [...step1.questions, ...extra].map((q) => ({ ...q, proposals: [], withdrawn_by: null, blocking: true }))
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(clean(document.body.textContent)).toContain('Confirmed 0 /'))
}

const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-row="q:${id}"]`)!
const card = () => screen.getAllByRole('region', { name: (n) => /^Question Q\d+$/.test(clean(n)) })

describe('a Question holding no sheet', () => {
  it('traces a numbering gap to the title blocks either side of it, never to a drawing list', async () => {
    const id = 'c1640000-0000-4000-8000-0000000000a1'
    await open([check(id, 'engine.register_check.gap', { after: 'A-03', before: 'A-05', missing: 1, discipline: 'architectural' })])
    await waitFor(() => expect(rowOf(id)).toBeTruthy())
    await userEvent.click(rowOf(id))
    await waitFor(() => expect(card().some((c) => clean(c.textContent).includes('the numbering skips from A-03 to A-05'))).toBe(true))
    const text = clean(card().find((c) => clean(c.textContent).includes('skips from A-03'))!.textContent)
    expect(text).toContain('A gap in the numbering')
    expect(text).toContain('Trace: the title blocks of A-03 and A-05')
    expect(text).not.toContain('Trace: the drawing list')
    // 21c gives it the drawing list's options; the gap words two of them for itself (the words gate, round 1).
    expect(text).toContain('Not sent yet: count the missing number and ask the consultant')
    expect(text).toContain('Not part of this set: the numbering simply skips')
    expect(text).not.toContain('take it off the list')
  })

  it('traces a gap to the one title block found, in the singular, and words several missing numbers', async () => {
    const id = 'c1640000-0000-4000-8000-0000000000a3'
    await open([check(id, 'engine.register_check.gap', { after: 'A-03', before: 'A-99', missing: 3, discipline: 'architectural' })])
    await waitFor(() => expect(rowOf(id)).toBeTruthy())
    await userEvent.click(rowOf(id))
    await waitFor(() => expect(card().some((c) => clean(c.textContent).includes('skips from A-03 to A-99'))).toBe(true))
    const text = clean(card().find((c) => clean(c.textContent).includes('skips from A-03'))!.textContent)
    expect(text).toContain('Trace: the title block of A-03')
    expect(text).not.toContain('title blocks')
    expect(text).toContain('Not sent yet: count the missing numbers and ask the consultant')
  })

  it('shows "—" for a Question with no sheet and no number, and does not call an unknown Check one against the drawing list', async () => {
    const id = 'c1640000-0000-4000-8000-0000000000a2'
    await open([check(id, 'engine.some_check.not_yet_worded', {})])
    await waitFor(() => expect(rowOf(id)).toBeTruthy())
    const number = clean(rowOf(id).querySelectorAll('[role="gridcell"]')[1]!.textContent)
    expect(number).toBe('—')
    expect(clean(rowOf(id).textContent)).not.toContain('A Check against the drawing list')
    expect(clean(rowOf(id).textContent)).not.toContain('Held')
  })
})
