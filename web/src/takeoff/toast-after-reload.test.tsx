/*
 * #167's refuter, round 1: an act's toast waits for Step 1's reload (F1), and so
 *  R1. a reload that fails must not show the plain success toast beside the stale Count: it says the
 *      Count may be behind;
 *  R2. a toast queued for an act must not show once the next act has begun (as `toast.clear()` drops a
 *      shown one), so no stale Undo stands during that act;
 *  R3. an undo's "Undone: …" waits for its reload too, never beside the Count it changed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { notifyManager } from '@tanstack/react-query'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const bodyText = () => (document.body.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ')
const refusal = { code: 'takeoff.step1.nothing_to_undo', params: {} }
const count = (step1: FakeStep1, call: string) => step1.calls().filter((c) => c === call).length
const busy = () => document.querySelector('[data-step1]')?.getAttribute('aria-busy') === 'true'
const STALE = 'Step 1 could not be reloaded, so its Count may be behind. Reload the page to see it.'

describe('an act’s toast after Step 1’s reload (#167 refuter)', () => {
  it('R1: says the Count may be behind when the reload fails, never the plain toast beside "Confirmed 0 / 24"', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    let acted = false
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      const isStep1 = url.pathname.includes('/takeoff/step1')
      if (isStep1 && request.method !== 'GET') acted = true
      else if (isStep1 && acted) return new Response(JSON.stringify({ code: 'x', params: {} }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      return inner(request)
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1'), { timeout: 20000 })
    expect(bodyText()).toContain(STALE)
  }, 30000)

  it('R2: drops a toast queued for an act once the next act has begun', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    const held: (() => void)[] = []
    let releaseExclude = () => {}
    let holdExclude = false
    let bStarted = false
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      if (holdExclude && request.method === 'POST' && url.pathname.endsWith('/exclude')) {
        holdExclude = false
        bStarted = true
        await new Promise<void>((r) => (releaseExclude = r))
      }
      return inner(request)
    }
    // A key can win the race with the queued toast: its show is held here until the test lets it go.
    vi.spyOn(notifyManager, 'schedule').mockImplementation((cb) => void held.push(cb))
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    // Act A: the bulk act, its exclusion refused (confirms 16).
    step1.answerOnce('POST /exclude', 409, refusal)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(held.length).toBe(1), { timeout: 5000 })
    await waitFor(() => expect(busy()).toBe(false))
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 / 24'))
    // Act B begins before A's toast is shown.
    holdExclude = true
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bStarted).toBe(true))
    held.shift()!()
    await new Promise((r) => setTimeout(r, 50))
    expect(bodyText()).not.toContain('Confirmed 16 sheets.')
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull()
    releaseExclude()
    await waitFor(() => expect(busy()).toBe(false), { timeout: 5000 })
  }, 30000)

  it('R3: shows "Undone: …" only once Step 1 has reloaded after the undo', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    let holdGets = false
    const waiting: (() => void)[] = []
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      if (holdGets && request.method === 'GET' && url.pathname.includes('/takeoff/step1')) await new Promise<void>((r) => waiting.push(r))
      return inner(request)
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1'))
    await waitFor(() => expect(busy()).toBe(false))
    holdGets = true
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(count(step1, 'POST /undo')).toBe(2))
    await new Promise((r) => setTimeout(r, 50))
    expect(bodyText()).not.toContain('Undone:')
    holdGets = false
    for (const go of waiting.splice(0)) go()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'), { timeout: 5000 })
    expect(bodyText()).toContain('Confirmed 0 / 24')
  }, 30000)
})
