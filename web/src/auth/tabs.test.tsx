/*
 * The session read again (review 20a r1, finding 1; design gate must 1): on every move inside the frame,
 * whenever the tab comes back into view, and at once when another tab of the browser signs in or out,
 * joins or chooses a Developer. Two apps mounted on one in-memory API share its session as two tabs
 * share the cookie, and hear each other as tabs do (tabs.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PASSWORD } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'
import { chooseDeveloper, enter, signIn, signOut, type Held } from './actions'

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

/** Every address the router settled on, from now. */
function settled(router: Awaited<ReturnType<typeof mountApp>>['router']): string[] {
  const seen: string[] = []
  router.subscribe('onResolved', (event) => seen.push(event.toLocation.pathname))
  return seen
}

/** Every text that ever entered the page, from now. */
function watchText(): { saw: (text: string) => boolean; stop: () => void } {
  const texts: string[] = []
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) texts.push(node.textContent ?? '')
    for (const record of records) if (record.type === 'characterData') texts.push(record.target.textContent ?? '')
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return { saw: (text) => texts.some((t) => t.includes(text)), stop: () => observer.disconnect() }
}

/**
 * The other tab's own acts, as its menu and sign-in form run them. (Its buttons are not clicked: in one
 * test document, this tab's open dialog would hold the pointer and the focus, as two tabs never do.)
 */
function heldBy(tab: Awaited<ReturnType<typeof mountApp>>): Held {
  return { queryClient: tab.queryClient, router: tab.router, clearToast: () => undefined }
}

/** What a tab's toast says now, isolates aside. */
function said(container: HTMLElement): string {
  return clean(within(container).getByRole('status').textContent)
}

/** The words of a tab's top bar. */
function topBar(container: HTMLElement): string {
  return clean(container.querySelector('[data-region="top-bar"]')?.textContent)
}

function developerId(api: FakeApi, name: string): string {
  return api.developers.find((d) => d.name === name)!.id
}

describe('a revoked member’s next click (4.4’s finish line, step 10)', () => {
  it('lands on Access ended from the brand, with no reload, though the projects page asks the API nothing new', async () => {
    const api = new FakeApi()
    const { router } = await mountApp('/projects', { as: PEOPLE.engineer, api })
    expect(await screen.findByText('Bokul Place')).toBeVisible()
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
    const before = api.calls().length
    await userEvent.click(screen.getByRole('link', { name: 'Vextrus' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/access-ended'))
    expect(await screen.findByRole('heading', { name: 'Access ended' })).toBeVisible()
    expect(clean(screen.getByRole('main').querySelector('p')?.textContent)).toBe(
      'Your access to Shapla Homes Ltd has ended. Kamal Uddin revoked it on 28 Sep 2026. What you did before then is kept under your name.',
    )
    expect(api.calls().slice(before)[0]).toBe('GET /api/me')
    await waitFor(() => expect(document.body.textContent).not.toContain('Bokul Place'))
  })

  it('lands on Access ended from a project’s row, never opening the project', async () => {
    const api = new FakeApi()
    const { router } = await mountApp('/projects', { as: PEOPLE.engineer, api })
    const row = await screen.findByRole('link', { name: /Kadam Residence/ })
    const seen = settled(router)
    api.revoke(PEOPLE.engineer, 'Shapla Homes Ltd', PEOPLE.md)
    await userEvent.click(row)
    await waitFor(() => expect(router.state.location.pathname).toBe('/access-ended'))
    expect(await screen.findByRole('heading', { name: 'Access ended' })).toBeVisible()
    expect(seen.filter((path) => path.startsWith('/p/'))).toEqual([])
  })
})

describe('another tab of the same browser', () => {
  it('switching the Developer there: this tab’s open invite dialog is gone before it can write, and it starts again in the new Developer', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.twoDevelopers)
    api.session.developerId = developerId(api, 'Meghna Properties Ltd')
    const a = await mountApp('/members', { as: null, api })
    await userEvent.click(await within(a.container).findByRole('button', { name: 'Invite' }))
    const dialog = await screen.findByRole('dialog', { name: named(/^Invite someone to Meghna Properties Ltd$/) })
    await userEvent.type(within(dialog).getByLabelText('Email'), 'someone@meghna.example')

    const b = await mountApp('/projects', { as: null, api })
    await within(b.container).findByText('Meghna Heights')
    await chooseDeveloper(heldBy(b), developerId(api, 'Kanchan Homes Ltd'))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: named(/^Invite someone to Meghna Properties Ltd$/) })).toBeNull())
    await waitFor(() => expect(a.router.state.location.pathname).toBe('/projects'))
    await waitFor(() => expect(said(a.container)).toBe('You switched to Kanchan Homes Ltd in another tab, so this tab has switched too.'))
    expect(said(b.container)).toBe('')
    expect(topBar(a.container)).toContain('Kanchan Homes Ltd')
    expect(api.calls().filter((call) => call.startsWith('POST /api/invitations'))).toEqual([])
  })

  it('learns it on coming back into view, with no word from the other tab', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.twoDevelopers)
    api.session.developerId = developerId(api, 'Meghna Properties Ltd')
    const { router, container } = await mountApp('/members', { as: null, api })
    await within(container).findByRole('heading', { name: 'Members and access' })
    api.session.developerId = developerId(api, 'Kanchan Homes Ltd')
    // The tab comes back into view, as the browser says it.
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
    await waitFor(() => expect(said(container)).toBe('You switched to Kanchan Homes Ltd in another tab, so this tab has switched too.'))
  })

  it('learns it on the next move inside the frame', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.twoDevelopers)
    api.session.developerId = developerId(api, 'Meghna Properties Ltd')
    const { router, container } = await mountApp('/projects', { as: null, api })
    expect(await within(container).findByText('Meghna Heights')).toBeVisible()
    api.session.developerId = developerId(api, 'Kanchan Homes Ltd')
    const text = watchText()
    await userEvent.click(within(container).getByRole('link', { name: /Meghna Heights/ }))
    await waitFor(() => expect(topBar(container)).toContain('Kanchan Homes Ltd'))
    expect(router.state.location.pathname).toBe('/projects')
    await waitFor(() => expect(said(container)).toBe('You switched to Kanchan Homes Ltd in another tab, so this tab has switched too.'))
    text.stop()
    expect(text.saw('MG-01')).toBe(false)
  })

  it('signing out there opens this tab’s Signed-out dialog over its page, and signing in again there closes it', async () => {
    const api = new FakeApi()
    const a = await mountApp('/projects', { as: PEOPLE.qs, api })
    await userEvent.click(await within(a.container).findByRole('button', { name: 'New project' }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    await userEvent.type(within(form).getByLabelText('Name'), 'Hasnahena Tower')

    const b = await mountApp('/members', { as: null, api })
    await within(b.container).findByRole('heading', { name: 'Members and access' })
    await signOut(heldBy(b))
    expect(b.router.state.location.pathname).toBe('/sign-in')

    expect(await screen.findByRole('dialog', { name: 'You were signed out.' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hasnahena Tower')).toBeInTheDocument()

    await enter(heldBy(b), await signIn(PEOPLE.qs, PASSWORD))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'You were signed out.' })).toBeNull())
    expect(screen.getByDisplayValue('Hasnahena Tower')).toBeInTheDocument()
    expect(a.router.state.location.pathname).toBe('/projects')
  })

  it('someone else signing in there: this tab starts again as them, never showing them the first person’s rows', async () => {
    const api = new FakeApi()
    const a = await mountApp('/members', { as: PEOPLE.md, api })
    expect(await within(a.container).findByText('rumana@shapla-homes.example')).toBeVisible()

    // The other tab shows /sign-in (signed out there a moment ago; this tab has not asked since).
    api.session = { userId: null, developerId: null }
    const b = await mountApp('/sign-in', { as: null, api })
    await within(b.container).findByLabelText('Password')
    const text = watchText()
    await enter(heldBy(b), await signIn(PEOPLE.guest, PASSWORD))

    await waitFor(() => expect(a.router.state.location.pathname).toBe('/projects'))
    await waitFor(() => expect(said(a.container)).toBe('Farhana Kabir signed in from another tab, so this tab is theirs now.'))
    expect(topBar(a.container)).toContain('Farhana Kabir')
    text.stop()
    expect(text.saw('rumana@shapla-homes.example')).toBe(false)
    expect(text.saw('Bokul Place')).toBe(false)
  })
})
