/*
 * Answering on Step 1, #156's fix round 3 (the design gate): the drawing-list Question's toast names the
 * act (item 1); Enter in an empty "Type a number" field says what to type instead of nothing (item 2).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from '@/acceptance/t156/answer.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

async function openWith(kind: string) {
  const fake = new FakeAnswers()
  const question = fake.byKind()[kind]!
  fake.questions = [question]
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

const cardOf = (tag: string) => screen.findByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` })
const NUMBER_FIRST = 'Type the sheet’s number first, as its title block should read.'

describe('the drawing-list Question’s toast names the act (round 3, item 1)', () => {
  it('says S-13 stays in the count as missing, never the bare "Q1 answered."', async () => {
    const { fake } = await openWith('check')
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('1')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(fake.posted.length).toBe(1))
    await waitFor(() => expect(bodyText()).toContain('Q1 answered. S-13 stays in the count as missing.'))
  })
})

describe('an empty typed number is refused aloud (round 3, item 2)', () => {
  it('keeps focus in the field, marks it invalid and says what to type, politely; typing clears it', async () => {
    const { question, calls } = await openWith('missing')
    await userEvent.keyboard('q')
    const card = await cardOf('Q1')
    await userEvent.keyboard(String(question.options.findIndex((o) => o.key === 'type_number') + 1))
    const field = await within(card).findByRole('textbox', { name: /number/ })
    await waitFor(() => expect(document.activeElement).toBe(field))
    expect(clean(card.textContent)).toContain('As its title block should read. Enter answers.')
    expect(field.getAttribute('aria-invalid')).toBeNull()

    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(document.activeElement).toBe(field)
    const error = card.querySelector<HTMLElement>('[data-field-error]')
    expect(clean(error?.textContent)).toBe(NUMBER_FIRST)
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(error?.id)
    expect(clean(card.textContent)).not.toContain('As its title block should read. Enter answers.')
    const status = within(card).getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(clean(status.textContent)).toBe(NUMBER_FIRST)
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])

    // Blank is empty too.
    await userEvent.type(field, '   ')
    expect(field.getAttribute('aria-invalid')).toBeNull()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])

    await userEvent.type(field, 'S-99')
    expect(field.getAttribute('aria-invalid')).toBeNull()
    expect(clean(card.textContent)).toContain('As its title block should read. Enter answers.')
    expect(clean(within(card).getByRole('status').textContent)).toBe('')
  })
})
