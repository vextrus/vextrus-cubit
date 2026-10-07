/*
 * S15-W2 (issue #543): the status bar shows the stated scale. docs/design/m0-screens.md §4.1: "Status
 * bar (24 px, canvas screens only), left to right. Cursor …; the stated scale ("1:100, as stated", or
 * "Not to scale"); "Imperial" …"; §4.6 "Status bar items it registers: … the stated scale under the
 * cursor's view."
 *
 * On the seed of ./keys.fixture.ts, S-02's plan is stated at 1:100 and its detail is not to scale.
 * The pointer is the browser's own (vitest's Playwright `hover`), moved over each view's outline.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import { DETAIL_VIEW, PLAN_VIEW, clean, openSheet, seed, statusBar } from './keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const outline = (id: string) => {
  const el = document.querySelector<HTMLElement>(`[data-outline="${id}"]`)
  expect(el, `the outline of view ${id}`).not.toBeNull()
  return el!
}

describe('the stated scale in the status bar (§4.1, §4.6)', () => {
  it('shows "1:100, as stated" with the cursor over a view stated at 1:100', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => outline(PLAN_VIEW))
    await userEvent.hover(outline(PLAN_VIEW))
    await waitFor(() => expect(clean(statusBar().textContent)).toContain('1:100, as stated'))
  })

  it('shows "Not to scale" with the cursor over a view not to scale', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => outline(DETAIL_VIEW))
    await userEvent.hover(outline(DETAIL_VIEW))
    await waitFor(() => expect(clean(statusBar().textContent)).toContain('Not to scale'))
    expect(clean(statusBar().textContent)).not.toContain('1:100')
  })

  it('follows the cursor from the plan to the detail', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => outline(PLAN_VIEW))
    await userEvent.hover(outline(PLAN_VIEW))
    await waitFor(() => expect(clean(statusBar().textContent)).toContain('1:100, as stated'))
    await userEvent.hover(outline(DETAIL_VIEW))
    await waitFor(() => expect(clean(statusBar().textContent)).toContain('Not to scale'))
    expect(clean(statusBar().textContent)).not.toContain('1:100, as stated')
  })
})
