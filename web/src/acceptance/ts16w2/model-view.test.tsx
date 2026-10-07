/*
 * S16-W2: the 3D Live Model view at `/p/$code/model` (session-16 contract, "W2: `/p/$code/model`"),
 * on ./model.fixture.ts. The ticket: "orthographic, orbit, storey isolate, pick → inspector with
 * Trace"; its finish line: "keyboard reach". CLAUDE.md: "A UI ticket walks m0-screens §8 by keyboard"
 * (keys, focus rings).
 *
 * No screen spec gives the view's labels (docs/design has no m1-screens.md), so no label is asserted:
 * the storey controls are found by the storey's own name from the data, the inspector by the values
 * the inspector endpoint answers (ifc_class, the Uniclass code) and the domain's word "Trace"
 * (CONTEXT.md).
 *
 * The pick: with a single column, the view opens framed on the model, so the canvas's centre falls on
 * the column (an orthographic view framed on a convex solid's bounds centre).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page, userEvent as browserEvent } from 'vitest/browser'
import { PEOPLE, mountApp } from '@/app/testing'
import { C1_GF, seedModel } from './model.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const canvas = async () => {
  let found: HTMLCanvasElement | null = null
  await waitFor(() => {
    found = document.querySelector('canvas')
    expect(found, 'the 3D canvas').not.toBeNull()
  })
  return found as unknown as HTMLCanvasElement
}

/** A focus ring the eye sees: an outline or a box shadow on the focused element. */
function ringVisible(el: Element): boolean {
  const s = getComputedStyle(el)
  const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
  return outline || (s.boxShadow !== '' && s.boxShadow !== 'none')
}

/** Tab through the page, from the top, until `pick` holds for the focused element (at most 60 stops). */
async function tabTo(pick: (el: Element) => boolean): Promise<Element | null> {
  ;(document.activeElement as HTMLElement | null)?.blur()
  for (let i = 0; i < 60; i++) {
    await userEvent.tab()
    const el = document.activeElement
    if (el && el !== document.body && pick(el)) return el
  }
  return null
}

const isStoreyControl = (name: string) => (el: Element) =>
  !el.contains(document.querySelector('canvas')) && (el.textContent ?? '').replace(/\s+/g, ' ').trim().includes(name)

describe('keyboard reach', () => {
  it('reaches the 3D canvas by Tab, with a visible focus ring', async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    const c = await canvas()
    const focused = await tabTo((el) => el === c || el.contains(c))
    expect(focused, 'Tab reaches the canvas (or the region holding it)').not.toBeNull()
    expect(ringVisible(focused!), 'the canvas shows its focus').toBe(true)
  })

  it("reaches each storey's control by Tab, with a visible focus ring", async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    await canvas()
    for (const name of ['GF', '1F']) {
      const focused = await tabTo(isStoreyControl(name))
      expect(focused, `Tab reaches the ${name} control`).not.toBeNull()
      expect(ringVisible(focused!), `the ${name} control shows its focus`).toBe(true)
    }
  })
})

describe('storey isolate', () => {
  it("isolates a storey from the keyboard: Enter on its control marks it on", async () => {
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api: seedModel().api })
    await canvas()
    const gf = await tabTo(isStoreyControl('GF'))
    expect(gf).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      const on = ['aria-pressed', 'aria-checked', 'aria-selected', 'aria-current'].some((a) => {
        const v = gf!.getAttribute(a)
        return v !== null && v !== 'false'
      })
      expect(on, 'the GF control states it is the isolated storey').toBe(true)
    })
  })
})

describe('pick → inspector with Trace', () => {
  it("picking a column opens the inspector with its IFC class, Uniclass code and Trace", async () => {
    const { api, seen } = seedModel([C1_GF])
    await mountApp('/p/KR-01/model', { as: PEOPLE.qs, api })
    const c = await canvas()
    await waitFor(() => expect(c.getBoundingClientRect().width).toBeGreaterThan(0))
    // A real pointer click at the canvas's centre (Playwright's), not a synthetic event at (0, 0).
    await browserEvent.click(c)
    await waitFor(() => expect(seen.some((call) => call.startsWith('GET ') && call.endsWith(`/model/elements/${C1_GF}`))).toBe(true))
    await screen.findByText(/IfcColumn/)
    await screen.findByText(/EF_20_10/)
    await screen.findByText(/Trace/)
  })
})
