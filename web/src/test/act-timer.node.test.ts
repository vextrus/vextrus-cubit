import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import type { Page } from '@playwright/test'
import { timedAct } from '../../e2e/real/act-timer'

const URL_UNDO = 'http://127.0.0.1/api/projects/p/takeoff/step1/undo'

/** A page whose first key sends the act's request and is answered at once; the second key does nothing. */
function fakePage(): Page {
  const bus = new EventEmitter()
  const request = { method: () => 'POST', url: () => URL_UNDO }
  let presses = 0
  return {
    on: (e: string, f: (...a: unknown[]) => void) => bus.on(e, f),
    off: (e: string, f: (...a: unknown[]) => void) => bus.off(e, f),
    waitForTimeout: (ms: number) => new Promise((r) => setTimeout(r, ms)),
    keyboard: {
      press: async () => {
        presses += 1
        if (presses === 1) {
          bus.emit('request', request)
          bus.emit('response', { request: () => request, status: () => 200 })
        }
      },
    },
  } as unknown as Page
}

describe('timedAct on a multi-key act', () => {
  it('records a non-negative ms when the request was answered before the last key', async () => {
    const record = await timedAct(fakePage(), { reading: async () => false }, 'p', 'undo', ['a', 'b'], { timeoutMs: 1000 })
    expect(record?.status).toBe(200)
    expect(record?.ms).toBeGreaterThanOrEqual(0)
  })
})
