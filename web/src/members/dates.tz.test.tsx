/*
 * An end date is the end of that day in the Market's time zone, whatever the browser's (m0-screens
 * §1.2, §4.4): these run in browsers set to UTC and to a zone west of UTC (vite.config.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { dayIn, endOfDay } from './dates'

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')

afterEach(() => {
  vi.useRealTimers()
})

describe('the browser this runs in', () => {
  it('is set to UTC or to a zone west of UTC, never the machine’s own', () => {
    expect(['UTC', 'America/Los_Angeles']).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
})

describe('endOfDay in Dhaka, from any browser', () => {
  it('ends 26 Oct 2026 at 23:59:59 in Dhaka, 17:59:59 UTC', () => {
    expect(endOfDay({ y: 2026, m: 10, d: 26 }, 'Asia/Dhaka')).toBe('2026-10-26T17:59:59.000Z')
  })

  it('reads the day an instant falls on in Dhaka, not in the browser', () => {
    // 20:00 UTC on 26 Oct is already 27 Oct in Dhaka, and still 26 Oct (13:00) in Los Angeles.
    expect(dayIn(Date.parse('2026-10-26T20:00:00Z'), 'Asia/Dhaka')).toEqual({ y: 2026, m: 10, d: 27 })
  })
})

describe('the invite dialog’s end date, in a browser away from Dhaka', () => {
  it('counts 30 days from today in Dhaka and sends the end of that day there', async () => {
    // 20:00 UTC on 28 Sep: already 29 Sep in Dhaka; still 28 Sep in UTC and in Los Angeles.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T20:00:00Z'))
    const api = new FakeApi()
    await mountApp('/members', { as: PEOPLE.md, api })
    await userEvent.click(await screen.findByRole('button', { name: 'Invite' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Guest' }))
    const date = within(dialog).getByLabelText('Access ends on')
    expect(date).toHaveValue('29 Oct 2026')
    expect(clean(date.parentElement?.textContent)).toContain('(30 days)')

    await userEvent.type(within(dialog).getByLabelText('Email'), 'jamal.new@padma-builders.example')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: (name) => clean(name) === 'KR-01 Kadam Residence' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await within(dialog).findByText(/^Copy this link/)
    await waitFor(() => expect(api.memberships.find((m) => m.invitedEmail === 'jamal.new@padma-builders.example')?.expiresAt).toBe('2026-10-29T17:59:59.000Z'))
  })
})
