/*
 * #167's refuter, round 1: an act's toast waits for Step 1's reload (F1), and so
 *  R1. a reload that fails must not show the plain success toast beside the stale Count: it says the
 *      confirmed count may be behind;
 *  R2. a toast queued for an act must not show once the next act has begun (as `toast.clear()` drops a
 *      shown one), so no stale Undo stands during that act;
 *  R3. an undo's "Undone: …" waits for its reload too, never beside the Count it changed;
 *  R4. a drawing list whose own reload fails says so too (round 2: only the Count's queries were checked);
 *  R5. a toast queued for an act goes once Ctrl Z is pressed, as for a new act (round 2);
 *  R6. a drawing list failing before the act is not the act's: its toast says nothing stale (round 3, Q1);
 *  R7. Ctrl Z pressed while the act's calls are in flight drops that act's toast (round 3, Q3);
 *  R8. no toast is ever drawn beside the Count from before its act or undo, watched frame by frame (round 3, Q4);
 *  R9. leaving Step 1 while the act reloads still says what the act did (round 4, Q5).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
const toastText = () => (document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

/** Every DOM state with a toast, as "toast || Count". */
function watchToasts() {
  const seen: string[] = []
  const observer = new MutationObserver(() => {
    const toast = toastText()
    if (!toast) return
    const line = `${toast} || ${(bodyText().match(/Confirmed \d+ \/ 24/g) ?? []).join(' & ')}`
    if (seen.at(-1) !== line) seen.push(line)
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  return { seen, stop: () => observer.disconnect() }
}

const STALE = 'Step 1 could not be reloaded, so the confirmed count may be behind. Reload the page to see it.'

describe('an act’s toast after Step 1’s reload (#167 refuter)', () => {
  it('R1: says the confirmed count may be behind when the reload fails, never the plain toast beside "Confirmed 0 / 24"', async () => {
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

  it('R1 for an undo: ends "Undone: …" with its full stop before saying the confirmed count may be behind (#167 words gate, F4)', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    let failing = false
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      if (failing && request.method === 'GET' && url.pathname.includes('/takeoff/step1'))
        return new Response(JSON.stringify({ code: 'x', params: {} }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      return inner(request)
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 sheets; left out 1'))
    await waitFor(() => expect(busy()).toBe(false))
    failing = true
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain(`Undone: confirmed 16 sheets and left out 1. ${STALE}`), { timeout: 20000 })
  }, 30000)

  it('R4: says Step 1 may be behind when the drawing list’s own reload fails after it is set', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    let acted = false
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      if (url.pathname.includes('/takeoff/step1') && request.method !== 'GET') acted = true
      else if (acted && url.pathname.endsWith('/drawing-list'))
        return new Response(JSON.stringify({ code: 'x', params: {} }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      return inner(request)
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    const heading = await screen.findByText('Architectural 8 found', { exact: false })
    const section = heading.closest('section, [role="rowgroup"], [role="group"], div')!.parentElement!
    await userEvent.click(within(section).getAllByText('Paste the drawing list')[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'The architectural drawing list' })
    await userEvent.type(within(dialog).getByRole('textbox'), 'A-01–A-08')
    await waitFor(() => expect(bodyText()).toContain('Read as a range'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use as the drawing list' }))
    await waitFor(() => expect(bodyText()).toContain('Drawing list set'), { timeout: 15000 })
    expect(bodyText()).toContain(STALE)
  }, 30000)

  it('R5: drops a toast queued for an act once Ctrl Z is pressed', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    const held: (() => void)[] = []
    let holdUndo = false
    let releaseUndo = () => {}
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      if (holdUndo && url.pathname.endsWith('/undo')) {
        holdUndo = false
        await new Promise<void>((r) => (releaseUndo = r))
      }
      return inner(request)
    }
    const spy = vi.spyOn(notifyManager, 'schedule').mockImplementation((cb) => void held.push(cb))
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(held.length).toBe(1), { timeout: 5000 })
    await waitFor(() => expect(busy()).toBe(false))
    holdUndo = true
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(holdUndo).toBe(false))
    spy.mockRestore()
    held.shift()!()
    await new Promise((r) => setTimeout(r, 50))
    expect(bodyText()).not.toContain('Confirmed 16 sheets')
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull()
    releaseUndo()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 16 sheets and left out 1'), { timeout: 5000 })
  }, 30000)

  it('R6: says nothing stale when only a drawing list that failed before the act fails again', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      if (request.method === 'GET' && url.pathname.endsWith('/drawing-list') && url.searchParams.get('discipline') === 'electrical')
        return new Response(JSON.stringify({ code: 'x', params: {} }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      return inner(request)
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(toastText()).toContain('Confirmed 16 sheets'), { timeout: 15000 })
    expect(toastText()).not.toContain('could not be reloaded')
  }, 30000)

  it('R7: drops the act’s toast when Ctrl Z is pressed while its calls are in flight', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    let hold = true
    let release = () => {}
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      if (hold && request.method === 'POST' && url.pathname.endsWith('/exclude')) {
        hold = false
        await new Promise<void>((r) => (release = r))
      }
      return inner(request)
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(hold).toBe(false))
    const watch = watchToasts()
    await userEvent.keyboard('{Control>}z{/Control}')
    release()
    await waitFor(() => expect(count(step1, 'POST /undo')).toBe(2), { timeout: 5000 })
    await waitFor(() => expect(toastText()).toContain('Undone'), { timeout: 5000 })
    await new Promise((r) => setTimeout(r, 300))
    watch.stop()
    expect(watch.seen.filter((t) => t.startsWith('Confirmed 16 sheets'))).toEqual([])
    expect(watch.seen.filter((t) => t.startsWith('Undone') && !t.endsWith('|| Confirmed 0 / 24'))).toEqual([])
  }, 30000)

  it('R8: draws each toast only beside the Count its act or undo left, an act then an undo', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    const watch = watchToasts()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(toastText()).toContain('Confirmed 16 sheets'))
    await waitFor(() => expect(busy()).toBe(false))
    await new Promise((r) => setTimeout(r, 300))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(count(step1, 'POST /undo')).toBe(2), { timeout: 5000 })
    await waitFor(() => expect(toastText()).toContain('Undone'))
    await new Promise((r) => setTimeout(r, 300))
    watch.stop()
    const wrong = watch.seen.filter((t) => (t.startsWith('Confirmed 16 sheets') && !t.endsWith('|| Confirmed 16 / 24')) || (t.startsWith('Undone') && !t.endsWith('|| Confirmed 0 / 24')))
    expect(wrong).toEqual([])
    expect(watch.seen.length).toBeGreaterThanOrEqual(2)
  }, 30000)

  it('R9: still shows the act’s toast when the QS leaves Step 1 while it reloads', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    let acted = false
    const waiting: (() => void)[] = []
    const inner = api.handle
    api.handle = async (request: Request) => {
      const url = new URL(request.url, location.origin)
      const isStep1 = url.pathname.includes('/takeoff/step1')
      if (isStep1 && request.method !== 'GET') acted = true
      else if (isStep1 && acted && request.method === 'GET') await new Promise<void>((r) => waiting.push(r))
      return inner(request)
    }
    const { router } = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(waiting.length).toBeGreaterThan(0), { timeout: 5000 })
    await router.navigate({ to: '/p/$code/drawing-set', params: { code: 'KR-01' } } as never)
    await waitFor(() => expect(document.querySelector('[data-step1]')).toBeNull(), { timeout: 5000 })
    for (const go of waiting.splice(0)) go()
    await waitFor(() => expect(toastText()).toContain('Confirmed 16 sheets'), { timeout: 5000 })
  }, 30000)
})
