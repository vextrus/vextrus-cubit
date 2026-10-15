/*
 * Ticket S30-W2's acceptance tests: G1's act timer measures an act's `ms` on a monotonic clock, so a
 * jump of the wall clock never enters an act's time.
 *
 * The defect (G1 walk #3, act_p95_during_read 1,512 ms against 1,000): this machine's wall clock jumps
 * forward 1.1 to 1.5 s every 32.5 s (systemd-timesyncd), and `timedAct` in web/e2e/real/act-timer.ts
 * took each act's times from `Date.now()`, so a jump inside an act's window added time that never
 * passed.
 *
 * The contract: an act's `ms` comes from `performance.now()` (directly, or through an injectable clock
 * that defaults to it, as act-driver.ts's `now?()` does). Read timings stay on the wall clock and are
 * not pinned here.
 *
 * Here (not under web/src: the walk's repeat relation counts web/src as product code) because Vitest's
 * node project runs `scripts/**\/*.test.ts` (web/vite.config.ts), as `npm test` in .github/workflows/web.yml.
 * No browser: a fake page on an event bus, as web/src/test/act-timer.node.test.ts.
 */
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@playwright/test'
import { timedAct } from '../../../../e2e/real/act-timer'

const URL_UNDO = 'http://127.0.0.1/api/projects/p/takeoff/step1/undo'

/** A page whose key sends the act's request; `between` runs after the request and before its answer. */
function fakePage(between: () => void): Page {
  const bus = new EventEmitter()
  const request = { method: () => 'POST', url: () => URL_UNDO }
  return {
    on: (e: string, f: (...a: unknown[]) => void) => bus.on(e, f),
    off: (e: string, f: (...a: unknown[]) => void) => bus.off(e, f),
    waitForTimeout: (ms: number) => new Promise((r) => setTimeout(r, ms)),
    keyboard: {
      press: async () => {
        bus.emit('request', request)
        between()
        bus.emit('response', { request: () => request, status: () => 200, headers: () => ({}) })
      },
    },
  } as unknown as Page
}

const api = { reading: async () => true }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the act timer on a monotonic clock', () => {
  it('leaves a wall-clock jump of 1300 ms between the request and its answer out of the act', async () => {
    const realNow = Date.now.bind(Date)
    let jump = 0
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + jump)
    const page = fakePage(() => {
      jump += 1300
    })

    const record = await timedAct(page, api, 'p', 'undo', ['u'], { timeoutMs: 1000 })

    expect(record?.status).toBe(200)
    expect(record?.ms).toBeGreaterThanOrEqual(0)
    expect(record?.ms).toBeLessThan(1000)
  })

  it('counts the 400 ms a monotonic clock advanced between the request and its answer', async () => {
    let clock = 5000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const page = fakePage(() => {
      clock += 400
    })

    const record = await timedAct(page, api, 'p', 'undo', ['u'], { timeoutMs: 1000 })

    expect(record?.status).toBe(200)
    expect(record?.ms).toBe(400)
  })
})
