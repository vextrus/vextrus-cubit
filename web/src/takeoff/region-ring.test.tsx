/*
 * Step 1's sheet region shows its focus ring over a drawn sheet (m0-screens 8.7; the re-gate and review
 * on #842): F6 lands on the region, whose own inset outline the canvas's layers cover, so a ring above
 * the drawing answers the region's focus.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import userEvent from '@testing-library/user-event'
import { openSheet, seed } from '@/acceptance/ts15w2/keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

describe("the sheet region's focus ring", () => {
  it('draws above the canvas when the region has the focus by key', async () => {
    await openSheet(seed(), 'S-02')
    const region = document.querySelector<HTMLElement>('[data-region-focus]')!
    const ring = region.querySelector<HTMLElement>(':scope > [data-region-ring]')!
    expect(ring, 'a ring layer in the region').not.toBeNull()
    expect(getComputedStyle(ring).outlineStyle).toBe('none')
    await userEvent.keyboard('{Shift}')
    region.focus()
    expect(document.activeElement).toBe(region)
    expect(getComputedStyle(ring).outlineStyle, 'no ring while the region has the focus').not.toBe('none')
    // Above the canvas's layers (the canvas z 1, its own ring z 3, under the region's last child).
    expect(Number(getComputedStyle(ring).zIndex)).toBeGreaterThanOrEqual(3)
    expect(region.lastElementChild).toBe(ring)
  })
})
