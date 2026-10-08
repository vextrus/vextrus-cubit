/*
 * Ticket S15-W1's acceptance test, acts (the orchestrator's addition, 0:47: "S15-A2 makes a Step 1 act
 * that hits the lock_timeout return 503 {code, params}. The 5xx retry must apply to reads (queries)
 * only: a mutation (an act) is never retried automatically, and its 503 refusal is shown to the QS in
 * words"). S15-A2 pins `step1.act_lock_timeout.refusal_status = 503` and leaves the code to its
 * builder ("the catalogue must word it"); a code the catalogue words today stands in for it here.
 *
 * The act is Ctrl Z on Step 1 (the server's undo, `POST …/takeoff/step1/undo`), the one act the QS
 * can make with no row chosen; the clock faked, so ten minutes pass with no automatic second try.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { clean, fakeClock, settle, tick, until } from './server.fixture'

/** A code the catalogue words (web/src/messages/takeoff/step1/en.po), standing in for S15-A2's. */
const STAND_IN = { code: 'takeoff.step1.discipline_unknown', params: {} }
const STAND_IN_WORDS = 'This page named a Discipline Vextrus does not have. Reload the page and try again.'

beforeEach(async () => {
  await page.viewport(1440, 900)
  onlineManager.setOnline(true)
  fakeClock()
})

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
})

const bodyText = () => clean(document.body.textContent)

describe('a Step 1 act the server answers with a fault (503)', () => {
  it('is never tried again by itself, and its refusal is shown in the catalogue’s words', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    await settle(mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api }))
    expect(await until(() => bodyText().includes('Confirmed 0 / 24'), 10_000), 'Step 1 open').toBe(true)
    step1.answerOnce('POST /undo', 503, STAND_IN)
    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true })
    expect(await until(() => bodyText().includes(STAND_IN_WORDS), 10_000), `the refusal in words: "${STAND_IN_WORDS}"`).toBe(true)
    await tick(10 * 60_000)
    const undos = step1.calls().filter((c) => c === 'POST /undo')
    expect(undos.length, 'tries of the act in 10 minutes').toBe(1)
  })
})
