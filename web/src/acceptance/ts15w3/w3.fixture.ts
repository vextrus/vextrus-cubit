/*
 * S15-W3's helpers (issue #547): KR-01's Step 1 on the repo's fakes, 22's (../t22/step1.fixture.ts)
 * with 21c's answer operation (../t156/answer.fixture.ts) and, where a file's chip or report is read,
 * 20b's Drawing Set fake (../t20b/drawings.fixture.ts). Nothing here is a real drawing's.
 */
import { expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PEOPLE, mountApp } from '@/app/testing'
import { FakeAnswers, type Question21c } from '../t156/answer.fixture'

export const PATH = '/p/KR-01/takeoff/1'

/** Text as read: the isolates a message puts round its figures dropped, spaces folded. */
export const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
export const bodyText = () => clean(document.body.textContent)

/** Step 1 takes keys again: its act, its undos and the reloads after them have ended (the screen's aria-busy). */
export const idle = () => waitFor(() => expect(document.querySelector('[data-step1]')?.getAttribute('aria-busy')).not.toBe('true'), { timeout: 5000 })

export const ctrlZ = () => userEvent.keyboard('{Control>}z{/Control}')

/** Mounts KR-01's Step 1 as the QS on `fake` and waits for its Count. */
export async function open(fake: FakeAnswers) {
  await mountApp(PATH, { as: PEOPLE.qs, api: fake.api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed 0 \/ \d+/))
}

/** KR-01 with only `kind`'s Question open (156's one of each kind), mounted. */
export async function openWith(kind: string, change?: (q: Question21c, fake: FakeAnswers) => void): Promise<{ fake: FakeAnswers; question: Question21c }> {
  const fake = new FakeAnswers()
  const question = fake.byKind()[kind]!
  change?.(question, fake)
  fake.questions = [question]
  await open(fake)
  return { fake, question }
}

/** The card of Question `tag` (the inspector's region "Question Q1"). */
export const cardOf = (tag = 'Q1') => screen.findByRole('region', { name: (n: string) => clean(n) === `Question ${tag}` })

/** `Q` to the one open Question, the digit of `key`'s option, then (with `text`, typed first) Enter. */
export async function answerByKeys(question: Question21c, key: string, text?: string) {
  await userEvent.keyboard('q')
  await cardOf('Q1')
  const digit = question.options.findIndex((o) => o.key === key) + 1
  expect(digit, `${key} is offered`).toBeGreaterThan(0)
  await userEvent.keyboard(String(digit))
  if (text !== undefined) {
    const field = await screen.findByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(field))
    await userEvent.keyboard(text)
  }
  await userEvent.keyboard('{Enter}')
}

/** The toast's words now: the text of every live status region but the screen's own (empty when none shows). */
export function toastText(): string {
  return [...document.querySelectorAll('[role="status"]')].map((s) => clean(s.textContent)).filter(Boolean).join(' | ')
}

/** Waits for a toast whose words match `words`, and returns them. */
export async function toastMatching(words: RegExp | string): Promise<string> {
  let seen = ''
  await waitFor(() => {
    seen = toastText()
    if (typeof words === 'string') expect(seen).toContain(words)
    else expect(seen).toMatch(words)
  })
  return seen
}

/** A list row's text, its cells joined with " · " (so a number reads apart from the cell before it). */
export function rowText(row: HTMLElement): string {
  const cells = [...row.querySelectorAll<HTMLElement>('[role="gridcell"], [role="columnheader"], [role="rowheader"]')]
  return cells.length ? cells.map((c) => clean(c.textContent)).join(' · ') : clean(row.textContent)
}

/** The rows of the list's section headed `heading` (§6.3: each Discipline's rowgroup, its heading first). */
export async function sectionRows(heading: string): Promise<string[]> {
  const grid = await screen.findByRole('grid', { name: 'Sheets' })
  const group = [...grid.querySelectorAll<HTMLElement>('[role="rowgroup"]')].find((g) => clean(g.textContent).startsWith(heading))
  expect(group, `the section headed "${heading}"`).toBeDefined()
  return within(group!).getAllByRole('row').map(rowText)
}
