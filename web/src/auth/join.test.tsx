/*
 * An invitation link's page, /join#<token> (m0-screens §4.2, "Invitation link opened"; the owner's
 * ruling of 28 Sep 2026: the unusable words name no Developer). The token is read from the fragment
 * only and never kept anywhere but the page's memory.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
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
const UNUSABLE = 'This invitation can no longer be used. Ask whoever sent it for a new one.'
const END_26_OCT = '2026-10-26T17:59:00Z'

/** An invitation made as the MD through the API, as the Members page makes one; its token. */
async function invited(api: FakeApi, body: { email: string; role: string; project_ids?: string[] | null; expires_at?: string | null }): Promise<string> {
  const before = api.session
  api.signInAs(PEOPLE.md)
  const csrf = api.csrf!
  const response = await api.handle(
    new Request(`${location.origin}/api/members/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ outside_org: '', project_ids: null, expires_at: null, ...body }),
    }),
  )
  api.session = before
  return ((await response.json()) as { token: string }).token
}

async function join(path: string, options: Parameters<typeof mountApp>[1]) {
  const app = await mountApp(path, options)
  await waitFor(() => expect(screen.queryByText('Opening the invitation…')).toBeNull())
  return app
}

const line = () => clean(screen.getByRole('heading', { level: 1 }).nextElementSibling?.textContent)

describe('the link’s page (§4.2)', () => {
  it.each([
    ['no token at all', '/join'],
    ['a guessed token', '/join#guessedtoken0000'],
    ['a token too long to be one', `/join#${'x'.repeat(300)}`],
  ])('says a link cannot be used, naming no Developer, for %s', async (_, path) => {
    const { router, keyMap } = await join(path, { as: null })
    expect(screen.getByText(UNUSABLE)).toBeVisible()
    expect(document.body.textContent).not.toContain('Shapla')
    expect(router.state.location.hash).toBe('')
    expectKeyMapSound(keyMap)
  })

  it.each([
    ['used', (api: FakeApi, token: string) => api.memberships.filter((m) => m.token === token).forEach((m) => ((m.userId = api.user(PEOPLE.qs).id), (m.token = null)))],
    ['withdrawn', (api: FakeApi, token: string) => api.memberships.filter((m) => m.token === token).forEach((m) => (m.revokedAt = '2026-09-27T00:00:00Z'))],
    ['expired', (api: FakeApi, token: string) => api.memberships.filter((m) => m.token === token).forEach((m) => (m.inviteExpiresAt = '2026-09-27T00:00:00Z'))],
  ])('says a %s link cannot be used, naming no Developer', async (_, spoil) => {
    const api = new FakeApi()
    const token = api.tokenFor('rumana@shapla-homes.example')
    spoil(api, token)
    await join(`/join#${token}`, { as: null, api })
    expect(screen.getByText(UNUSABLE)).toBeVisible()
    expect(document.body.textContent).not.toContain('Shapla')
  })

  it('looks up a new link pasted into the page that said the last one could not be used (only the fragment changes)', async () => {
    const api = new FakeApi()
    const used = api.tokenFor('rumana@shapla-homes.example')
    api.memberships.filter((m) => m.token === used).forEach((m) => ((m.userId = api.user(PEOPLE.qs).id), (m.token = null)))
    const token = await invited(api, { email: 'sadia@shapla-homes.example', role: 'qs' })
    const { router } = await join(`/join#${used}`, { as: null, api })
    expect(screen.getByText(UNUSABLE)).toBeVisible()
    await router.history.push(`/join#${token}`)
    expect(await screen.findByRole('heading', { name: named(/^Join Shapla Homes Ltd$/) })).toBeVisible()
    expect(screen.queryByText(UNUSABLE)).toBeNull()
    await waitFor(() => expect(router.state.location.hash).toBe(''))
  })

  it('joins a new person: name and a password of at least 12 characters, in the API’s words, then their projects', async () => {
    const api = new FakeApi()
    const token = api.tokenFor('rumana@shapla-homes.example')
    const { router, queryClient } = await join(`/join#${token}`, { as: null, api })
    expect(screen.getByRole('heading', { name: (n) => clean(n) === 'Join Shapla Homes Ltd' })).toBeVisible()
    expect(document.title).toBe('Join Shapla Homes Ltd · Vextrus')
    expect(line()).toBe('Kamal Uddin invited you as a QS.')
    // The token has left the address bar, and is in no query key, search or log.
    expect(router.state.location.hash).toBe('')
    expect(router.state.location.href).not.toContain(token)
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.queryKey))).not.toContain(token)
    expect(JSON.stringify(queryClient.getMutationCache().getAll().map((m) => m.state.variables))).not.toContain(token)
    expect(screen.getByLabelText('Email')).toHaveValue('rumana@shapla-homes.example')
    expect(screen.getByText('At least 12 characters')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(screen.getByText('Enter your name.')).toBeVisible()
    await userEvent.type(screen.getByLabelText('Name'), 'Rumana Akter')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    const refused = await screen.findByText((_, el) => el?.hasAttribute('data-field-error') === true && clean(el.textContent) === 'At least 12 characters.')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', refused.id)
    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
    expect(await screen.findByRole('button', { name: (n) => /Rumana Akter, QS/.test(clean(n)) })).toBeVisible()
  })

  it('says what a Guest may do, naming the projects by code and name and the end date', async () => {
    const api = new FakeApi()
    const token = await invited(api, { email: 'jamal.mia@padma-builders.example', role: 'guest', project_ids: [api.project('KR-01').id], expires_at: END_26_OCT })
    await join(`/join#${token}`, { as: null, api })
    expect(line()).toBe(
      'Kamal Uddin invited you as a Guest to KR-01 Kadam Residence until 26 Oct 2026. You can look at its drawings and Takeoff but not change them.',
    )
  })

  it('leaves the until clause out when the access has no end date, and names two projects by the list pattern', async () => {
    const api = new FakeApi()
    const token = await invited(api, { email: 'hasan@padma-builders.example', role: 'guest', project_ids: [api.project('KR-01').id, api.project('BP-02').id] })
    await join(`/join#${token}`, { as: null, api })
    expect(line()).toBe('Kamal Uddin invited you as a Guest to BP-02 Bokul Place and KR-01 Kadam Residence. You can look at their drawings and Takeoff but not change them.')
  })

  it('gives a Vextrus Engineer’s invitation with no account words that say why and what to do, and no form', async () => {
    const api = new FakeApi()
    const token = await invited(api, { email: 'sabbir@vextrus.example', role: 'vextrus_engineer', expires_at: END_26_OCT })
    await join(`/join#${token}`, { as: null, api })
    expect(line()).toBe('Kamal Uddin invited you as a Vextrus Engineer until 26 Oct 2026.')
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          clean(el.textContent) ===
            'This invitation is for a Vextrus Engineer, but sabbir@vextrus.example has no Vextrus account. Ask whoever sent it to invite your Vextrus email, or to invite you in another role.',
      ),
    ).toBeVisible()
    expect(screen.queryByLabelText('Password')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
  })

  it('takes the password of an email that has an account, signs in and joins', async () => {
    const api = new FakeApi()
    const token = await invited(api, { email: PEOPLE.meghnaQs, role: 'qs' })
    const { router } = await join(`/join#${token}`, { as: null, api })
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    expect(screen.queryByLabelText('Name')).toBeNull()
    await userEvent.type(screen.getByLabelText('Password'), 'wrong password here')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect((await screen.findByRole('alert')).textContent).toBe("That email and password don't match an account. Check them and try again.")
    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
    expect(await screen.findByText('Kadam Residence')).toBeVisible()
  })

  it('joins in one press when signed in as the invited email', async () => {
    const api = new FakeApi()
    const token = await invited(api, { email: PEOPLE.meghnaQs, role: 'qs' })
    const { router } = await join(`/join#${token}`, { as: PEOPLE.meghnaQs, api })
    expect(screen.queryByLabelText('Password')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
    expect(await screen.findByText('Kadam Residence')).toBeVisible()
  })

  it('says a signed-in account is the wrong one, and after [Sign out] carries on with the link it holds', async () => {
    const api = new FakeApi()
    const token = api.tokenFor('rumana@shapla-homes.example')
    await join(`/join#${token}`, { as: PEOPLE.qs, api })
    expect(clean(screen.getByRole('alert').textContent)).toBe(
      'This invitation is for rumana@shapla-homes.example. Sign out, then sign in here as rumana@shapla-homes.example to join.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByLabelText('Name')).toBeVisible()
    expect(api.calls()).toContain('POST /api/auth/sign-out')
  })

  it('renders a Developer’s and an inviter’s names as text, whatever they hold', async () => {
    const api = new FakeApi()
    api.developer('Shapla Homes Ltd').name = '<img src=x onerror=alert(1)>'
    api.user(PEOPLE.md).name = 'javascript:alert(1)'
    const token = api.tokenFor('rumana@shapla-homes.example')
    await join(`/join#${token}`, { as: null, api })
    expect(document.querySelector('img')).toBeNull()
    expect(clean(screen.getByRole('heading', { level: 1 }).textContent)).toBe('Join <img src=x onerror=alert(1)>')
    expect(line()).toBe('javascript:alert(1) invited you as a QS.')
    expect(document.querySelector('a[href^="javascript"]')).toBeNull()
  })

  it('works at 390 px wide', async () => {
    await page.viewport(390, 844)
    const api = new FakeApi()
    await join(`/join#${api.tokenFor('rumana@shapla-homes.example')}`, { as: null, api })
    expect(screen.getByRole('heading', { name: (n) => clean(n) === 'Join Shapla Homes Ltd' })).toBeVisible()
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'Join' }).getBoundingClientRect().right).toBeLessThanOrEqual(390)
  })
})
