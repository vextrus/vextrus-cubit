/*
 * S24-C1's acceptance on Step 1's list (#717; G1 walk 1 of 59524e39, f-1, M0-FL8): a continuation row
 * whose sheets have one source each is confirmed by Enter, all of it, in one act.
 *
 * The promises, in the authority's words:
 * - m0-screens §6.2, continuation sheets: "one continuation and one row ... Confirming or excluding the
 *   row does it to all three, and the Count counts three sheets."
 * - m0-screens §6.4: the bar "always says what `Enter` will do"; §6.9: one undo reverses one act.
 *
 * Mounted through the app on 22's fake (`../t22/step1.fixture.ts`) with S15-Q3's invented Sheets
 * (`../ts15q3/groups.fixture.ts`): three Sheets the server names one continuation, `agrees` false (one
 * source each), nothing else in the set. The fake confirms what it is sent; the server's half (a whole
 * run confirms in one act, anything more or less is refused) is pinned in
 * vextrus/takeoff/tests/acceptance/ts24c1.
 *
 * Not pinned (no authority gives them): the bar's words on such a row, sheet mode's Enter on one sheet
 * of a run, the toast's words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { clean, continuation, stage, type Proposal } from '../ts15q3/groups.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const PATH = '/p/KR-01/takeoff/1'
const bodyText = () => clean(document.body.textContent)

/** The run: D-41 to D-43, one continuation, one source each. */
function run(): Proposal[] {
  return continuation().map((p) => ({ ...p, agrees: false }))
}

async function show(proposals: readonly Proposal[]): Promise<FakeStep1> {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  stage(step1, proposals)
  await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 3'))
  return step1
}

/** The focused row's Number cell (m0-screens §6.2's columns: mark, Number, Title), as the eye reads it. */
function focusedNumber(): string {
  const active = document.activeElement as HTMLElement | null
  if (active?.getAttribute('role') !== 'row') return ''
  return clean(active.querySelectorAll<HTMLElement>('[role="gridcell"]')[1]?.textContent)
}

/** Focus the run's one row by keyboard (into the sheet list, then ↓) and open it with Space, its first
 * sheet in sheet mode (m0-screens §6.2: "Space opens its first sheet"; §6.4: one-source sheets are
 * confirmed in sheet mode, 6.5). */
async function openTheRun() {
  const grid = await screen.findByRole('grid', { name: 'Sheets' })
  grid.focus()
  for (let i = 0; i < 10 && !/^D-41\s*[–-]\s*D-43$/.test(focusedNumber()); i++) await userEvent.keyboard('{ArrowDown}')
  expect(focusedNumber()).toMatch(/^D-41\s*[–-]\s*D-43$/)
  await userEvent.keyboard(' ')
  await screen.findByRole('group', { name: /D-41/ })
}

describe('a continuation run of one-source sheets confirms on the bar’s Enter (m0-screens §6.2, §6.5; #717)', () => {
  it('confirms all three of the opened run’s sheets in one act on the bar’s Enter, and the Count counts three', async () => {
    const sheets = run()
    const step1 = await show(sheets)
    await openTheRun()

    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(bodyText()).toContain('Confirmed 3 / 3'))
    const acts = step1.seen.filter((s) => s.call === 'POST /confirm')
    expect(acts, 'one confirm act').toHaveLength(1)
    expect(new Set((acts[0]!.body as { proposals: string[] }).proposals)).toEqual(new Set(sheets.map((p) => p.id)))
    expect(step1.proposals.map((p) => p.decision)).toEqual(['confirmed', 'confirmed', 'confirmed'])
  })

  it('takes all three back with one Ctrl Z', async () => {
    const step1 = await show(run())
    await openTheRun()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain('Confirmed 3 / 3'))

    await userEvent.keyboard('{Control>}z{/Control}')

    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 3'))
    expect(step1.calls().filter((c) => c === 'POST /undo')).toHaveLength(1)
    expect(step1.proposals.map((p) => p.decision)).toEqual([null, null, null])
  })
})
