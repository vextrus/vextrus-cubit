/*
 * S24-B2 (issue #677, M0-FL8): E corrects a plan view's storeys and their meaning, on t22's KR-01 fake (every title
 * invented). docs/design/m0-screens.md §6.9 "Corrections (`E`)": "Correct the Proposal" opens in the inspector in place
 * of the Proposal block: Number, Title, and for each plan view "Storeys of "<view title>", each listed" (placeholder
 * "3rd, 5th, 7th") with its meaning as a two-choice toggle, "at floor level" | "floor to floor" (a view read "at
 * ceiling level" shows that meaning as read beside the toggle, and the toggle does not offer it: a correction picks
 * one of the two); "Save ↵" and "Cancel Esc". Toast "Corrected S-18: storeys of "3rd, 5th & 7th floor beam layout".
 * Still a Proposal until confirmed."; the State column adds ", corrected". "Undo (`Ctrl Z`): undoes the last act (…
 * a correction …); the toast names what it undid (5)" (§5: "Undone: confirmed 20 sheets"). §8 item 8: "A two-choice
 * toggle per plan view in the correction form". §6.12: the MD and a Guest change nothing.
 *
 * Built on S22-FL8's Correct act (PR #706: `POST …/takeoff/step1/correct`, `{ proposal, number?, title? }`, a
 * corrected Proposal's `corrected: true`). Named by the acceptance writer (the builder meets them): the body also
 * carries `views: [{ view, storeys, meaning }]`, the storeys as typed and the meaning's key (`at_floor_level` or
 * `floor_to_floor`). The toggle is two radios or two pressed/unpressed buttons, each named by its words.
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

/** Text as the eye reads it: bidi marks dropped, white space folded, curly quotes as straight ones. */
const clean = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[⁦-⁩‎‏]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'

const PLAN_TITLE = '3rd, 5th & 7th floor beam layout'
const CEILING_TITLE = 'Pipe layout ZQ at 2nd floor ceiling level'
const FIELD = `Storeys of "${PLAN_TITLE}", each listed`
const TYPED = '2nd, 4th, 6th'

let serial = 0
function view(kind: string, title: string, over: Record<string, unknown> = {}) {
  serial += 1
  return {
    id: `b2400000-0000-4000-8000-${String(serial).padStart(12, '0')}`,
    ordinal: serial,
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

type View = ReturnType<typeof view>

/**
 * KR-01 with S-06's one plan read "3rd, 5th, 7th" at floor level beside a section, and S-11's plan read at ceiling
 * level. Its fake server answers `POST /correct` as the API does (the views take the typed storeys, the sheet is
 * marked corrected) and `POST /undo` puts the last correction back.
 */
function kr01() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const s06 = step1.proposals.find((p) => p.number === 'S-06')!
  const s11 = step1.proposals.find((p) => p.number === 'S-11')!
  const plan = view('plan', PLAN_TITLE, { storeys: ['floor_3', 'floor_5', 'floor_7'], storeys_as_stated: '3RD, 5TH & 7TH FLOOR', storeys_meaning: 'at_floor_level', steps: ['beams'] })
  const section = view('section', 'Section ZQ-6', { box: ['70', '10', '90', '30'], steps: ['beams'] })
  const ceiling = view('plan', CEILING_TITLE, { storeys: ['floor_2'], storeys_as_stated: '2ND FLOOR', storeys_meaning: 'at_ceiling_level' })
  Object.assign(s06, { views: [plan, section], corrected: false })
  Object.assign(s11, { views: [ceiling], corrected: false })
  for (const p of step1.proposals) if (!('views' in p)) Object.assign(p, { views: [], corrected: false })
  const undoable: { proposal: Record<string, unknown>; views: { view: View; before: View }[] }[] = []
  const act = (name: string) => ({ confirmation_id: `b2400000-0000-4000-8000-${String((serial += 1)).padStart(12, '0')}`, act: name, sheets: 1, by: step1.actor, at: '2026-09-28T06:00:00Z' })
  const push = step1.seen.push.bind(step1.seen)
  step1.seen.push = (...items) => {
    for (const { call, body } of items) {
      if (call === 'POST /correct') {
        const asked = body as { proposal: string; views?: { view: string; storeys: string; meaning: string }[] }
        const p = step1.proposals.find((x) => x.id === asked.proposal) as unknown as Record<string, unknown> & { views: View[] }
        if (!p) continue
        const changed: { view: View; before: View }[] = []
        for (const v of asked.views ?? []) {
          const target = p.views.find((x) => x.id === v.view)
          if (!target) continue
          changed.push({ view: target, before: { ...target } })
          const keys = v.storeys.split(',').map((s) => `floor_${parseInt(s, 10)}`)
          Object.assign(target, { storeys: keys, storeys_meaning: v.meaning, storeys_source: 'typed' })
        }
        Object.assign(p, { corrected: true })
        undoable.push({ proposal: p, views: changed })
        step1.answerOnce('POST /correct', 200, act('correct'))
      }
      if (call === 'POST /undo') {
        const last = undoable.pop()
        if (!last) continue
        for (const { view: v, before } of last.views) Object.assign(v, before)
        Object.assign(last.proposal, { corrected: false })
        step1.answerOnce('POST /undo', 200, act('correct'))
      }
    }
    return push(...items)
  }
  return { api, step1, s06, plan, section }
}

async function open(api: FakeApi, as: string = PEOPLE.qs) {
  await mountApp(PATH, { as, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
}

async function shows(words: string) {
  await waitFor(() => expect(bodyText()).toContain(words))
}

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('tr, [role="row"], [role="option"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

async function focusRow(number: string) {
  await waitFor(() => rowOf(number))
  await userEvent.click(within(rowOf(number)).getByText(number))
}

const posts = (step1: FakeStep1) => step1.calls().filter((c) => c.startsWith('POST'))
const inspector = () => screen.getByRole('complementary')

/** The storeys field of a plan view, by its label's words (quotes straight or curly). */
function storeysField(title: string): HTMLInputElement {
  const name = `Storeys of "${title}", each listed`
  return within(inspector()).getByRole('textbox', { name: (n) => clean(n) === name }) as HTMLInputElement
}

/** The toggle's choice named `words`: a radio, or a button pressed or not. */
function choices(words: string): HTMLElement[] {
  const named = { name: (n: string) => clean(n) === words }
  return [...within(inspector()).queryAllByRole('radio', named), ...within(inspector()).queryAllByRole('button', named)]
}
const isOn = (el: HTMLElement) => (el as HTMLInputElement).checked === true || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true'

/** The correction form: the smallest part of the inspector holding both the field and "Save". */
function formAround(field: HTMLElement): HTMLElement {
  const save = within(inspector()).getByRole('button', { name: /^Save\b/ })
  let at: HTMLElement | null = field
  while (at && !at.contains(save)) at = at.parentElement
  return at!
}

async function correcting(number = 'S-06', as: string = PEOPLE.qs) {
  const fake = kr01()
  await open(fake.api, as)
  await focusRow(number)
  await userEvent.keyboard('e')
  await shows('Correct the Proposal')
  return fake
}

const toasts = () => screen.queryAllByRole('status').map((s) => clean(s.textContent))

describe('E on a sheet with a plan view: its storeys and their meaning (§6.9)', () => {
  it(`offers "${FIELD}" with the placeholder "3rd, 5th, 7th"`, async () => {
    const { step1 } = await correcting()
    const field = storeysField(PLAN_TITLE)
    expect(field.placeholder).toBe('3rd, 5th, 7th')
    expect(posts(step1)).toEqual([])
  })

  it('offers no storeys field for a view that is not a plan', async () => {
    await correcting()
    storeysField(PLAN_TITLE)
    expect(within(inspector()).queryByRole('textbox', { name: (n) => clean(n).startsWith('Storeys of "Section ZQ-6"') })).toBeNull()
  })

  it('offers the meaning as a two-choice toggle, "at floor level" | "floor to floor", with the meaning read chosen', async () => {
    await correcting()
    const [atFloor, ...moreAtFloor] = choices('at floor level')
    const [floorToFloor, ...moreFloorToFloor] = choices('floor to floor')
    expect([moreAtFloor, moreFloorToFloor]).toEqual([[], []])
    expect(atFloor && isOn(atFloor), '"at floor level" chosen').toBe(true)
    expect(floorToFloor && isOn(floorToFloor), '"floor to floor" not chosen').toBe(false)
  })

  it('shows a view read "at ceiling level" with that meaning beside the toggle, which does not offer it', async () => {
    await correcting('S-11')
    const form = formAround(storeysField(CEILING_TITLE))
    expect(clean(form.textContent)).toContain('at ceiling level')
    expect(choices('at ceiling level')).toEqual([])
    expect(choices('at floor level')).toHaveLength(1)
    expect(choices('floor to floor')).toHaveLength(1)
  })

  it('saves on Enter: posts the typed storeys and the meaning chosen for the plan view', async () => {
    const { step1, s06, plan } = await correcting()
    await userEvent.click(choices('floor to floor')[0]!)
    const field = storeysField(PLAN_TITLE)
    await userEvent.click(field)
    await userEvent.clear(field)
    await userEvent.type(field, TYPED)
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(step1.seen.find((s) => s.call === 'POST /correct')?.body).toMatchObject({
        proposal: s06.id,
        views: [{ view: plan.id, storeys: TYPED, meaning: 'floor_to_floor' }],
      }),
    )
  })

  it(`toasts 'Corrected S-06: storeys of "${PLAN_TITLE}". Still a Proposal until confirmed.' and marks the row ", corrected"`, async () => {
    await correcting()
    const field = storeysField(PLAN_TITLE)
    await userEvent.click(field)
    await userEvent.clear(field)
    await userEvent.type(field, TYPED)
    await userEvent.keyboard('{Enter}')
    await shows(`Corrected S-06: storeys of "${PLAN_TITLE}". Still a Proposal until confirmed.`)
    await waitFor(() => expect(clean(rowOf('S-06').textContent)).toContain(', corrected'))
    expect(bodyText()).toContain('Confirmed 0 / 24')
  })

  it('takes the correction back on Ctrl Z: posts the undo and toasts "Undone:"', async () => {
    const { step1 } = await correcting()
    const field = storeysField(PLAN_TITLE)
    await userEvent.click(field)
    await userEvent.clear(field)
    await userEvent.type(field, TYPED)
    await userEvent.keyboard('{Enter}')
    await shows('Still a Proposal until confirmed.')
    await waitFor(() => expect(bodyText()).not.toContain('Correct the Proposal'))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(posts(step1)).toEqual(['POST /correct', 'POST /undo']))
    await waitFor(() => expect(toasts().some((t) => t.startsWith('Undone:'))).toBe(true))
    await waitFor(() => expect(clean(rowOf('S-06').textContent)).not.toContain(', corrected'))
  })

  it('cancels on Esc after typing storeys: nothing is posted', async () => {
    const { step1 } = await correcting()
    const field = storeysField(PLAN_TITLE)
    await userEvent.click(field)
    await userEvent.type(field, TYPED)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(bodyText()).not.toContain('Correct the Proposal'))
    expect(posts(step1)).toEqual([])
  })
})

describe('read only (§6.12): the MD and a Guest have no E', () => {
  it.each([
    ['MD', PEOPLE.md, 'As MD you can look at the Takeoff but not change it.'],
    ['Guest', PEOPLE.guest, 'As a Guest you can look at the Takeoff but not change it.'],
  ])('answers the %s’s E in words and opens no storeys field', async (_, as, words) => {
    const { api, step1 } = kr01()
    await open(api, as)
    await focusRow('S-06')
    await userEvent.keyboard('e')
    await shows(words)
    expect(bodyText()).not.toContain('Correct the Proposal')
    expect(within(inspector()).queryByRole('textbox', { name: (n) => clean(n).startsWith('Storeys of') })).toBeNull()
    expect(posts(step1)).toEqual([])
  })
})
