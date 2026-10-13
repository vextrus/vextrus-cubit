/*
 * S26-D7: Step 1's counts in the frame update in the same render as the rows. The frame around Step 1
 * (docs/design/m0-screens.md 4.7: the toolbar's Count "Confirmed 0 / 24", the step rail's state mark and,
 * open, its Count; the inspector's Questions tab with its number) agrees with the rows at every rendered
 * state. The design-gate walk of #774 (session 26) caught "Confirmed 0 / 24" beside a row reading
 * "Confirmed NJ" after answering Q2; the diagnosis (session 26) found the frame one render behind the rows
 * after every act, and reset to "not started" on each read of the session (focus, another tab) until Step 1
 * wrote its counts back.
 *
 * Every DOM state is recorded with a MutationObserver: what the eye could catch, not only where it ends.
 * The fakes are 22's (../t22/step1.fixture.ts) and 156's (../t156/answer.fixture.ts), unchanged; 21c's
 * "keep_latest" (confirm the latest copy, leave the other out as superseded) is laid over 156's here, as
 * the diagnosis did, since 156's fake carries out only "keep_all".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { FakeAnswers, type Question21c } from '../t156/answer.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T06:00:00Z'))
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

/**
 * Every change made to the frame's Step 1 pieces (the toolbar, the rail's Step 1, the Questions tab), from the
 * mutation records themselves: a state taken back within the same task is still a change the DOM went through.
 */
function watchFrameChanges() {
  const pieces = [
    document.querySelector('[role="toolbar"][aria-label="The step\'s tools"]'),
    document.querySelector('nav[aria-label="Takeoff Steps"] a[aria-current="page"]'),
    [...document.querySelectorAll('[role="tab"]')].find((t) => clean(t.textContent).startsWith('Questions')) ?? null,
  ].filter((e): e is Element => e !== null)
  expect(pieces, 'the toolbar, the rail\'s Step 1 and the Questions tab').toHaveLength(3)
  const changes: string[] = []
  const describe = (r: MutationRecord) =>
    r.type === 'characterData'
      ? `a text was "${r.oldValue ?? ''}"`
      : `removed "${clean([...r.removedNodes].map((n) => n.textContent).join(' '))}", added "${clean([...r.addedNodes].map((n) => n.textContent).join(' '))}"`
  const take = (records: MutationRecord[]) => {
    for (const r of records) if (pieces.some((p) => p.contains(r.target))) changes.push(describe(r))
  }
  const mo = new MutationObserver(take)
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, characterDataOldValue: true })
  return {
    stop: () => {
      take(mo.takeRecords())
      mo.disconnect()
      return changes
    },
  }
}

/** The rail opened (its Count shows only open), with focus given back to the page. */
async function openRail() {
  await userEvent.click(screen.getByRole('button', { name: 'Open the step rail' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close the step rail' })).toBeVisible())
  ;(document.activeElement as HTMLElement | null)?.blur()
}

/** The smallest row-like element holding `text` (22's helper). */
function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

/** KR-01 with `kinds`' Questions open in that order; 21c's keep_latest carried out on the copies one holds. */
async function openAnswers(kinds: string[]) {
  const fake = new FakeAnswers()
  const byKind = fake.byKind()
  fake.questions = kinds.map((k) => byKind[k]!)
  const base = fake.api.handle
  fake.api.handle = async (request: Request) => {
    const response = await base(request)
    const path = new URL(request.url, location.origin).pathname
    const question = fake.questions.find((q) => path.endsWith(`/questions/${q.id}/answer`))
    if (question && request.method === 'POST' && response.ok) {
      const body = (await request.clone().json()) as { option?: string }
      if (body.option === 'keep_latest') {
        const [latest, older] = question.proposals.map((id) => fake.step1.proposals.find((p) => p.id === id)!)
        const at = '2026-10-13T06:00:00.000Z'
        Object.assign(latest!, { decision: 'confirmed', decided_by: fake.step1.actor, decided_at: at })
        Object.assign(older!, { decision: 'excluded', excluded_reason: 'superseded', excluded_text: '', decided_by: fake.step1.actor, decided_at: at })
      }
    }
    return response
  }
  const app = await mountApp(PATH, { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return { ...app, fake }
}

/** Q until the card `tag` is the active one, the digit of its first option, then Enter (m0-screens 6.15). */
async function answerFirstOption(question: Question21c, tag: string) {
  for (let i = 0; i < 5 && !screen.queryByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` }); i++) await userEvent.keyboard('q')
  await screen.findByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` })
  expect(question.options[0]!.key).toBe('keep_latest')
  await userEvent.keyboard('1')
  await userEvent.keyboard('{Enter}')
}

/** KR-01 after reading (22's fake: 24 sheets, five Questions open). */
async function openKr01(api: FakeApi = new FakeApi()) {
  const step1 = new FakeStep1(api)
  const app = await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return { ...app, step1 }
}

describe('the frame agrees with the rows at every rendered state, after each act', () => {
  it('answering Q2 (pick 1, Enter): no state shows "2 / 13 settled" beside "Confirmed 0 / 24", the old rail or the old Questions number', async () => {
    const { fake } = await openAnswers(['file_misread', 'same_number'])
    await openRail()
    const before: Frame = { count: 'Confirmed 0 / 24', mark: 'Questions open', rail: '0 / 24', questions: '2' }
    const after: Frame = { count: 'Confirmed 1 / 24, 1 excluded', mark: 'Questions open', rail: '1 / 24', questions: '1' }
    await waitFor(() => expect(frameNow()).toEqual(before))
    const w = watchStates('2 / 13 settled')
    await answerFirstOption(fake.questions[1]!, 'Q2')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(bodyText()).toContain('2 / 13 settled'))
    await waitFor(() => expect(frameNow()).toEqual(after))
    w.stop()
    expect(disagreeing(w.seen, before, after), 'a state whose frame disagrees with its rows').toEqual([])
  })

  it('answering the last open Question: the rail\'s mark leaves "Questions open" and the Questions number goes in the same state as the rows', async () => {
    const { fake } = await openAnswers(['same_number'])
    await openRail()
    const before: Frame = { count: 'Confirmed 0 / 24', mark: 'Questions open', rail: '0 / 24', questions: '1' }
    const after: Frame = { count: 'Confirmed 1 / 24, 1 excluded', mark: 'Proposals ready', rail: '1 / 24', questions: '' }
    await waitFor(() => expect(frameNow()).toEqual(before))
    const w = watchStates('2 / 13 settled')
    await answerFirstOption(fake.questions[0]!, 'Q1')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(bodyText()).toContain('2 / 13 settled'))
    await waitFor(() => expect(frameNow()).toEqual(after))
    w.stop()
    expect(disagreeing(w.seen, before, after), 'a state whose frame disagrees with its rows').toEqual([])
  })

  it('confirming by Enter ("Confirm 16, leave out 1"): no state shows "11 / 13 settled" beside "Confirmed 0 / 24" or the rail\'s "0 / 24"', async () => {
    await openKr01()
    await openRail()
    const before: Frame = { count: 'Confirmed 0 / 24', mark: 'Questions open', rail: '0 / 24', questions: '5' }
    const after: Frame = { count: 'Confirmed 16 / 24, 1 excluded', mark: 'Questions open', rail: '16 / 24', questions: '5' }
    await waitFor(() => expect(frameNow()).toEqual(before))
    const w = watchStates('11 / 13 settled')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1, each with its reason.'))
    await waitFor(() => expect(frameNow()).toEqual(after))
    w.stop()
    expect(disagreeing(w.seen, before, after), 'a state whose frame disagrees with its rows').toEqual([])
  })

  it('excluding S-02 (X, then 1): no state shows "1 / 13 settled" beside "Confirmed 0 / 24" without "1 excluded"', async () => {
    await openKr01()
    await openRail()
    const before: Frame = { count: 'Confirmed 0 / 24', mark: 'Questions open', rail: '0 / 24', questions: '5' }
    const after: Frame = { count: 'Confirmed 0 / 24, 1 excluded', mark: 'Questions open', rail: '0 / 24', questions: '5' }
    await waitFor(() => expect(frameNow()).toEqual(before))
    await waitFor(() => rowOf('S-02'))
    await userEvent.click(within(rowOf('S-02')).getByText('S-02'))
    const w = watchStates('1 / 13 settled')
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toContain('Exclude S-02. Why?'))
    await userEvent.keyboard('1')
    await waitFor(() => expect(bodyText()).toContain('S-02 excluded: superseded. It stays in the count.'))
    await waitFor(() => expect(frameNow()).toEqual(after))
    w.stop()
    expect(disagreeing(w.seen, before, after), 'a state whose frame disagrees with its rows').toEqual([])
  })
})

describe('the frame keeps its counts while the session is read again', () => {
  it('a session read on the tab coming back into view never shows "Confirmed 0 / —" or loses "Confirmed 16 / 24, 1 excluded"', async () => {
    const api = new FakeApi()
    // /api/projects held open while `held` is set: the session read in flight, as a slow network has it.
    let held: { release: () => void; seen: boolean } | null = null
    let projectsAnswered = 0
    const base = api.handle
    api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      const isProjects = request.method === 'GET' && path === '/api/projects'
      const hold = held
      if (isProjects && hold) {
        hold.seen = true
        await new Promise<void>((resolve) => (hold.release = resolve))
      }
      const response = await base(request)
      if (isProjects) projectsAnswered += 1
      return response
    }
    const { queryClient } = await openKr01(api)
    await openRail()
    await userEvent.keyboard('{Enter}')
    const counted: Frame = { count: 'Confirmed 16 / 24, 1 excluded', mark: 'Questions open', rail: '16 / 24', questions: '5' }
    await waitFor(() => expect(frameNow()).toEqual(counted))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))

    const answeredBefore = projectsAnswered
    const changes = watchFrameChanges()
    held = { release: () => undefined, seen: false }
    window.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(held!.seen).toBe(true))
    expect(frameNow()).toEqual(counted)
    const gate = held
    held = null
    gate.release()
    await waitFor(() => expect(projectsAnswered).toBe(answeredBefore + 1))
    await waitFor(() => expect(queryClient.isFetching({ queryKey: ['session'] })).toBe(0))
    // Two frames drawn after the read settles: the session's new copy has been rendered.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await waitFor(() => expect(frameNow()).toEqual(counted))
    const seen = changes.stop()
    expect(seen.filter((c) => c.includes('—')), 'never "Confirmed 0 / —"').toEqual([])
    expect(seen, 'the Count, the rail and the Questions number untouched by the read').toEqual([])
  })
})
