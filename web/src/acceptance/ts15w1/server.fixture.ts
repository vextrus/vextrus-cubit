/*
 * Ticket S15-W1's acceptance helpers: a server that is down, or that fails, for one address, laid over
 * the seed's in-memory API (and Step 1's, ticket 22's acceptance fake), with the tries counted on the
 * test's clock; and the clock moved on as the page waits.
 */
import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { FakeApi } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'

/** The words of the ErrorBar under the top bar (docs/design/m0-screens.md §4.1, "Server unreachable"). */
export const UNREACHABLE = 'Vextrus can’t be reached. Check your connection; this page keeps trying.'

/** Visible text without the isolates the message layer puts round every value. */
export const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

export const region = (name: string) => document.querySelector<HTMLElement>(`[data-region="${name}"]`)

/** The frame's ErrorBar: an alert in the unreachable words, directly under the top bar. */
export function barUnderTopBar(): HTMLElement | undefined {
  const top = region('top-bar')
  if (!top) return undefined
  const bottom = top.getBoundingClientRect().bottom
  return [...document.querySelectorAll<HTMLElement>('[role="alert"]')].find(
    (el) => clean(el.textContent) === UNREACHABLE && Math.abs(el.getBoundingClientRect().top - bottom) < 0.5,
  )
}

export const alerts = () => [...document.querySelectorAll<HTMLElement>('[role="alert"]')]

/** What the down address does: fail to connect, answer a server fault, or answer a refusal. */
export type Failure = { kind: 'unreachable' } | { kind: 'fault'; status: number } | { kind: 'refusal'; status: number; body: unknown }

export interface Outage {
  api: FakeApi
  /** The time (the test's clock, ms) of every try of the address, and what it was answered. */
  tries: { at: number; status: number }[]
  /** While true, the address fails as `failure` says; false: it is answered as the seed answers it. */
  down: boolean
}

/** The address under test on a screen, and the API answering everything else. */
export interface Screen {
  name: string
  path: string
  address: (api: FakeApi) => RegExp
  api: () => FakeApi
}

export const SCREENS: Screen[] = [
  { name: 'Members', path: '/members', address: () => /^\/api\/members$/, api: () => new FakeApi() },
  {
    name: 'Step 1',
    path: '/p/KR-01/takeoff/1',
    address: (api) => new RegExp(`^/api/projects/${api.project('KR-01').id}/takeoff/step1/proposals$`),
    api: () => {
      const api = new FakeApi()
      new FakeStep1(api)
      return api
    },
  },
]

/** Lays a failing address over the API: every try of it is counted, and while down it fails as said. */
export function outage(screen: Screen, failure: Failure): Outage {
  const api = screen.api()
  const address = screen.address(api)
  const state: Outage = { api, tries: [], down: true }
  const base = api.handle
  api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    if (!address.test(path)) return base(request)
    if (!state.down) {
      const answer = await base(request)
      state.tries.push({ at: Date.now(), status: answer.status })
      return answer
    }
    state.tries.push({ at: Date.now(), status: failure.kind === 'unreachable' ? 0 : failure.status })
    if (failure.kind === 'unreachable') throw new TypeError('Failed to fetch')
    if (failure.kind === 'fault')
      return new Response(`<html><body><h1>${failure.status}</h1></body></html>`, { status: failure.status, headers: { 'Content-Type': 'text/html' } })
    return new Response(JSON.stringify(failure.body), { status: failure.status, headers: { 'Content-Type': 'application/json' } })
  }
  return state
}

/** The test's clock: timers and Date are faked, so waits are moved on, never slept. */
export function fakeClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
}

/** Moves the clock on by `ms`, letting React draw what follows. */
export async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Moves the clock on in steps until `seen()` holds or `withinMs` has passed; whether it held. */
export async function until(seen: () => boolean, withinMs: number, stepMs = 100): Promise<boolean> {
  for (let waited = 0; waited < withinMs; waited += stepMs) {
    if (seen()) return true
    await tick(stepMs)
  }
  return seen()
}

/** Resolves a promise that waits on faked timers, moving the clock on until it settles. */
export async function settle<T>(promise: Promise<T>, withinMs = 10_000): Promise<T> {
  let done = false
  void promise.then(
    () => (done = true),
    () => (done = true),
  )
  for (let waited = 0; !done && waited < withinMs; waited += 10) await vi.advanceTimersByTimeAsync(10)
  return promise
}
