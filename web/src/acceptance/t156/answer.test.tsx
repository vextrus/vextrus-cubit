/*
 * Ticket 156's acceptance tests (issue #156, B1): the QS answers Questions on the Step 1 screen, by
 * keyboard only (m0-screens §6.7, §6.15: `Q` next open Question, `1`–`9` pick an answer on the focused
 * Question, `Enter` "Answer Q1 ↵"), through 21c's answer operation (answer.fixture.ts). The POST body
 * carries the chosen option key; the list, the progress and the inspector update without a reload.
 *
 * Chosen by the acceptance writer (the report lists them): each test mounts one open Question, so `Q`
 * lands on it; after "Type a number" is picked, the number field in the card has the focus.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers, type Question21c } from './answer.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-30T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'

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

async function posted(fake: FakeAnswers, question: Question21c, body: Record<string, unknown>) {
  await waitFor(() => expect(fake.posted).toHaveLength(1))
  expect(fake.posted[0]!.question).toBe(question.id)
  expect(fake.posted[0]!.body).toMatchObject(body)
}

describe('answering each kind of Question by keyboard (#156 B1; m0-screens §6.7, §6.15)', () => {
  it('answers a held file "Set this file aside and mark it for Vextrus to look at" with sent_to_vextrus', async () => {
    const { fake, question } = await openWith('file_misread')
    await answerByKeys(question, 'sent_to_vextrus')
    await posted(fake, question, { option: 'sent_to_vextrus' })
  })

  it('answers two sheets of one number with keep_latest', async () => {
    const { fake, question } = await openWith('same_number')
    await answerByKeys(question, 'keep_latest')
    await posted(fake, question, { option: 'keep_latest' })
  })

  it('answers two sheets of one title with keep_all', async () => {
    const { fake, question } = await openWith('same_title')
    await answerByKeys(question, 'keep_all')
    await posted(fake, question, { option: 'keep_all' })
  })

  it('answers two drawing lists that differ with use_read', async () => {
    const { fake, question } = await openWith('lists_disagree')
    await answerByKeys(question, 'use_read')
    await posted(fake, question, { option: 'use_read' })
  })

  it('answers a sheet with no number with type_number and the number typed', async () => {
    const { fake, question } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    const field = await within(card).findByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(field))
    await userEvent.keyboard('A-08')
    await userEvent.keyboard('{Enter}')
    await posted(fake, question, { option: 'type_number', text: 'A-08' })
  })

  it('answers a sheet with no Discipline with the Discipline’s key', async () => {
    const { fake, question } = await openWith('missing_discipline')
    await answerByKeys(question, 'architectural')
    await posted(fake, question, { option: 'architectural' })
  })

  it('answers a sheet whose kind is unclear with the kind’s key', async () => {
    const { fake, question } = await openWith('low_confidence')
    await answerByKeys(question, 'section')
    await posted(fake, question, { option: 'section' })
  })

  it('answers a boundary storey with includes_storey', async () => {
    const { fake, question } = await openWith('convention')
    await answerByKeys(question, 'includes_storey')
    await posted(fake, question, { option: 'includes_storey' })
  })

  it('answers a Check against the drawing list with not_sent_yet', async () => {
    const { fake, question } = await openWith('check')
    await answerByKeys(question, 'not_sent_yet')
    await posted(fake, question, { option: 'not_sent_yet' })
  })

  it('keeps a Question open with keep_open, and its card then says "Kept open"', async () => {
    const { fake, question } = await openWith('check')
    await answerByKeys(question, 'keep_open')
    await posted(fake, question, { option: 'keep_open' })
    await waitFor(() => expect(clean(screen.getByRole('region', { name: (n: string) => clean(n) === 'Question Q1' }).textContent)).toContain('Kept open'))
  })
})

describe('after an answer (#156 B1)', () => {
  it('updates the list, the progress and the inspector without a reload', async () => {
    const { fake, question } = await openWith('same_title')
    ;(window as unknown as Record<string, unknown>).__t156 = 'same page'
    expect(bodyText()).toContain('0 / 3 settled')
    await answerByKeys(question, 'keep_all')
    await posted(fake, question, { option: 'keep_all' })

    // The toast names the act (§6.5: "Q3 answered. …").
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    // The list: no open Question row is left.
    const grid = screen.getByRole('grid', { name: 'Sheets' })
    await waitFor(() => expect(within(grid).queryAllByRole('row').filter((r) => clean(r.textContent).includes('Question Q1'))).toHaveLength(0))
    // The progress: the two sheets the Question held are confirmed.
    await waitFor(() => expect(bodyText()).toContain('2 / 3 settled'))
    // The inspector: none open, and the answer under "Answered" with who gave it (§6.6).
    await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    await waitFor(() => expect(bodyText()).toContain('No open Questions.'))
    expect(bodyText()).toContain('Answered')
    expect(bodyText()).toMatch(/Q1 .*Nusrat Jahan/)
    expect((window as unknown as Record<string, unknown>).__t156).toBe('same page')
  })

  it('shows the catalogue’s words when the Question was answered elsewhere first (409)', async () => {
    const { fake, question } = await openWith('check')
    fake.refuseNext = { status: 409, body: { code: 'takeoff.proposals.answered_already', params: {} } }
    await answerByKeys(question, 'not_sent_yet')
    await waitFor(() => expect(bodyText()).toContain('This Question is already answered or no longer asked, so nothing was changed. Reload the page to see where it stands.'))
  })
})
