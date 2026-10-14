/*
 * S27-G7 (#319): an answer shows from its reply (`changed_proposals`) before the Proposals list is read
 * again, but an answer can close more Questions than the one answered (the server asks the set's Questions
 * again after each act). Shown from the reply alone, such a Question stayed open on screen until the list
 * landed: Q focused its card, the read behind then took it away, and Enter fell through to the bar's bulk
 * act (the timing walk on a 221-sheet set, answer 2). So the Questions are read again before the answer
 * shows: no state after the reply shows the Question the server closed.
 *
 * And an answer that moves no sheet still closes its Question, so a Discipline's open Questions (Step 1's
 * progress) move with it: the reply carries progress, written with the Questions (S27-G7's review).
 *
 * The fakes are 22's and 156's (../acceptance/t22, ../acceptance/t156), with 21c's keep_latest laid over
 * 156's as ts26d7 lays it, and the server closing S-08's Question with it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '../acceptance/t156/answer.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

/** The Questions tab's number and the open Question cards' tags. */
function questionsNow() {
  const tab = [...document.querySelectorAll('[role="tab"]')].map((t) => clean(t.textContent)).find((t) => t.startsWith('Questions'))
  return tab === undefined ? '(no tab)' : tab.replace(/^Questions/, '').trim()
}

describe('an answer that closes another Question too', () => {
  it('keeping S-07\'s latest copy, which also closes S-08\'s Question, with the Proposals list held: the Questions number reads 1, never 2, after the reply', async () => {
    const fake = new FakeAnswers()
    const byKind = fake.byKind()
    fake.questions = [byKind.same_number!, byKind.convention!, byKind.check!]
    const [copies, s08] = [fake.questions[0]!, fake.questions[1]!]
    let gate: Promise<void> | null = null
    let release = () => undefined as void
    const list = new RegExp(`^/api/projects/${fake.step1.projectId}/takeoff/step1/proposals/?$`)
    const base = fake.api.handle
    fake.api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      const waiting = gate
      if (request.method === 'GET' && list.test(path) && waiting) await waiting
      const response = await base(request)
      if (request.method === 'POST' && path.endsWith(`/questions/${copies.id}/answer`) && response.ok) {
        const [latest, older] = copies.proposals.map((id) => fake.step1.proposals.find((p) => p.id === id)!)
        const at = '2026-10-14T06:00:00.000Z'
        Object.assign(latest!, { decision: 'confirmed', decided_by: fake.step1.actor, decided_at: at })
        Object.assign(older!, { decision: 'excluded', excluded_reason: 'superseded', excluded_text: '', decided_by: fake.step1.actor, decided_at: at })
        // The server asked the set's Questions again after the act: S-08's is no longer asked.
        Object.assign(s08, { status: 'withdrawn' })
        const reply = (await response.json()) as Record<string, unknown>
        return new Response(JSON.stringify({ ...reply, changed_proposals: JSON.parse(JSON.stringify([latest, older])) as unknown }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return response
    }
    const { queryClient } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await waitFor(() => expect(questionsNow()).toBe('3'))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    gate = new Promise<void>((resolve) => (release = resolve))

    const seen: string[] = []
    const mo = new MutationObserver(() => seen.push(questionsNow()))
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    for (let i = 0; i < 5 && !screen.queryByRole('region', { name: (n: string) => clean(n) === 'Question Q1' }); i++) await userEvent.keyboard('q')
    await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(bodyText(), 'the rows from the reply, the list still held').toContain('Confirmed 1 / 24, 1 excluded'))
    expect(questionsNow()).toBe('1')
    mo.disconnect()
    release()
    gate = null

    expect([...new Set(seen)].filter((n) => n === '2'), 'a state showing S-08\'s closed Question still open').toEqual([])
  })
})

describe('an answer that moves no sheet', () => {
  it('answering S-13\'s check with the Proposals, Coverage and progress GETs held: Structural\'s open Questions in progress fall in the same write as the Questions number', async () => {
    const fake = new FakeAnswers()
    const byKind = fake.byKind()
    fake.questions = [byKind.check!, byKind.same_number!]
    const check = fake.questions[0]!
    let gate: Promise<void> | null = null
    let release = () => undefined as void
    const held = new RegExp(`^/api/projects/${fake.step1.projectId}/takeoff/step1/(proposals|coverage|progress)/?$`)
    const progressPath = `/api/projects/${fake.step1.projectId}/takeoff/step1/progress`
    const base = fake.api.handle
    fake.api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      const waiting = gate
      if (request.method === 'GET' && held.test(path) && waiting) await waiting
      const response = await base(request)
      if (request.method === 'POST' && path.endsWith(`/questions/${check.id}/answer`) && response.ok) {
        // The server's reply: the Question, no sheet moved, and progress as it now reads.
        const progress = (await (await base(new Request(new URL(progressPath, location.origin)))).json()) as unknown
        const reply = (await response.json()) as Record<string, unknown>
        return new Response(JSON.stringify({ ...reply, changed_proposals: [], progress }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return response
    }
    const { queryClient } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    const structuralOpen = () =>
      queryClient.getQueryData<{ disciplines: { discipline: string | null; open_questions: number }[] }>(['step1', fake.step1.projectId, 'progress'])?.disciplines.find((d) => d.discipline === 'structural')
        ?.open_questions
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await waitFor(() => expect(questionsNow()).toBe('2'))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(structuralOpen()).toBe(2)
    gate = new Promise<void>((resolve) => (release = resolve))

    const seen: string[] = []
    const mo = new MutationObserver(() => seen.push(`${questionsNow()}|${String(structuralOpen())}`))
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    for (let i = 0; i < 5 && !screen.queryByRole('region', { name: (n: string) => clean(n) === 'Question Q2' }); i++) await userEvent.keyboard('q')
    await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q2' })
    expect(check.options[0]!.key).toBe('not_sent_yet')
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(questionsNow(), 'the Questions number with the reads held').toBe('1'))
    expect(structuralOpen(), 'progress\'s open Questions with the reads held').toBe(1)
    mo.disconnect()
    release()
    gate = null

    expect([...new Set(seen)].filter((s) => s === '1|2'), 'a state with the Questions number moved and progress not').toEqual([])
  })
})
