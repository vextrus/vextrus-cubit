/*
 * S15-W2 (issue #543): the `?` overlay lists the keys this ticket adds, where they are active.
 * docs/design/m0-screens.md §2.1: "The `?` overlay is drawn from the registry, so it lists exactly the
 * keys active on this screen now"; "the overlay shows keys as Kbd chips"; §8 item 2: "the `?` overlay
 * lists every active key and each works". The keys and where they are active are §2.2's: `O` and
 * `PageUp` `PageDown` on any sheet, `Z` on the canvas, `Home` `End` and `Shift ↑` `Shift ↓` on the list.
 *
 * Only the keys' chips are pinned (the overlay's dialog "Keys", one row per key); what each row says is
 * the catalogue's.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { PLAN_VIEW, canvasOf, clean, focusRow, openList, openSheet, seed } from './keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

/** The overlay's rows, each as its Kbd chips: `[['Z'], ['Shift', '↑'], …]`. */
async function overlayChips(): Promise<string[][]> {
  await userEvent.keyboard('?')
  const dialog = await screen.findByRole('dialog', { name: 'Keys' })
  const rows = [...dialog.querySelectorAll<HTMLElement>('li, [role="listitem"], [role="row"]')]
  return rows.map((r) => [...r.querySelectorAll('kbd')].map((k) => clean(k.textContent))).filter((chips) => chips.length > 0)
}

const has = (rows: string[][], chips: string[]) => rows.some((r) => r.length === chips.length && r.every((c, i) => c === chips[i]))

describe('on the sheet, with focus on the canvas', () => {
  it('lists Z with a view selected', async () => {
    await openSheet(seed(), 'S-02')
    ;(await canvasOf('S-02')).focus()
    // A view selected with → (§6.15), so Z has a view to zoom to.
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(document.querySelector(`[data-outline="${PLAN_VIEW}"]`)?.getAttribute('aria-pressed')).toBe('true'))
    expect(has(await overlayChips(), ['Z']), 'Z').toBe(true)
  })

  it('lists O', async () => {
    await openSheet(seed(), 'S-02')
    ;(await canvasOf('S-02')).focus()
    expect(has(await overlayChips(), ['O']), 'O').toBe(true)
  })

  it('lists PageUp and PageDown', async () => {
    await openSheet(seed(), 'S-02')
    ;(await canvasOf('S-02')).focus()
    const rows = await overlayChips()
    expect(has(rows, ['PageUp']), 'PageUp').toBe(true)
    expect(has(rows, ['PageDown']), 'PageDown').toBe(true)
  })
})

describe('in the list, with focus on a row', () => {
  it('lists Home and End', async () => {
    await openList(seed())
    await focusRow('S-02')
    const rows = await overlayChips()
    expect(has(rows, ['Home']), 'Home').toBe(true)
    expect(has(rows, ['End']), 'End').toBe(true)
  })

  it('lists Shift ↑ and Shift ↓', async () => {
    await openList(seed())
    await focusRow('S-02')
    const rows = await overlayChips()
    expect(has(rows, ['Shift', '↑']), 'Shift ↑').toBe(true)
    expect(has(rows, ['Shift', '↓']), 'Shift ↓').toBe(true)
  })
})
