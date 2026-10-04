/*
 * Ticket 156's acceptance tests (issue #156, W4): "every option key every Question code can carry has
 * an English message", so "An answer Vextrus has no words for yet" is unreachable. The codes and keys
 * are options.fixture.ts's, which options.node.test.ts proves are the backend's (21c, PR #152).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers } from './answer.fixture'
import { QUESTION_SHAPES } from './options.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const UNWORDED = 'An answer Vextrus has no words for yet'

async function questionsTab(fake: FakeAnswers) {
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
}

describe('every option has words (#156 W4)', () => {
  it('words every option key of every Question code, never "An answer Vextrus has no words for yet"', async () => {
    const fake = new FakeAnswers()
    fake.questions = fake.everyShape()
    await questionsTab(fake)
    const radios = await waitFor(() => {
      const all = screen.getAllByRole('radio')
      expect(all).toHaveLength(QUESTION_SHAPES.reduce((n, s) => n + s.options.length, 0))
      return all
    })
    for (const radio of radios) {
      const words = clean(radio.closest('label')?.textContent ?? '')
      const key = radio.getAttribute('value') ?? ''
      expect(words, key).not.toContain(UNWORDED)
      expect(words, key).not.toContain(key.includes('_') ? key : '\u0000')
      expect(words.replace(/^\d+\s*/, '').length, key).toBeGreaterThan(1)
    }
    expect(bodyText()).not.toContain(UNWORDED)
  })

  it('words the two sheets of one number’s options: keep the later copy, keep both, keep open', async () => {
    const fake = new FakeAnswers()
    fake.questions = [fake.byKind().same_number!]
    await questionsTab(fake)
    const card = await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    const labels = within(card).getAllByRole('radio').map((r) => clean(r.closest('label')?.textContent ?? ''))
    expect(labels).toHaveLength(3)
    expect(labels[0]).toMatch(/Keep rev B.*; leave rev A out as superseded/)
    expect(labels[1]).toMatch(/keep both/i)
    expect(labels[2]).toContain('Keep open, ask the consultant')
    expect(clean(card.textContent)).not.toContain(UNWORDED)
  })
})
