/*
 * A double Enter on a Question posts its answer once (#202; #156's re-check): an Enter pressed after
 * the answer's reload but before the screen re-renders reads the old pick and the old Question. Enter
 * is pressed on every turn of the event loop from the answer's post until its card goes, so one lands
 * in that gap whenever there is one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '@/acceptance/t156/answer.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-04T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const card = () => document.querySelector<HTMLElement>('[data-question]')

/**
 * Presses Enter (never marked `repeat`) on every task until `done`: posted through a MessageChannel,
 * the queue React's scheduler renders from, so presses interleave with its renders (a nested
 * setTimeout is clamped to 4 ms and steps over the gap).
 */
function enterEveryTurn(done: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const press = () => {
      if (done()) {
        channel.port1.close()
        return resolve()
      }
      const target = document.activeElement ?? document.body
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
      target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
      channel.port2.postMessage(null)
    }
    channel.port1.onmessage = press
    press()
  })
}

describe('a double Enter posts an answer once, however the second Enter falls (#202)', () => {
  it.each(['same_title', 'check'])('posts one answer to a %s Question with Enter pressed on every turn until its card goes', async (kind) => {
    const fake = new FakeAnswers()
    const question = fake.byKind()[kind]!
    fake.questions = [question]
    const base = fake.api.handle
    let answering: Promise<void> | null = null
    let gone = false
    fake.api.handle = async (request: Request) => {
      const reply = base(request)
      if (request.method === 'POST' && /\/questions\/[^/]+\/answer\/?$/.test(new URL(request.url, location.origin).pathname) && !answering) {
        answering = enterEveryTurn(() => gone)
      }
      return reply
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    await userEvent.keyboard('q')
    await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted.length).toBeGreaterThan(0))
    await waitFor(() => expect(card()?.dataset.question === question.id).toBe(false), { timeout: 5000 })
    gone = true
    await answering
    await new Promise((r) => setTimeout(r, 300))
    expect(fake.posted).toHaveLength(1)
  })
})
