/*
 * T-W327's acceptance tests (#327, G1 walk item FL4): a held file's row on the Drawing Set gets "Open the
 * Question", and it lands on that file's Question in Step 1.
 *
 * m0-screens §4.5's "Actions on the row" column: "Held" and the three "Held, answered" rows give
 * "Open the Question" (`docs/design/m0-screens.md` §4.5). The ticket's seams: the act is on all four held
 * rows and for every role (it reads, it changes nothing); it goes to `/p/<code>/takeoff/1?file=<file id>`;
 * Step 1 opens there in list mode with the file's open `file_misread` Question's row (`q:<id>`) focused,
 * or, once that Question is answered, with the file's report in the inspector (its heading focused);
 * any other id opens Step 1 as with no `file`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeDrawingSet, file, msg, type FileOut } from '@/acceptance/t20b/drawings.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FIRST_HELD, READ_NAME, SECOND_HELD, twoHeld, type HeldAnswer } from './held.fixture'

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
const SET_PATH = '/p/KR-01/drawing-set'
const STEP1 = '/p/KR-01/takeoff/1'
const OPEN_THE_QUESTION = 'Open the Question'
const CHANGING = ['Cancel reading', 'Read again', 'Try again']

/** The table row that holds `name` (the smallest row-like element with it). */
function rowOf(name: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"]')].filter((r) => clean(r.textContent).includes(name))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${name}`).toHaveLength(1)
  return inner[0]!
}

async function row(name: string): Promise<HTMLElement> {
  await waitFor(() => rowOf(name))
  return rowOf(name)
}

const buttonNames = (r: HTMLElement) => within(r).queryAllByRole('button').map((b) => clean(b.textContent)).sort()

/** Step 1 drawn (22's header count). */
async function step1Drawn() {
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed 0 \/ \d+/))
}

const activeRowKey = () => document.activeElement?.getAttribute('data-row') ?? null

/** The Question cards shown (the inspector's Selection and any other), visible ones only. */
const shownCards = () => [...document.querySelectorAll<HTMLElement>('section[data-question]')].filter((c) => c.getBoundingClientRect().height > 0)

describe('the acts of every state (§4.5 "Actions on the row"; the class check)', () => {
  const states: [string, Partial<FileOut> & Pick<FileOut, 'state' | 'status'>, string[]][] = [
    ['waiting', { state: 'waiting', status: msg('drawings.files.waiting', { ahead: 1 }) }, ['Cancel reading']],
    ['reading', { state: 'reading', status: msg('drawings.files.reading_sheet', { position: 4, total: 19 }) }, ['Cancel reading']],
    ['retrying', { state: 'retrying', status: msg('drawings.files.retrying', { attempt: 2, tries: 3 }) }, ['Cancel reading']],
    ['cancelled', { state: 'cancelled', status: msg('drawings.files.cancelled_unnamed') }, ['Read again']],
    ['failed', { state: 'failed', status: msg('drawings.files.failed', { tries: 2 }) }, ['Try again']],
    ['read (a DWG)', { state: 'read', status: msg('drawings.files.read'), sheets_found: 6 }, ['Open in Step 1']],
    ['read (a PDF)', { name: 'KR-GAS-R0.pdf', state: 'read', status: msg('drawings.files.plot_matched', { matched: 3, pages: 4 }) }, []],
    ['stopping', { state: 'stopping', status: msg('drawings.files.stopping') }, []],
    ['refused', { name: 'KR-GAS-scan.pdf', state: 'refused', status: msg('drawings.files.refused_scan') }, []],
    ['unreadable', { state: 'unreadable', status: msg('drawings.files.old_version') }, []],
    ['held', { state: 'held', status: msg('drawings.files.held') }, [OPEN_THE_QUESTION]],
    ['held, read anyway', { state: 'held', status: msg('drawings.files.held_read_anyway'), sheets_found: 5 }, [OPEN_THE_QUESTION]],
    ['held, set aside to be re-saved', { state: 'held', status: msg('drawings.files.await_resaved') }, [OPEN_THE_QUESTION]],
    ['held, sent to Vextrus', { state: 'held', status: msg('drawings.files.sent_to_vextrus') }, [OPEN_THE_QUESTION]],
  ]

  async function shown(over: Partial<FileOut> & Pick<FileOut, 'state' | 'status'>, as: string) {
    const api = new FakeApi()
    const set = new FakeDrawingSet(api, 'KR-01')
    const name = over.name ?? 'KR-GAS-R0.dwg'
    set.files.push(file({ ...over, name }))
    await mountApp(SET_PATH, { as, api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    return row(name)
  }

  it.each(states)('offers a QS on a file %s exactly its §4.5 acts', async (_, over, acts) => {
    const r = await shown(over, PEOPLE.qs)
    await waitFor(() => expect(buttonNames(r)).toEqual([...acts].sort()))
  })

  it.each(
    states.flatMap(([state, over, acts]) => [
      ['MD', state, over, acts] as const,
      ['Guest', state, over, acts] as const,
    ]),
  )('offers the %s on a file %s only the acts that read', async (who, _, over, acts) => {
    const r = await shown(over, who === 'MD' ? PEOPLE.md : PEOPLE.guest)
    const reading = acts.filter((a) => !CHANGING.includes(a))
    await waitFor(() => expect(buttonNames(r)).toEqual([...reading].sort()))
    for (const act of CHANGING) expect(within(r).queryByRole('button', { name: act })).toBeNull()
  })
})

describe('"Open the Question" by keyboard (§8: keys and focus)', () => {
  it('is reached by Tab after the held row and its Discipline select, names the file, and Enter goes to its Question', async () => {
    const { fake, set, first } = twoHeld({ heldFirst: true })
    set.files = [first.file, set.files.find((f) => f.name === READ_NAME)!]
    const { router } = await mountApp(SET_PATH, { as: PEOPLE.qs, api: fake.api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    const held = await row(FIRST_HELD)

    screen.getByRole('button', { name: 'Add files' }).focus()
    for (let i = 0; i < 40 && document.activeElement !== held; i++) await userEvent.tab()
    expect(document.activeElement, 'Tab reaches the held row').toBe(held)
    await userEvent.tab()
    expect(document.activeElement?.getAttribute('role') === 'combobox' || document.activeElement instanceof HTMLSelectElement, 'then its Discipline select').toBe(true)
    expect(held.contains(document.activeElement)).toBe(true)
    await userEvent.tab()
    const button = document.activeElement as HTMLElement
    expect(held.contains(button)).toBe(true)
    expect(button.getAttribute('role') ?? button.tagName.toLowerCase()).toBe('button')
    expect(clean(button.textContent)).toBe(OPEN_THE_QUESTION)
    const described = (button.getAttribute('aria-describedby') ?? '').split(/\s+/).map((id) => document.getElementById(id))
    expect(described.some((el) => !!el && clean(el.textContent).includes(FIRST_HELD)), 'its description is the file').toBe(true)

    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe(STEP1))
    expect((router.state.location.search as { file?: string }).file).toBe(first.file.id)
    // The button's Enter is the button's: the Drawing Set's report never opened on the way.
    expect(set.seen.map((s) => s.call)).not.toContain(`GET /files/${first.file.id}/report`)
  })
})

describe("it lands on that file's Question (§4.5 → §6.6)", () => {
  it.each([
    ['second', SECOND_HELD, FIRST_HELD],
    ['first', FIRST_HELD, SECOND_HELD],
  ] as const)("opens Step 1 on the %s held file's own Question, focused, its card shown", async (which, name, other) => {
    const held = twoHeld()
    const target = which === 'second' ? held.second : held.first
    const { router } = await mountApp(SET_PATH, { as: PEOPLE.qs, api: held.fake.api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await userEvent.click(within(await row(name)).getByRole('button', { name: OPEN_THE_QUESTION }))

    await waitFor(() => expect(router.state.location.pathname).toBe(STEP1))
    expect((router.state.location.search as { file?: string }).file).toBe(target.file.id)
    await step1Drawn()
    await waitFor(() => expect(activeRowKey()).toBe(`q:${target.question.id}`))
    await waitFor(() => {
      const cards = shownCards()
      expect(cards.length, 'a Question card is shown').toBeGreaterThan(0)
      for (const card of cards) expect(card.getAttribute('data-question')).toBe(target.question.id)
      expect(clean(cards[0]!.textContent)).toContain(`${name} may be misread`)
      expect(clean(cards[0]!.textContent)).not.toContain(`${other} may be misread`)
    })
  })
})

describe("an answered Question opens the file's report (§6.6's Selection)", () => {
  it.each<HeldAnswer>(['read_anyway', 'await_resaved', 'sent_to_vextrus'])(
    "opens Step 1 with the held file's report, its heading focused, when its Question is answered %s",
    async (answered) => {
      const { fake } = twoHeld({ second: answered })
      const before = fake.questions.map((q) => [q.id, q.status])
      const { router } = await mountApp(SET_PATH, { as: PEOPLE.qs, api: fake.api })
      await screen.findByRole('heading', { name: 'Drawing Set' })
      await userEvent.click(within(await row(SECOND_HELD)).getByRole('button', { name: OPEN_THE_QUESTION }))

      await waitFor(() => expect(router.state.location.pathname).toBe(STEP1))
      await step1Drawn()
      const heading = await screen.findByRole('heading', { level: 2, name: (n: string) => clean(n).includes(SECOND_HELD) })
      await waitFor(() => expect(document.activeElement).toBe(heading))
      expect(fake.posted).toEqual([])
      expect(fake.questions.map((q) => [q.id, q.status])).toEqual(before)
    },
  )
})

describe('an address that names nothing is not an error', () => {
  async function at(search: (h: ReturnType<typeof twoHeld>) => string) {
    const held = twoHeld()
    await mountApp(`${STEP1}?file=${search(held)}`, { as: PEOPLE.qs, api: held.fake.api })
    await step1Drawn()
    return held
  }

  function asWithNoFile() {
    expect(document.querySelector('[role="alert"]'), 'no error bar').toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: (n: string) => [FIRST_HELD, SECOND_HELD, READ_NAME].some((f) => clean(n).includes(f)) })).toBeNull()
    expect(activeRowKey(), 'no row focused').toBeNull()
    const toasts = [...document.querySelectorAll('[role="status"]')].map((s) => clean(s.textContent)).join('')
    expect(toasts, 'no toast').toBe('')
  }

  it('opens Step 1 as with no file for an id no file has', async () => {
    await at(() => '00000000-0000-4000-8000-00000000dead')
    asWithNoFile()
  })

  it('opens Step 1 as with no file for a read file, which has no Question', async () => {
    await at((h) => h.read.id)
    asWithNoFile()
  })
})
