/*
 * Step 1's acts when they go wrong (the review of 22, round 1): a bulk act whose exclusion is refused
 * after its Confirmation was made says both halves, offers Undo, and Ctrl Z names only what was done;
 * a second Enter while the act is in flight sends nothing more.
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
const bodyText = () => (document.body.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ')

async function open() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return step1
}

/** From `slow()` on, Step 1's reads answer 400 ms late (the review's repro of R1). */
async function openSlow(ms = 400) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  let late = false
  const base = api.handle
  api.handle = async (request: Request) => {
    if (late && request.method === 'GET' && new URL(request.url, location.origin).pathname.includes('/takeoff/step1')) await new Promise((r) => setTimeout(r, ms))
    return base(request)
  }
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  late = true
  return step1
}

describe('the bulk act, half refused', () => {
  it('says the 16 were confirmed and why the rest was not, offers Undo, and undoes only what was done', async () => {
    const step1 = await open()
    step1.answerOnce('POST /exclude', 409, { code: 'takeoff.step1.nothing_to_undo', params: {} })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets.'))
    expect(bodyText()).toContain('The rest was not done: You have nothing left to undo on Step 1')
    expect(screen.getByRole('button', { name: /Undo/ })).toBeInTheDocument()
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets'))
    expect(bodyText()).not.toContain('left out 1')
    expect(step1.calls().filter((c) => c === 'POST /undo')).toHaveLength(1)
  })
})

describe('an act in flight', () => {
  it('sends the bulk act once for two Enters', async () => {
    const step1 = await open()
    await userEvent.keyboard('{Enter}{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1'))
    await new Promise((r) => setTimeout(r, 300))
    expect(step1.calls().filter((c) => c === 'POST /confirm')).toHaveLength(1)
    expect(step1.calls().filter((c) => c === 'POST /exclude')).toHaveLength(1)
  })

  it('sends the bulk act once when the second Enter comes while Step 1 reloads', async () => {
    const step1 = await openSlow()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.calls().filter((c) => c === 'POST /exclude')).toHaveLength(1))
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 1000))
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toEqual(['POST /confirm', 'POST /exclude'])
  })

  it("sends a sheet's act once when the second Enter comes while Step 1 reloads", async () => {
    const step1 = await openSlow()
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const active = () => document.activeElement as HTMLElement | null
    const number = () => (active()?.getAttribute('role') === 'row' ? (active()!.querySelectorAll('[role="gridcell"]')[1]?.textContent ?? '').replace(/[⁦-⁩‎‏\s]/g, '') : '')
    for (let i = 0; i < 30 && number() !== 'S-02'; i++) await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-02/ })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.calls().filter((c) => c.startsWith('POST'))).toHaveLength(1))
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 1000))
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toHaveLength(1)
  })

  it('sends no drawing list while the bulk act is still reloading', async () => {
    const step1 = await openSlow(1500)
    const heading = await screen.findByText('Architectural 8 found', { exact: false })
    const section = heading.closest('section, [role="rowgroup"], [role="group"], div')!.parentElement!
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.calls()).toContain('POST /exclude'))
    await userEvent.click(within(section).getAllByText('Paste the drawing list')[0]!)
    const again = await screen.findByRole('dialog', { name: 'The architectural drawing list' })
    await userEvent.type(within(again).getByRole('textbox'), 'A-01–A-08')
    await waitFor(() => expect(clean(again.textContent)).toContain('Read as a range'))
    await userEvent.click(within(again).getByRole('button', { name: 'Use as the drawing list' }))
    await new Promise((r) => setTimeout(r, 300))
    expect(step1.calls()).not.toContain('POST /drawing-list')
  })
})

describe('an Undo while the act is still going (the review of 22, round 2)', () => {
  async function openAt60() {
    const api = new FakeApi({ latencyMs: 60 })
    const step1 = new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    return step1
  }

  it('waits for the bulk act and undoes it, when Ctrl Z comes at once', async () => {
    const step1 = await openAt60()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'), { timeout: 5000 })
    expect(step1.calls().filter((c) => c.startsWith('POST'))).toEqual(['POST /confirm', 'POST /exclude', 'POST /undo', 'POST /undo'])
  })

  it('undoes the act when its toast’s Undo is pressed during the reload', async () => {
    const step1 = await openAt60()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1'))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'), { timeout: 5000 })
    expect(step1.calls().filter((c) => c === 'POST /undo')).toHaveLength(2)
  })
})
