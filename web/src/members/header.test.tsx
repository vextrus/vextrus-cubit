/*
 * The Members page's header is rendered once, whatever the rows' state: the heading and Invite are the
 * same elements while the rows load and after (so nothing holding them, a screen reader, a test or
 * focus, loses them when the rows arrive), and the title is the page's from its first commit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { setTransport } from '@/api/client'
import { FakeApi } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the Members page’s header', () => {
  it('keeps one heading and one Invite from loading to loaded', async () => {
    const api = new FakeApi()
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await mountApp('/projects', { as: PEOPLE.md, api })
    setTransport(async (request) => {
      if (new URL(request.url).pathname === '/api/members') await held
      return api.handle(request)
    })
    screen.getByRole('link', { name: 'Members and access' }).click()
    const heading = await screen.findByRole('heading', { name: 'Members and access', level: 1 })
    const invite = screen.queryByRole('button', { name: 'Invite' })
    expect(screen.getByText('Opening Members and access…')).toBeInTheDocument()
    expect(document.title).toBe('Members and access · Vextrus')
    release()
    await waitFor(() => expect(screen.queryByText('Opening Members and access…')).toBeNull())
    // The flake of 29 Sep 2026: a test held the loading page's h1, which the loaded page replaced.
    expect(heading.isConnected).toBe(true)
    expect(screen.getByRole('heading', { name: 'Members and access', level: 1 })).toBe(heading)
    expect(invite).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Invite' })).toBe(invite)
  })
})
