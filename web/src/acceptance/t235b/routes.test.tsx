/*
 * Ticket T-235b's acceptance tests for C (issue #235; the triage's unfiled vite warning): a project's own
 * address and the Takeoff without a step redirect to Step 1 without TanStack Router's duplicate-route
 * warning ("Generated path … matched route … instead"), which the redirect to `/p/$code/takeoff/$step`
 * with step 1 raises because Step 1's static route outranks `$step`. Steps 2–14 and anything past 14
 * keep their own canvases (m0-screens §4.1).
 *
 * KR-01 through ticket 22's in-memory fake (`../t22/step1.fixture.ts`); every literal is the fixture's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
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
  vi.restoreAllMocks()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

/** Every `console.warn` the router makes about a generated path matching another route. */
function watchWarnings(): () => string[] {
  const warn = vi.spyOn(console, 'warn')
  return () => warn.mock.calls.map((call) => call.map(String).join(' ')).filter((line) => line.includes('matched route'))
}

async function mount(path: string) {
  const api = new FakeApi()
  new FakeStep1(api, 'KR-01')
  return mountApp(path, { as: PEOPLE.qs, api })
}

describe('the redirects to Step 1 (issue #235; m0-screens §4.1)', () => {
  it.each([
    ['a project’s own address', '/p/KR-01'],
    ['the Takeoff without a step', '/p/KR-01/takeoff'],
  ])('opens Step 1 from %s without the duplicate-route warning', async (_, path) => {
    const warnings = watchWarnings()
    const { router } = await mount(path)
    expect(await screen.findByRole('grid', { name: 'Sheets' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/p/KR-01/takeoff/1')
    expect(warnings(), 'the router’s "matched route" warnings').toEqual([])
  })
})

describe('the other steps keep their own canvases (a guard)', () => {
  it('still opens Step 7 as "not open yet"', async () => {
    const { router } = await mount('/p/KR-01/takeoff/7')
    const canvas = await screen.findByText(/is not open yet\. It will read the sheets you confirm in Step 1\./)
    expect(clean(canvas.textContent)).toContain('Step 7, Beams, is not open yet.')
    expect(router.state.location.pathname).toBe('/p/KR-01/takeoff/7')
  })

  it('still shows a step past 14 as "Page not found", inside the frame', async () => {
    await mount('/p/KR-01/takeoff/15')
    expect(await screen.findByText(/There is nothing at this address\./)).toBeVisible()
    expect(document.querySelectorAll('[data-frame]')).toHaveLength(1)
  })
})
