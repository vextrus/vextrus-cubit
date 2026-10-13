/*
 * S24-B2's storeys fields of "Correct the Proposal" at their edges (ts24b2 pins the promise): the field starts
 * from the storeys listed one by one (never "2nd–4th", which the server refuses as a range); a view the QS did
 * not touch is not sent; a view read at ceiling level is sent only once a meaning is chosen, and until then the
 * form stays open and says so.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

const PLAN = 'Column layout 2nd to 4th floor'
const CEILING = 'Pipe layout ZQ at 2nd floor ceiling level'

function view(id: string, kind: string, title: string, over: Record<string, unknown> = {}) {
  return {
    id: `b2400001-0000-4000-8000-${id.padStart(12, '0')}`,
    ordinal: Number(id),
    kind,
    title,
    stated_scale: '1:100',
    not_to_scale: false,
    storeys: [] as string[],
    storeys_as_stated: '',
    storeys_meaning: null as string | null,
    storeys_source: null as string | null,
    steps: [] as string[],
    part: null,
    proposed_exclusion: null,
    decision: null,
    excluded_reason: null,
    box: ['10', '10', '60', '50'],
    ...over,
  }
}

async function correcting(views: ReturnType<typeof view>[]) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  for (const p of step1.proposals) Object.assign(p, { views: [], corrected: false })
  Object.assign(step1.proposals.find((p) => p.number === 'S-06')!, { views })
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  const rows = [...document.querySelectorAll<HTMLElement>('[role="option"], [role="row"], tr')].filter((r) => clean(r.textContent).includes('S-06'))
  const row = rows.find((r) => !rows.some((o) => o !== r && r.contains(o)))!
  await userEvent.click(within(row).getByText('S-06'))
  await userEvent.keyboard('e')
  await waitFor(() => expect(bodyText()).toContain('Correct the Proposal'))
  return { step1, inspector: screen.getByRole('complementary') }
}

const fieldOf = (inspector: HTMLElement, title: string) => within(inspector).getByRole('textbox', { name: (n) => clean(n) === `Storeys of "${title}", each listed` }) as HTMLInputElement
const posts = (step1: FakeStep1) => step1.calls().filter((c) => c.startsWith('POST'))
const bodyOf = (step1: FakeStep1) => step1.seen.find((s) => s.call === 'POST /correct')?.body as Record<string, unknown> | undefined

describe('the storeys fields of E (§6.9)', () => {
  it('starts from the storeys listed one by one, a run of floors included', async () => {
    const plan = view('1', 'plan', PLAN, { storeys: ['floor_2', 'floor_3', 'floor_4'], storeys_meaning: 'floor_to_floor' })
    const { inspector } = await correcting([plan])
    expect(fieldOf(inspector, PLAN).value).toBe('2nd, 3rd, 4th')
  })

  it('sends no view the QS did not touch: a new title alone posts the title only', async () => {
    const plan = view('1', 'plan', PLAN, { storeys: ['floor_2', 'floor_3', 'floor_4'], storeys_meaning: 'floor_to_floor' })
    const { step1, inspector } = await correcting([plan])
    const title = within(inspector).getByRole('textbox', { name: 'Title' })
    await userEvent.clear(title)
    await userEvent.type(title, 'Another title')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyOf(step1)).toBeDefined())
    expect(bodyOf(step1)).not.toHaveProperty('views')
  })

  it('starts empty, with its placeholder, for a view whose storeys are not stated', async () => {
    const plan = view('1', 'plan', PLAN, { storeys: ['not_stated'] })
    const { inspector } = await correcting([plan])
    expect(fieldOf(inspector, PLAN).value).toBe('')
  })

  it('keeps the form open and says so when a view read at ceiling level has storeys typed and no meaning chosen', async () => {
    const ceiling = view('1', 'plan', CEILING, { storeys: ['floor_2'], storeys_meaning: 'at_ceiling_level' })
    const { step1, inspector } = await correcting([ceiling])
    const field = fieldOf(inspector, CEILING)
    await userEvent.click(field)
    await userEvent.clear(field)
    await userEvent.type(field, '3rd')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Choose what the storeys mean, then save.'))
    expect(bodyText()).toContain('Correct the Proposal')
    expect(posts(step1)).toEqual([])

    await userEvent.click(within(inspector).getByRole('radio', { name: 'floor to floor' }))
    await waitFor(() => expect(bodyText()).not.toContain('Choose what the storeys mean, then save.'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyOf(step1)).toMatchObject({ views: [{ view: ceiling.id, storeys: '3rd', meaning: 'floor_to_floor' }] }))
  })

  it('does not choose a meaning by tabbing through the toggle', async () => {
    const ceiling = view('1', 'plan', CEILING, { storeys: ['floor_2'], storeys_meaning: 'at_ceiling_level' })
    const { inspector } = await correcting([ceiling])
    await userEvent.click(fieldOf(inspector, CEILING))
    await userEvent.tab()
    expect(within(inspector).getAllByRole('radio').map((r) => (r as HTMLInputElement).checked)).toEqual([false, false])
  })

  it('says a storeys refusal under the view it is about, not under Number, and retyping the storeys clears it', async () => {
    const plan = view('1', 'plan', PLAN, { storeys: ['floor_2', 'floor_3', 'floor_4'], storeys_meaning: 'floor_to_floor' })
    const other = view('2', 'plan', 'Beam layout 5th floor', { storeys: ['floor_5'], storeys_meaning: 'floor_to_floor' })
    const { step1, inspector } = await correcting([plan, other])
    const field = fieldOf(inspector, 'Beam layout 5th floor')
    await userEvent.clear(field)
    await userEvent.type(field, 'kitchen')
    step1.answerOnce('POST /correct', 400, { code: 'drawings.sheets.storeys_not_a_storey', params: { word: 'kitchen', view_id: other.id, view_title: other.title } })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fieldOf(inspector, 'Beam layout 5th floor')).toHaveAttribute('aria-invalid', 'true'))
    expect(within(inspector).getByRole('textbox', { name: 'Number' })).not.toHaveAttribute('aria-invalid')
    expect(fieldOf(inspector, PLAN)).not.toHaveAttribute('aria-invalid')

    await userEvent.type(fieldOf(inspector, 'Beam layout 5th floor'), 's')
    await waitFor(() => expect(fieldOf(inspector, 'Beam layout 5th floor')).not.toHaveAttribute('aria-invalid'))
  })

  it('sends no storeys the QS never touched after the sheet is reloaded under the open form', async () => {
    // Review of #777: the draft was frozen at open but compared with the reloaded sheet, so another person's
    // storeys (or a reload) made an untouched view look changed.
    const plan = view('1', 'plan', PLAN, { storeys: ['floor_2', 'floor_3', 'floor_4'], storeys_meaning: 'floor_to_floor' })
    const { step1, inspector } = await correcting([plan])
    const stored = step1.proposals.find((p) => p.number === 'S-06') as unknown as { views: { storeys: string[] }[] }
    stored.views[0]!.storeys = ['floor_9'] // another person's correction, landing with the next reload
    step1.answerOnce('POST /correct', 409, { code: 'takeoff.step1.corrected_since', params: { field: 'title', value: 'THEIR TITLE', has: 'yes', sheet: 'S-06', named: 'number', moved: 'no', now: 'S-06' } })
    const title = within(inspector).getByRole('textbox', { name: 'Title' })
    await userEvent.clear(title)
    await userEvent.type(title, 'My title')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(within(inspector).getByRole('textbox', { name: 'Title' })).toHaveAttribute('aria-invalid', 'true'))
    await waitFor(() => expect(step1.calls().filter((c) => c === 'GET /proposals').length).toBeGreaterThan(1))
    // The request is not the reload: an Enter before Step 1 has reloaded is dropped by design (acts.tsx), so wait for it to land.
    await waitFor(() => expect(document.querySelector('[data-step1]')).toHaveAttribute('aria-busy', 'false'))

    await userEvent.type(within(inspector).getByRole('textbox', { name: 'Title' }), '!')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(step1.seen.filter((x) => x.call === 'POST /correct').length).toBe(2))
    const second = step1.seen.filter((x) => x.call === 'POST /correct')[1]!.body as Record<string, unknown>
    expect(second).not.toHaveProperty('views')
  })

  it('names an untitled plan by its place among the sheet’s plans in its label, legend, toast and refusal, never an empty quote (review 2 of #780)', async () => {
    const first = view('1', 'plan', '', { storeys: ['floor_2'], storeys_meaning: 'floor_to_floor' })
    const legend = view('2', 'legend', 'LEGEND')
    const second = view('3', 'plan', '', { storeys: ['floor_4'], storeys_meaning: 'floor_to_floor' })
    const titled = view('4', 'plan', PLAN, { storeys: ['floor_5'], storeys_meaning: 'floor_to_floor' })
    const { step1, inspector } = await correcting([first, legend, second, titled])
    const labelled = (name: string) => within(inspector).getByRole('textbox', { name: (n) => clean(n) === name }) as HTMLInputElement
    expect(labelled('Storeys of plan view 1 (untitled), each listed').value).toBe('2nd')
    expect(labelled('Storeys of plan view 2 (untitled), each listed').value).toBe('4th')
    expect(fieldOf(inspector, PLAN).value).toBe('5th')
    const groups = within(inspector).getAllByRole('group').map((g) => clean(g.querySelector('legend')?.textContent))
    expect(groups).toEqual(expect.arrayContaining(['What the storeys of plan view 1 (untitled) mean', 'What the storeys of plan view 2 (untitled) mean']))
    expect(bodyText()).not.toContain('""')

    const field = labelled('Storeys of plan view 2 (untitled), each listed')
    await userEvent.clear(field)
    await userEvent.type(field, '6th')
    step1.answerOnce('POST /correct', 409, { code: 'takeoff.step1.storeys_corrected_since', params: { view: '', view_id: second.id, titled: 'no', place: 2, sheet: 'S-06', named: 'number', moved: 'no', now: 'S-06' } })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('The storeys of plan view 2 (untitled) are no longer what the form showed.'))
    // The refusal shows before Step 1 has reloaded, and an Enter during the reload is dropped by design (acts.tsx).
    await waitFor(() => expect(document.querySelector('[data-step1]')).toHaveAttribute('aria-busy', 'false'))

    step1.answerOnce('POST /correct', 200, { confirmation_id: '01a10000-0000-7000-8000-00000000c0e3', act: 'correct', sheets: 1, by: step1.actor, at: '2026-09-28T06:00:00Z' })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Corrected S-06: storeys of plan view 2 (untitled). Still a Proposal until confirmed.'))
    expect(bodyText()).not.toContain('""')
  })
})
