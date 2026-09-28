/*
 * 4.1's session states, unreachable on 03's static session: "Signed out while working", "Access ended"
 * (revoked, revoked by no one named, expired, naming chosen projects) and "No access to anything"; and
 * the read-only toast 20b and 22 call. Through the in-memory API, in Chromium.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PASSWORD } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'
import { TOAST_MS, UiProviders, expectKeyMapSound } from '@/ui'
import { useReadOnlyToast } from './readOnly'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')
const sentence = () => clean(screen.getByRole('main').querySelector('p')?.textContent)

describe('Access ended (§4.1)', () => {
  it('lands a revoked Vextrus Engineer’s next request on Access ended, naming who and when, with the old rows gone', async () => {
    const api = new FakeApi()
    const { router, queryClient } = await mountApp('/projects', { as: PEOPLE.engineer, api })
    expect(await screen.findByText('Bokul Place')).toBeVisible()
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
    await userEvent.click(screen.getByRole('link', { name: 'Members and access' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/access-ended'))
    expect(await screen.findByRole('heading', { name: 'Access ended' })).toBeVisible()
    expect(sentence()).toBe('Your access to Shapla Homes Ltd has ended. Kamal Uddin revoked it on 28 Sep 2026. What you did before then is kept under your name.')
    expect(screen.queryByRole('link', { name: 'Choose another Developer' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
    expect(document.body.textContent).not.toContain('Bokul Place')
    await waitFor(() => expect(queryClient.getQueryCache().findAll({ queryKey: ['session'] })).toHaveLength(0))
    expect(document.title).toBe('Access ended · Vextrus')
  })

  it('keeps showing Access ended on a reload, not the chooser', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.engineer)
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
    const { router } = await mountApp('/projects', { as: null, api })
    await waitFor(() => expect(router.state.location.pathname).toBe('/access-ended'))
    expect(await screen.findByRole('heading', { name: 'Access ended' })).toBeVisible()
  })

  it('words a revocation that names no one without a name', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.engineer)
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', null)
    await mountApp('/projects', { as: null, api })
    await screen.findByRole('heading', { name: 'Access ended' })
    expect(sentence()).toBe('Your access to Shapla Homes Ltd was ended on 28 Sep 2026. What you did before then is kept under your name.')
  })

  it('words its date with the ended Developer’s Market, even in a browser that never worked in one', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.engineer)
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
    await mountApp('/access-ended', { as: null, api })
    await screen.findByRole('heading', { name: 'Access ended' })
    expect(sentence()).toContain('Kamal Uddin revoked it on 28 Sep 2026.')
  })

  it('names an expired Guest’s chosen projects and asks the Developer to renew, on signing in', async () => {
    const { router } = await mountApp('/sign-in', { as: null })
    await userEvent.type(await screen.findByLabelText('Email'), PEOPLE.expiredGuest)
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/access-ended'))
    await waitFor(() => expect(sentence()).toBe('Your access to KR-01 at Shapla Homes Ltd ended on 20 Sep 2026. Ask Shapla Homes Ltd to renew it.'))
    expect(screen.queryByRole('link', { name: 'Choose another Developer' })).toBeNull()
  })

  it('offers [Choose another Developer] only when another Membership is current, and it works', async () => {
    const api = new FakeApi()
    const { router } = await mountApp('/sign-in', { as: null, api })
    await userEvent.type(await screen.findByLabelText('Email'), PEOPLE.twoDevelopers)
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await userEvent.click(await screen.findByRole('button', { name: /Meghna Properties Ltd/ }))
    expect(await screen.findByText('Meghna Heights')).toBeVisible()
    api.revoke(PEOPLE.twoDevelopers, 'Meghna Properties Ltd', PEOPLE.meghnaQs)
    await userEvent.click(screen.getByRole('link', { name: 'Members and access' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/access-ended'))
    await waitFor(() => expect(sentence()).toBe('Your access to Meghna Properties Ltd has ended. Tanvir Ahmed revoked it on 28 Sep 2026. What you did before then is kept under your name.'))
    await userEvent.click(screen.getByRole('link', { name: 'Choose another Developer' }))
    const list = await screen.findByRole('listbox', { name: 'Your Developers' })
    expect(within(list).getAllByRole('option').map((o) => clean(o.textContent))).toEqual(['Kanchan Homes LtdMD'])
    await userEvent.click(within(list).getByRole('button'))
    expect(await screen.findByText('No projects yet. Your QS creates them.')).toBeVisible()
  })

  it('signs out from Access ended', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.engineer)
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
    const { router, keyMap } = await mountApp('/access-ended', { as: null, api })
    await screen.findByRole('heading', { name: 'Access ended' })
    expectKeyMapSound(keyMap)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    expect(api.calls()).toContain('POST /api/auth/sign-out')
  })

  it('is never blank: /access-ended while working goes to the projects', async () => {
    const { router } = await mountApp('/access-ended')
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
  })
})

describe('No access to anything (§4.1)', () => {
  it('says so to someone with no Membership at all, with [Sign out]', async () => {
    const api = new FakeApi({ extend: (a) => void a.addUser('nobody@shapla-homes.example', 'Nobody Yet') })
    const { router } = await mountApp('/projects', { as: 'nobody@shapla-homes.example', api })
    await waitFor(() => expect(router.state.location.pathname).toBe('/no-access'))
    expect(await screen.findByText('You have no access to any Developer at the moment. Ask your MD, or Vextrus, for an invitation.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  it('is never blank: /no-access while working goes to the projects', async () => {
    const { router } = await mountApp('/no-access')
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
  })
})

describe('Signed out while working (§4.1)', () => {
  it('opens the dialog over the page on a 401, keeps the text typed, and carries on once signed in again', async () => {
    const api = new FakeApi()
    await mountApp('/projects', { api })
    await userEvent.click(await screen.findByRole('button', { name: 'New project' }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    await userEvent.type(within(form).getByLabelText('Name'), 'Hasnahena Tower')
    api.session = { userId: null, developerId: null }
    await userEvent.click(within(form).getByRole('button', { name: 'Create project' }))
    const signedOut = await screen.findByRole('dialog', { name: 'You were signed out.' })
    expect(within(signedOut).getByText('Sign in again to carry on; nothing you confirmed is lost.')).toBeInTheDocument()
    expect(within(signedOut).getByLabelText('Email')).toHaveValue(PEOPLE.qs)
    expect(screen.getByDisplayValue('Hasnahena Tower')).toBeInTheDocument()
    await userEvent.type(within(signedOut).getByLabelText('Password'), PASSWORD)
    await userEvent.click(within(signedOut).getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'You were signed out.' })).toBeNull())
    await waitFor(() => expect(screen.getByDisplayValue('Hasnahena Tower')).toBeVisible())
  })

  it('clears everything held when someone else signs in there', async () => {
    const api = new FakeApi()
    const { router } = await mountApp('/members', { api, as: PEOPLE.md })
    expect(await screen.findByText('rumana@shapla-homes.example')).toBeVisible()
    api.session = { userId: null, developerId: null }
    await userEvent.click(screen.getAllByRole('button', { name: /^Renew 30 days for / })[0]!)
    const signedOut = await screen.findByRole('dialog', { name: 'You were signed out.' })
    await userEvent.clear(within(signedOut).getByLabelText('Email'))
    await userEvent.type(within(signedOut).getByLabelText('Email'), PEOPLE.guest)
    await userEvent.type(within(signedOut).getByLabelText('Password'), PASSWORD)
    await userEvent.click(within(signedOut).getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
    await waitFor(() => expect(document.body.textContent).not.toContain('rumana@shapla-homes.example'))
    expect(document.body.textContent).not.toContain('Bokul Place')
  })

  it('brings a signed-out address back through /sign-in?next=', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.qs)
    api.session = { userId: null, developerId: null }
    const { router } = await mountApp('/p/KR-01/takeoff/1', { as: null, api })
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    expect(router.state.location.search).toEqual({ next: '/p/KR-01/takeoff/1' })
  })
})

function Refuse({ role }: { role: 'md' | 'guest' }) {
  const refuse = useReadOnlyToast()
  return (
    <button type="button" onClick={() => refuse(role)}>
      press
    </button>
  )
}

describe('the read-only toast (§1.4; 20b and 22 call it)', () => {
  it.each([
    ['guest', 'As a Guest you can look at the Takeoff but not change it.'],
    ['md', 'As MD you can look at the Takeoff but not change it.'],
  ] as const)('shows the %s’s words for 6 s', async (role, words) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(
      <UiProviders>
        <Refuse role={role} />
      </UiProviders>,
    )
    act(() => screen.getByRole('button', { name: 'press' }).click())
    expect(screen.getByRole('status').textContent).toBe(words)
    act(() => vi.advanceTimersByTime(TOAST_MS - 1))
    expect(screen.getByRole('status').textContent).toBe(words)
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
