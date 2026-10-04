/*
 * Ticket 202's acceptance tests (issue #202): Step 1's answers and Ctrl Z after session 09's ruling on
 * #156 (the server's undo refuses an act made by answering a Question, `takeoff.step1.answer_stays`),
 * and #156's re-check (25 each): a double Enter posts an answer once; Enter in an empty "Type a number"
 * posts nothing; a `low_confidence` answer refused as `question_first` does not hold Ctrl Z.
 *
 * Built on 156's fake (../t156/answer.fixture.ts) over 22's (../t22/step1.fixture.ts). Chosen by the
 * acceptance writer (the report lists them): the words for Ctrl Z after an answer are the catalogue's
 * `takeoff.step1.answer_stays`, one source for the in-tab refusal and the server's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers, type Question21c } from '../t156/answer.fixture'

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
const PATH = '/p/KR-01/takeoff/1'

/** The catalogue's words for `takeoff.step1.answer_stays` (web/src/messages/takeoff/step1/en.po). */
const ANSWER_STAYS =
  'Nothing was undone: the last thing you did on Step 1 was answer a Question, and undo does not take back an answer or anything you did before it. To change what the answer decided, exclude a sheet it confirmed, or confirm back in a sheet it excluded.'

/** Step 1 takes keys again: its act, its undos and the reloads after them have ended (the screen's aria-busy). */
const idle = () => waitFor(() => expect(document.querySelector('[data-step1]')?.getAttribute('aria-busy')).not.toBe('true'), { timeout: 5000 })
const undos = (fake: FakeAnswers) => fake.step1.calls().filter((c) => c === 'POST /undo').length
const ctrlZ = () => userEvent.keyboard('{Control>}z{/Control}')

/** KR-01 with only `kind`'s Question open. */
async function openWith(kind: string): Promise<{ fake: FakeAnswers; question: Question21c }> {
  const fake = new FakeAnswers()
  const question = fake.byKind()[kind]!
  fake.questions = [question]
  await mountApp(PATH, { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return { fake, question }
}

/** `Q` to the Question, the digit of `key`'s option, then Enter. */
async function answerByKeys(question: Question21c, key: string) {
  await userEvent.keyboard('q')
  await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
  const digit = question.options.findIndex((o) => o.key === key) + 1
  expect(digit, `${key} is offered`).toBeGreaterThan(0)
  await userEvent.keyboard(String(digit))
  await userEvent.keyboard('{Enter}')
}

describe('a double Enter posts an answer once (#202; #156 re-check)', () => {
  it('ignores a second Enter pressed before the answer’s reply', async () => {
    const { fake, question } = await openWith('same_title')
    await userEvent.keyboard('q')
    await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'keep_all') + 1))
    await userEvent.keyboard('{Enter}{Enter}')
    await idle()
    expect(fake.posted).toHaveLength(1)
  })
})

describe('Enter in an empty "Type a number" posts nothing (#202; #156 re-check)', () => {
  it('posts no answer on Enter in the empty number field', async () => {
    const { fake, question } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    const field = await within(card).findByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(field))
    await userEvent.keyboard('{Enter}')
    await idle()
    expect(fake.posted).toEqual([])
  })

  it('posts no answer on Enter in a number field holding only spaces', async () => {
    const { fake, question } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    const field = await within(card).findByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(field))
    await userEvent.keyboard('   {Enter}')
    await idle()
    expect(fake.posted).toEqual([])
  })
})

describe('Ctrl Z after an answer (#202: session 09’s ruling on #156)', () => {
  it('does not ask the server to undo an answer that confirmed sheets, and words why with the catalogue’s answer_stays', async () => {
    const { fake, question } = await openWith('same_title')
    await answerByKeys(question, 'keep_all')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await idle()
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain(ANSWER_STAYS))
    await idle()
    expect(undos(fake)).toBe(0)
    // Its two sheets stay confirmed.
    expect(fake.step1.proposals.filter((p) => question.proposals.includes(p.id)).map((p) => p.decision)).toEqual(['confirmed', 'confirmed'])
  })

  it('words the server’s answer_stays refusal the same, on a tab that did not make the answer', async () => {
    const { fake } = await openWith('check')
    fake.step1.answerOnce('POST /undo', 409, { code: 'takeoff.step1.answer_stays', params: {} })
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain(ANSWER_STAYS))
  })
})

describe('a low_confidence answer refused as question_first does not hold Ctrl Z (#202; #156 re-check)', () => {
  it('lets Ctrl Z go past the refused answer to undo the act before it', async () => {
    const { fake, question } = await openWith('low_confidence')
    // An act of the QS's from before this tab: the server's undo takes it back.
    fake.step1.answerOnce('POST /undo', 200, { confirmation_id: 'e2020000-0000-4000-8000-000000000001', act: 'confirmed', sheets: 1, by: 'Nusrat Jahan', at: '2026-10-04T05:00:00Z' })
    fake.refuseNext = { status: 409, body: { code: 'takeoff.step1.question_first', params: { count: 1, asks: 'other', sheet: 'A-05', named: 'number', question: 'Q2' } } }
    await answerByKeys(question, 'section')
    await waitFor(() => expect(bodyText()).toContain('Nothing was confirmed:'))
    await idle()
    // The refused answer made nothing: as after any act refused outright, one Ctrl Z says so, the next undoes the act before.
    await ctrlZ()
    await idle()
    await ctrlZ()
    await waitFor(() => expect(bodyText()).toContain('Undone: confirmed 1 sheet'))
    expect(undos(fake)).toBe(1)
    expect(bodyText()).not.toContain(ANSWER_STAYS)
    expect(bodyText()).not.toContain('does not take back an answer')
  })
})
