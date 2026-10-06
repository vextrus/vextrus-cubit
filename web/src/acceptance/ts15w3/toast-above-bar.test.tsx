/*
 * S15-W3 (issue #547, superseding #218): on Step 1 a toast never covers the Confirmation bar's second
 * line. docs/design/m0-screens.md §6.4: "The bar is as wide as the prototype's list-mode bar: the canvas
 * less 32 px, at most 820 px, in list and sheet mode alike (6.18). The toast sits just above it." #218:
 * "At 1440 and 1280 the bar's sub-line … is hidden for the toast's 6 s after each act."
 *
 * The act is the first Enter on KR-01 (22's fake): the bulk act, whose toast reads "Confirmed 17
 * sheets; left out 1, each with its reason." (§6.4's form). Only where the toast sits is pinned, not
 * its words. Not pinned: #218's "refusals 8 s" and "kept while hovered" (§3 gives every toast 6 s; the
 * spec does not carry them).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { bodyText, clean } from './w3.fixture'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const BULK_TOAST = /Confirmed \d+ sheets/

/**
 * The Confirmation bar: the widest ancestor, still within the bar's 820 px, of a button keyed Enter or
 * Space (its copper button or its ghost, §6.4), taking the lowest such on the page (the bar floats at
 * the canvas foot; the toolbar is at its head).
 */
function bar(): HTMLElement | null {
  const keyed = screen.queryAllByRole('button').filter((b) => ['Enter', 'Space'].includes(b.getAttribute('aria-keyshortcuts') ?? ''))
  const bars = keyed.map((button) => {
    let el: HTMLElement = button
    while (el.parentElement && el.parentElement.getBoundingClientRect().width <= 821) el = el.parentElement
    return el
  })
  return bars.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] ?? null
}

/** The toast's box: the outermost element of a live status region holding `words` that is no taller than a toast. */
function toastBox(words: RegExp): DOMRect | null {
  for (const status of document.querySelectorAll<HTMLElement>('[role="status"]')) {
    for (const el of [status, ...status.querySelectorAll<HTMLElement>('*')]) {
      const r = el.getBoundingClientRect()
      if (r.height > 0 && r.height <= 64 && words.test(clean(el.textContent))) return r
    }
  }
  return null
}

async function actAt(width: number, height: number) {
  await page.viewport(width, height)
  const api = new FakeApi()
  new FakeStep1(api, 'KR-01')
  await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed 0 \/ \d+/))
  // The first Enter: the bulk act (§6.4).
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(toastBox(BULK_TOAST), 'the bulk act’s toast').not.toBeNull())
  // The bar after the act: the next item's.
  await waitFor(() => expect(bar(), 'the Confirmation bar').not.toBeNull())
}

describe('the toast sits just above the Confirmation bar (m0-screens §6.4; #218)', () => {
  it('keeps the bar wholly clear of the toast at 1440 × 900', async () => {
    await actAt(1440, 900)
    const toast = toastBox(BULK_TOAST)!
    const b = bar()!.getBoundingClientRect()
    expect(toast.bottom, `the toast's foot (${Math.round(toast.bottom)}) must sit at or above the bar's top (${Math.round(b.top)})`).toBeLessThanOrEqual(b.top + 0.5)
  })

  it('keeps the bar wholly clear of the toast at 1280 × 800', async () => {
    await actAt(1280, 800)
    const toast = toastBox(BULK_TOAST)!
    const b = bar()!.getBoundingClientRect()
    expect(toast.bottom, `the toast's foot (${Math.round(toast.bottom)}) must sit at or above the bar's top (${Math.round(b.top)})`).toBeLessThanOrEqual(b.top + 0.5)
  })
})
