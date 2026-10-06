/*
 * S15-W3 (issue #547, superseding #224): a Check on a sheet that is in a file but not on the drawing
 * list never offers words that are false for it.
 *
 * docs/design/m0-screens.md §5, the drawing-list Check: "1 "Not sent yet: keep it in the count as
 * missing and ask the consultant" · 2 … (a sheet in a file but not on the list: "Not part of this set:
 * record it, then exclude it in the list"; the answer records it and takes nothing off the list)". #224:
 * "`engine.register_check.not_listed` option 1 still reads "Not sent yet: keep it in the count as
 * missing and ask the consultant". That is false for a sheet that is in a file"; the fix: "words that
 * are true for a sheet in a file … (ux-critic to word), or drop the option."
 *
 * Only the false words' absence is pinned (the option may be reworded or dropped); the card's other
 * words are ../t206's and the unit tests'.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { cardOf, clean, openWith } from './w3.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the Check on S-02, in a file but not on the drawing list (§5; #224)', () => {
  it('offers no option saying S-02 is kept in the count as missing', async () => {
    await openWith('check', (q, fake) => {
      const s02 = fake.step1.proposals.find((p) => p.number === 'S-02')!
      Object.assign(q, { code: 'engine.register_check.not_listed', params: { number: 'S-02' }, subject_id: s02.sheet_id, proposals: [s02.id] })
    })
    await userEvent.keyboard('q')
    const card = await cardOf('Q1')
    await waitFor(() => expect(clean(card.textContent)).toContain('Not part of this set'))
    const options = [...card.querySelectorAll('label')].map((l) => clean(l.textContent))
    expect(options.length, 'the card’s options').toBeGreaterThan(1)
    expect(options.filter((o) => /in the count as missing/i.test(o)), 'options keeping S-02 in the count as missing').toEqual([])
  })
})
