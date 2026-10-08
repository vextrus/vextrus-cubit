/*
 * Ticket S15-W1's acceptance tests, the shell (#542): "One query policy: an unreachable server shows the
 * ErrorBar, a 5xx is retried with backoff, every route has an error boundary"; its check: "Shell tests
 * for unreachable and 5xx." On two screens, each read through a different data module: Members and
 * Step 1, in Chromium, the browser online throughout, the clock faked so every wait is moved on.
 *
 * The words are m0-screens §4.1's "Server unreachable" state: "ErrorBar under the top bar: 'Vextrus
 * can't be reached. Check your connection; this page keeps trying.'" A 5xx's and a refusal's words are
 * the screen's own (no authority words them for this ticket), so only that an alert shows is asserted.
 * How many tries, and how long each wait, are the builder's: the tests ask only that the tries are few
 * (at most MAX_TRIES before the page says so) and that each wait is no shorter than the one before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { SCREENS, UNREACHABLE, alerts, barUnderTopBar, clean, fakeClock, outage, region, settle, tick, until, type Screen } from './server.fixture'

/** "A bounded number of tries": the most a page may try one address before it says what is wrong. */
const MAX_TRIES = 6
/** How long the page is given, on the test's clock, to try, show, or give up (2 minutes). */
const WITHIN_MS = 120_000

beforeEach(async () => {
  await page.viewport(1440, 900)
  onlineManager.setOnline(true)
  fakeClock()
})

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
})

async function open(screen: Screen, outageOf: ReturnType<typeof outage>) {
  const app = await settle(mountApp(screen.path, { as: PEOPLE.qs, api: outageOf.api }))
  await until(() => region('top-bar') !== null, 10_000)
  expect(region('top-bar'), 'the frame’s top bar').not.toBeNull()
  return app
}

/** The waits between one try and the next, in ms. */
const waits = (tries: { at: number }[]) => tries.slice(1).map((t, i) => t.at - tries[i]!.at)

describe.each(SCREENS)('$name, when Vextrus cannot be reached and the browser is online (§4.1)', (screen) => {
  it('shows the ErrorBar under the top bar after a bounded number of tries', async () => {
    const down = outage(screen, { kind: 'unreachable' })
    await open(screen, down)
    const shown = await until(() => barUnderTopBar() !== undefined, WITHIN_MS)
    expect(shown, `the ErrorBar "${UNREACHABLE}" under the top bar within 2 minutes; tries: ${down.tries.length}`).toBe(true)
    expect(down.tries.length, 'tries of the address before the ErrorBar showed').toBeGreaterThanOrEqual(1)
    expect(down.tries.length, 'tries of the address before the ErrorBar showed').toBeLessThanOrEqual(MAX_TRIES)
  })

  it('keeps trying after the ErrorBar shows, and takes it away once Vextrus answers', async () => {
    const down = outage(screen, { kind: 'unreachable' })
    await open(screen, down)
    expect(await until(() => barUnderTopBar() !== undefined, WITHIN_MS), 'the ErrorBar under the top bar').toBe(true)
    const triedBefore = down.tries.length
    await until(() => down.tries.length > triedBefore, WITHIN_MS)
    expect(down.tries.length, '"this page keeps trying": a try after the ErrorBar showed').toBeGreaterThan(triedBefore)

    down.down = false
    const answered = await until(() => down.tries.some((t) => t.status === 200) && barUnderTopBar() === undefined, WITHIN_MS)
    expect(answered, 'the address answered and the ErrorBar gone within 2 minutes of Vextrus answering').toBe(true)
    await tick(1000)
    expect(alerts().map((a) => clean(a.textContent)), 'no alert once Vextrus answers').toEqual([])
  })
})

describe.each(SCREENS)('$name, when the server answers with a fault (5xx)', (screen) => {
  it.each([500, 502, 503])('tries a %i again with no shorter wait each time, then shows the problem in the frame', async (status) => {
    const failing = outage(screen, { kind: 'fault', status })
    await open(screen, failing)
    const shown = await until(() => alerts().length > 0, WITHIN_MS)
    expect(shown, `an alert on the page within 2 minutes; tries: ${failing.tries.length}`).toBe(true)
    const triesWhenShown = failing.tries.length
    expect(triesWhenShown, 'the first try and at least two more, so the waits can be seen to grow').toBeGreaterThanOrEqual(3)
    expect(triesWhenShown, 'a bounded number of tries').toBeLessThanOrEqual(MAX_TRIES)
    const gaps = waits(failing.tries)
    for (let i = 1; i < gaps.length; i++) expect(gaps[i], `wait ${i + 1} (${gaps.join(', ')} ms) is no shorter than wait ${i}`).toBeGreaterThanOrEqual(gaps[i - 1]!)
    expect(gaps.at(-1)!, `the last wait is longer than the first (${gaps.join(', ')} ms): a backoff`).toBeGreaterThan(gaps[0]!)

    await tick(10 * 60_000)
    expect(failing.tries.length, 'no try after the problem was shown (10 minutes on)').toBe(triesWhenShown)
    expect(region('top-bar'), 'the frame stays round the problem').not.toBeNull()
    expect(barUnderTopBar(), 'a fault is not "can’t be reached" while the server answers').toBeUndefined()
  })
})

describe.each(SCREENS)('$name, when the server refuses (4xx)', (screen) => {
  it.each([
    [404, { code: 'platform.not_found', params: {} }],
    [409, { code: 'platform.conflict', params: {} }],
    [422, { detail: [{ type: 'missing', loc: ['query', 'x'], msg: 'Field required' }] }],
  ])('takes a %i as the answer: one try, shown at once, never tried again', async (status, body) => {
    const refusing = outage(screen, { kind: 'refusal', status, body })
    await open(screen, refusing)
    expect(await until(() => alerts().length > 0, 5_000), 'an alert on the page').toBe(true)
    await tick(10 * 60_000)
    expect(refusing.tries.length, 'tries of a refused address in 10 minutes').toBe(1)
    expect(region('top-bar'), 'the frame stays round the refusal').not.toBeNull()
  })
})
