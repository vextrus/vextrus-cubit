/*
 * A Question withdrawn when its sheet was left out (the review of 22, round 4, F4): 21c refuses to
 * confirm the sheet back in until the Question is answered (409 `takeoff.step1.question_first`,
 * naming the sheet), so the Question stays on screen, marked withdrawn, reachable by ↓, and the
 * sheet the refusal names is found in its row.
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

const clean = (t: string | null | undefined) => (t ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const active = () => document.activeElement as HTMLElement | null

/** KR-01 with A-05 left out, which withdrew its Question (as 21c sends it: top-level `withdrawn_by`, `blocking`). */
async function openWithdrawn() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const a05 = step1.proposals.find((p) => p.number === 'A-05')!
  Object.assign(a05, { decision: 'excluded', excluded_reason: 'for_information', decided_by: 'Nusrat Jahan', decided_at: '2026-09-27T05:00:00Z' })
  const q = step1.questions.find((x) => x.subject_id === a05.sheet_id)!
  Object.assign(q, { status: 'withdrawn', withdrawn_by: 'c2200000-0000-4000-8000-0000000000aa', blocking: true })
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Needs you: 4 Questions open'))
  return { step1, a05 }
}

describe('a Question withdrawn by an exclusion', () => {
  it('shows in its own section, marked withdrawn, reached by ↓, and the bar and card say what it waits for', async () => {
    await openWithdrawn()
    expect(bodyText()).toContain('1 Question withdrawn when its sheet was left out')
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const number = () => (active()?.getAttribute('role') === 'row' ? clean(active()!.querySelectorAll('[role="gridcell"]')[1]?.textContent).replace(/\s/g, '') : '')
    for (let i = 0; i < 12 && number() !== 'A-05'; i++) await userEvent.keyboard('{ArrowDown}')
    expect(number()).toBe('A-05')
    expect(clean(active()!.textContent)).toContain('Question Q5 withdrawn')
    await waitFor(() => expect(bodyText()).toContain('Question Q5, withdrawn:'))
    expect(bodyText()).toContain('Withdrawn when A-05 was left out. A-05 can be confirmed back in once this is answered.')
    const card = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('section[aria-label]')].find((e) => clean(e.getAttribute('aria-label')) === 'Question Q5')
      expect(found).toBeTruthy()
      return found!
    })
    expect(clean(card.textContent)).toContain('Withdrawn')
    expect(clean(card.textContent)).toContain('Questions cannot be answered on this screen yet, so A-05 stays left out until this one is answered.')
  })

  it('keeps the sheet a refused "Confirm back in" names on screen, with its Question', async () => {
    const { step1 } = await openWithdrawn()
    step1.answerOnce('POST /confirm', 409, { code: 'takeoff.step1.question_first', params: { count: 1, asks: 'discipline', sheet: 'A-05', named: 'number' } })
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const number = () => (active()?.getAttribute('role') === 'row' ? clean(active()!.querySelectorAll('[role="gridcell"]')[1]?.textContent).replace(/\s/g, '') : '')
    for (let i = 0; i < 12 && number() !== 'A-05'; i++) await userEvent.keyboard('{ArrowDown}')
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm back in' }))
    await waitFor(() => expect(step1.calls()).toContain('POST /confirm'))
    const row = [...document.querySelectorAll<HTMLElement>('[role="row"][data-row]')].find((r) => clean(r.textContent).includes('A-05'))!
    expect(row).toBeTruthy()
    expect(clean(within(row).getAllByRole('gridcell').at(-1)!.textContent)).toContain('Question Q5 withdrawn')
  })

  for (const width of [1280, 1024])
    it(`shows "Question Q5 withdrawn" whole in the State column at ${width}, the excluded mark read as "Excluded"`, async () => {
      await page.viewport(width, 800)
      await openWithdrawn()
      const row = [...document.querySelectorAll<HTMLElement>('[role="row"][data-row]')].find((r) => clean(r.textContent).includes('A-05'))!
      const state = within(row).getAllByRole('gridcell').at(-1)!
      expect(clean(state.textContent)).toContain('Question Q5 withdrawn')
      // The compact mark's word, read by a screen reader and shown in its tooltip.
      expect(state.querySelector('[title="Excluded"]')).not.toBeNull()
      // Nothing in the cell is cut ("…Q5 w" at 1280 before the walk's fix).
      for (const e of [state, ...state.querySelectorAll<HTMLElement>('*:not(.sr-only)')]) expect(e.scrollWidth, clean(e.textContent)).toBeLessThanOrEqual(e.clientWidth + 1)
      expect(state.getBoundingClientRect().right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 1)
    })

  it('quotes a sheet the refusal names by its title with typographic quotes (Y2, walk 5)', async () => {
    const { step1 } = await openWithdrawn()
    step1.answerOnce('POST /confirm', 409, { code: 'takeoff.step1.question_first', params: { count: 1, asks: 'number', sheet: 'DOOR AND WINDOW SCHEDULE', named: 'title' } })
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const number = () => (active()?.getAttribute('role') === 'row' ? clean(active()!.querySelectorAll('[role="gridcell"]')[1]?.textContent).replace(/\s/g, '') : '')
    for (let i = 0; i < 12 && number() !== 'A-05'; i++) await userEvent.keyboard('{ArrowDown}')
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm back in' }))
    await waitFor(() => expect(bodyText()).toContain('the sheet titled “DOOR AND WINDOW SCHEDULE”'))
    expect(bodyText()).not.toContain('"DOOR AND WINDOW SCHEDULE"')
  })

  it('is not taken by Q, the next open Question', async () => {
    await openWithdrawn()
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const seen: string[] = []
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard('q')
      seen.push(clean(active()?.textContent))
    }
    expect(seen.some((t) => t.includes('withdrawn'))).toBe(false)
  })
})
