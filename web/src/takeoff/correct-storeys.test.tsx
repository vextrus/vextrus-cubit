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
})
