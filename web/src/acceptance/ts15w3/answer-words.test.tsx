/*
 * S15-W3 (issue #547, superseding #221): Step 1's answer words name their subject and the next step.
 *
 * docs/design/m0-screens.md:
 * - §6.7, the no-number card's first lines: "2: "Answering leaves the sheet without a number; confirm
 *   it in the list." · 3: "Answering gives the sheet the number you type; confirm it in the list."";
 *   §6.5: "the toast names the act". #221: "Toast "Q3 answered. The sheet stays without a number."
 *   leaves out the next step the first line gives. Same for a typed number."
 * - §6.6, the Questions tab's "Answered": "one line each, "Q3 Keep R1 (14 Sep 2026); leave R0 out as
 *   superseded. Rafiq Hasan, 26 Sep 2026, 10:50"". #221: "Answered lines without a subject: "Q3
 *   Numbered A-08.", "Q4 Elevation."".
 * - §6.2's State column: "Question Q3" · "Q3 kept open"; §6.7: "Keep open, ask the consultant" keeps
 *   the Question (state "Q5 kept open", card "Kept open"). #221: "A kept-open row reads "Question Q6"
 *   where others read "Q6 kept open"."
 * - §6.15: "`1`–`9` | screen | Pick an answer on the focused Question" (one row). #221: "The keys
 *   overlay lists nine rows "Pick answer N on the focused Question"."
 *
 * Pinned: the next step's words §6.7 gives ("confirm it in the list"), the subject (the sheet's
 * number, or "the sheet" for one with none), "Q1 kept open", one overlay row "Pick an answer". The rest of
 * each sentence is the catalogue's (the ticket's ux-critic words review). Not pinned: the Answer
 * button's colour (#221, by eye).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { answerByKeys, cardOf, clean, idle, openWith, rowText, toastMatching } from './w3.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

/** The Questions tab's "Answered" line of Q1 (§6.6): the list item that starts with the tag and names who answered. */
async function answeredLine(): Promise<string> {
  await userEvent.click(screen.getByRole('tab', { name: /^Questions/ }))
  let line = ''
  await waitFor(() => {
    const items = [...document.querySelectorAll('li')].map((li) => clean(li.textContent)).filter((t) => /^Q1\b/.test(t) && t.includes('Nusrat Jahan'))
    expect(items, 'the Answered line of Q1').toHaveLength(1)
    line = items[0]!
  })
  return line
}

describe('the toast after an answer that confirms nothing names the next step (§6.7; #221)', () => {
  it('says "confirm it in the list" after "Leave it without a number"', async () => {
    const { question } = await openWith('missing')
    await answerByKeys(question, 'no_number')
    const toast = await toastMatching(/^Q1 answered\./)
    expect(toast).toContain('confirm it in the list')
  })

  it('names the typed number and says "confirm it in the list" after "Type a number"', async () => {
    const { question } = await openWith('missing')
    await answerByKeys(question, 'type_number', 'A-08')
    const toast = await toastMatching(/^Q1 answered\./)
    expect(toast).toContain('A-08')
    expect(toast).toContain('confirm it in the list')
  })
})

describe('an Answered line names its subject (§6.6; #221)', () => {
  it('names A-05 on the line of the sheet-kind Question it answered', async () => {
    const { fake, question } = await openWith('low_confidence')
    await answerByKeys(question, 'elevation')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await idle()
    expect(await answeredLine()).toContain('A-05')
  })

  it('names the sheet and its typed number on the line of the no-number Question', async () => {
    const { fake, question } = await openWith('missing')
    await answerByKeys(question, 'type_number', 'A-08')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await idle()
    const line = await answeredLine()
    expect(line).toContain('A-08')
    expect(line).toMatch(/\bthe sheet\b/i)
  })
})

describe('a Question kept open reads "Q1 kept open" in the list (§6.2, §6.7; #221)', () => {
  it('marks the kept sheet’s row "Q1 kept open", never "Question Q1"', async () => {
    const { fake, question } = await openWith('low_confidence')
    await answerByKeys(question, 'keep_open')
    await waitFor(() => expect(fake.posted).toHaveLength(1))
    await idle()
    const grid = await screen.findByRole('grid', { name: 'Sheets' })
    let row: HTMLElement | undefined
    await waitFor(() => {
      row = within(grid)
        .getAllByRole('row')
        .find((r) => /\bA-05\b/.test(rowText(r)))
      expect(row, 'the row of A-05').toBeDefined()
      expect(rowText(row!)).toContain('Q1 kept open')
    })
    expect(rowText(row!)).not.toContain('Question Q1')
  })
})

describe('the keys overlay words the answer keys in one row (§6.15; #221)', () => {
  it('lists "Pick an answer" once, on a focused Question', async () => {
    await openWith('low_confidence')
    await userEvent.keyboard('q')
    await cardOf('Q1')
    await userEvent.keyboard('?')
    const dialog = await screen.findByRole('dialog', { name: 'Keys' })
    const rows = [...dialog.querySelectorAll<HTMLElement>('li, [role="listitem"], [role="row"]')].map((r) => clean(r.textContent))
    expect(rows.filter((t) => t.includes('Pick an answer')), 'rows saying "Pick an answer"').toHaveLength(1)
    expect(rows.filter((t) => /Pick answer \d/.test(t)), 'a row per digit').toEqual([])
  })
})
