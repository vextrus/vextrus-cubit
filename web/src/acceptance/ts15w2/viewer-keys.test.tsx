/*
 * S15-W2 (issue #543, supersedes #239): the sheet's keys in Step 1's sheet mode, on the seed of
 * ./keys.fixture.ts. docs/design/m0-screens.md:
 *
 * - §2.2: "`O` | screen (any sheet) | Show or hide the view outlines"; "`Z` | region: canvas | Zoom to
 *   the selected view"; "`[` `]`, `PageUp` `PageDown` | screen (any sheet) | Previous / next sheet in
 *   the list's order"; 2.3 item 7: "`Z` zooms to the selected view; `Ctrl Z` only ever undoes."
 * - §4.6: "**Zoom to view** (tooltip "Zoom to the selected view  Z"; disabled with no view selected)
 *   and **Outlines** (tooltip "View outlines  O"; pressed by default). At 1280 Zoom to view and
 *   Outlines sit in the toolbar's overflow ("More", …) as menu rows with their Kbd; at 1440 they are in
 *   the toolbar."; "A Trace or a view flown to (`→ ←` in Step 1, `Z`, …) lands tight on its source".
 * - §6.15: "Also kept from 2.2: … `Z`, `O`".
 *
 * A view is selected with `→` (§6.15, "Next / previous view on the sheet; the canvas flies to it").
 * Where the canvas looks is read from the selected view's outline, its width on screen (16's outline
 * layer, `[data-outline]`).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { ORDER, PLAN_VIEW, canvasOf, clean, openSheet, outlineWidth, seed, shownSheet, visibleOutlines } from './keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

/** Within 2 CSS px. */
const near = (a: number, b: number) => Math.abs(a - b) <= 2

describe('Z: zoom to the selected view (§2.2, §4.6)', () => {
  it('Z flies back to the selected view after F fitted the whole sheet', async () => {
    await openSheet(seed(), 'S-02')
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(document.querySelector(`[data-outline="${PLAN_VIEW}"]`)?.getAttribute('aria-pressed')).toBe('true'))
    // The landing of a view flown to (→), the one Z lands on too (§4.6, "A Trace or a view flown to").
    let flown = 0
    await waitFor(() => {
      flown = outlineWidth(PLAN_VIEW)
      expect(flown).toBeGreaterThan(0)
    })
    await waitFor(async () => {
      const before = outlineWidth(PLAN_VIEW)
      await new Promise((go) => requestAnimationFrame(go))
      expect(outlineWidth(PLAN_VIEW)).toBe(before)
      flown = before
    })
    await userEvent.keyboard('f')
    await waitFor(() => expect(outlineWidth(PLAN_VIEW)).toBeLessThan(flown - 10))
    await userEvent.keyboard('z')
    await waitFor(() => expect(near(outlineWidth(PLAN_VIEW), flown), `the plan's outline ${outlineWidth(PLAN_VIEW)} px wide, flown to ${flown} px`).toBe(true))
    // The view stays selected and the sheet open: Z only zooms.
    expect(document.querySelector(`[data-outline="${PLAN_VIEW}"]`)?.getAttribute('aria-pressed')).toBe('true')
    expect(shownSheet()).toBe('S-02')
  })

  it('shows the "Zoom to view" button in the toolbar at 1440, disabled with no view selected, and Z then changes nothing', async () => {
    await openSheet(seed(), 'S-02')
    const zoom = await screen.findByRole('button', { name: 'Zoom to view' })
    expect(zoom.hasAttribute('disabled') || zoom.getAttribute('aria-disabled') === 'true', 'disabled with no view selected').toBe(true)
    await waitFor(() => expect(outlineWidth(PLAN_VIEW)).toBeGreaterThan(0))
    const before = outlineWidth(PLAN_VIEW)
    await userEvent.keyboard('z')
    expect(near(outlineWidth(PLAN_VIEW), before)).toBe(true)
    expect(shownSheet()).toBe('S-02')
  })

  it('enables "Zoom to view" once a view is selected, and its click zooms to it as Z does', async () => {
    await openSheet(seed(), 'S-02')
    await userEvent.keyboard('{ArrowRight}')
    const zoom = await screen.findByRole('button', { name: 'Zoom to view' })
    await waitFor(() => expect(zoom.hasAttribute('disabled') || zoom.getAttribute('aria-disabled') === 'true').toBe(false))
    let flown = 0
    await waitFor(async () => {
      const before = outlineWidth(PLAN_VIEW)
      await new Promise((go) => requestAnimationFrame(go))
      expect(outlineWidth(PLAN_VIEW)).toBe(before)
      flown = before
    })
    await userEvent.keyboard('f')
    await waitFor(() => expect(outlineWidth(PLAN_VIEW)).toBeLessThan(flown - 10))
    await userEvent.click(zoom)
    await waitFor(() => expect(near(outlineWidth(PLAN_VIEW), flown)).toBe(true))
  })

  it('names "Zoom to the selected view" and its key Z in the button’s tooltip', async () => {
    await openSheet(seed(), 'S-02')
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.hover(await screen.findByRole('button', { name: 'Zoom to view' }))
    const tip = await screen.findByRole('tooltip')
    expect(clean(tip.textContent)).toContain('Zoom to the selected view')
    expect([...tip.querySelectorAll('kbd')].map((k) => clean(k.textContent))).toEqual(['Z'])
  })
})

describe('O: show or hide the view outlines (§2.2, §4.6)', () => {
  it('O hides the view outlines and O again shows them', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => expect(visibleOutlines()).toHaveLength(2))
    await userEvent.keyboard('o')
    await waitFor(() => expect(visibleOutlines()).toHaveLength(0))
    expect(shownSheet(), 'the sheet stays open').toBe('S-02')
    await userEvent.keyboard('o')
    await waitFor(() => expect(visibleOutlines()).toHaveLength(2))
  })

  it('shows the "Outlines" toggle in the toolbar at 1440, pressed by default, unpressed by O', async () => {
    await openSheet(seed(), 'S-02')
    const outlines = await screen.findByRole('button', { name: 'Outlines' })
    expect(outlines).toHaveAttribute('aria-pressed', 'true')
    await userEvent.keyboard('o')
    await waitFor(() => expect(outlines).toHaveAttribute('aria-pressed', 'false'))
    await userEvent.keyboard('o')
    await waitFor(() => expect(outlines).toHaveAttribute('aria-pressed', 'true'))
  })

  it('a click on "Outlines" hides and shows the outlines as O does', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => expect(visibleOutlines()).toHaveLength(2))
    await userEvent.click(await screen.findByRole('button', { name: 'Outlines' }))
    await waitFor(() => expect(visibleOutlines()).toHaveLength(0))
    await userEvent.click(screen.getByRole('button', { name: 'Outlines' }))
    await waitFor(() => expect(visibleOutlines()).toHaveLength(2))
  })

  it('names "View outlines" and its key O in the toggle’s tooltip', async () => {
    await openSheet(seed(), 'S-02')
    await userEvent.hover(await screen.findByRole('button', { name: 'Outlines' }))
    const tip = await screen.findByRole('tooltip')
    expect(clean(tip.textContent)).toContain('View outlines')
    expect([...tip.querySelectorAll('kbd')].map((k) => clean(k.textContent))).toEqual(['O'])
  })
})

describe('at 1280, Zoom to view and Outlines in "More" (§4.6, §4.1)', () => {
  it('puts Zoom to view and Outlines in "More" as menu rows with their Kbd, not in the toolbar', async () => {
    await page.viewport(1280, 800)
    await openSheet(seed(), 'S-02')
    await waitFor(() => expect(visibleOutlines()).toHaveLength(2))
    const toolbar = screen.getByRole('toolbar')
    const visible = (el: HTMLElement) => el.checkVisibility({ visibilityProperty: true })
    expect(within(toolbar).queryAllByRole('button', { name: 'Zoom to view' }).filter(visible)).toHaveLength(0)
    expect(within(toolbar).queryAllByRole('button', { name: 'Outlines' }).filter(visible)).toHaveLength(0)
    await userEvent.click(within(toolbar).getByRole('button', { name: 'More' }))
    const menu = await screen.findByRole('menu')
    const rows = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]')]
    const row = (name: string) => rows.find((r) => clean(r.textContent).startsWith(name))
    expect(row('Zoom to view'), 'a "Zoom to view" row').toBeTruthy()
    expect(row('Outlines'), 'an "Outlines" row').toBeTruthy()
    expect([...row('Zoom to view')!.querySelectorAll('kbd')].map((k) => clean(k.textContent))).toEqual(['Z'])
    expect([...row('Outlines')!.querySelectorAll('kbd')].map((k) => clean(k.textContent))).toEqual(['O'])
  })
})

describe('PageUp and PageDown: previous and next sheet in the list’s order (§2.2)', () => {
  it('PageDown opens the next sheet in the list’s order', async () => {
    await openSheet(seed(), 'S-06')
    // S-06 is proposed to leave out, so it comes first in the list; S-01 follows it.
    await userEvent.keyboard('{PageDown}')
    await waitFor(() => expect(shownSheet()).toBe(ORDER[1]))
    await canvasOf(ORDER[1]!)
    await userEvent.keyboard('{PageDown}')
    await waitFor(() => expect(shownSheet()).toBe(ORDER[2]))
  })

  it('PageUp opens the previous sheet in the list’s order', async () => {
    await openSheet(seed(), 'S-01')
    await userEvent.keyboard('{PageUp}')
    await waitFor(() => expect(shownSheet()).toBe('S-06'))
  })

  it('PageDown and PageUp walk every sheet in the list’s order and back', async () => {
    await openSheet(seed(), ORDER[0]!)
    const down: string[] = [ORDER[0]!]
    for (let i = 1; i < ORDER.length; i++) {
      await userEvent.keyboard('{PageDown}')
      await waitFor(() => expect(shownSheet()).toBe(ORDER[i]))
      down.push(shownSheet()!)
    }
    expect(down).toEqual(ORDER)
    const up: string[] = [ORDER.at(-1)!]
    for (let i = ORDER.length - 2; i >= 0; i--) {
      await userEvent.keyboard('{PageUp}')
      await waitFor(() => expect(shownSheet()).toBe(ORDER[i]))
      up.push(shownSheet()!)
    }
    expect(up).toEqual([...ORDER].reverse())
  })
})
