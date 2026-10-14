/*
 * S27-G7 (#319): an answer that confirms or leaves out sheets shows on Step 1 once its POST has returned,
 * from the Proposals its reply carries (`changed_proposals`, pinned by
 * vextrus/takeoff/tests/acceptance/ts27g7/), without waiting for the whole Proposals list to be fetched
 * again. Session 26's G1 walk (M0-FL8 f-6) measured 2.7-4.2 s from Enter to the Questions count on 218
 * sheets, the 643 KB list read again after each answer.
 *
 * D7's pin (../ts26d7) stands: the toolbar's Count, the step rail's mark and Count and the Questions tab's
 * number agree with the rows in every rendered state, so here the rows, the Count and the Questions
 * number all move in one render, while the Proposals list's GET is still held. Every DOM state is
 * recorded with a MutationObserver (D7's helpers, copied unchanged).
 *
 * The fakes are 22's (../t22/step1.fixture.ts) and 156's (../t156/answer.fixture.ts), unchanged; 21c's
 * "keep_latest" (confirm the latest copy, leave the other out as superseded) is laid over 156's as D7
 * lays it, and the answer's reply here also carries the two copies as the list now shows them, under
 * `changed_proposals`, as the server's will.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers, type Question21c } from '../t156/answer.fixture'

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
const PATH = '/p/KR-01/takeoff/1'

/** What the frame shows of Step 1: the toolbar's Count, the rail's mark and Count, the Questions tab's number. */
interface Frame {
  count: string
  mark: string
  rail: string
  questions: string
}

function frameNow(): Frame {
  const toolbar = clean(document.querySelector('[role="toolbar"][aria-label="The step\'s tools"]')?.textContent)
  const step1 = document.querySelector('nav[aria-label="Takeoff Steps"] a[aria-current="page"]')
  const tab = [...document.querySelectorAll('[role="tab"]')].map((t) => clean(t.textContent)).find((t) => t.startsWith('Questions'))
  return {
    count: /Confirmed \d{1,3}(?:,\d{3})* \/ (?:\d{1,3}(?:,\d{3})*|—)(?:, \d{1,3}(?:,\d{3})* excluded)?/.exec(toolbar)?.[0] ?? '(no Count)',
    mark: step1?.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '(no mark)',
    rail: /(\d{1,3}(?:,\d{3})* \/ (?:\d{1,3}(?:,\d{3})*|—))$/.exec(clean(step1?.textContent))?.[1] ?? '(no rail Count)',
    questions: tab === undefined ? '(no tab)' : tab.replace(/^Questions/, '').trim(),
  }
}

/** Every DOM state from now until `stop`, each with whether the rows already show `after` (Step 1's own words). */
function watchStates(after: string) {
  const seen: (Frame & { rows: 'new' | 'old' })[] = []
  const look = () => seen.push({ rows: bodyText().includes(after) ? 'new' : 'old', ...frameNow() })
  const mo = new MutationObserver(look)
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] })
  look()
  return {
    seen,
    stop: () => {
      look()
      mo.disconnect()
    },
  }
}

const same = (a: Frame, b: Frame) => a.count === b.count && a.mark === b.mark && a.rail === b.rail && a.questions === b.questions

/** The states whose frame does not match its rows: old rows with the old frame, new rows with the new. */
function disagreeing(seen: ReturnType<typeof watchStates>['seen'], before: Frame, after: Frame) {
  return [...new Set(seen.filter((s) => !same(s, s.rows === 'new' ? after : before)).map((s) => JSON.stringify(s)))]
}

/** The rail opened (its Count shows only open), with focus given back to the page. */
async function openRail() {
  await userEvent.click(screen.getByRole('button', { name: 'Open the step rail' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close the step rail' })).toBeVisible())
  ;(document.activeElement as HTMLElement | null)?.blur()
}

/**
 * KR-01 with `kinds`' Questions open in that order; 21c's keep_latest carried out on the copies one holds,
 * its reply carrying them under `changed_proposals`. Once `hold.arm()` is called, each GET of the
 * Proposals list is held open until `hold.release()`.
 */
async function openAnswers(kinds: string[]) {
  const fake = new FakeAnswers()
  const byKind = fake.byKind()
  fake.questions = kinds.map((k) => byKind[k]!)
  let gate: Promise<void> | null = null
  let open = () => undefined as void
  const hold = {
    seen: 0,
    answered: 0,
    arm: () => {
      gate = new Promise<void>((resolve) => (open = resolve))
    },
    release: () => {
      gate = null
      open()
    },
  }
  const list = new RegExp(`^/api/projects/${fake.step1.projectId}/takeoff/step1/proposals/?$`)
  const base = fake.api.handle
  fake.api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    const waiting = gate
    if (request.method === 'GET' && list.test(path) && waiting) {
      hold.seen += 1
      await waiting
      const listed = await base(request)
      hold.answered += 1
      return listed
    }
    const response = await base(request)
    const question = fake.questions.find((q) => path.endsWith(`/questions/${q.id}/answer`))
    if (question && request.method === 'POST' && response.ok) {
      const body = (await request.clone().json()) as { option?: string }
      if (body.option === 'keep_latest') {
        const [latest, older] = question.proposals.map((id) => fake.step1.proposals.find((p) => p.id === id)!)
        const at = '2026-10-14T06:00:00.000Z'
        Object.assign(latest!, { decision: 'confirmed', decided_by: fake.step1.actor, decided_at: at })
        Object.assign(older!, { decision: 'excluded', excluded_reason: 'superseded', excluded_text: '', decided_by: fake.step1.actor, decided_at: at })
        const reply = (await response.json()) as Record<string, unknown>
        const changed_proposals = JSON.parse(JSON.stringify([latest, older])) as unknown
        return new Response(JSON.stringify({ ...reply, changed_proposals }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    }
    return response
  }
  const app = await mountApp(PATH, { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return { ...app, fake, hold }
}

/** Q until the card `tag` is the active one, the digit of its first option, then Enter (m0-screens 6.15). */
async function answerFirstOption(question: Question21c, tag: string) {
  for (let i = 0; i < 5 && !screen.queryByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` }); i++) await userEvent.keyboard('q')
  await screen.findByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` })
  expect(question.options[0]!.key).toBe('keep_latest')
  await userEvent.keyboard('1')
  await userEvent.keyboard('{Enter}')
}

const BEFORE: Frame = { count: 'Confirmed 0 / 24', mark: 'Questions open', rail: '0 / 24', questions: '2' }
const AFTER: Frame = { count: 'Confirmed 1 / 24, 1 excluded', mark: 'Questions open', rail: '1 / 24', questions: '1' }

/** Q2 (the S-07 copies) answered "keep the latest" with the Proposals list's GET held; returns once the rows and frame show it, still held. */
async function answeredHeld() {
  const app = await openAnswers(['file_misread', 'same_number'])
  const { fake, hold, queryClient } = app
  await openRail()
  await waitFor(() => expect(frameNow()).toEqual(BEFORE))
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  hold.arm()
  const w = watchStates('2 / 13 settled')
  await answerFirstOption(fake.questions[1]!, 'Q2')
  await waitFor(() => expect(fake.posted).toHaveLength(1))
  await waitFor(() => expect(bodyText(), 'the rows once the answer POST returned, with the Proposals list held').toContain('2 / 13 settled'))
  await waitFor(() => expect(frameNow()).toEqual(AFTER))
  expect(hold.answered, 'no held GET of the Proposals list answered yet').toBe(0)
  return { ...app, w }
}

describe('an answer that moves sheets shows from its reply, not from the Proposals list read again', () => {
  it('keeping S-07\'s latest copy with the Proposals list\'s GET held: the rows read "2 / 13 settled", the Count "Confirmed 1 / 24, 1 excluded" and the Questions number 1, all in one state', async () => {
    const { w } = await answeredHeld()
    w.stop()
    expect(disagreeing(w.seen, BEFORE, AFTER), 'a state whose frame disagrees with its rows').toEqual([])
  })

  it('when the held Proposals list finally lands, no state shows "Confirmed 0 / 24", the rail\'s "0 / 24" or 2 Questions again', async () => {
    const { w, hold, queryClient } = await answeredHeld()
    w.stop()
    const after = watchStates('2 / 13 settled')
    hold.release()
    await waitFor(() => expect(hold.answered).toBe(hold.seen))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    // Two frames drawn after the reads settle: the last copy has been rendered.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await waitFor(() => expect(frameNow()).toEqual(AFTER))
    after.stop()
    expect(after.seen.filter((s) => s.rows !== 'new' || !same(s, AFTER)), 'a state showing the answer taken back').toEqual([])
  })
})
