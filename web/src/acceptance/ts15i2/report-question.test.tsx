/*
 * S15-I2's acceptance tests (#439): a held DWG's report panel names its Question and opens it.
 *
 * m0-screens §4.5, "The report panel for a DWG", Readers: after the readers' disagreement "The panel adds
 * 'Question Q1 asks what to do.' [Open the Question]". The tag is the Question's own, the one Step 1
 * shows on its card ("Question Q3"): Step 1's Questions carry it as `raised` (Q<raised>, its tag for
 * life); here every Question has one, and the held files' tags are neither Q1 nor their place in the
 * queue. "Open the Question" goes where the row's does (T-W327, ../tw327): `/p/<code>/takeoff/1?file=<id>`,
 * Step 1 on that file's own Question. It reads and changes nothing, so the MD and a Guest have it too
 * (§4.5 "MD or Guest": reports readable). A file read with readers that agree has neither. Every file
 * name and person here is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { msg } from '@/acceptance/t20b/drawings.fixture'
import { PEOPLE, mountApp, type FakeApi } from '@/app/testing'
import { FIRST_HELD, READ_NAME, SECOND_HELD, twoHeld, type HeldAnswer } from '../tw327/held.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const SET_PATH = '/p/KR-01/drawing-set'
const STEP1 = '/p/KR-01/takeoff/1'
const OPEN_THE_QUESTION = 'Open the Question'
const HELD_WORDS = 'It is held, so nothing from it reaches the sheet list while it may be misread.'
const DISAGREE = msg('engine.decoders_agree.disagree', { items: 212, only_first: 212, only_second: 0, kinds: 1, layers: 3, unread: 0 })
const AGREE = msg('drawings.reports.readers_agree')

/** KR-01 with two held DWGs, every Question tagged by `raised`, newest first: the tags are no queue's. */
function tagged(answers: { first?: HeldAnswer | null; second?: HeldAnswer | null } = {}) {
  const held = twoHeld(answers)
  const count = held.fake.questions.length
  held.fake.questions.forEach((q, i) => Object.assign(q, { raised: count - i + 2 }))
  for (const h of [held.first, held.second]) held.set.reports.set(h.file.id, { readers: [DISAGREE] })
  held.set.reports.set(held.read.id, { readers: [AGREE], sheets: [msg('drawings.reports.sheets_found', { sheets: 9, drawn: 9, layouts: 0 })] })
  const tag = (h: typeof held.first) => `Q${(h.question as unknown as { raised: number }).raised}`
  return { ...held, tag }
}

function rowOf(name: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"]')].filter((r) => clean(r.textContent).includes(name))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${name}`).toHaveLength(1)
  return inner[0]!
}

/** The report panel of `name`: the region its heading (the file's name) labels. */
function panelOf(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name: (n: string) => clean(n).includes(name) })
  const panel = heading.closest<HTMLElement>('section, [role="region"], [role="complementary"], [role="dialog"], aside')
  expect(panel, `the report panel of ${name}`).not.toBeNull()
  return panel!
}

/** Opens `name`'s report by a click on its row; its panel once its Readers are shown. */
async function report(name: string, as: string, api: FakeApi) {
  const mounted = await mountApp(SET_PATH, { as, api })
  await screen.findByRole('heading', { name: 'Drawing Set' })
  await waitFor(() => rowOf(name))
  await userEvent.click(within(rowOf(name)).getByText(name))
  await waitFor(() => expect(clean(panelOf(name).textContent)).toContain('The two readers found different contents in this file'))
  return { ...mounted, panel: panelOf(name) }
}

describe("a held DWG's report names its Question (§4.5 Readers)", () => {
  it.each([
    ['first', FIRST_HELD],
    ['second', SECOND_HELD],
  ] as const)('says "Question Qn asks what to do." with the %s held file\'s own tag, after the readers\' words', async (which, name) => {
    const held = tagged()
    const target = which === 'first' ? held.first : held.second
    const other = which === 'first' ? held.second : held.first
    const { panel } = await report(name, PEOPLE.qs, held.fake.api)

    const asks = `Question ${held.tag(target)} asks what to do.`
    await waitFor(() => expect(clean(panel.textContent)).toContain(asks))
    const text = clean(panel.textContent)
    expect(text.indexOf(HELD_WORDS), 'the readers first').toBeGreaterThanOrEqual(0)
    expect(text.indexOf(HELD_WORDS)).toBeLessThan(text.indexOf(asks))
    expect(text).not.toContain(`Question ${held.tag(other)} asks`)
  })

  it('offers "Open the Question" in the panel, a button', async () => {
    const held = tagged()
    const { panel } = await report(FIRST_HELD, PEOPLE.qs, held.fake.api)
    await waitFor(() => expect(within(panel).getByRole('button', { name: OPEN_THE_QUESTION })).toBeVisible())
  })

  it.each([
    ['MD', PEOPLE.md],
    ['Guest', PEOPLE.guest],
  ])('shows the %s the Question and "Open the Question" too: it only reads', async (_, who) => {
    const held = tagged()
    const { panel } = await report(SECOND_HELD, who, held.fake.api)
    await waitFor(() => expect(clean(panel.textContent)).toContain(`Question ${held.tag(held.second)} asks what to do.`))
    expect(within(panel).getByRole('button', { name: OPEN_THE_QUESTION })).toBeVisible()
  })

  it('names no Question in the report of a file whose readers agree', async () => {
    const held = tagged()
    await mountApp(SET_PATH, { as: PEOPLE.qs, api: held.fake.api })
    await screen.findByRole('heading', { name: 'Drawing Set' })
    await waitFor(() => rowOf(READ_NAME))
    await userEvent.click(within(rowOf(READ_NAME)).getByText(READ_NAME))
    await waitFor(() => expect(clean(panelOf(READ_NAME).textContent)).toContain('✓ Read twice, by two independent readers, and they agree.'))
    const panel = panelOf(READ_NAME)
    expect(clean(panel.textContent)).not.toMatch(/asks what to do/)
    expect(within(panel).queryByRole('button', { name: OPEN_THE_QUESTION })).toBeNull()
  })
})

describe('"Open the Question" in the panel opens that Question in Step 1', () => {
  it("is reached by Tab from the panel and Enter opens Step 1 on the file's own Question", async () => {
    const held = tagged()
    const { router, panel } = await report(SECOND_HELD, PEOPLE.qs, held.fake.api)
    await waitFor(() => within(panel).getByRole('button', { name: OPEN_THE_QUESTION }))
    const button = within(panel).getByRole('button', { name: OPEN_THE_QUESTION })

    for (let i = 0; i < 30 && document.activeElement !== button; i++) await userEvent.tab()
    expect(document.activeElement, 'Tab reaches the button').toBe(button)
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(router.state.location.pathname).toBe(STEP1))
    expect((router.state.location.search as { file?: string }).file).toBe(held.second.file.id)
    await waitFor(() => expect(document.activeElement?.getAttribute('data-row')).toBe(`q:${held.second.question.id}`))
    expect(await screen.findByRole('region', { name: (n: string) => clean(n) === `Question ${held.tag(held.second)}` })).toBeTruthy()
  })

  it('changes nothing on the way', async () => {
    const held = tagged()
    const before = held.fake.questions.map((q) => [q.id, q.status])
    const { router, panel } = await report(FIRST_HELD, PEOPLE.qs, held.fake.api)
    await userEvent.click(await within(panel).findByRole('button', { name: OPEN_THE_QUESTION }))
    await waitFor(() => expect(router.state.location.pathname).toBe(STEP1))
    expect((router.state.location.search as { file?: string }).file).toBe(held.first.file.id)
    expect(held.fake.posted).toEqual([])
    expect(held.set.seen.filter((s) => !s.call.startsWith('GET '))).toEqual([])
    expect(held.fake.questions.map((q) => [q.id, q.status])).toEqual(before)
  })
})

describe('an answered Question asks nothing', () => {
  it.each<HeldAnswer>(['await_resaved', 'sent_to_vextrus'])('does not say "asks what to do" once the Question is answered %s', async (answered) => {
    const held = tagged({ second: answered })
    const { panel } = await report(SECOND_HELD, PEOPLE.qs, held.fake.api)
    expect(clean(panel.textContent)).not.toMatch(/asks what to do/)
  })
})
