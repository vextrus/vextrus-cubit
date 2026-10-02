/*
 * Answering on Step 1 (#156) beyond its acceptance tests: the toast names what the answer did (it is
 * drawn outside the format's provider, so its words must not need it); Ctrl Z after an answer takes
 * nothing back and says so (21c has no undo for an answer, and the server's latest acts are the
 * answer's own); a refusal carrying a list of sheets is worded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
    await waitFor(() => expect(bodyText()).toContain('Q1 answered. Confirms S-07 (rev B) and excludes rev A as superseded.'))
  })

  it('takes nothing back on Ctrl Z after an answer, and says so', async () => {
    const { calls } = await openWith('same_title')
    await pickAndAnswer(1)
    await waitFor(() => expect(bodyText()).toContain('Q1 answered.'))
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(bodyText()).toContain('Nothing undone: an answer is not taken back with Ctrl Z.'))
    expect(calls.filter((c) => c.endsWith('/undo'))).toEqual([])
  })

  it('answers nothing on Enter before a pick, the bar saying to pick one', async () => {
    const { fake } = await openWith('check')
    await userEvent.keyboard('q')
    await screen.findByRole('region', { name: (n: string) => clean(n) === 'Question Q1' })
    await waitFor(() => expect(bodyText()).toContain('Pick an answer: 1, 2, 3, 4.'))
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 200))
    expect(fake.posted).toHaveLength(0)
  })
})
