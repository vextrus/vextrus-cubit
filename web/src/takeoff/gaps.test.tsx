/*
 * One gap Question per Discipline (#229, the owner's ruling: "all of one Discipline's gaps are asked as
 * one Question"): its card names every gap and words its answers for all of them; it holds only the
 * sheets beside its gaps, which stay in the list.
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
const ID = 'c2290000-0000-4000-8000-0000000000a1'

async function open() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  step1.proposals = step1.proposals.filter((p) => p.number !== 'A-02' && p.number !== 'A-04')
  // The Check's `after` and `before` of each gap: A-01, A-03 and A-05.
  const beside = step1.proposals.filter((p) => p.number === 'A-01' || p.number === 'A-03' || p.number === 'A-05')
  const gaps: QuestionOut = {
    id: ID,
    kind: 'check',
    status: 'open',
    code: 'engine.register_check.gaps',
    params: { discipline: 'architectural', gaps: [{ after: 'A-01', before: 'A-03', missing: 1 }, { after: 'A-03', before: 'A-05', missing: 1 }] } as unknown as QuestionOut['params'],
    options: ['not_sent_yet', 'not_in_set', 'file_not_added', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline: 'architectural',
    subject_id: null,
    check_code: 'register',
    answer: null,
    answered_at: null,
  }
  step1.questions = [...step1.questions.map((q) => ({ ...q, proposals: [], withdrawn_by: null, blocking: true })), { ...gaps, proposals: beside.map((p) => p.id), withdrawn_by: null, blocking: true } as QuestionOut]
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(clean(document.body.textContent)).toContain('Confirmed 0 /'))
  return beside
}

const rowOf = (key: string) => document.querySelector<HTMLElement>(`[data-row="${key}"]`)
const card = () => screen.getAllByRole('region', { name: (n) => /^Question Q\d+$/.test(clean(n)) })

describe('a Discipline’s gaps, asked as one Question', () => {
  it('names every gap in one card, words its answers for all of them, and leaves the sheets beside them in the list', async () => {
    const beside = await open()
    await waitFor(() => expect(rowOf(`q:${ID}`)).toBeTruthy())
    expect(clean(rowOf(`q:${ID}`)!.textContent)).toContain('A-01')
    expect(clean(rowOf(`q:${ID}`)!.textContent)).toContain('A-05')
    expect(clean(rowOf(`q:${ID}`)!.textContent)).not.toContain('copies')
    // The sheets beside the gaps keep their own rows (they are not swallowed by the Question's).
    for (const p of beside.filter((s) => s.number !== 'A-05')) expect(rowOf(`p:${p.id}`)).toBeTruthy() // A-05's kind is asked too
    await userEvent.click(rowOf(`q:${ID}`)!)
    await waitFor(() => expect(card().some((c) => clean(c.textContent).includes('the numbering skips 2 times'))).toBe(true))
    const text = clean(card().find((c) => clean(c.textContent).includes('skips 2 times'))!.textContent)
    expect(text).toContain('Gaps in the numbering')
    expect(text).toContain('at A-01–A-03, A-03–A-05: 2 numbers are missing, so the sheets either side of each gap have one source')
    expect(text).toContain('Trace: the title blocks of A-01, A-03 and A-05')
    expect(text).toContain('Answering confirms no sheets: it records why the numbering skips, and the sheets either side of the gaps stop waiting for it.')
    expect(text).not.toContain('Answering settles')
    expect(text).toContain('Not sent yet: keep the missing sheets in the count and ask the consultant')
    expect(text).toContain('Not part of this set: the numbering skips at each gap')
    expect(text).not.toContain('skips here')
  })
})
