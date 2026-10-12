/*
 * S22-FL8's "Correct the Proposal" at its edges (ts22fl8 pins the promise): Enter with nothing changed posts
 * nothing and closes; Esc from the Title field cancels; a refused correction keeps the form and what was
 * typed, its refusal said; a correction sends only what changed, and Ctrl Z after it posts the undo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, msg } from '@/acceptance/t22/step1.fixture'

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

async function correcting() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  const rows = [...document.querySelectorAll<HTMLElement>('[role="option"], [role="row"], tr')].filter((r) => clean(r.textContent).includes('S-05'))
  const row = rows.find((r) => !rows.some((o) => o !== r && r.contains(o)))!
  await userEvent.click(within(row).getByText('S-05'))
  await userEvent.keyboard('e')
  await waitFor(() => expect(bodyText()).toContain('Correct the Proposal'))
  const inspector = screen.getByRole('complementary')
  return { step1, inspector, title: within(inspector).getByRole('textbox', { name: 'Title' }), number: within(inspector).getByRole('textbox', { name: 'Number' }) }
}

function rowFor(number: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="option"], [role="row"], tr')].filter((r) => clean(r.textContent).includes(number))
  return rows.find((r) => !rows.some((o) => o !== r && r.contains(o)))!
}

const count = (step1: FakeStep1, call: string) => step1.calls().filter((c) => c === call).length
const posts = (step1: FakeStep1) => step1.calls().filter((c) => c.startsWith('POST'))

describe('Correct the Proposal (§6.9)', () => {
  it('closes on Enter with nothing changed, posting nothing', async () => {
    const { step1 } = await correcting()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).not.toContain('Correct the Proposal'))
    expect(posts(step1)).toEqual([])
  })

  it('cancels on Esc from the Title field', async () => {
    const { step1, title } = await correcting()
    await userEvent.click(title)
    await userEvent.type(title, ' X')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(bodyText()).not.toContain('Correct the Proposal'))
    expect(posts(step1)).toEqual([])
  })

  it('keeps the form and what was typed when the correction is refused', async () => {
    const { step1, number } = await correcting()
    step1.answerOnce('POST /correct', 400, msg('drawings.sheets.number_unreadable'))
    await userEvent.clear(number)
    await userEvent.type(number, 'S-5 1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('so nothing was changed'))
    expect(bodyText()).toContain('Correct the Proposal')
    expect((within(screen.getByRole('complementary')).getByRole('textbox', { name: 'Number' }) as HTMLInputElement).value).toBe('S-5 1')
  })

  it('refuses E on a confirmed sheet at the key, in the server’s words, opening no form', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { decision: 'confirmed', decided_by: 'Nusrat Jahan', decided_at: '2026-09-26T05:00:00Z' })
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 1 / 24'))
    const rows = [...document.querySelectorAll<HTMLElement>('[role="option"], [role="row"], tr')].filter((r) => clean(r.textContent).includes('S-05'))
    const row = rows.find((r) => !rows.some((o) => o !== r && r.contains(o)))!
    await userEvent.click(within(row).getByText('S-05'))
    await userEvent.keyboard('e')
    await waitFor(() => expect(bodyText()).toContain('This sheet is confirmed, so it was not corrected.'))
    expect(bodyText()).not.toContain('Correct the Proposal')
    expect(posts(step1)).toEqual([])
  })

  /** The design gate of PR #680: E opens the form where it is seen, focused, never hidden behind a tab or a panel. */
  async function eFrom(before: () => Promise<void>) {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    const rows = [...document.querySelectorAll<HTMLElement>('[role="option"], [role="row"], tr')].filter((r) => clean(r.textContent).includes('S-05'))
    const row = rows.find((r) => !rows.some((o) => o !== r && r.contains(o)))!
    await userEvent.click(within(row).getByText('S-05'))
    await before()
    await userEvent.keyboard('e')
    const number = await waitFor(() => within(screen.getByRole('complementary')).getByRole('textbox', { name: 'Number' }))
    await waitFor(() => expect(number.checkVisibility()).toBe(true))
    expect(document.activeElement).toBe(number)
    return step1
  }

  it('shows the form on the Selection tab when E is pressed with the Questions tab open', async () => {
    await eFrom(async () => {
      await userEvent.click(screen.getByRole('tab', { name: /^Questions/ }))
      await userEvent.click(within(rowFor('S-05')).getByText('S-05'))
    })
  })

  it('closes an open panel when E is pressed, so the form is drawn', async () => {
    await eFrom(async () => {
      await userEvent.click(screen.getAllByRole('button').find((b) => clean(b.textContent).startsWith('Coverage 70 views'))!)
      await waitFor(() => expect(bodyText()).not.toContain('Proposal: where each was read'))
    })
  })

  it('sends only what changed', async () => {
    const { step1, number } = await correcting()
    step1.answerOnce('POST /correct', 200, { confirmation_id: '01a10000-0000-7000-8000-00000000c0e2', act: 'correct', sheets: 1, by: step1.actor, at: '2026-09-28T06:00:00Z' })
    await userEvent.clear(number)
    await userEvent.type(number, 'S-51')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.seen.find((s) => s.call === 'POST /correct')?.body).toEqual({ proposal: step1.proposals.find((p) => p.number === 'S-05')!.id, number: 'S-51' }))
    await waitFor(() => expect(bodyText()).toContain('Corrected S-05: number → S-51. Still a Proposal until confirmed.'))
  })

  it('words Ctrl Z from the server when it passed the correction over, and keeps the correction to undo', async () => {
    // Fix round 3 of #691 (70/60): the tab's own history said "corrected S-05" for any Ctrl Z.
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    const out = (act: string) => ({ confirmation_id: '01a10000-0000-7000-8000-00000000c0e2', act, sheets: 1, by: step1.actor, at: '2026-09-28T06:00:00Z' })
    await userEvent.click(within(rowFor('S-01')).getByText('S-01'))
    step1.answerOnce('POST /confirm', 200, out('confirm'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(count(step1, 'POST /confirm')).toBe(1))
    await waitFor(() => expect(document.querySelector('[data-step1]')?.getAttribute('aria-busy')).not.toBe('true'))
    await userEvent.click(within(rowFor('S-05')).getByText('S-05'))
    await userEvent.keyboard('e')
    await waitFor(() => expect(bodyText()).toContain('Correct the Proposal'))
    const number = within(screen.getByRole('complementary')).getByRole('textbox', { name: 'Number' })
    step1.answerOnce('POST /correct', 200, out('correct'))
    await userEvent.clear(number)
    await userEvent.type(number, 'S-51')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Corrected S-05'))
    await waitFor(() => expect(document.querySelector('[data-step1]')?.getAttribute('aria-busy')).not.toBe('true'))

    // Another person corrected S-05 meanwhile: the server passes the correction over and undoes the confirmation.
    step1.answerOnce('POST /undo', 200, out('confirm'))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 1 sheet'))
    expect(bodyText()).not.toContain('Undone: corrected S-05')
    await waitFor(() => expect(document.querySelector('[data-step1]')?.getAttribute('aria-busy')).not.toBe('true'))

    // The correction is still the last act of this tab: the next Ctrl Z takes it.
    step1.answerOnce('POST /undo', 200, out('correct'))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Undone: corrected S-05'))
  })

  it('sends a pasted line whole, so the server refuses it in words, not cut silently by the field', async () => {
    const { step1, title } = await correcting()
    step1.answerOnce('POST /correct', 400, { code: 'drawings.sheets.title_too_long', params: { limit: 500 } })
    const long = 'T'.repeat(600)
    await userEvent.click(title)
    await userEvent.clear(title)
    await userEvent.paste(long)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect((step1.seen.find((s) => s.call === 'POST /correct')?.body as { title?: string }).title).toBe(long))
    await waitFor(() => expect(bodyText()).toContain('longer than 500 characters'))
  })
})
