/*
 * S15-W3 (issue #547, superseding #219): Ctrl Z after an answer, and a refused answer's words.
 *
 * docs/design/m0-screens.md §6.9: "Undo (`Ctrl Z`): undoes the last act … An answer that confirmed or
 * excluded sheets is never undone, nor anything before it: Ctrl Z after one says so in §5's words.
 * Ctrl Z passes over any other answer (one that only recorded a pick, or kept the Question open), to
 * the act before it (the orchestrator's ruling, session 11)." §5: "If Step 1 cannot reload after an act
 * or an undo, the toast adds: "Step 1 could not be reloaded, so the confirmed count may be behind.
 * Reload the page to see it."" (so a reload is asked for only when Step 1 could not reload).
 *
 * #219: "After an answer that made no act (e.g. Q3's typed number), a refused Ctrl Z takes two presses
 * to settle; the first posts `/step1/undo`, gets a 409, and shows the server's words ("… To change
 * another person's …": "another person's" is wrong for the QS who just answered)"; "A refused answer
 * shows "Reload the page to see where it stands" after the screen has already reloaded."
 *
 * The answer that only records is the no-number Question's "Type a number" (A-08): 21c gives the
 * sheet the number and confirms nothing (§6.7: "Answering gives the sheet the number you type; confirm
 * it in the list."). The answer that confirms is ../t202's, not repeated here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { answerByKeys, bodyText, ctrlZ, idle, openWith, toastMatching, toastText } from './w3.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const ANSWER_STAYS = 'Nothing undone: an answer to a Question cannot be undone, nor anything before it.'

describe('Ctrl Z after an answer that only recorded a pick (§6.9; #219)', () => {
  it('passes over the answer and undoes the act before it with one press', async () => {
    const { fake, question } = await openWith('missing')
    // An act of the QS's own from before the answer (made in an earlier visit): the server's undo takes it back.
    fake.step1.answerOnce('POST /undo', 200, { confirmation_id: 'e5470000-0000-4000-8000-000000000001', act: 'confirmed', sheets: 1, by: 'Nusrat Jahan', at: '2026-10-06T05:00:00Z' })
    await answerByKeys(question, 'type_number', 'A-08')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await idle()
    await ctrlZ()
    await toastMatching('Undone: confirmed 1 sheet')
    await idle()
    expect(fake.step1.calls().filter((c) => c === 'POST /undo'), 'undo asked of the server').toHaveLength(1)
    expect(bodyText()).not.toContain(ANSWER_STAYS)
  })

  it('settles with one press when nothing is left to undo: the words of the first press are the last', async () => {
    const { fake, question } = await openWith('missing')
    await answerByKeys(question, 'type_number', 'A-08')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await idle()
    await ctrlZ()
    await waitFor(() => expect(toastText(), 'a toast after the one Ctrl Z').not.toBe(''))
    await idle()
    const first = toastText()
    // Nothing more happens without another press: no second undo asked, no other words.
    await idle()
    expect(fake.step1.calls().filter((c) => c === 'POST /undo').length, 'undo asked of the server').toBeLessThanOrEqual(1)
    expect(toastText()).toBe(first)
  })

  it('never speaks of another person’s changes to the QS who just answered', async () => {
    const { fake, question } = await openWith('missing')
    await answerByKeys(question, 'type_number', 'A-08')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await idle()
    await ctrlZ()
    await waitFor(() => expect(toastText(), 'a toast after the one Ctrl Z').not.toBe(''))
    await idle()
    expect(toastText()).not.toMatch(/another person/i)
  })
})

describe('a refused answer, once Step 1 has reloaded (§5; #219)', () => {
  it('does not ask the QS to reload the page', async () => {
    const { fake, question } = await openWith('missing')
    // Answered in another tab meanwhile: 21c refuses the second answer.
    fake.refuseNext = { status: 409, body: { code: 'takeoff.proposals.answered_already', params: {} } }
    await answerByKeys(question, 'no_number')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(toastText(), 'the refusal’s toast').not.toBe(''))
    await idle()
    // Step 1 reloaded after the refusal (its Questions read again).
    expect(fake.step1.calls().filter((c) => c === 'GET /questions').length).toBeGreaterThan(1)
    expect(toastText()).not.toMatch(/Reload the page/i)
  })
})
