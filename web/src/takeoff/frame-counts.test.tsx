/*
 * S26-D7: the step rail's Step 1 mark on a step other than Step 1 comes from Step 1's own queries, so
 * it is there on arrival and a read of the session never takes it away.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
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

const railMark = () => document.querySelector('nav[aria-label="Takeoff Steps"] li:first-child [role="img"]')?.getAttribute('aria-label') ?? '(no mark)'
const questionsTab = () => [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.startsWith('Questions'))

describe('Step 1\'s mark in the rail on Step 2 (S26-D7)', () => {
  it('shows "Questions open" on arrival at /takeoff/2 and keeps it, untouched, when the session is read again', async () => {
    const api = new FakeApi()
    new FakeStep1(api)
    const { queryClient } = await mountApp('/p/KR-01/takeoff/2', { as: PEOPLE.qs, api })
    await waitFor(() => expect(railMark()).toBe('Questions open'))
    // The Questions tab is the open step's: Step 2 has none, so no number.
    expect(questionsTab()?.textContent).toBe('Questions')
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))

    const changes: string[] = []
    const mo = new MutationObserver((records) => {
      for (const r of records) if (document.querySelector('nav[aria-label="Takeoff Steps"] li:first-child')?.contains(r.target)) changes.push(r.type)
    })
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
    window.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(queryClient.isFetching({ queryKey: ['session'] })).toBe(0))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    mo.disconnect()
    expect(railMark()).toBe('Questions open')
    expect(changes).toEqual([])
  })
})
