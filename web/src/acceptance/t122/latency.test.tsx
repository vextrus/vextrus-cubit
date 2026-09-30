/*
 * Ticket 122's acceptance tests, part 2 (issue #134): the in-memory API can answer slowly, so a web
 * test cannot pass only on a fast runner. held.test.tsx and sign-in.test.tsx raced on a slow CI
 * runner and were reproduced "by adding 0–60 ms latency to `FakeApi.handle`"; the issue asks for "an
 * optional latency setting in `FakeApi.handle`, run in one CI shard, so this class fails at once".
 *
 * Chosen by the acceptance writer (the issue names none): the option is `latencyMs` on
 * `FakeApiOptions`, a number of milliseconds every answer of `handle` waits, 0 unless given (or unless
 * `VITE_FAKE_API_LATENCY_MS` sets the default: held.latency.test.tsx). An explicit `latencyMs` wins
 * over that default, so these tests read the same in the slowed CI run.
 *
 * No wall-clock bound: each test only orders the answer against a timer set at the same moment.
 */
import { describe, expect, it } from 'vitest'
import { FakeApi, PEOPLE } from '@/app/seed/api.fixture'

const after = (ms: number) => new Promise<'timer'>((resolve) => setTimeout(() => resolve('timer'), ms))

function me(api: FakeApi): Promise<'answer'> {
  return api.handle(new Request('http://127.0.0.1/api/me')).then(() => 'answer' as const)
}

describe('FakeApi answers after its latency (#134)', () => {
  it('answers before the next task with no latency, so a racy test passes on it', async () => {
    const api = new FakeApi({ latencyMs: 0 })
    api.signInAs(PEOPLE.qs)
    expect(await Promise.race([me(api), after(0)])).toBe('answer')
  })

  it('answers after the next task with a latency, so a test reading the answer a task later fails', async () => {
    const api = new FakeApi({ latencyMs: 60 })
    api.signInAs(PEOPLE.qs)
    // The deliberately racy assertion: "the answer is in by the next task" holds only with no latency.
    let answered = false
    void me(api).then(() => {
      answered = true
    })
    await after(0)
    expect(answered, 'answered by the next task despite a 60 ms latency').toBe(false)
  })

  it('waits at least its latency: a 60 ms answer comes after a 30 ms timer set with it', async () => {
    const api = new FakeApi({ latencyMs: 60 })
    api.signInAs(PEOPLE.qs)
    expect(await Promise.race([me(api), after(30)])).toBe('timer')
  })

  it('still answers as the API would, only later', async () => {
    const api = new FakeApi({ latencyMs: 20 })
    api.signInAs(PEOPLE.qs)
    const response = await api.handle(new Request('http://127.0.0.1/api/me'))
    expect(response.status).toBe(200)
    expect(api.requests).toEqual([{ method: 'GET', path: '/api/me', status: 200 }])
  })
})
