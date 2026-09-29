/*
 * Ticket 16's development-only harness route (docs/plans/M0.md, "16 Sheet viewer": "Owns
 * `web/src/sheet/` and its development-only harness route, `web/src/routes/dev/sheet/`
 * (`/dev/sheet/:id`, m0-screens 4.6 ...)"; "a dev route that loads harness output locally"; the
 * orchestrator's ruling: "Route `web/src/routes/dev/sheet/` (development only, m0-screens 4.6)").
 *
 * Chosen by the acceptance writer (the authority names the route, not what `:id` names): the route
 * also opens the committed fixtures by their name (`/dev/sheet/tiny-sheet`), so the design gate can
 * walk the viewer on invented data, as it walks /dev/specimen, without a real drawing. Where it finds
 * local harness output is the builder's.
 */
import { describe, expect, it } from 'vitest'
import { mountApp } from '@/app/testing'
import { inkBox, snapshot } from './sheet.fixture'

describe('/dev/sheet/:id', () => {
  it('draws the committed tiny sheet at /dev/sheet/tiny-sheet, inside a left-to-right canvas', async () => {
    const { container } = await mountApp('/dev/sheet/tiny-sheet')
    await expect.poll(() => container.querySelector('[data-ltr-canvas] canvas'), { timeout: 10_000 }).not.toBeNull()
    const canvasArea = container.querySelector('[data-ltr-canvas]')!
    await expect.poll(() => inkBox(snapshot(canvasArea)), { timeout: 10_000 }).not.toBeNull()
  })
})
