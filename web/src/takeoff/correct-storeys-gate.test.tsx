/*
 * The design gate of #811 on S24-B2's correction form and the Step 1 list (each fails without its fix): a
 * refusal of no field is said above Save with no field marked; the storeys' meaning is the shared two-choice
 * toggle (Segmented), its targets at least 24 px; and a Question row holding several sheets names each number.
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
const PLAN = 'Beam layout 3rd, 5th and 7th floor'

function plan() {
  return {
    id: 'b2400001-0000-4000-8000-000000000001',
    ordinal: 1,
    kind: 'plan',
    title: PLAN,
    stated_scale: '1:100',
    not_to_scale: false,
    storeys: ['floor_3', 'floor_5', 'floor_7'],
    storeys_as_stated: '',
    storeys_meaning: 'at_floor_level',
    storeys_source: null,
    steps: [] as string[],
    part: null,
    proposed_exclusion: null,
    decision: null,
    excluded_reason: null,
    box: ['10', '10', '60', '50'],
  }
}

function rowOf(number: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(number))
  return rows.find((r) => !rows.some((o) => o !== r && r.contains(o)))!
}

async function step1Screen(arrange: (step1: FakeStep1) => void = () => {}) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  for (const p of step1.proposals) Object.assign(p, { views: [], corrected: false })
  Object.assign(step1.proposals.find((p) => p.number === 'S-06')!, { views: [plan()] })
  arrange(step1)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return step1
}

async function correctingS06() {
  const step1 = await step1Screen()
  await userEvent.click(within(rowOf('S-06')).getByText('S-06'))
  await userEvent.keyboard('e')
  await waitFor(() => expect(bodyText()).toContain('Correct the Proposal'))
  return { step1, inspector: screen.getByRole('complementary') }
}

describe('the correction form after the design gate of #811', () => {
  it('says a refusal of no field above Save, with no field marked invalid', async () => {
    const { step1, inspector } = await correctingS06()
    step1.answerOnce('POST /correct', 400, { code: 'takeoff.step1.nothing_to_correct', params: {} })
    const number = within(inspector).getByRole('textbox', { name: 'Number' })
    await userEvent.clear(number)
    await userEvent.type(number, 'S-61')
    await userEvent.keyboard('{Enter}')

    const said = await waitFor(() => {
      const found = inspector.querySelector<HTMLElement>('[data-form-error]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(clean(said.textContent)).not.toBe('')
    expect(inspector.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0)
    const save = within(inspector).getByRole('button', { name: /^Save\b/ })
    expect(said.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('says above Save a 409 about a view the sheet no longer has (read again since)', async () => {
    const { step1, inspector } = await correctingS06()
    step1.answerOnce('POST /correct', 409, { code: 'takeoff.step1.storeys_corrected_since', params: { view: PLAN, view_id: 'b2400001-0000-4000-8000-0000000000ff', titled: 'yes', place: 1, sheet: 'S-06', named: 'number', moved: 'no', now: 'S-06' } })
    await userEvent.click(within(inspector).getByRole('radio', { name: 'floor to floor' }))
    await userEvent.keyboard('{Enter}')

    const said = await waitFor(() => {
      const found = inspector.querySelector<HTMLElement>('[data-form-error]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(clean(said.textContent)).toContain('To see them, cancel the correction and open it again with E.')
    expect(inspector.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0)
  })

  it('offers the meaning as the shared two-choice toggle, each target at least 24 px', async () => {
    const { inspector } = await correctingS06()
    const [group, ...more] = within(inspector).getAllByRole('radiogroup')
    expect(more).toHaveLength(0)
    expect(clean(group!.getAttribute('aria-label'))).toBe(`What the storeys of "${PLAN}" mean`)
    const choices = within(group!).getAllByRole('radio')
    expect(choices.map((c) => clean(c.textContent))).toEqual(['at floor level', 'floor to floor'])
    expect(choices.map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    for (const c of choices) {
      expect(c.tagName).toBe('BUTTON') // the toggle's segment, never a native 13 px radio
      const box = c.getBoundingClientRect()
      expect(box.height).toBeGreaterThanOrEqual(24)
      expect(box.width).toBeGreaterThanOrEqual(24)
    }
  })

  it('saves with Enter from the toggle, as from any field', async () => {
    const { step1, inspector } = await correctingS06()
    await userEvent.click(within(inspector).getByRole('radio', { name: 'floor to floor' }))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.seen.find((s) => s.call === 'POST /correct')?.body).toMatchObject({ views: [{ meaning: 'floor_to_floor' }] }))
  })
})

describe('a Question row holding several sheets', () => {
  it('names each sheet by its number, never the first number alone beside "2 sheets"', async () => {
    await step1Screen((step1) => {
      const held = ['S-04', 'S-06'].map((n) => step1.proposals.find((p) => p.number === n)!)
      step1.questions.push({
        id: 'c2200000-0000-4000-8000-0000000000aa',
        kind: 'conflict',
        status: 'open',
        code: 'engine.conflicts.same_storey',
        params: { sheets: 2 },
        options: [{ key: 'keep_open', picked: false }],
        discipline: 'structural',
        subject_id: held[0]!.sheet_id,
        check_code: null,
        answer: null,
        answered_at: null,
        proposals: held.map((p) => p.id),
      } as unknown as (typeof step1.questions)[number])
    })
    const row = rowOf('S-04')
    const cells = within(row).getAllByRole('gridcell').map((c) => clean(c.textContent))
    expect(cells[1]).toBe('S-04, S-06')
  })
})
