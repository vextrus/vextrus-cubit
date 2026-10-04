/*
 * Answering on Step 1, #156's fix round 2 (the design gate's walk): the card's first line follows the
 * pick (§6.7, M3); Ctrl Z is held by an answer from the moment it is sent (CI's slowed run); a tag is
 * fixed for life (M1).
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

async function mount(fake: FakeAnswers, delay = 0) {
  const calls: string[] = []
  const base = fake.api.handle
  fake.api.handle = async (request: Request) => {
    calls.push(`${request.method} ${new URL(request.url, location.origin).pathname}`)
    if (delay && request.method === 'POST') await new Promise((r) => setTimeout(r, delay))
    return base(request)
  }
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return calls
}

async function openWith(kind: string, delay = 0) {
  const fake = new FakeAnswers()
  const question = fake.byKind()[kind]!
  fake.questions = [question]
  const calls = await mount(fake, delay)
  return { fake, question, calls }
}

const cardOf = (tag: string) => screen.findByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` })
const cardText = (card: HTMLElement) => clean(card.textContent)

describe('the card’s first line follows the pick (§6.7; the walk, M3)', () => {
  it('words each pick on the held file, and asks for a pick before one', async () => {
    await openWith('file_misread')
    await userEvent.keyboard('q')
    const card = await cardOf('Q1')
    await waitFor(() => expect(cardText(card)).toContain('Pick an answer: 1, 2, 3, 4.'))
    await userEvent.keyboard('1')
    await waitFor(() => expect(cardText(card)).toMatch(/Answering reads .* anyway: its sheets join the list as Proposals, each marked held, and their figures are flagged later\./))
    await userEvent.keyboard('2')
    await waitFor(() => expect(cardText(card)).toContain('Answering sets the file aside: none of its sheets is read or counted. Structural can still be confirmed.'))
    expect(cardText(card)).not.toContain('Answering decides whether')
    await userEvent.keyboard('4')
    await waitFor(() => expect(cardText(card)).toContain('Answering keeps the file held. Structural cannot be confirmed until it is answered.'))
  })

  it('words each pick on a drawing-list entry in no file', async () => {
    await openWith('check')
    await userEvent.keyboard('q')
    const card = await cardOf('Q1')
    await userEvent.keyboard('1')
    await waitFor(() => expect(cardText(card)).toContain('Answering keeps S-13 in the count as missing. Structural can still be confirmed.'))
    expect(cardText(card)).not.toContain('Answering confirms no sheets')
    await userEvent.keyboard('2')
    await waitFor(() => expect(cardText(card)).toContain('Answering records that S-13 is not part of this set; the drawing list still counts it.'))
    await userEvent.keyboard('4')
    await waitFor(() => expect(cardText(card)).toContain('Answering keeps S-13 open. Structural cannot be confirmed until this Question is answered.'))
  })

  it('words "Type a number" and "Leave it without a number"', async () => {
    const { question } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await cardOf('Q1')
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    await waitFor(() => expect(cardText(card)).toContain('Answering gives the sheet the number you type; confirm it in the list.'))
    expect(cardText(card)).not.toContain('Answering settles')
    await userEvent.click(within(card).getAllByRole('radio')[question.options.findIndex((o) => o.key === 'no_number')]!)
    await waitFor(() => expect(cardText(card)).toContain('Answering leaves the sheet without a number; confirm it in the list.'))
  })
})

describe('Ctrl Z while an answer is in flight (CI’s slowed run)', () => {
  it('sends no undo for a Ctrl Z pressed before the answer’s reply, however often', async () => {
    const { calls } = await openWith('same_title', 300)
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(calls.some((c) => c.endsWith('/answer'))).toBe(true))
    for (let i = 0; i < 3; i++) await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Nothing was undone: the last thing you did on Step 1 was answer a Question, and undo does not take back an answer or anything you did before it.'), { timeout: 3000 })
    await new Promise((r) => setTimeout(r, 1200))
    expect(calls.filter((c) => c.endsWith('/undo'))).toEqual([])
  })
})

describe('a Question’s tag is fixed for life (the walk, M1)', () => {
  it('names an answered Question by the same tag in its card, its toast and the Answered list', async () => {
    const fake = new FakeAnswers()
    const kinds = fake.byKind()
    // Raised in this order; the queue puts the two copies first, so their place in the queue is 1, not 3.
    fake.questions = [kinds.low_confidence!, kinds.missing!, kinds.same_number!].map((q, i) => ({ ...q, raised: i + 1 }))
    await mount(fake)
    await userEvent.keyboard('q')
    const card = await cardOf('Q3')
    await userEvent.click(within(card).getAllByRole('radio')[0]!)
    await userEvent.click(within(card).getByRole('button', { name: (n: string) => clean(n).startsWith('Answer Q3') }))
    await waitFor(() => expect(bodyText()).toContain('Q3 answered.'))
    await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    const line = await waitFor(() => {
      const li = [...document.querySelectorAll('li')].find((l) => clean(l.textContent).includes('superseded'))
      expect(li).toBeTruthy()
      return li!
    })
    expect(clean(line.textContent)).toMatch(/^Q3 Keep/)
    // The two still open keep their tags, Q1 and Q2, though one of them now leads the queue.
    expect(await cardOf('Q1')).toBeTruthy()
    expect(screen.queryByRole('region', { name: (n: string) => clean(n) === 'Question Q3' })).toBeNull()
  })
})

describe('an empty number is never sent (the walk, M4)', () => {
  it('does nothing on Enter in the empty number field, focus staying in it, the bar’s Answer off as the card’s', async () => {
    const { question, calls } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await cardOf('Q1')
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    const field = await within(card).findByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(field))
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 300))
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
    expect(document.activeElement).toBe(field)
    expect(bodyText()).not.toContain('Pick an answer to Q1 first')
    const answers = screen.getAllByRole('button', { name: (n: string) => clean(n).startsWith('Answer Q1') })
    expect(answers.length).toBeGreaterThan(1)
    for (const b of answers) expect((b as HTMLButtonElement).disabled).toBe(true)
  })

  it('refuses Enter in the empty field under it: focus kept, the field invalid, the hint replaced, said politely (round 3)', async () => {
    const { question, calls } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await cardOf('Q1')
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    const field = await within(card).findByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(field))
    expect(field.getAttribute('aria-invalid')).toBeNull()
    expect(cardText(card)).toContain('As its title block should read. Enter answers.')
    await userEvent.keyboard('{Enter}')
    const refusal = 'Type the sheet’s number first, as its title block should read.'
    await waitFor(() => expect(cardText(card)).toContain(refusal))
    expect(cardText(card)).not.toContain('As its title block should read. Enter answers.')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(field)
    const error = within(card).getByText(refusal)
    expect(error.closest('[aria-live="polite"]')).not.toBeNull()
    expect(field.getAttribute('aria-describedby') ?? '').toContain(error.id)
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
    // Typed, the refusal goes and the hint is back.
    await userEvent.keyboard('A-08')
    await waitFor(() => expect(cardText(card)).toContain('As its title block should read. Enter answers.'))
    expect(field.getAttribute('aria-invalid')).toBeNull()
  })

  it('focuses the row the bar names once the last Question is answered', async () => {
    await openWith('same_title')
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    await waitFor(() => expect(document.activeElement?.getAttribute('role'), document.activeElement?.outerHTML.slice(0, 200)).toBe('row'))
  })
})

describe('the bar while Step 1 reloads after an answer (the walk, M5)', () => {
  it('never shows the bulk act while the answer and its reload are in flight', async () => {
    const fake = new FakeAnswers()
    const kinds = fake.byKind()
    fake.questions = [kinds.same_title!, kinds.missing!]
    let slow = false
    const base = fake.api.handle
    fake.api.handle = async (request: Request) => {
      if (request.method === 'POST' && request.url.endsWith('/answer')) slow = true
      if (slow) await new Promise((r) => setTimeout(r, 150 + Math.random() * 150))
      return base(request)
    }
    await mount(fake)
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    const seen: string[] = []
    const until = performance.now() + 1500
    while (performance.now() < until) {
      for (const b of screen.queryAllByRole('button')) {
        const name = clean(b.textContent)
        if (/^(Confirm \d+|Leave out \d+)/.test(name) && !(b as HTMLButtonElement).disabled) seen.push(name)
      }
      await new Promise((r) => setTimeout(r, 15))
    }
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    expect(seen).toEqual([])
  })
})

describe('the toast names what the answer did (§6.5; the walk, M7)', () => {
  it('says the held file is set aside', async () => {
    await openWith('file_misread')
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('2')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Q1 answered. The file is set aside, waiting for the re-saved file.'))
  })

  it('says what kind of sheet the answer confirmed', async () => {
    await openWith('low_confidence')
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Q1 answered. A-05’s kind is Elevation.'))
  })
})

describe('a Check’s first lines say only what 21c does (the words gate, round 2)', () => {
  async function openCheck(code: string, params: Record<string, unknown>) {
    const fake = new FakeAnswers()
    fake.questions = [{ ...fake.byKind().check!, code, params }]
    await mount(fake)
    await userEvent.keyboard('q')
    return cardOf('Q1')
  }

  it('never says a sheet in a file but off the list is missing', async () => {
    const card = await openCheck('engine.register_check.not_listed', { number: 'S-02' })
    await userEvent.keyboard('1')
    await waitFor(() => expect(cardText(card)).toContain('Answering records your pick; S-02 stays in the list, to confirm or exclude.'))
    expect(cardText(card)).not.toContain('Answering keeps S-02 in the count as missing')
    await userEvent.keyboard('2')
    await waitFor(() => expect(cardText(card)).toContain('Answering records that S-02 is not part of this set; exclude it in the list.'))
  })

  it('never says a gap’s missing sheets are in the count (no drawing list counts them)', async () => {
    const card = await openCheck('engine.register_check.gap', { after: 'S-03', before: 'S-05', missing: 1 })
    await userEvent.keyboard('1')
    await waitFor(() => expect(cardText(card)).toContain('Answering records that the missing sheet is still to come. Paste the drawing list to count it.'))
    expect(cardText(card)).not.toContain('Answering keeps the missing sheet in the count')
  })
})

describe('the read-anyway toast promises the read, not its result', () => {
  it('says the file is being read again', async () => {
    await openWith('file_misread')
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Q1 answered. Reading the file again: its sheets join the list, marked held, once it is read.'))
  })
})
