/* The one retry rule (app/query-policy.ts): who is tried again, how often, and how long each wait. */
import { describe, expect, it } from 'vitest'
import { ApiRefused } from '@/api/client'
import { FAULT_RETRIES, backoff, mutationPolicy, shouldRetry } from './query-policy'

describe('shouldRetry', () => {
  it('keeps trying a server that cannot be reached, however many tries failed', () => {
    for (const failures of [0, 5, 500]) expect(shouldRetry(failures, new TypeError('Failed to fetch'))).toBe(true)
  })

  it('tries a 5xx again FAULT_RETRIES times, then gives it up', () => {
    const fault = new ApiRefused(503, null)
    for (let failures = 0; failures < FAULT_RETRIES; failures++) expect(shouldRetry(failures, fault)).toBe(true)
    expect(shouldRetry(FAULT_RETRIES, fault)).toBe(false)
  })

  it.each([400, 401, 403, 404, 409, 422])('never tries a %i again', (status) => {
    expect(shouldRetry(0, new ApiRefused(status, null))).toBe(false)
  })

  it('tries any other failure the same bounded times', () => {
    expect(shouldRetry(0, new Error('x'))).toBe(true)
    expect(shouldRetry(FAULT_RETRIES, new Error('x'))).toBe(false)
  })
})

describe('backoff', () => {
  it('never shortens, grows, and stops at 30 s', () => {
    const waits = Array.from({ length: 10 }, (_, attempt) => backoff(attempt))
    for (let i = 1; i < waits.length; i++) expect(waits[i]!).toBeGreaterThanOrEqual(waits[i - 1]!)
    expect(waits[1]!).toBeGreaterThan(waits[0]!)
    expect(waits.at(-1)).toBe(30_000)
  })
})

describe('mutations', () => {
  it('are never tried again by themselves', () => {
    expect(mutationPolicy.retry).toBe(false)
  })
})
