/*
 * Nothing held for one person or Developer reaches the next (the refuter's findings, 29 Sep 2026): a
 * toast still on screen when the MD signs out is gone before the Guest signs in, and a project page
 * the router cached in one Developer is never shown again under the same code in the next.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PASSWORD } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'

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

async function signIn(email: string) {
  await userEvent.type(await screen.findByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), PASSWORD)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('what the session’s acts forget', () => {
  it('drops a toast still on screen when the MD signs out, before the Guest signs in', async () => {
    const api = new FakeApi()
    await mountApp('/members', { as: PEOPLE.md, api })
    await screen.findByText('rumana@shapla-homes.example')
    await userEvent.click(within(screen.getByRole('table', { name: 'Vextrus access' })).getByRole('button', { name: 'Revoke' }))
    await userEvent.click(await screen.findByRole('button', { name: 'End access' }))
    await waitFor(() => expect(clean(screen.getByRole('status').textContent)).toMatch(/access has ended\.$/))
    await userEvent.click(await screen.findByRole('button', { name: named(/Kamal Uddin, MD/) }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(clean(screen.getByRole('status').textContent)).toBe('')
    await signIn(PEOPLE.guest)
    await screen.findByRole('button', { name: named(/Farhana Kabir, Guest/) })
    expect(clean(document.body.textContent)).not.toMatch(/access has ended/)
  })

  it('never shows the first Developer’s project under the same code in the second', async () => {
    const api = new FakeApi()
    api.addProject(api.developer('Kanchan Homes Ltd'), 'MG-01', 'Kanchan Tower', 'Plot 1, Road 1, Dhaka')
    const { router } = await mountApp('/sign-in', { as: null, api })
    await signIn(PEOPLE.twoDevelopers)
    await userEvent.click(await screen.findByRole('button', { name: /Meghna Properties Ltd/ }))
    expect(await screen.findByText('Meghna Heights')).toBeVisible()
    await router.navigate({ href: '/p/MG-01/takeoff/1' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/MG-01/takeoff/1'))
    await userEvent.click(screen.getByRole('button', { name: named(/Rafiq Hasan, QS/) }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: named(/Switch to Kanchan Homes Ltd/) }))
    await screen.findByText('Kanchan Tower')
    const seen = new Set<string>()
    const look = () => {
      for (const m of router.state.matches) if (m.routeId === '/_app/p/$code' && m.loaderData) seen.add((m.loaderData as { name: string }).name)
      if (clean(document.body.textContent).includes('Meghna Heights')) seen.add('Meghna Heights in the page')
    }
    const off = router.subscribe('onRendered', look)
    const observer = new MutationObserver(look)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    await router.navigate({ href: '/p/MG-01/takeoff/1' })
    await waitFor(() => expect(screen.getByRole('button', { name: named(/Project: Kanchan Tower/) })).toBeInTheDocument())
    off()
    observer.disconnect()
    expect([...seen].filter((s) => s.includes('Meghna'))).toEqual([])
  })
})
