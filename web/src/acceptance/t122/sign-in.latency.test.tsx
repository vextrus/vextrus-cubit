/*
 * Ticket 122's acceptance tests (issue #134): `src/auth/sign-in.test.tsx`, one of the two suites that
 * raced on a slow runner, still passes with the in-memory API slowed. Its tests run here, in this
 * file, with `VITE_FAKE_API_LATENCY_MS` set: the default latency of every `new FakeApi()` (chosen by
 * the acceptance writer, the issue names none; the slowed CI run sets it, ci.node.test.ts).
 * 60 ms is the top of the latency that reproduced the races, 6 of 6 (#134).
 */
import { describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_FAKE_API_LATENCY_MS', '60')
const { FakeApi, PEOPLE } = await import('@/app/seed/api.fixture')

describe('the fake API is slowed in this file', () => {
  it('answers a new FakeApi’s request after the next task, not before', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.qs)
    let answered = false
    void api.handle(new Request('http://127.0.0.1/api/me')).then(() => {
      answered = true
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(answered, 'answered by the next task: VITE_FAKE_API_LATENCY_MS is not read').toBe(false)
  })
})

// The suite itself, registered in this file with the latency on.
await import('@/auth/sign-in.test')
