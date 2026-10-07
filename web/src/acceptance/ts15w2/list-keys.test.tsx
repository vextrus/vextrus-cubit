/*
 * S15-W2 (issue #543): Step 1's list keys, on the seed of ./keys.fixture.ts (list order S-06, S-01 to
 * S-05). docs/design/m0-screens.md:
 *
 * - §2.2: "`Home` `End` | region: list | First / last row"; "`Shift ↑` `Shift ↓` | region: list |
 *   Extend the selection (in Step 1, list mode only, with Shift-click; 6.9)".
 * - §6.15: "`Shift ↑` `Shift ↓`, Shift-click | list mode | Select several sheets (to exclude them
 *   together)"; "Also kept from 2.2: … `Home` `End`".
 * - §6.9: "With a view selected (sheet mode), `X` excludes the view; otherwise the focused sheet (or, in
 *   list mode, the sheets selected with Shift-click or `Shift ↑ ↓`)"; the picker's reasons "1 Superseded
 *   · …"; "`1`–`7` pick".
 *
 * What a selection is for is read where it lands: the sheets `X` then `1` (Superseded) excludes, as
 * 19a's `POST …/step1/exclude` receives them.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { excludedBy, focusRow, focusedSheet, openList, rowOf, seed } from './keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

describe('Home and End: first and last row (§2.2)', () => {
  it('Home focuses the list’s first row', async () => {
    await openList(seed())
    await focusRow('S-03')
    await userEvent.keyboard('{Home}')
    await waitFor(() => expect(focusedSheet()).toBe('S-06'))
  })

  it('End focuses the list’s last row', async () => {
    await openList(seed())
    await focusRow('S-02')
    await userEvent.keyboard('{End}')
    await waitFor(() => expect(focusedSheet()).toBe('S-05'))
  })

  it('Home then End then Home go to the first, the last and the first row again', async () => {
    await openList(seed())
    await focusRow('S-04')
    await userEvent.keyboard('{Home}')
    await waitFor(() => expect(focusedSheet()).toBe('S-06'))
    await userEvent.keyboard('{End}')
    await waitFor(() => expect(focusedSheet()).toBe('S-05'))
    await userEvent.keyboard('{Home}')
    await waitFor(() => expect(focusedSheet()).toBe('S-06'))
  })
})

describe('Shift ↑ ↓ and Shift-click select several sheets, and X excludes them together (§6.9, §6.15)', () => {
  it('Shift ↓ twice from S-01 selects S-01 to S-03, and X with Superseded excludes those three', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-01')
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    await userEvent.keyboard('x')
    await userEvent.keyboard('1')
    await waitFor(() => expect(excludedBy(s.step1).numbers).toEqual(['S-01', 'S-02', 'S-03']))
    expect(new Set(excludedBy(s.step1).reasons)).toEqual(new Set(['superseded']))
  })

  it('Shift ↑ twice from S-04 selects S-02 to S-04, and X with Superseded excludes those three', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-04')
    await userEvent.keyboard('{Shift>}{ArrowUp}{ArrowUp}{/Shift}')
    await userEvent.keyboard('x')
    await userEvent.keyboard('1')
    await waitFor(() => expect(excludedBy(s.step1).numbers).toEqual(['S-02', 'S-03', 'S-04']))
    expect(new Set(excludedBy(s.step1).reasons)).toEqual(new Set(['superseded']))
  })

  it('Shift-click on S-03 after a click on S-01 selects both, and X with Superseded excludes them and no sheet outside them', async () => {
    const s = seed()
    await openList(s)
    await focusRow('S-01')
    const user = userEvent.setup()
    await user.keyboard('{Shift>}')
    await user.click(within(rowOf('S-03')).getByText('S-03'))
    await user.keyboard('{/Shift}')
    await user.keyboard('x')
    await user.keyboard('1')
    await waitFor(() => expect(excludedBy(s.step1).numbers).toEqual(expect.arrayContaining(['S-01', 'S-03'])))
    const out = excludedBy(s.step1).numbers
    expect(out, 'nothing outside S-01 to S-03').not.toContain('S-04')
    expect(out).not.toContain('S-05')
    expect(out).not.toContain('S-06')
  })
})
