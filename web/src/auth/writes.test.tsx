/*
 * Every write sends the CSRF token, and words a refusal in place, `csrf_failed` included (the trust
 * boundary: sign-in, sign-out, choose, look-up, accept, invite, link, withdraw, revoke, renew and create).
 * The in-memory API refuses a write without the token, as the server does; here each write's token is
 * refused once, as a stale page's would be, and its screen must say so in the API's words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { setTransport } from '@/api/client'
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

const STALE = 'This page is out of date. Reload it and try again.'
const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')
const named = (re: RegExp) => (name: string) => re.test(clean(name))

function refuseOnce(api: FakeApi, path: RegExp) {
  api.failOnce((method, p) => method === 'POST' && path.test(p), 403, { code: 'platform.auth.csrf_failed', params: {} })
}

async function said(words = STALE) {
  await waitFor(() => expect(clean(document.body.textContent)).toContain(words))
}

describe('each write words its refused token in place', () => {
  it('sign-in', async () => {
    const api = new FakeApi()
    await mountApp('/sign-in', { as: null, api })
    refuseOnce(api, /\/api\/auth\/sign-in$/)
    await userEvent.type(await screen.findByLabelText('Email'), PEOPLE.qs)
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await said()
  })

  it('sign-out, from the user menu, and the page stays', async () => {
    const api = new FakeApi()
    const { router } = await mountApp('/projects', { api })
    refuseOnce(api, /\/api\/auth\/sign-out$/)
    await userEvent.click(await screen.findByRole('button', { name: named(/Nusrat Jahan, QS/) }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sign out' }))
    await said()
    expect(router.state.location.pathname).toBe('/projects')
  })

  it('choosing on "Which Developer?"', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.twoDevelopers)
    await mountApp('/choose-developer', { as: null, api })
    refuseOnce(api, /\/api\/me\/developer$/)
    await userEvent.click(within(await screen.findByRole('listbox', { name: 'Your Developers' })).getAllByRole('button')[0]!)
    await said()
  })

  it('switching Developer, from the user menu', async () => {
    const api = new FakeApi()
    api.signInAs(PEOPLE.twoDevelopers)
    api.session.developerId = api.developer('Meghna Properties Ltd').id
    await mountApp('/projects', { as: null, api })
    refuseOnce(api, /\/api\/me\/developer$/)
    await userEvent.click(await screen.findByRole('button', { name: named(/Rafiq Hasan, QS/) }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: named(/Switch to Kanchan Homes Ltd/) }))
    await said()
    expect(screen.getByText('Meghna Heights')).toBeVisible()
  })

  it('an invitation link’s look-up, never as the link’s own words', async () => {
    const api = new FakeApi()
    const token = api.tokenFor('rumana@shapla-homes.example')
    refuseOnce(api, /\/api\/invitations\/look-up$/)
    await mountApp(`/join#${token}`, { as: null, api })
    await said()
    expect(document.body.textContent).not.toContain('This invitation can no longer be used.')
  })

  it('accepting it', async () => {
    const api = new FakeApi()
    const token = api.tokenFor('rumana@shapla-homes.example')
    await mountApp(`/join#${token}`, { as: null, api })
    await userEvent.type(await screen.findByLabelText('Name'), 'Rumana Akter')
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password')
    refuseOnce(api, /\/api\/invitations\/accept$/)
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    await said()
  })

  it('inviting', async () => {
    const api = new FakeApi()
    await mountApp('/members', { as: PEOPLE.md, api })
    await userEvent.click(await screen.findByRole('button', { name: 'Invite' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Email'), 'jamal.mia@padma-builders.example')
    refuseOnce(api, /\/api\/members\/invitations$/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await waitFor(() => expect(clean(dialog.textContent)).toContain(STALE))
  })

  it.each([
    ['a new link', /\/link$/, 'Copy link'],
    ['withdrawing', /\/withdraw$/, 'Withdraw'],
    ['renewing', /\/renew$/, 'Renew 30 days'],
  ])('%s, on its row', async (_, path, button) => {
    const api = new FakeApi()
    await mountApp('/members', { as: PEOPLE.md, api })
    await screen.findByText('rumana@shapla-homes.example')
    refuseOnce(api, path)
    await userEvent.click(screen.getAllByRole('button', { name: button })[0]!)
    await said()
  })

  it('revoking, after its confirm', async () => {
    const api = new FakeApi()
    await mountApp('/members', { as: PEOPLE.md, api })
    await screen.findByText('rumana@shapla-homes.example')
    refuseOnce(api, /\/revoke$/)
    await userEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'End access' }))
    await said()
  })

  it('creating a project', async () => {
    const api = new FakeApi()
    await mountApp('/projects', { api })
    await userEvent.click(await screen.findByRole('button', { name: 'New project' }))
    const dialog = await screen.findByRole('dialog', { name: 'New project' })
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Hasnahena Tower')
    await userEvent.type(within(dialog).getByLabelText('Code'), 'HT-04')
    refuseOnce(api, /\/api\/projects$/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    await waitFor(() => expect(clean(dialog.textContent)).toContain(STALE))
  })
})

describe('the token on every write', () => {
  it('sends the current token, rotated by signing in, on each write of a working session', async () => {
    const api = new FakeApi()
    const sent: [string, string | null, string | null][] = []
    await mountApp('/sign-in', { as: null, api })
    setTransport(async (request) => {
      if (request.method !== 'GET') sent.push([new URL(request.url).pathname, request.headers.get('X-CSRFToken'), api.csrf])
      return api.handle(request)
    })
    await userEvent.type(await screen.findByLabelText('Email'), PEOPLE.md)
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await userEvent.click(await screen.findByRole('link', { name: 'Members and access' }))
    await screen.findByText('rumana@shapla-homes.example')
    await userEvent.click(screen.getAllByRole('button', { name: 'Renew 30 days' })[0]!)
    await userEvent.click(screen.getAllByRole('button', { name: 'Withdraw' })[0]!)
    await waitFor(() => expect(sent.map(([p]) => p)).toEqual(['/api/auth/sign-in', expect.stringMatching(/\/renew$/), expect.stringMatching(/\/withdraw$/)]))
    for (const [path, header, current] of sent) expect(header, path).toBe(current)
    expect(sent[0]![1]).not.toBe(sent[1]![1])
  })
})
