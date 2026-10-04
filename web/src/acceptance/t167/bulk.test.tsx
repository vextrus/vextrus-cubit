/*
 * Ticket 167's acceptance tests for F1 and F2 (gh issue #167): "The header and bar update with the
 * toast; the toast's Space opens the sheet it names." The walk saw "Confirmed 0 / 67" with the confirm
 * still clickable for 3–5 s after the toast reported the bulk confirm, and Space opening the first
 * list row instead of the sheet the bar named.
 *
 * KR-01 after reading, through ticket 22's in-memory fake (`../t22/step1.fixture.ts`). The bulk act
 * (m0-screens §6.4): "Confirm 16, leave out 1 ↵", toast "Confirmed 16 sheets; left out 1, each with its
 * reason.", Count "Confirmed 16 / 24, 1 excluded"; then only the three Electrical sheets with one source
 * are left for the bar: "3 Electrical sheets have one source each" with "Open E-01 Space" (§6.4's table).
 *
 * F1 is forced, not timed: after the act's calls, Step 1's reloads (every GET of …/takeoff/step1) are
 * held until the test lets them go, and a MutationObserver records every moment the DOM shows the toast
 * beside the stale Count or a clickable bulk confirm. The builder may update from the act's reply, or
 * show the toast only once Step 1 has reloaded; either passes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'
const TOAST = 'Confirmed 16 sheets; left out 1, each with its reason.'
const STALE = 'Confirmed 0 / 24'
const FRESH = 'Confirmed 16 / 24, 1 excluded'

/** KR-01, with Step 1's reloads held once an act has been made, until `release()`. */
function kr01Held() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  let acted = false
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const held: string[] = []
  const inner = api.handle
  api.handle = async (request: Request) => {
    const url = new URL(request.url, location.origin)
    const isStep1 = url.pathname.includes('/takeoff/step1')
    if (isStep1 && request.method !== 'GET') acted = true
    else if (isStep1 && acted) {
      held.push(url.pathname)
      await gate
    }
    return inner(request)
  }
  return { api, step1, held, release: () => release() }
}

/** Every DOM state, as it is committed, that shows the toast beside the stale Count or a clickable bulk confirm. */
function watchStale(): { seen: string[]; stop: () => void } {
  const seen: string[] = []
  const check = () => {
    const text = bodyText()
    if (!text.includes(TOAST)) return
    if (text.includes(STALE)) seen.push(`the toast beside "${STALE}"`)
    const live = [...document.querySelectorAll<HTMLButtonElement>('button')].filter((b) => /Confirm 16, leave out 1/.test(clean(b.textContent)) && !b.disabled && b.getAttribute('aria-disabled') !== 'true')
    if (live.length > 0) seen.push('the toast beside a clickable "Confirm 16, leave out 1"')
  }
  const observer = new MutationObserver(check)
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
  return { seen, stop: () => observer.disconnect() }
}

async function open(api: FakeApi) {
  await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain(STALE))
  await waitFor(() => expect(screen.getByRole('button', { name: /Confirm 16, leave out 1/ })).toBeVisible())
}

describe('F1: the header and bar update with the toast (issue #167; m0-screens §6.4)', () => {
  it('never shows the bulk act’s toast beside "Confirmed 0 / 24" or a clickable "Confirm 16, leave out 1"', async () => {
    const { api, held, release } = kr01Held()
    await open(api)
    const watch = watchStale()
    try {
      await userEvent.keyboard('{Enter}')
      // Either the toast is up (the screen updated from the act) or Step 1 is reloading before it.
      await waitFor(() => expect(bodyText().includes(TOAST) || held.length > 0, 'the toast, or a reload').toBe(true))
      if (bodyText().includes(TOAST)) {
        expect(bodyText(), 'the Count with the toast, before Step 1 reloads').toContain(FRESH)
      }
      release()
      await waitFor(() => expect(bodyText()).toContain(TOAST))
      await waitFor(() => expect(bodyText()).toContain(FRESH))
      expect(watch.seen, 'stale states shown with the toast').toEqual([])
    } finally {
      watch.stop()
      release()
    }
  })

  it('shows the Count "Confirmed 16 / 24, 1 excluded" with the toast while Step 1 is still reloading, or no toast until it has', async () => {
    const { api, held, release } = kr01Held()
    await open(api)
    try {
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(held.length, 'Step 1 reloads after the act').toBeGreaterThan(0))
      if (bodyText().includes(TOAST)) expect(bodyText()).toContain(FRESH)
      expect(bodyText().includes(TOAST) && bodyText().includes(STALE), 'the toast beside the stale Count').toBe(false)
    } finally {
      release()
    }
  })
})

describe('F2: Space opens the sheet the bar names (issue #167; m0-screens §6.4, §6.15)', () => {
  it('offers "Open E-01 Space" after the bulk act and opens E-01 on Space', async () => {
    const api = new FakeApi()
    new FakeStep1(api, 'KR-01')
    await open(api)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(bodyText()).toContain(FRESH))
    await waitFor(() => expect(bodyText()).toContain('3 Electrical sheets have one source each'))
    expect(screen.getByRole('button', { name: /Open\s*E-01/ })).toBeVisible()
    await userEvent.keyboard(' ')
    const canvas = await screen.findByRole('group', { name: /Sheet\s*⁨?E-01⁩?/ })
    expect(canvas).toBeVisible()
    expect(screen.queryAllByRole('group', { name: /^Sheet\s/ }).filter((g) => !/E-01/.test(clean(g.getAttribute('aria-label')))), 'no other sheet opened').toEqual([])
  })

  it('opens E-01 on Space pressed with the toast, while Step 1 is still reloading', async () => {
    const { api, held, release } = kr01Held()
    await open(api)
    try {
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(bodyText().includes(TOAST) || held.length > 0, 'the toast, or a reload').toBe(true))
      if (!bodyText().includes(TOAST)) release()
      await waitFor(() => expect(bodyText()).toContain(TOAST))
      await userEvent.keyboard(' ')
      const opened = await screen.findByRole('group', { name: /^Sheet\s/ })
      expect(clean(opened.getAttribute('aria-label')), 'the sheet the bar names (m0-screens §6.4: "Open E-01 Space")').toMatch(/^Sheet\s*E-01$/)
    } finally {
      release()
    }
  })
})
