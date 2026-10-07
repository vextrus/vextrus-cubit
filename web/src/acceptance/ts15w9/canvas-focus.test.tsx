/*
 * Ticket S15-W9's acceptance test: F6 onto the sheet's canvas in Step 1's sheet mode draws a focus ring.
 * docs/design/m0-screens.md §8 item 7: "Focus visible everywhere"; §2.2: F6 moves focus region by region
 * (top bar, the step's list or rail, the canvas, the inspector, the status bar); web/src/app/regions.ts:
 * the element F6 lands on "draws its own ring inside itself too". The ring is an outline, as every
 * other F6 stop's (web/src/app/shell.test.tsx, "focus stays visible").
 *
 * On ticket 22's acceptance fake (KR-01 after reading, §7); real key presses, so `:focus-visible` is
 * the browser's own.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

const inCanvas = () => !!document.activeElement?.closest('[data-region="canvas"]')

describe('F6 onto the sheet’s canvas (§8 item 7)', () => {
  it.each([
    [1440, 900],
    [1280, 800],
  ])('draws a visible focus ring on what F6 focused at %i×%i', async (w, h) => {
    await page.viewport(w, h)
    const api = new FakeApi()
    new FakeStep1(api)
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => rowOf('S-02'))
    await userEvent.click(within(rowOf('S-02')).getByText('S-02'))
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-02/ })
    // Out of the canvas, then round to it again by F6 alone.
    await userEvent.keyboard('{F6}')
    for (let i = 0; i < 8 && inCanvas(); i++) await userEvent.keyboard('{F6}')
    expect(inCanvas()).toBe(false)
    for (let i = 0; i < 8 && !inCanvas(); i++) await userEvent.keyboard('{F6}')
    expect(inCanvas()).toBe(true)

    const el = document.activeElement as HTMLElement
    const style = getComputedStyle(el)
    expect(style.outlineStyle, 'a ring').not.toBe('none')
    expect(parseFloat(style.outlineWidth), 'a ring of some width').toBeGreaterThan(0)
    expect(style.outlineColor, 'a ring with a colour').not.toMatch(/^(transparent|rgba\(\d+, \d+, \d+, 0\))$/)
  })
})
