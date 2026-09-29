/*
 * Sign-in, "Which Developer?", signing out and the Developer switcher (m0-screens §4.1, §4.2; stories
 * 1, 56), through the in-memory API, in Chromium. The trust boundary: `next` never leaves the app,
 * every write carries the CSRF token, and signing out or switching Developer clears what was held.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { setTransport } from '@/api/client'
import { FakeApi, PASSWORD } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'
import { expectKeyMapSound } from '@/ui'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')
const named = (re: RegExp) => (name: string) => re.test(clean(name))

async function signIn(email: string, password = PASSWORD) {
  await userEvent.type(await screen.findByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

/** Every text shown from now on (a MutationObserver), to prove something was never in the DOM. */
function recordText() {
  const seen: string[] = []
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) seen.push(node.textContent ?? '')
      if (r.type === 'characterData') seen.push(r.target.textContent ?? '')
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return {
    text: () => clean(seen.join('\n') + '\n' + document.body.textContent),
    stop: () => observer.disconnect(),
  }
}

describe('sign-in (§4.2)', () => {
  it('sends a signed-out address to /sign-in and back to it after signing in', async () => {
    const { router } = await mountApp('/members', { as: null })
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    expect(router.state.location.search).toEqual({ next: '/members' })
    expect(document.title).toBe('Sign in · Vextrus')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(screen.getByText('Forgot your password? Ask Vextrus to set a new one.')).toBeVisible()
    await signIn(PEOPLE.md)
    await waitFor(() => expect(router.state.location.pathname).toBe('/members'))
    expect(await screen.findByRole('heading', { name: 'Members and access' })).toBeVisible()
  })

  it('refuses an empty field under it, and a wrong password in the API’s words, never naming the field', async () => {
    const { api } = await mountApp('/sign-in', { as: null })
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter your email.')).toBeVisible()
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    await userEvent.type(screen.getByLabelText('Email'), PEOPLE.qs)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter your password.')).toBeVisible()
    await userEvent.type(screen.getByLabelText('Password'), 'not the password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    const bar = await screen.findByRole('alert')
    expect(bar.textContent).toBe("That email and password don't match an account. Check them and try again.")
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0)
    expect(api.calls()).not.toContain('GET /api/projects')
  })

  it('locks the fields and shows "Signing in…" while signing in', async () => {
    const api = new FakeApi()
    await mountApp('/sign-in', { as: null, api })
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    setTransport(async (request) => {
      if (request.url.endsWith('/api/auth/sign-in')) await held
      return api.handle(request)
    })
    await signIn(PEOPLE.qs)
    const button = await screen.findByRole('button', { name: 'Signing in…' })
    expect(button).toBeDisabled()
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Password')).toHaveAttribute('readonly')
    release()
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeVisible()
  })

  it('submits with Enter, in the order Email → Password → Sign in', async () => {
    const { router } = await mountApp('/sign-in', { as: null })
    await screen.findByRole('heading', { name: 'Sign in' })
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    await userEvent.keyboard(PEOPLE.qs)
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Password'))
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sign in' }))
    await userEvent.tab({ shift: true })
    await userEvent.keyboard(`${PASSWORD}{Enter}`)
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
  })

  it('fetches the CSRF token before the first write and sends it; a refused token is said in the API’s words', async () => {
    const { api } = await mountApp('/sign-in', { as: null })
    api.failOnce((method, path) => method === 'POST' && path === '/api/auth/sign-in', 403, { code: 'platform.auth.csrf_failed', params: {} })
    await signIn(PEOPLE.qs)
    expect((await screen.findByRole('alert')).textContent).toBe('This page is out of date. Reload it and try again.')
    const calls = api.calls()
    expect(calls.indexOf('GET /api/auth/csrf')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('GET /api/auth/csrf')).toBeLessThan(calls.indexOf('POST /api/auth/sign-in'))
  })

  it('says so when Vextrus cannot be reached', async () => {
    const { api } = await mountApp('/sign-in', { as: null })
    await screen.findByRole('heading', { name: 'Sign in' })
    api.offline = true
    await signIn(PEOPLE.qs)
    expect((await screen.findByRole('alert')).textContent).toBe('Vextrus can’t be reached. Check your connection and try again.')
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/sign-in', '%2F%2Fevil.example', '/.//evil.example', '/a/..//x/sign-in'])(
    'goes to /projects, never to %j, after signing in',
    async (next) => {
      const { router } = await mountApp(`/sign-in?next=${encodeURIComponent(next)}`, { as: null })
      await signIn(PEOPLE.qs)
      await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
      expect(router.state.location.href.startsWith('/projects')).toBe(true)
    },
  )

  it('is never a blank page while signed in: /sign-in goes to the projects', async () => {
    const { router } = await mountApp('/sign-in')
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
  })

  it('works at 390 px wide, with no phone notice', async () => {
    await page.viewport(390, 844)
    await mountApp('/sign-in', { as: null })
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(screen.queryByText('Vextrus needs a desktop')).toBeNull()
    const card = screen.getByRole('main').firstElementChild!.getBoundingClientRect()
    expect(card.right).toBeLessThanOrEqual(390)
  })

  it('keeps its keys sound', async () => {
    const { keyMap } = await mountApp('/sign-in', { as: null })
    await screen.findByRole('heading', { name: 'Sign in' })
    expectKeyMapSound(keyMap)
  })
})

describe('"Which Developer?" (§4.2) and the Developer switcher (§4.1)', () => {
  it('lists each Developer with the role in it after signing in, and works in the one chosen by Enter', async () => {
    const { router, keyMap } = await mountApp('/sign-in', { as: null })
    await signIn(PEOPLE.twoDevelopers)
    await waitFor(() => expect(router.state.location.pathname).toBe('/choose-developer'))
    expect(await screen.findByRole('heading', { name: 'Which Developer?' })).toBeVisible()
    expect(document.title).toBe('Which Developer? · Vextrus')
    const list = screen.getByRole('listbox', { name: 'Your Developers' })
    expect(within(list).getAllByRole('option').map((o) => clean(o.textContent))).toEqual(['Meghna Properties LtdQS', 'Kanchan Homes LtdMD'])
    expectKeyMapSound(keyMap)
    list.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
    expect(await screen.findByText('Meghna Heights')).toBeVisible()
  })

  it('switches Developer from the user menu, clearing what was held: no row of the first is ever shown again', async () => {
    const { router } = await mountApp('/sign-in', { as: null })
    await signIn(PEOPLE.twoDevelopers)
    await userEvent.click(await screen.findByRole('button', { name: /Meghna Properties Ltd/ }))
    expect(await screen.findByText('Meghna Heights')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: named(/Rafiq Hasan, QS/) }))
    const menu = await screen.findByRole('menu')
    expect(clean(within(menu).getByText(/Working in/).textContent)).toBe('Working in Meghna Properties Ltd')
    const record = recordText()
    await userEvent.click(within(menu).getByRole('menuitem', { name: named(/Switch to Kanchan Homes Ltd/) }))
    expect(await screen.findByText('No projects yet. Your QS creates them.')).toBeVisible()
    expect(router.state.location.pathname).toBe('/projects')
    record.stop()
    expect(screen.getByRole('button', { name: named(/Rafiq Hasan, MD/) })).toBeVisible()
    expect(record.text()).not.toContain('Meghna Heights')
    expect(record.text()).not.toContain('MG-01')
  })

  it('shows no switcher to a user with one Membership', async () => {
    await mountApp('/projects')
    await userEvent.click(await screen.findByRole('button', { name: named(/Nusrat Jahan, QS/) }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByText(/Switch to/)).toBeNull()
    expect(within(menu).queryByText(/Working in/)).toBeNull()
  })
})

describe('signing out (§4.1 user menu)', () => {
  it('ends the session at the API and clears everything held: sign out as the QS, sign in as the Guest, and no QS row is ever shown', async () => {
    const { router, api, queryClient } = await mountApp('/members')
    expect(await screen.findByText('rumana@shapla-homes.example')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: named(/Nusrat Jahan, QS/) }))
    const record = recordText()
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    expect(api.calls()).toContain('POST /api/auth/sign-out')
    expect(queryClient.getQueryCache().findAll({ queryKey: ['members'] })).toHaveLength(0)
    expect(queryClient.getQueryCache().findAll({ queryKey: ['session'] })).toHaveLength(0)
    await signIn(PEOPLE.guest)
    expect(await screen.findByText((_, el) => el?.tagName === 'P' && clean(el.textContent) === '1 project at Shapla Homes Ltd is open to you')).toBeVisible()
    record.stop()
    const shown = record.text()
    for (const qsOnly of ['rumana@shapla-homes.example', 'Bokul Place', 'Shimul Garden', 'BP-02', 'SG-03', 'Nusrat Jahan, QS']) expect(shown).not.toContain(qsOnly)
  })
})

describe('the user menu’s Keys (03’s gate minor N1)', () => {
  it('opens the keys overlay from the menu and, closed, gives focus back to the menu’s trigger', async () => {
    await mountApp('/projects')
    const trigger = await screen.findByRole('button', { name: named(/Nusrat Jahan, QS/) })
    await userEvent.click(trigger)
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /Keys/ }))
    await screen.findByRole('dialog', { name: 'Keys' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Keys' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
