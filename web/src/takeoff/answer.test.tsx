/*
 * Answering on Step 1 (#156) beyond its acceptance tests: the toast names what the answer did (it is
 * drawn outside the format's provider, so its words must not need it); Ctrl Z after an answer takes
 * nothing back and says so (21c has no undo for an answer, and the server's latest acts are the
 * answer's own); a refusal carrying a list of sheets is worded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '@/acceptance/t156/answer.fixture'

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

async function openWith(kind: string) {
  const fake = new FakeAnswers()
  const question = fake.byKind()[kind]!
  fake.questions = [question]
  return mount(fake, question)
}

async function mount(fake: FakeAnswers, question: ReturnType<FakeAnswers['byKind']>[string]) {
  const calls: string[] = []
  const base = fake.api.handle
  fake.api.handle = async (request: Request) => {
    calls.push(`${request.method} ${new URL(request.url, location.origin).pathname}`)
    return base(request)
  }
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return { fake, question, calls }
}

async function pickAndAnswer(digit: number) {
  await userEvent.keyboard('q')
  await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
  await userEvent.keyboard(String(digit))
  await userEvent.keyboard('{Enter}')
}

describe('after an answer (#156)', () => {
  it('toasts what keeping the latest copy did, naming both copies by their marks', async () => {
    const { fake } = await openWith('same_number')
    await pickAndAnswer(1)
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await waitFor(() => expect(bodyText()).toContain('Q1 answered. Confirms S-07 rev B and excludes rev A as superseded.'))
  })

  it('takes nothing back on Ctrl Z after an answer, and says so', async () => {
    const { calls } = await openWith('same_title')
    await pickAndAnswer(1)
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Nothing was undone: the last thing you did on Step 1 was answer a Question, and undo does not take back an answer or anything you did before it.'))
    expect(calls.filter((c) => c.endsWith('/undo'))).toEqual([])
  })

  it('answers nothing on Enter before a pick, the bar saying to pick one', async () => {
    const { fake } = await openWith('check')
    await userEvent.keyboard('q')
    await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await waitFor(() => expect(bodyText()).toContain('Pick an answer: 1, 2, 3, 4.'))
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Pick an answer to Q1 first: 1, 2, 3, 4'))
    expect(fake.posted).toHaveLength(0)
  })

  it('never sends an undo on Ctrl Z after an answer that made an act, however often pressed (the refuter, A)', async () => {
    const { calls } = await openWith('same_title')
    await pickAndAnswer(1)
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    for (let i = 0; i < 3; i++) {
      await userEvent.keyboard('{Control>}z{/Control}')
      await waitFor(() => expect(bodyText()).toContain('Nothing was undone: the last thing you did on Step 1 was answer a Question, and undo does not take back an answer or anything you did before it.'))
    }
    await new Promise((r) => setTimeout(r, 300))
    expect(calls.filter((c) => c.endsWith('/undo'))).toEqual([])
  })

  it('answers the card whose number field Enter is pressed in, never the sheet open (the refuter, B)', async () => {
    const { calls } = await openWith('missing')
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    const active = () => document.activeElement as HTMLElement | null
    const number = () => (active()?.getAttribute('role') === 'row' ? (active()!.querySelectorAll('[role="gridcell"]')[1]?.textContent ?? '').replace(/[⁦-⁩‎‏\s]/g, '') : '')
    for (let i = 0; i < 30 && number() !== 'S-02'; i++) await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-02/ })
    await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.click(within(card).getAllByRole('radio')[1]!)
    await userEvent.type(await within(card).findByRole('textbox'), 'S-99')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(calls.filter((c) => c.startsWith('POST'))).toEqual([expect.stringMatching(/\/answer$/)]))
  })

  it('does nothing on Enter while the exclusion picker is open over a Question (the refuter, C)', async () => {
    const { calls } = await openWith('same_number')
    await userEvent.keyboard('q')
    await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard('1')
    await userEvent.keyboard('x')
    await screen.findByRole('group', { name: 'Exclusion reasons' })
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 400))
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
  })
})

// Fix round 1, F1 (75): the card's options take focus, so Enter on one and the arrows between them
// are the card's own: the key map leaves a radio's Enter and a radiogroup's arrows to the focused element.
describe('keys on a card’s options (#156, fix round 1)', () => {
  it('answers on Enter with an option focused after a click (A2)', async () => {
    const { fake, question } = await openWith('same_number')
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    const first = within(card).getAllByRole('radio')[0]!
    await userEvent.click(first)
    expect(document.activeElement).toBe(first)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    expect(fake.posted[0]!.question).toBe(question.id)
    expect(fake.posted[0]!.body).toMatchObject({ option: question.options[0]!.key })
  })

  it('moves the pick with the arrows inside the card, the card staying in the Selection (A3)', async () => {
    const { fake, question } = await openWith('same_number')
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard('1')
    const radios = within(card).getAllByRole('radio')
    radios[0]!.focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect((radios[1] as HTMLInputElement).checked).toBe(true))
    expect(document.activeElement).toBe(radios[1])
    expect(card.isConnected).toBe(true)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    expect(fake.posted[0]!.body).toMatchObject({ option: question.options[1]!.key })
  })

  it('names the options as one group of answers', async () => {
    await openWith('same_number')
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    expect(within(card).getByRole('radiogroup', { name: 'Answers' })).toBeTruthy()
  })

  it('keeps Answer off until a number is typed under "Type a number"', async () => {
    const { question } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    const field = await within(card).findByRole('textbox')
    const button = within(card).getByRole('button', { name: (n: string) => clean(n).startsWith('Answer Q1') })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(field, '  ')
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(field, 'S-99')
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('never excludes from a card while the picker holds a typed reason: Enter on an option or in the number field (the refuter, round 1)', async () => {
    for (const kind of ['same_number', 'missing']) {
      document.body.innerHTML = ''
      const { calls, question, fake } = await openWith(kind)
      await userEvent.keyboard('q')
      const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
      await userEvent.keyboard('x')
      await userEvent.keyboard('7')
      await screen.findByRole('textbox', { name: 'The reason, in a few words' })
      await userEvent.keyboard('oops')
      if (kind === 'missing') {
        await userEvent.click(within(card).getAllByRole('radio')[question.options.findIndex((o) => o.key === 'type_number')]!)
        await userEvent.type(await within(card).findByRole('textbox', { name: /number/ }), 'S-99')
      } else {
        await userEvent.click(within(card).getAllByRole('radio')[0]!)
      }
      await userEvent.keyboard('{Enter}')
      await new Promise((r) => setTimeout(r, 400))
      expect({ kind, posts: calls.filter((c) => c.startsWith('POST')), answers: fake.posted.length }).toEqual({ kind, posts: [], answers: 0 })
    }
  })
})
