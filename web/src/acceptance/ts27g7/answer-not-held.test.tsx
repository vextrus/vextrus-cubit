/*
 * S27-G7 (#319): after Enter on a Question card, the Questions count and list change once the answer's
 * POST has returned, without waiting for the full Proposals list (or Step 1's other reads) to be fetched
 * again. Session 26's G1 walk (M0-FL8 f-6) measured 2.7-4.2 s from Enter to the Questions count on 218
 * sheets: the answer's POST (about 740 ms), then the Proposals list (643 KB) and ten other reads fetched
 * again, while D7's snapshot (`useSettled`) held the whole frame until the slowest of them landed.
 *
 * D7's pins (../ts26d7) stand: the toolbar's Count, the step rail's mark and Count and the Questions tab's
 * number agree with each other and with the rows in every rendered state. These tests answer a Question
 * that decides no sheet (a drawing-list check, "not sent yet"), so nothing but the Questions changes and
 * the toolbar's and rail's "Confirmed 0 / 24" stay. Every DOM state is recorded with a MutationObserver.
 * Whether Step 1 is read again after the answer, and when, is the builder's: any GET of the held reads made
 * after the answer is held open, and none needs to be made.
 *
 * Not pinned here: an answer that confirms or excludes sheets (keep the latest copy, keep all, a kind).
 * Its Count can move only with the rows (D7), and the rows can move before the Proposals list is fetched
 * again only from something the answer's reply carries, which no contract names yet.
 *
 * The fakes are 22's (../t22/step1.fixture.ts) and 156's (../t156/answer.fixture.ts), unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '../t156/answer.fixture'

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

/** What the frame shows of Step 1 (D7's reading), and the open Question cards in the Questions tab. */
interface Frame {
  count: string
  mark: string
  rail: string
  questions: string
  /** The open Question cards (each a region "Question Qn"), by whether each names S-13. */
  cards: number
  s13: boolean
}

function frameNow(): Frame {
  const toolbar = clean(document.querySelector('[role="toolbar"][aria-label="The step\'s tools"]')?.textContent)
  const step1 = document.querySelector('nav[aria-label="Takeoff Steps"] a[aria-current="page"]')
  const tab = [...document.querySelectorAll('[role="tab"]')].map((t) => clean(t.textContent)).find((t) => t.startsWith('Questions'))
  const cards = screen.queryAllByRole('region', { name: (n: string) => /^Question Q\d+$/.test(clean(n)) })
  return {
    count: /Confirmed \d{1,3}(?:,\d{3})* \/ (?:\d{1,3}(?:,\d{3})*|—)(?:, \d{1,3}(?:,\d{3})* excluded)?/.exec(toolbar)?.[0] ?? '(no Count)',
    mark: step1?.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '(no mark)',
    rail: /(\d{1,3}(?:,\d{3})* \/ (?:\d{1,3}(?:,\d{3})*|—))$/.exec(clean(step1?.textContent))?.[1] ?? '(no rail Count)',
    questions: tab === undefined ? '(no tab)' : tab.replace(/^Questions/, '').trim(),
    cards: cards.length,
    s13: cards.some((c) => clean(c.textContent).includes('S-13')),
  }
}

/** Every DOM state from now until `stop`. */
function watchStates() {
  const seen: Frame[] = []
  const look = () => seen.push(frameNow())
  const mo = new MutationObserver(look)
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] })
  look()
  return {
    seen,
    stop: () => {
      look()
      mo.disconnect()
      return [...new Set(seen.map((s) => JSON.stringify(s)))].map((s) => JSON.parse(s) as Frame)
    },
  }
}

/** The rail opened (its Count shows only open), with focus given back to the page. */
async function openRail() {
  await userEvent.click(screen.getByRole('button', { name: 'Open the step rail' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close the step rail' })).toBeVisible())
  ;(document.activeElement as HTMLElement | null)?.blur()
}

/** A GET under Step 1 held open from `arm` until `release`: a slow network's refetch still in flight. */
interface Hold {
  arm: () => void
  release: () => void
  /** Each held GET's path that reached the fake. */
  seen: string[]
  /** Each held GET answered. */
  answered: string[]
}

/**
 * KR-01 with the S-07 copies as Q1 and a drawing-list check (S-13 named on the list, in no file) as Q2.
 * `parts`: Step 1's reads (`proposals`, `coverage`, `progress`) whose GETs the hold keeps open once armed.
 */
async function openWithHold(parts: readonly string[]) {
  const fake = new FakeAnswers()
  const byKind = fake.byKind()
  fake.questions = [byKind.check!, byKind.same_number!]
  let gate: Promise<void> | null = null
  let open = () => undefined as void
  const hold: Hold = {
    arm: () => {
      gate = new Promise<void>((resolve) => (open = resolve))
    },
    release: () => {
      gate = null
      open()
    },
    seen: [],
    answered: [],
  }
  const held = new RegExp(`^/api/projects/${fake.step1.projectId}/takeoff/step1/(${parts.join('|')})/?$`)
  const base = fake.api.handle
  fake.api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    const isHeld = request.method === 'GET' && held.test(path)
    const waitFor = gate
    if (isHeld && waitFor) {
      hold.seen.push(path)
      await waitFor
    }
    const response = await base(request)
    if (isHeld && waitFor) hold.answered.push(path)
    return response
  }
  const app = await mountApp(PATH, { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return { ...app, fake, hold }
}

/** The inspector's Questions tab, where every open Question's card is listed, with focus given back to the page. */
async function openQuestionsTab() {
  await userEvent.click(screen.getByRole('tab', { name: (n: string) => clean(n).startsWith('Questions') }))
  await waitFor(() => expect(screen.getByRole('tab', { name: (n: string) => clean(n).startsWith('Questions') })).toHaveAttribute('aria-selected', 'true'))
  ;(document.activeElement as HTMLElement | null)?.blur()
}

/** Q until the card `tag` is the active one, the one the Selection tab shows (m0-screens 6.15). */
async function goToCard(tag: string) {
  for (let i = 0; i < 5 && !screen.queryByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` }); i++) await userEvent.keyboard('q')
  await screen.findByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` })
}

/** The digit of the active card's first option ("not sent yet"), then Enter (m0-screens 6.15). */
async function answerNotSentYet(option: string) {
  expect(option).toBe('not_sent_yet')
  await userEvent.keyboard('1')
  await userEvent.keyboard('{Enter}')
}

const BEFORE: Frame = { count: 'Confirmed 0 / 24', mark: 'Questions open', rail: '0 / 24', questions: '2', cards: 2, s13: true }
const AFTER: Frame = { count: 'Confirmed 0 / 24', mark: 'Questions open', rail: '0 / 24', questions: '1', cards: 1, s13: false }

/** Answers S-13's check (Q2) with the GETs of `parts` held; returns once the frame shows the answer, the hold still open. */
async function answerHeld(parts: readonly string[]) {
  const app = await openWithHold(parts)
  const { fake, hold, queryClient } = app
  await openRail()
  await goToCard('Q2')
  await openQuestionsTab()
  await waitFor(() => expect(frameNow()).toEqual(BEFORE))
  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  hold.arm()
  const w = watchStates()
  await answerNotSentYet(fake.questions[0]!.options[0]!.key)
  await waitFor(() => expect(fake.posted).toHaveLength(1))
  await waitFor(() => expect(frameNow(), 'the Questions number and cards once the answer POST returned, with the refetch held').toEqual(AFTER))
  expect(hold.answered, 'no held GET answered yet').toEqual([])
  return { ...app, w }
}

describe('the Questions count and list change once the answer is back, not once Step 1 is read again', () => {
  it('answering S-13\'s check ("not sent yet") with the Proposals list\'s GET held: the Questions number reads 1 and S-13\'s card is gone', async () => {
    const { w } = await answerHeld(['proposals'])
    const states = w.stop()
    expect(states.filter((s) => s.count !== 'Confirmed 0 / 24' || s.rail !== '0 / 24'), 'a state whose toolbar or rail Count moved').toEqual([])
    expect(states.filter((s) => String(s.cards) !== s.questions), 'a state whose Questions number disagrees with its open cards').toEqual([])
  })

  it('with the Proposals list\'s, Coverage\'s and progress\'s GETs all held: the Questions number still reads 1 and S-13\'s card is gone', async () => {
    const { w } = await answerHeld(['proposals', 'coverage', 'progress'])
    const states = w.stop()
    expect(states.filter((s) => s.count !== 'Confirmed 0 / 24' || s.rail !== '0 / 24'), 'a state whose toolbar or rail Count moved').toEqual([])
    expect(states.filter((s) => String(s.cards) !== s.questions), 'a state whose Questions number disagrees with its open cards').toEqual([])
  })

  it('when the held Proposals list finally lands, no state shows "2" Questions or S-13\'s card again', async () => {
    const { w, hold, queryClient } = await answerHeld(['proposals'])
    w.stop()
    const after = watchStates()
    hold.release()
    // Every GET held (if the answer asked for any) is answered now, and Step 1 has nothing more in flight.
    await waitFor(() => expect(hold.answered).toHaveLength(hold.seen.length))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    // Two frames drawn after the reads settle: the last copy has been rendered.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await waitFor(() => expect(frameNow()).toEqual(AFTER))
    const states = after.stop()
    expect(states.filter((s) => s.questions !== '1' || s.s13 || s.cards !== 1), 'a state showing the answered Question again').toEqual([])
    expect(states.filter((s) => s.count !== 'Confirmed 0 / 24' || s.rail !== '0 / 24'), 'a state whose toolbar or rail Count moved').toEqual([])
  })
})
