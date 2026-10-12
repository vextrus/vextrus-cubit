/*
 * S22-FL8 (issue #656): the Correct key E on Step 1, on the t22 fixture (the seed's KR-01; every title invented).
 * docs/design/m0-screens.md §2.2 row E: "Correct the focused sheet's number, title or storeys, in the inspector;
 * `Enter` saves, `Esc` cancels" (In M0: yes); §6.6 item 6: the actions "Correct E" (not for the MD or a Guest);
 * §6.9 "Corrections (`E`)": "Correct the Proposal" opens in the inspector in place of the Proposal block: Number,
 * Title, …, "Save ↵" and "Cancel Esc". A correction leaves the sheet a Proposal: toast "Corrected S-18: … Still a
 * Proposal until confirmed."; the State column adds ", corrected"; §6.12: for the MD "Correct" is absent and E
 * shows §1.4's toast; §2.1: the `?` overlay lists the keys active now. Tonight's cut: number and title only.
 *
 * Named by the acceptance writer (the builder meets them): the act is `POST …/takeoff/step1/correct` with
 * `{ proposal, number?, title? }`; a corrected Proposal carries `corrected: true`.
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

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'
const NEW_TITLE = 'Lift core wall details'

/** KR-01 whose fake server answers `POST /correct` as the API does: the sheet takes the new values, marked corrected. */
function kr01(): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const push = step1.seen.push.bind(step1.seen)
  step1.seen.push = (...items) => {
    for (const { call, body } of items) {
      if (call !== 'POST /correct') continue
      const asked = body as { proposal: string; number?: string; title?: string }
      const p = step1.proposals.find((x) => x.id === asked.proposal)
      if (!p) continue
      Object.assign(p, { corrected: true }, asked.number ? { number: asked.number } : {}, asked.title ? { title: asked.title } : {})
      step1.answerOnce('POST /correct', 200, { confirmation_id: '01a10000-0000-7000-8000-00000000c0e1', act: 'correct', sheets: 1, by: step1.actor, at: '2026-09-28T06:00:00Z' })
    }
    return push(...items)
  }
  return { api, step1 }
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

/** Focus S-05, press E, and wait for the inspector's form. */
async function correcting(step1: FakeStep1, api: FakeApi) {
  await open(api)
  await focusRow('S-05')
  await userEvent.keyboard('e')
  await shows('Correct the Proposal')
  return step1.proposals.find((p) => p.number === 'S-05')!
}

describe('E on a focused sheet (§2.2, §6.9)', () => {
  it('opens "Correct the Proposal" in the inspector with Number, Title, "Save ↵" and "Cancel Esc"', async () => {
    const { api, step1 } = kr01()
    await correcting(step1, api)
    const inspector = screen.getByRole('complementary')
    expect(clean(inspector.textContent)).toContain('Correct the Proposal')
    expect((within(inspector).getByRole('textbox', { name: 'Number' }) as HTMLInputElement).value).toBe('S-05')
    within(inspector).getByRole('textbox', { name: 'Title' })
    expect(clean(inspector.textContent)).toContain('Save ↵')
    expect(clean(inspector.textContent)).toContain('Cancel Esc')
    expect(posts(step1)).toEqual([])
  })

  it('saves on Enter: posts the correction and toasts "Corrected S-05" and "Still a Proposal until confirmed."', async () => {
    const { api, step1 } = kr01()
    const s05 = await correcting(step1, api)
    const title = within(screen.getByRole('complementary')).getByRole('textbox', { name: 'Title' })
    await userEvent.clear(title)
    await userEvent.type(title, NEW_TITLE)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.seen.find((s) => s.call === 'POST /correct')?.body).toMatchObject({ proposal: s05.id, title: NEW_TITLE }))
    await shows('Corrected S-05')
    await shows('Still a Proposal until confirmed.')
  })

  it('marks the corrected sheet ", corrected" in its row and leaves it a Proposal', async () => {
    const { api, step1 } = kr01()
    await correcting(step1, api)
    const title = within(screen.getByRole('complementary')).getByRole('textbox', { name: 'Title' })
    await userEvent.clear(title)
    await userEvent.type(title, NEW_TITLE)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(clean(rowOf(NEW_TITLE).textContent)).toContain(', corrected'))
    expect(bodyText()).toContain('Confirmed 0 / 24')
  })

  it('cancels on Esc: the form closes and nothing is posted', async () => {
    const { api, step1 } = kr01()
    await correcting(step1, api)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(bodyText()).not.toContain('Correct the Proposal'))
    expect(posts(step1)).toEqual([])
  })

  it('offers "Correct E" among the focused sheet’s actions (§6.6 item 6)', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-05')
    const inspector = screen.getByRole('complementary')
    await waitFor(() => expect(within(inspector).getByRole('button', { name: /^Correct\b/ })).toBeTruthy())
    expect(clean(within(inspector).getByRole('button', { name: /^Correct\b/ }).textContent)).toContain('E')
  })
})

describe('the ? overlay (§2.1)', () => {
  it('lists E with a sheet focused', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-05')
    await userEvent.keyboard('?')
    const dialog = await screen.findByRole('dialog', { name: 'Keys' })
    const rows = [...dialog.querySelectorAll<HTMLElement>('li, [role="listitem"], [role="row"]')]
    const chips = rows.map((r) => [...r.querySelectorAll('kbd')].map((k) => clean(k.textContent)))
    expect(chips.some((c) => c.length === 1 && c[0] === 'E'), 'a row whose one chip is E').toBe(true)
  })
})

describe('read only (§6.12)', () => {
  it('answers the MD’s E with "As MD you can look at the Takeoff but not change it." and opens no form', async () => {
    const { api, step1 } = kr01()
    await open(api, PEOPLE.md)
    await focusRow('S-05')
    expect(within(screen.getByRole('complementary')).queryByRole('button', { name: /^Correct\b/ })).toBeNull()
    await userEvent.keyboard('e')
    await shows('As MD you can look at the Takeoff but not change it.')
    expect(bodyText()).not.toContain('Correct the Proposal')
    expect(posts(step1)).toEqual([])
  })
})
