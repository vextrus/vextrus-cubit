/*
 * Nothing held for one person or Developer reaches the next (the refuter's findings, 29 Sep 2026): a
 * toast still on screen when the MD signs out is gone before the Guest signs in, and a project page
 * the router cached in one Developer is never shown again under the same code in the next; and an act
 * still in flight when the session changes says nothing, and writes nothing, once its answer comes
 * (review 20a r1, finding 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { setTransport } from '@/api/client'
import { FakeApi, PASSWORD } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'
import { chooseDeveloper } from './actions'

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

/**
 * The API does the act at once, but its answer is held back until released, as a slow network holds
 * it: the act has happened on the server, and the page learns so late.
 */
function holdAnswers(api: FakeApi, match: (method: string, path: string) => boolean) {
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let held = 0
  let answered = 0
  const restore = setTransport(async (request) => {
    const answer = await api.handle(request)
    if (!match(request.method, new URL(request.url).pathname)) return answer
    held += 1
    await released
    answered += 1
    return answer
  })
  return { release, restore, held: () => held, answered: () => answered }
}

describe('what the session’s acts forget', () => {
  it('drops a toast still on screen when the MD signs out, before the Guest signs in', async () => {
    const api = new FakeApi()
    await mountApp('/members', { as: PEOPLE.md, api })
    await screen.findByText('rumana@shapla-homes.example')
    await userEvent.click(within(screen.getByRole('table', { name: 'Vextrus access' })).getByRole('button', { name: /^Revoke / }))
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
    // The top bar shows Kanchan Tower as soon as the session is set, before the switch's own move to
    // /projects and its last clearing of the router's cache have ended: wait for those too.
    await waitFor(() => {
      expect(router.state.status).toBe('idle')
      expect(router.state.matches.some((m) => m.routeId === '/_app/p/$code')).toBe(false)
    })
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

  it('says nothing to the Guest of the MD’s Renew still in flight when the MD signed out, and keeps none of its rows', async () => {
    const api = new FakeApi()
    const { queryClient } = await mountApp('/members', { as: PEOPLE.md, api })
    await screen.findByText('rumana@shapla-homes.example')
    const answers = holdAnswers(api, (method, path) => method === 'POST' && path.endsWith('/renew'))
    await userEvent.click(within(screen.getByRole('table', { name: named(/^People at/) })).getAllByRole('button', { name: /^Renew 30 days for / })[0]!)
    await waitFor(() => expect(answers.held()).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: named(/Kamal Uddin, MD/) }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in' })
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    await signIn(PEOPLE.guest)
    await screen.findByRole('button', { name: named(/Farhana Kabir, Guest/) })
    answers.release()
    await waitFor(() => expect(answers.answered()).toBe(1))
    // The act's own ending (its toast, its rows read again) runs after the answer: give it its turn.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(clean(screen.getByRole('status').textContent)).toBe('')
    expect(clean(document.body.textContent)).not.toMatch(/access now ends/)
    expect(queryClient.getQueryCache().findAll({ queryKey: ['members'] })).toHaveLength(0)
    answers.restore()
  })

  it('does not open the project created in one Developer once another tab has switched to the next', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.twoDevelopers)
    api.session.developerId = api.developer('Meghna Properties Ltd').id
    const a = await mountApp('/projects', { as: null, api })
    await userEvent.click(await within(a.container).findByRole('button', { name: 'New project' }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    await userEvent.type(within(form).getByLabelText('Name'), 'Hasnahena Tower')
    await userEvent.type(within(form).getByLabelText('Code'), 'HT-01')
    const answers = holdAnswers(api, (method, path) => method === 'POST' && path === '/api/projects')
    await userEvent.click(within(form).getByRole('button', { name: 'Create project' }))
    await waitFor(() => expect(answers.held()).toBe(1))

    const b = await mountApp('/projects', { as: null, api })
    await within(b.container).findByText('Meghna Heights')
    await chooseDeveloper({ queryClient: b.queryClient, router: b.router, clearToast: () => undefined }, api.developer('Kanchan Homes Ltd').id)
    await waitFor(() => expect(clean(a.container.querySelector('[data-region="top-bar"]')?.textContent)).toContain('Kanchan Homes Ltd'))
    answers.release()
    await waitFor(() => expect(answers.answered()).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(a.router.state.location.pathname).toBe('/projects')
    answers.restore()
  })
})
