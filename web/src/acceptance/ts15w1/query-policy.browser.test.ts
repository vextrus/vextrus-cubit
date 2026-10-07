/*
 * Ticket S15-W1's acceptance tests, the policy every query has unless it says otherwise (#542: "One
 * query policy … a 5xx is retried with backoff"): the app's query client (src/app/router.ts, the one
 * the app and its screen tests run on) reading through the API's typed client, the server answering
 * with a fault or a refusal, the clock faked. The orchestrator's pins: "5xx retried N times with
 * backoff", "4xx refusals not retried". N and the waits are the builder's; the tests ask that a fault
 * is tried at least twice more, a bounded number of times, each wait no shorter than the one before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MutationObserver, onlineManager } from '@tanstack/react-query'
import { ApiRefused, api, setTransport, unwrap } from '@/api/client'
import { createQueryClient } from '@/app/router'

const MAX_TRIES = 6

let restore: () => void = () => {}
let tries: number[] = []

function answer(status: number, body: string, type: string) {
  tries = []
  restore = setTransport(async (request: Request) => {
    // The tab's CSRF token, asked before an act: answered, and not a try of the address.
    if (new URL(request.url, location.origin).pathname === '/api/auth/csrf') return new Response(JSON.stringify({ token: 'probe' }), { status: 200 })
    tries.push(Date.now())
    return new Response(body, { status, headers: { 'Content-Type': type } })
  })
}

beforeEach(() => {
  onlineManager.setOnline(true)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
})

afterEach(() => {
  restore()
  vi.useRealTimers()
})

/** A query with no retry of its own, as a data module's that leaves it to the policy. */
async function read(): Promise<unknown> {
  const client = createQueryClient()
  const outcome = client.fetchQuery({ queryKey: ['policy-probe'], queryFn: () => unwrap(api.GET('/api/projects')) }).then(
    () => null,
    (error: unknown) => error,
  )
  let settled = false
  void outcome.then(() => (settled = true))
  for (let waited = 0; !settled && waited < 30 * 60_000; waited += 250) await vi.advanceTimersByTimeAsync(250)
  expect(settled, 'the read settled within 30 minutes').toBe(true)
  return outcome
}

describe('the query policy, for a query that sets none of its own', () => {
  it.each([500, 502, 503, 504])('tries a %i again, each wait no shorter than the last, then gives it up as the error', async (status) => {
    answer(status, `<html><body><h1>${status}</h1></body></html>`, 'text/html')
    const error = await read()
    expect(error, 'the read ends in the server’s fault').toBeInstanceOf(ApiRefused)
    expect((error as ApiRefused).status).toBe(status)
    expect(tries.length, 'the first try and at least two more').toBeGreaterThanOrEqual(3)
    expect(tries.length, 'a bounded number of tries').toBeLessThanOrEqual(MAX_TRIES)
    const gaps = tries.slice(1).map((at, i) => at - tries[i]!)
    for (let i = 1; i < gaps.length; i++) expect(gaps[i], `waits ${gaps.join(', ')} ms`).toBeGreaterThanOrEqual(gaps[i - 1]!)
    expect(gaps.at(-1)!, `waits ${gaps.join(', ')} ms: a backoff`).toBeGreaterThan(gaps[0]!)
  })

  it.each([
    [400, { code: 'platform.bad_request', params: {} }],
    [404, { code: 'platform.not_found', params: {} }],
    [409, { code: 'platform.conflict', params: {} }],
    [422, { detail: [{ type: 'missing', loc: ['query', 'x'], msg: 'Field required' }] }],
  ])('takes a %i refusal as the answer: one try, never again', async (status, body) => {
    answer(status, JSON.stringify(body), 'application/json')
    const error = await read()
    expect(error, 'the read ends in the refusal').toBeInstanceOf(ApiRefused)
    expect((error as ApiRefused).status).toBe(status)
    expect(tries.length, 'tries of a refused read').toBe(1)
  })

  it('never tries an act (a mutation) again by itself: a 503 is its answer (reads only are tried again)', async () => {
    answer(503, JSON.stringify({ code: 'takeoff.step1.discipline_unknown', params: {} }), 'application/json')
    const client = createQueryClient()
    const act = new MutationObserver(client, { mutationFn: () => unwrap(api.POST('/api/projects', { body: { code: 'KR-09', name: 'Probe' } as never })) })
    const outcome = act.mutate().then(
      () => null,
      (error: unknown) => error,
    )
    let settled = false
    void outcome.then(() => (settled = true))
    for (let waited = 0; waited < 10 * 60_000; waited += 250) await vi.advanceTimersByTimeAsync(250)
    expect(settled, 'the act settled').toBe(true)
    expect(await outcome, 'the act ends in the refusal').toBeInstanceOf(ApiRefused)
    expect(tries.length, 'tries of the act in 10 minutes').toBe(1)
  })
})
