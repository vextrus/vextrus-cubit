/*
 * Step 1's acts when they go wrong (the review of 22, round 1): a bulk act whose exclusion is refused
 * after its Confirmation was made says both halves, offers Undo, and Ctrl Z names only what was done;
 * a second Enter while the act is in flight sends nothing more.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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

const bodyText = () => (document.body.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ')

async function open() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
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
})

/** Step 1's reads answer `ms` late once armed: the reload after an act is still running. */
function slowReads(api: FakeApi, ms: number): { arm: () => void } {
  let armed = false
  const base = api.handle
  api.handle = async (request: Request) => {
    if (armed && request.method === 'GET' && new URL(request.url, location.origin).pathname.includes('/takeoff/step1')) await new Promise((r) => setTimeout(r, ms))
    return base(request)
  }
  return { arm: () => (armed = true) }
}

describe('an Enter during the reload after an act (review round 1, R1)', () => {
  it('sends the bulk act once when Enter is pressed again while Step 1 reloads', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    const slow = slowReads(api, 400)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    slow.arm()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.calls().filter((c) => c === 'POST /exclude')).toHaveLength(1))
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 1000))
    expect(step1.calls().filter((c) => c === 'POST /confirm')).toHaveLength(1)
    expect(step1.calls().filter((c) => c === 'POST /exclude')).toHaveLength(1)
  })

  it('sends a single sheet’s Confirmation once when Enter is pressed again while Step 1 reloads', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    const slow = slowReads(api, 400)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    const row = [...document.querySelectorAll<HTMLElement>('[role="row"]')].find((r) => (r.textContent ?? '').includes('S-02') && !(r.textContent ?? '').includes('S-03'))!
    await userEvent.click(row)
    await userEvent.keyboard(' ')
    await waitFor(() => expect(document.querySelector('[role="group"][aria-label*="S-02"]')).not.toBeNull())
    slow.arm()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(step1.calls().filter((c) => c === 'POST /confirm')).toHaveLength(1))
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 1000))
    expect(step1.calls().filter((c) => c === 'POST /confirm')).toHaveLength(1)
  })
})
