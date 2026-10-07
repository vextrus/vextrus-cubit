/* The frame's connectivity (app/connectivity.ts): the probe's own backoff, and a store that outlives its subscribers. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { setTransport } from '@/api/client'
import { emitActUnreachable } from '@/api/events'
import { connectivityOf } from './connectivity'

/** Moves the clock on in steps, letting each answer be read (a Response's body needs real turns of the event loop). */
async function advance(ms: number) {
  for (let waited = 0; waited < ms; waited += 250) {
    await vi.advanceTimersByTimeAsync(250)
    for (let i = 0; i < 20; i++) await new Promise<void>((done) => ((c) => ((c.port1.onmessage = () => done()), c.port2.postMessage(0)))(new MessageChannel()))
  }
}

let restore = () => {}
let asked: number[] = []
let mode: 'down' | 'up' = 'down'

beforeEach(() => {
  vi.useFakeTimers()
  asked = []
  mode = 'down'
  restore = setTransport(async (request: Request) => {
    if (new URL(request.url, location.origin).pathname === '/api/me') asked.push(Date.now())
    if (mode === 'down') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
})
afterEach(() => {
  restore()
  vi.useRealTimers()
})

describe('the probe', () => {
  it('asks again after the same remount: a bar left up by an act is cleared once the server answers', async () => {
    const connectivity = connectivityOf(new QueryClient())
    const off = connectivity.subscribe(() => {})
    emitActUnreachable()
    expect(connectivity.isDown()).toBe(true)
    off() // the bar's only subscriber goes (the frame remounts) ...
    const again = connectivity.subscribe(() => {}) // ... and comes back
    mode = 'up'
    await advance(10_000)
    expect(asked.length, 'the probe asked /api/me after the remount').toBeGreaterThan(0)
    expect(connectivity.isDown()).toBe(false)
    again()
  })

  it('waits longer each time while anything stays down, though /api/me answers', async () => {
    const client = new QueryClient()
    const connectivity = connectivityOf(client)
    const off = connectivity.subscribe(() => {})
    // A read that stays unreachable: the key is put down by a failing query that the probe cannot clear.
    const stuck = client.getQueryCache().build(client, { queryKey: ['stuck'], queryFn: () => Promise.reject(new TypeError('Failed to fetch')), retry: false })
    const observe = new QueryObserver(client, { queryKey: ['stuck'], queryFn: () => Promise.reject(new TypeError('Failed to fetch')), retry: false })
    const unsubscribe = observe.subscribe(() => {})
    await advance(250)
    expect(stuck.state.status).toBe('error')
    expect(connectivity.isDown()).toBe(true)
    mode = 'up' // /api/me answers; the read still fails
    await advance(40_000)
    const gaps = asked.slice(1).map((at, i) => at - asked[i]!)
    expect(asked.length, 'a few probes in 40 s, not one a second').toBeLessThanOrEqual(8)
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeGreaterThanOrEqual(gaps[i - 1]!)
    expect(gaps.at(-1)!).toBeGreaterThan(gaps[0]!)
    unsubscribe()
    off()
  })
})
