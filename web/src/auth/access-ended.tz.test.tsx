/*
 * The pages outside the frame word their dates with the Market the API sends beside them (the
 * orchestrator's ruling, 29 Sep 2026: `/api/me`'s `ended[].market`, the look-up's `market`), never with
 * the browser's zone or its language's own forms: these run in browsers set to UTC and to a zone west
 * of UTC (vite.config.ts), where the day in Dhaka is not the browser's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { FakeApi } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[\u2066-\u2069]/g, '')

describe('Access ended’s date, from a browser away from Dhaka', () => {
  it('is the day in Dhaka, in 1.2’s form: revoked at 20:43 UTC on 28 Sep is 29 Sep there', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T20:43:00Z'))
    const api = new FakeApi()
    api.signInAs(PEOPLE.engineer)
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
    await mountApp('/projects', { as: null, api })
    await screen.findByRole('heading', { name: 'Access ended' })
    expect(clean(screen.getByRole('main').querySelector('p')?.textContent)).toBe(
      'Your access to Shapla Homes Ltd has ended. Kamal Uddin revoked it on 29 Sep 2026. What you did before then is kept under your name.',
    )
  })
})

describe('an invitation link’s end date, from a browser away from Dhaka', () => {
  it('is the day in Dhaka, in 1.2’s form', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
    const api = new FakeApi()
    const token = api.tokenFor('rumana@shapla-homes.example')
    // 20:00 UTC on 26 Oct is 27 Oct in Dhaka, and still 26 Oct in UTC and in Los Angeles.
    api.memberships.find((m) => m.token === token)!.expiresAt = '2026-10-26T20:00:00Z'
    await mountApp(`/join#${token}`, { as: null, api })
    await waitFor(() => expect(screen.queryByText('Opening the invitation…')).toBeNull())
    expect(clean(screen.getByRole('heading', { level: 1 }).nextElementSibling?.textContent)).toBe('Kamal Uddin invited you as QS until 27 Oct 2026.')
  })
})
