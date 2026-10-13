/*
 * S26-D7, the design gate's second finding: the status bar's Coverage moved to the new figures before the
 * Count and the rows did (184 ms in sheet mode, 438 ms in list mode), because its query landed first. Coverage,
 * the Count and the rows are one snapshot: at no rendered state does Coverage disagree with the Count.
 * The Proposals are slowed here (the Coverage answers at once), the way the race goes in the walk.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const toolbar = () => clean(document.querySelector('[role="toolbar"][aria-label="The step\'s tools"]')?.textContent)
const coverage = () => /Coverage \d+ views?: (\d+) assigned/.exec(bodyText())?.[1] ?? '(no Coverage)'
const count = () => /Confirmed (\d+) \//.exec(toolbar())?.[1] ?? '(no Count)'

describe('Coverage and the Count change together (S26-D7)', () => {
  it('confirming with the Proposals slow: no state shows the new Coverage beside the old Count, or the new Count beside the old Coverage', async () => {
    const api = new FakeApi()
    const step1 = new FakeStep1(api)
    const base = api.handle
    api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      if (request.method === 'GET' && path.endsWith('/proposals')) await new Promise((r) => setTimeout(r, 250))
      const response = await base(request)
      // The Coverage moves with the act (the fake's own Coverage only moves for a whole Discipline).
      if (request.method === 'POST' && path.endsWith('/confirm') && response.ok) step1.coverage = { ...step1.coverage, assigned: 39 }
      return response
    }
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    expect([count(), coverage()]).toEqual(['0', '0'])
    const seen = new Set<string>()
    const mo = new MutationObserver(() => seen.add(`${count()}|${coverage()}`))
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(count()).toBe('16'))
    await waitFor(() => expect(coverage()).toBe('39'))
    mo.disconnect()
    expect([...seen].filter((s) => s !== '0|0' && s !== '16|39')).toEqual([])
  })

  it('while Step 1 is first read, the toolbar draws a bar where the Count will be, never "Confirmed 0 / —"', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    const base = api.handle
    api.handle = async (request: Request) => {
      if (request.method === 'GET' && new URL(request.url, location.origin).pathname.endsWith('/proposals')) await new Promise((r) => setTimeout(r, 250))
      return base(request)
    }
    const seen = new Set<string>()
    const mo = new MutationObserver(() => seen.add(`${toolbar().includes('Confirmed')}|${document.querySelector('[role="toolbar"] .skeleton') !== null}|${toolbar().includes('—')}`))
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
    mo.disconnect()
    expect([...seen].filter((s) => s.endsWith('|true'))).toEqual([])
    expect(seen.has('true|true|false')).toBe(true)
  })
})
