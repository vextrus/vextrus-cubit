/*
 * Jump to and Step 1's address (S25-D4, PR #771's round 5): the compact status mark agrees with the Step 1 list for
 * the sheets beside a numbering gap (one source: the model's), and `?sheet=` round-trips a number such as "1.10"
 * as text through the address Step 1 writes, Jump to writes and a link carries.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import type { QuestionOut } from '@/acceptance/t22/step1.fixture'
import { canvasOf, clean, openList, seed } from '../acceptance/ts15w2/keys.fixture'
import { step1SheetPath } from '@/takeoff/paths'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

async function jumpTyping(text: string): Promise<HTMLElement> {
  await userEvent.keyboard('{Control>}k{/Control}')
  const jump = await screen.findByRole('dialog')
  await userEvent.keyboard(text)
  return jump
}

const markOf = (jump: HTMLElement, number: string) => {
  const option = within(jump).getAllByRole('option').find((o) => clean(o.textContent).includes(number))!
  return option.querySelector<HTMLElement>('[title]')!.getAttribute('title')
}

describe('Jump to’s mark beside a numbering gap', () => {
  it('reads Proposal for the sheets beside a gap, as the list’s State column does, and Question for a sheet a Question holds', async () => {
    const s = seed()
    const question = (id: string, over: Partial<QuestionOut>) =>
      ({
        id,
        kind: 'check',
        status: 'open',
        options: [{ key: 'keep_open', picked: false }],
        discipline: 'structural',
        subject_id: null,
        check_code: 'register',
        answer: null,
        answered_at: null,
        withdrawn_by: null,
        blocking: true,
        ...over,
      }) as QuestionOut
    s.step1.questions = [
      question('c2290000-0000-4000-8000-0000000000a1', {
        code: 'engine.register_check.gaps',
        params: { discipline: 'structural', gaps: [{ after: 'S-02', before: 'S-04', missing: 1 }] } as unknown as QuestionOut['params'],
        proposals: [s.of('S-02').id, s.of('S-04').id],
      } as Partial<QuestionOut>),
      question('c2290000-0000-4000-8000-0000000000a2', {
        kind: 'missing',
        code: 'takeoff.step1.no_number',
        params: {},
        subject_id: s.of('S-05').sheet_id,
      }),
    ]
    await openList(s)
    for (const number of ['S-02', 'S-04']) {
      const row = document.querySelector<HTMLElement>(`[data-row="p:${s.of(number).id}"]`)
      expect(clean(row?.textContent), `the list's State for ${number}`).toContain('Proposal')
    }
    const jump = await jumpTyping('S-0')
    expect(markOf(jump, 'S-02')).toBe('Proposal')
    expect(markOf(jump, 'S-04')).toBe('Proposal')
    expect(markOf(jump, 'S-01')).toBe('Proposal')
    // The control: a one-sheet Question holds its sheet, in the list and in Jump to.
    expect(markOf(jump, 'S-05')).toBe('Question')
  })
})

describe('?sheet= keeps a sheet number as text', () => {
  const numbered = () => {
    const s = seed()
    s.of('S-01').number = '1.10'
    s.of('S-02').number = '2.0'
    s.of('S-03').number = '007'
    return s
  }

  it('opens the sheet a typed address names: 1.10, 2.0 and 007', async () => {
    for (const number of ['1.10', '2.0', '007']) {
      const s = numbered()
      const app = await mountApp(step1SheetPath('KR-01', number), { as: PEOPLE.qs, api: s.api })
      await canvasOf(number)
      app.unmount()
    }
  })

  it('writes the number as typed when a sheet is open, and a remount of Step 1 lands on it again', async () => {
    for (const number of ['1.10', '2.0', '007']) {
      const s = numbered()
      const app = await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: s.api })
      await waitFor(() => expect(clean(document.body.textContent)).toContain('Confirmed 0 /'))
      await jumpTyping(number)
      await userEvent.keyboard('{Enter}')
      await canvasOf(number)
      await waitFor(() => expect(app.router.state.location.searchStr).toBe(`?sheet=${number}`))
      expect(app.router.history.location.search).toBe(`?sheet=${number}`)
      // Back and Forward to Step 1, or a reload: the address alone brings the sheet back.
      const href = app.router.history.location.href
      app.unmount()
      const again = await mountApp(href, { as: PEOPLE.qs, api: s.api })
      await canvasOf(number)
      expect(again.router.history.location.search).toBe(`?sheet=${number}`)
      again.unmount()
    }
  })

  it('carries the number unchanged in the link a screen builds', () => {
    expect(step1SheetPath('KR-01', '1.10')).toBe('/p/KR-01/takeoff/1?sheet=1.10')
    expect(step1SheetPath('KR-01', '2.0')).toBe('/p/KR-01/takeoff/1?sheet=2.0')
    expect(step1SheetPath('KR-01', '007')).toBe('/p/KR-01/takeoff/1?sheet=007')
  })
})
