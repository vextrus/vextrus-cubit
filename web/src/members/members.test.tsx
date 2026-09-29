/*
 * Members and access (docs/design/m0-screens.md §4.4, §1.4; stories 58–62, 64, 101), in Chromium, on the
 * seed served by the in-memory API (src/app/seed/api.fixture.ts). Words are asserted verbatim; refusals
 * by the words they show; a row's acts are the API's, never the role's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PASSWORD } from '@/app/seed/api.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { UiProviders } from '@/ui/UiProviders'
import { expectKeyMapSound, notationProblems } from '@/ui'
import { MembersLoading } from './MembersPage'

const SHAPLA = 'Shapla Homes Ltd'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

/** Visible text: without the isolates the message layer puts round every value. */
const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')
const named = (re: RegExp) => (name: string) => re.test(clean(name))
const text = (el: Element | null | undefined) => clean(el?.textContent)
/** A matcher for the element whose visible text (isolates aside) is exactly `words`. */
const exactly =
  (words: string, tag = 'P') =>
  (_: string, el: Element | null) =>
    el?.tagName === tag && text(el) === words
/** Dialogs and toasts fade in: wait until the element is seen. */
async function seen(el: HTMLElement) {
  await waitFor(() => expect(el).toBeVisible())
}

async function members(as: string, api = new FakeApi()) {
  const app = await mountApp('/members', { as, api })
  await screen.findByRole('table', { name: named(/^People at /) })
  return app
}

function table(name: RegExp) {
  return screen.getByRole('table', { name: named(name) })
}

/** The body row of `table` whose first cell reads `first`. */
function row(tableName: RegExp, first: string | RegExp) {
  const rows = within(table(tableName)).getAllByRole('row').slice(1)
  const found = rows.find((r) => {
    const cell = text(r.querySelector('td'))
    return typeof first === 'string' ? cell === first : first.test(cell)
  })
  if (!found) throw new Error(`no row ${String(first)} in ${String(tableName)}: ${rows.map((r) => text(r.querySelector('td'))).join(' | ')}`)
  return found
}

function cells(r: HTMLElement) {
  return [...r.querySelectorAll('td')].map((td) => text(td))
}

function buttons(r: HTMLElement) {
  return within(r)
    .queryAllByRole('button')
    .map((b) => text(b))
}

/** Calls the in-memory API directly, as another person's browser would. */
async function call(api: FakeApi, method: string, path: string, body?: unknown) {
  const response = await api.handle(
    new Request(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': api.csrf ?? '' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  return { status: response.status, body: response.status === 204 ? null : ((await response.json()) as unknown) }
}

async function openInvite() {
  await userEvent.click(screen.getByRole('button', { name: 'Invite' }))
  return screen.findByRole('dialog', { name: named(/^Invite someone to /) })
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  const before = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  const spy = vi.fn(writeText)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: spy }, configurable: true })
  return {
    spy,
    restore() {
      if (before) Object.defineProperty(navigator, 'clipboard', before)
      else Reflect.deleteProperty(navigator, 'clipboard')
    },
  }
}

/** The words of 1.1's list the design gate greps the DOM for, and a message code's shape. */
const NEVER_SHOWN = [
  /\bhandle\b/i,
  /\bentity\b/i,
  /\bSDF\b/,
  /\bDXF\b/,
  /\bJSON\b/i,
  /\bsandbox\b/i,
  /\bworker\b/i,
  /\bjobs?\b/i,
  /\bqueue\b/i,
  /\bhash\b/i,
  /\btenant\b/i,
  /\bRLS\b/,
  /\bAPI\b/,
  /\bnull\b/,
  /\bundefined\b/,
  /\bNaN\b/,
  /\bUUID\b/i,
  /\blocale\b/i,
  /Building/,
  /Bangladesh/,
  /\bBDT\b/,
  /৳/,
  /%%/,
  /\b[a-z_]+\.[a-z_]+\.[a-z_]+\b/,
]

function expectNothingNeverShown() {
  const body = clean(document.body.textContent)
  for (const word of NEVER_SHOWN) expect(body, String(word)).not.toMatch(word)
  expect(notationProblems(document.body)).toEqual([])
}

describe('the MD’s page (§4.4)', () => {
  it('heads the page and lists the people with their roles, projects and end dates', async () => {
    await members(PEOPLE.md)
    expect(screen.getByRole('heading', { level: 1, name: 'Members and access' })).toBeVisible()
    expect(text(screen.getByRole('heading', { level: 1 }).nextElementSibling)).toBe('Who can open Shapla Homes Ltd’s projects')
    expect(screen.getByRole('button', { name: 'Invite' })).toBeVisible()
    expect(document.title).toBe('Members and access · Vextrus')
    expect(screen.getByRole('heading', { name: named(/^People at Shapla Homes Ltd$/) })).toBeVisible()

    expect(cells(row(/^People at/, 'Kamal Uddin (you)'))).toEqual(['Kamal Uddin (you)', 'kamal@shapla-homes.example', 'MD', 'All projects', '1 Sep 2026', '—', ''])
    expect(cells(row(/^People at/, 'Nusrat Jahan')).slice(0, 6)).toEqual(['Nusrat Jahan', 'nusrat@shapla-homes.example', 'QS', 'All projects', '3 Sep 2026', '—'])
    expect(cells(row(/^People at/, 'Farhana Kabir')).slice(0, 6)).toEqual(['Farhana Kabir', 'farhana@padma-builders.example', 'Guest', 'KR-01', '26 Sep 2026', '26 Oct 2026'])
  })

  it('offers no act on the MD’s own row, Revoke on anyone else’s, Renew 30 days where there is an end date', async () => {
    await members(PEOPLE.md)
    expect(buttons(row(/^People at/, 'Kamal Uddin (you)'))).toEqual([])
    expect(buttons(row(/^People at/, 'Nusrat Jahan'))).toEqual(['Revoke'])
    expect(buttons(row(/^People at/, 'Farhana Kabir'))).toEqual(['Renew 30 days', 'Revoke'])
  })

  it('keeps expired access listed, muted, "Ended 20 Sep 2026", renewable: the refused state after expiry', async () => {
    await members(PEOPLE.md)
    const jamal = row(/^People at/, 'Jamal Hossain')
    expect(cells(jamal)[5]).toBe('Ended 20\u00a0Sep\u00a02026') // the date never breaks
    expect(jamal.className).toContain('text-muted-foreground')
    expect(buttons(jamal)).toEqual(['Renew 30 days', 'Revoke'])
    // Listed after everyone whose access is current.
    const names = within(table(/^People at/))
      .getAllByRole('row')
      .slice(1)
      .map((r) => text(r.querySelector('td')))
    expect(names.at(-1)).toBe('Jamal Hossain')
  })

  it('refuses inviting again someone whose access ended, under the Email field, in the API’s words', async () => {
    await members(PEOPLE.md)
    const dialog = await openInvite()
    await userEvent.type(within(dialog).getByLabelText('Email'), 'jamal@padma-builders.example')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    const email = within(dialog).getByLabelText('Email')
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    const error = document.getElementById(email.getAttribute('aria-describedby')!.split(' ')[0]!)
    expect(text(error)).toBe('Access for jamal@padma-builders.example has ended. Renew it from their row under People instead of inviting them again.')
  })

  it('shows the Vextrus access with its line, who invited, the projects, the dates and the acts', async () => {
    await members(PEOPLE.md)
    expect(screen.getByRole('heading', { name: 'Vextrus access' })).toBeVisible()
    expect(screen.getByText('Vextrus sees your data only while an invitation below is current. You can end it at any time.')).toBeVisible()
    const arif = row(/^Vextrus access$/, 'Arif Rahman')
    expect(cells(arif).slice(0, 6)).toEqual(['Arif Rahman', 'Kamal Uddin', 'All projects', '26 Sep 2026', '26 Oct 2026', '2 acts, last 26 Sep 2026'])
    expect(buttons(arif)).toEqual(['2 acts, last 26 Sep 2026', 'Renew 30 days', 'Revoke'])
  })

  it('tells a QS the access they may end, and their MD any (the owner’s ruling, 29 Sep 2026)', async () => {
    await members(PEOPLE.qs)
    expect(screen.getByText('Vextrus sees your data only while an invitation below is current. You can end the access you gave; your MD can end any.')).toBeVisible()
    expect(screen.queryByText(/You can end it at any time/)).toBeNull()
  })

  it('lists the invitations not used yet, with Copy link and Withdraw', async () => {
    await members(PEOPLE.md)
    expect(screen.getByRole('heading', { name: 'Invitations not used yet' })).toBeVisible()
    const rumana = row(/^Invitations not used yet$/, 'rumana@shapla-homes.example')
    expect(cells(rumana).slice(0, 4)).toEqual(['rumana@shapla-homes.example', 'QS', 'All projects', '3 Oct 2026'])
    expect(buttons(rumana)).toEqual(['Copy link', 'Withdraw'])
  })

  it('says so when no one from Vextrus has access and no invitation is waiting', async () => {
    const api = new FakeApi()
    api.memberships = api.memberships.filter((m) => m.role !== 'vextrus_engineer' && m.userId !== null)
    await members(PEOPLE.md, api)
    expect(within(table(/^Vextrus access$/)).getByText('No one from Vextrus has access.')).toBeVisible()
    expect(within(table(/^Invitations not used yet$/)).getByText('No invitations are waiting to be used.')).toBeVisible()
  })

  it('shows no word the gate forbids, no message code, and a sound key map, the dialog open and closed', async () => {
    const { keyMap } = await members(PEOPLE.md)
    expectNothingNeverShown()
    expectKeyMapSound(keyMap)
    await openInvite()
    expectNothingNeverShown()
    expectKeyMapSound(keyMap)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expectKeyMapSound(keyMap)
  })
})

describe('each row’s acts are the API’s (#75’s `actions`), never re-derived from the role', () => {
  it('shows none where the API gives none, and only those it gives', async () => {
    const api = new FakeApi()
    const nusrat = api.membershipOf(PEOPLE.qs, SHAPLA)
    const farhana = api.membershipOf(PEOPLE.guest, SHAPLA)
    const own = api as unknown as { actionsFor: (viewer: unknown, m: { id: string }) => string[] }
    const rule = own.actionsFor.bind(api)
    own.actionsFor = (viewer, m) => (m.id === nusrat.id ? [] : m.id === farhana.id ? ['revoke'] : rule(viewer, m))
    await members(PEOPLE.md, api)
    expect(buttons(row(/^People at/, 'Nusrat Jahan'))).toEqual([])
    expect(buttons(row(/^People at/, 'Farhana Kabir'))).toEqual(['Revoke'])
    expect(buttons(row(/^People at/, 'Shirin Akter'))).toEqual(['Revoke'])
  })
})

describe('the role matrix (§1.4)', () => {
  it('QS: the same page; no act on any row but an Engineer’s the QS invited; the invite offers only a Vextrus Engineer', async () => {
    await members(PEOPLE.qs)
    expect(screen.getByRole('button', { name: 'Invite' })).toBeVisible()
    for (const name of ['Kamal Uddin', 'Farhana Kabir', 'Jamal Hossain']) expect(buttons(row(/^People at/, name))).toEqual([])
    expect(buttons(row(/^Vextrus access$/, 'Arif Rahman'))).toEqual(['2 acts, last 26 Sep 2026'])
    expect(buttons(row(/^Invitations not used yet$/, 'rumana@shapla-homes.example'))).toEqual([])
    const dialog = await openInvite()
    expect(within(dialog).queryByRole('radiogroup', { name: 'Role' })).toBeNull()
    expect(text(within(dialog).getByText(/^Role:/))).toBe('Role: Vextrus Engineer')
    await seen(within(dialog).getByRole('radio', { name: 'All projects' }))
    await seen(within(dialog).getByLabelText('Access ends on'))
  })

  it('QS: Copy link and Withdraw on the invitation of an Engineer the QS invited', async () => {
    const api = new FakeApi()
    await members(PEOPLE.qs, api)
    const dialog = await openInvite()
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sadia@vextrus.example')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await within(dialog).findByText(/^Copy this link/)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(buttons(row(/^Invitations not used yet$/, 'sadia@vextrus.example'))).toEqual(['Copy link', 'Withdraw']))
    expect(api.memberships.find((m) => m.invitedEmail === 'sadia@vextrus.example')?.role).toBe('vextrus_engineer')
  })

  it('a QS given chosen projects: no "All projects", only their projects to choose, and no one they share none with', async () => {
    await members(PEOPLE.scopedQs)
    expect(screen.queryByRole('row', { name: named(/Farhana Kabir/) })).toBeNull()
    expect(clean(document.body.textContent)).not.toContain('Farhana Kabir')
    expect(clean(document.body.textContent)).not.toContain('Jamal Hossain')
    const dialog = await openInvite()
    expect(within(dialog).queryByRole('radio', { name: 'All projects' })).toBeNull()
    const choices = within(dialog)
      .getAllByRole('checkbox')
      .map((c) => text(c.closest('label')))
    expect(choices).toEqual(['BP-02 Bokul Place'])
    // Their one project is theirs to give: ticked already (design gate 20a r1).
    expect(within(dialog).getByRole('checkbox', { name: named(/^BP-02 Bokul Place$/) })).toBeChecked()
  })

  it('Vextrus Engineer: the people only, no Invite, and no call the API would refuse', async () => {
    const { api } = await members(PEOPLE.engineer)
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull()
    expect(screen.queryByRole('table', { name: 'Vextrus access' })).toBeNull()
    expect(screen.queryByRole('table', { name: 'Invitations not used yet' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Vextrus access' })).toBeNull()
    for (const r of within(table(/^People at/)).getAllByRole('row').slice(1)) expect(buttons(r)).toEqual([])
    expect(api.calls()).not.toContain('GET /api/activity')
    expect(api.requests.filter((r) => r.status >= 400)).toEqual([])
    expectNothingNeverShown()
  })

  it('Guest: /members is "Page not found" in one frame, with no call to the Members API and no refusal shown', async () => {
    const { api, keyMap } = await mountApp('/members', { as: PEOPLE.guest })
    expect(await screen.findByText(/There is nothing at this address\. It may have been a link to another Developer’s project, or to a project you have not been given\./)).toBeVisible()
    expect(document.querySelectorAll('[data-frame]')).toHaveLength(1)
    expect(api.calls()).not.toContain('GET /api/members')
    expect(api.requests.filter((r) => r.status >= 400)).toEqual([])
    expect(clean(document.body.textContent)).not.toMatch(/As a Guest you can look at this|can’t do this|can't do this/)
    expect(screen.queryByRole('table')).toBeNull()
    expectKeyMapSound(keyMap)
  })
})

describe('the invite dialog (§4.4)', () => {
  it('offers the MD QS | MD | Guest | Vextrus Engineer, QS chosen, All projects, no end date', async () => {
    await members(PEOPLE.md)
    const dialog = await openInvite()
    expect(text(within(dialog).getByRole('heading'))).toBe('Invite someone to Shapla Homes Ltd')
    const roles = within(dialog).getByRole('radiogroup', { name: 'Role' })
    expect(within(roles).getAllByRole('radio').map((r) => text(r))).toEqual(['QS', 'MD', 'Guest', 'Vextrus Engineer'])
    expect(within(roles).getByRole('radio', { name: 'QS' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('radio', { name: 'All projects' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).queryAllByRole('checkbox', { name: named(/KR-01/) })).toEqual([])
    expect(within(dialog).getByRole('checkbox', { name: 'End their access on a date' })).not.toBeChecked()
    expect(within(dialog).queryByLabelText('Access ends on')).toBeNull()
    await seen(within(dialog).getByText(exactly('For someone from outside Shapla Homes Ltd, such as a consultant’s engineer or a contractor’s QS, set an end date.')))
    // No name, firm, Market, currency or Building field.
    expect(within(dialog).getAllByRole('textbox').map((f) => f.getAttribute('type'))).toEqual(['email'])
  })

  it('with Guest chosen: the read-only line, Chosen projects, and an end date ticked 30 days ahead', async () => {
    await members(PEOPLE.md)
    const dialog = await openInvite()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Guest' }))
    await seen(within(dialog).getByText('Read only: a Guest can look at the drawings and the Takeoff of the chosen projects, and change nothing.'))
    expect(within(dialog).getByRole('radio', { name: 'Chosen projects' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getAllByRole('checkbox', { name: named(/^[A-Z]{2}-\d\d /) }).map((c) => text(c.closest('label')))).toEqual([
      'BP-02 Bokul Place',
      'KR-01 Kadam Residence',
      'SG-03 Shimul Garden',
    ])
    expect(within(dialog).getByRole('checkbox', { name: 'End their access on a date' })).toBeChecked()
    const date = within(dialog).getByLabelText('Access ends on')
    expect(date).toHaveValue('28 Oct 2026')
    expect(text(date.parentElement)).toContain('(30 days)')
  })

  it('for a Vextrus Engineer: "Access ends on", required, 30 days ahead, and no checkbox', async () => {
    await members(PEOPLE.md)
    const dialog = await openInvite()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Vextrus Engineer' }))
    expect(within(dialog).queryByRole('checkbox', { name: 'End their access on a date' })).toBeNull()
    const date = within(dialog).getByLabelText('Access ends on')
    expect(date).toHaveValue('28 Oct 2026')
    await userEvent.clear(date)
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sadia@vextrus.example')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await waitFor(() => expect(date).toHaveAttribute('aria-invalid', 'true'))
    await seen(within(dialog).getByText(exactly('Enter a date like 28 Oct 2026.')))
    expect(within(dialog).queryByText(/^Copy this link/)).toBeNull()
  })

  it('takes a typed date and sends the end of that day in the Market’s time zone', async () => {
    const api = new FakeApi()
    await members(PEOPLE.md, api)
    const dialog = await openInvite()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Vextrus Engineer' }))
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sadia@vextrus.example')
    const date = within(dialog).getByLabelText('Access ends on')
    await userEvent.clear(date)
    await userEvent.type(date, '15 november 2026')
    await userEvent.tab()
    expect(date).toHaveValue('15 Nov 2026')
    expect(text(date.parentElement)).toContain('(48 days)')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await within(dialog).findByText(/^Copy this link/)
    expect(api.memberships.find((m) => m.invitedEmail === 'sadia@vextrus.example')?.expiresAt).toBe('2026-11-15T17:59:59.000Z')
  })

  it('refuses Chosen projects with none ticked: "Choose at least one project."', async () => {
    const api = new FakeApi()
    await members(PEOPLE.md, api)
    const dialog = await openInvite()
    await userEvent.type(within(dialog).getByLabelText('Email'), 'jamal.new@padma-builders.example')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Chosen projects' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await seen(await within(dialog).findByText('Choose at least one project.'))
    expect(api.calls()).not.toContain('POST /api/members/invitations')
    // Ticking a project answers it: the words go (design gate 20a r1).
    await userEvent.click(within(dialog).getByRole('checkbox', { name: named(/^KR-01 Kadam Residence$/) }))
    await waitFor(() => expect(within(dialog).queryByText('Choose at least one project.')).toBeNull())
  })

  it('moves the Role and Projects choices with the arrow keys, as radios do (design gate 20a r1)', async () => {
    await members(PEOPLE.md)
    const dialog = await openInvite()
    const roles = within(dialog).getByRole('radiogroup', { name: 'Role' })
    within(roles).getByRole('radio', { name: 'QS' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(within(roles).getByRole('radio', { name: 'MD' })).toHaveAttribute('aria-checked', 'true'))
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(within(roles).getByRole('radio', { name: 'Guest' })).toHaveAttribute('aria-checked', 'true'))
    // A Guest's projects are chosen ones; the arrow goes back to All.
    const projects = within(dialog).getByRole('radiogroup', { name: 'Projects' })
    within(projects).getByRole('radio', { name: 'Chosen projects' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(within(projects).getByRole('radio', { name: 'All projects' })).toHaveAttribute('aria-checked', 'true'))
  })

  it('says under the Email field that someone is already a member, in the API’s words', async () => {
    await members(PEOPLE.md)
    const dialog = await openInvite()
    await userEvent.type(within(dialog).getByLabelText('Email'), 'nusrat@shapla-homes.example')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await seen(await within(dialog).findByText(exactly('nusrat@shapla-homes.example is already a member.')))
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('creates the link, shows it once as selectable text, and copies it: "Link copied"', async () => {
    const api = new FakeApi()
    const clipboard = stubClipboard(async () => undefined)
    try {
      await members(PEOPLE.md, api)
      const dialog = await openInvite()
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Guest' }))
      await userEvent.type(within(dialog).getByLabelText('Email'), 'jamal.new@padma-builders.example')
      await userEvent.click(within(dialog).getByRole('checkbox', { name: named(/^KR-01 Kadam Residence$/) }))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
      const line = await within(dialog).findByText(/^Copy this link/)
      expect(text(line)).toBe('Copy this link and send it to jamal.new@padma-builders.example. It works once, until 5 Oct 2026.')
      const token = api.tokenFor('jamal.new@padma-builders.example')
      const link = within(dialog).getByRole('textbox', { name: 'The invitation link' })
      expect(link).toHaveValue(`${window.location.origin}/join#${token}`)
      expect(link).toHaveAttribute('readonly')
      expect(dialog.querySelector('a[href*="join"]')).toBeNull()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copy link' }))
      expect(clipboard.spy).toHaveBeenCalledWith(`${window.location.origin}/join#${token}`)
      await seen(await screen.findByText('Link copied'))
      const invited = api.memberships.find((m) => m.invitedEmail === 'jamal.new@padma-builders.example')!
      expect(invited.role).toBe('guest')
      expect(invited.projectIds).toEqual([api.project('KR-01').id])
      expect(invited.expiresAt).toBe('2026-10-28T17:59:59.000Z')
      // The new invitation is listed once the dialog closes.
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(cells(row(/^Invitations not used yet$/, 'jamal.new@padma-builders.example')).slice(0, 3)).toEqual(['jamal.new@padma-builders.example', 'Guest', 'KR-01'])
    } finally {
      clipboard.restore()
    }
  })

  it('keeps the link selected and says so when the browser refuses the clipboard', async () => {
    const clipboard = stubClipboard(async () => {
      throw new DOMException('Denied', 'NotAllowedError')
    })
    try {
      await members(PEOPLE.md)
      const dialog = await openInvite()
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Vextrus Engineer' }))
      await userEvent.type(within(dialog).getByLabelText('Email'), 'sadia@vextrus.example')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
      await within(dialog).findByText(/^Copy this link/)
      await userEvent.click(within(dialog).getByRole('button', { name: 'Copy link' }))
      await seen(await within(dialog).findByText('Your browser did not let Vextrus copy it. The link is selected above; press Ctrl C to copy it.'))
      const link = within(dialog).getByRole('textbox', { name: 'The invitation link' }) as HTMLInputElement
      expect(document.activeElement).toBe(link)
      expect(link.selectionStart).toBe(0)
      expect(link.selectionEnd).toBe(link.value.length)
      expect(screen.queryByText('Link copied')).toBeNull()
    } finally {
      clipboard.restore()
    }
  })

  it('never throws typed text away on Esc without asking; Keep editing returns, Discard closes', async () => {
    await members(PEOPLE.md)
    const dialog = await openInvite()
    await userEvent.type(within(dialog).getByLabelText('Email'), 'someone@example.com')
    await userEvent.keyboard('{Escape}')
    await seen(await within(dialog).findByText('Close without saving what you entered?'))
    await seen(screen.getByRole('dialog', { name: named(/^Invite someone to /) }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(within(dialog).queryByText('Close without saving what you entered?')).toBeNull()
    expect(within(dialog).getByLabelText('Email')).toHaveValue('someone@example.com')
    // Esc asks again; Esc once more is "Keep editing".
    await userEvent.keyboard('{Escape}')
    await within(dialog).findByText('Close without saving what you entered?')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(within(dialog).queryByText('Close without saving what you entered?')).toBeNull())
    await seen(screen.getByRole('dialog'))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Opened again, the form is empty.
    const again = await openInvite()
    expect(within(again).getByLabelText('Email')).toHaveValue('')
  })

  it('closes on Esc at once when nothing was typed', async () => {
    await members(PEOPLE.md)
    await openInvite()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('the acts on a row (§4.4, "Wording of acts")', () => {
  it('Revoke asks first, then ends the access: the toast, and the row "Revoked by Kamal Uddin, 28 Sep 2026", muted', async () => {
    const api = new FakeApi()
    await members(PEOPLE.md, api)
    await userEvent.click(within(row(/^Vextrus access$/, 'Arif Rahman')).getByRole('button', { name: /^Revoke / }))
    const confirm = await screen.findByRole('dialog', { name: named(/^End Arif Rahman’s access now\?$/) })
    await seen(within(confirm).getByText('Their next click is refused. What they did stays under their name.'))
    expect(api.calls()).not.toContain(`POST /api/members/${api.membershipOf(PEOPLE.engineer, SHAPLA).id}/revoke`)
    await userEvent.click(within(confirm).getByRole('button', { name: 'End access' }))
    await seen(await screen.findByText(exactly('Arif Rahman’s access has ended.', 'SPAN')))
    await waitFor(() => expect(cells(row(/^Vextrus access$/, 'Arif Rahman'))[4]).toBe('Revoked by Kamal Uddin, 28\u00a0Sep\u00a02026'))
    const arif = row(/^Vextrus access$/, 'Arif Rahman')
    expect(arif.className).toContain('text-muted-foreground')
    expect(buttons(arif)).toEqual(['2 acts, last 26 Sep 2026'])
  })

  it('Cancel on the confirm ends nothing', async () => {
    const api = new FakeApi()
    await members(PEOPLE.md, api)
    await userEvent.click(within(row(/^People at/, 'Nusrat Jahan')).getByRole('button', { name: /^Revoke / }))
    const confirm = await screen.findByRole('dialog', { name: named(/^End Nusrat Jahan’s access now\?$/) })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.calls().some((c) => c.endsWith('/revoke'))).toBe(false)
  })

  it('Renew 30 days: "Farhana Kabir’s access now ends on 25 Nov 2026."', async () => {
    await members(PEOPLE.md)
    await userEvent.click(within(row(/^People at/, 'Farhana Kabir')).getByRole('button', { name: /^Renew 30 days for / }))
    await seen(await screen.findByText(exactly('Farhana Kabir’s access now ends on 25 Nov 2026.', 'SPAN')))
    await waitFor(() => expect(cells(row(/^People at/, 'Farhana Kabir'))[5]).toBe('25 Nov 2026'))
  })

  it('Renew 30 days on expired access counts from today', async () => {
    await members(PEOPLE.md)
    await userEvent.click(within(row(/^People at/, 'Jamal Hossain')).getByRole('button', { name: /^Renew 30 days for / }))
    await seen(await screen.findByText(exactly('Jamal Hossain’s access now ends on 28 Oct 2026.', 'SPAN')))
  })

  it('Withdraw: "Invitation withdrawn. The link no longer works." and the row gone', async () => {
    await members(PEOPLE.md)
    await userEvent.click(within(row(/^Invitations not used yet$/, 'rumana@shapla-homes.example')).getByRole('button', { name: /^Withdraw the invitation for / }))
    await seen(await screen.findByText('Invitation withdrawn. The link no longer works.'))
    await waitFor(() => expect(within(table(/^Invitations not used yet$/)).getByText('No invitations are waiting to be used.')).toBeVisible())
  })

  it('Copy link on an invitation makes a new link, shown with "The link sent before no longer works."', async () => {
    const api = new FakeApi()
    const before = api.tokenFor('rumana@shapla-homes.example')
    await members(PEOPLE.md, api)
    await userEvent.click(within(row(/^Invitations not used yet$/, 'rumana@shapla-homes.example')).getByRole('button', { name: /^Copy link for / }))
    const dialog = await screen.findByRole('dialog', { name: (n) => clean(n) === 'New link for rumana@shapla-homes.example' })
    expect(text(within(dialog).getByText(/^Copy this link/))).toBe(
      'Copy this link and send it to rumana@shapla-homes.example. It works once, until 3 Oct 2026. The link sent before no longer works. Send this one instead.',
    )
    const after = api.tokenFor('rumana@shapla-homes.example')
    expect(after).not.toBe(before)
    expect(within(dialog).getByRole('textbox', { name: 'The invitation link' })).toHaveValue(`${window.location.origin}/join#${after}`)
  })

  it('shows a refusal made meanwhile in the API’s words', async () => {
    const api = new FakeApi()
    api.failOnce((method, path) => method === 'POST' && path.endsWith('/withdraw'), 409, { code: 'platform.invitations.no_longer_open', params: {} })
    await members(PEOPLE.md, api)
    await userEvent.click(within(row(/^Invitations not used yet$/, 'rumana@shapla-homes.example')).getByRole('button', { name: /^Withdraw the invitation for / }))
    const bar = await screen.findByRole('alert')
    expect(text(bar)).toBe('This invitation is no longer open: it was used, withdrawn or has run out. Invite them again if they still need access.')
  })
})

describe('where focus and words go after an act (design gate 20a r1)', () => {
  it('puts focus on the section’s heading once the row it was on is gone: after Withdraw, and after Revoke', async () => {
    await members(PEOPLE.md)
    const rumana = row(/^Invitations not used yet$/, 'rumana@shapla-homes.example')
    await userEvent.click(within(rumana).getByRole('button', { name: /^Withdraw the invitation for / }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Invitations not used yet' })).toHaveFocus())

    const arif = row(/^Vextrus access$/, 'Arif Rahman')
    await userEvent.click(within(arif).getByRole('button', { name: /^Revoke / }))
    await userEvent.click(await screen.findByRole('button', { name: 'End access' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Vextrus access' })).toHaveFocus())
  })

  it('drops the invite dialog’s "signed out" words once signed in again', async () => {
    const api = new FakeApi()
    await members(PEOPLE.md, api)
    const dialog = await openInvite()
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sadia@shapla-homes.example')
    api.session = { userId: null, developerId: null }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    const signedOut = await screen.findByRole('dialog', { name: 'You were signed out.' })
    // Under the Signed-out dialog, the invite dialog is hidden from the accessibility tree meanwhile.
    await waitFor(() => expect(within(dialog).getByRole('alert', { hidden: true })).toBeInTheDocument())
    await userEvent.type(within(signedOut).getByLabelText('Password'), PASSWORD)
    await userEvent.click(within(signedOut).getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'You were signed out.' })).toBeNull())
    await waitFor(() => expect(within(dialog).queryByRole('alert', { hidden: true })).toBeNull())
    expect(within(dialog).getByLabelText('Email')).toHaveValue('sadia@shapla-homes.example')
  })
})

describe('finish line step 10 in miniature: invite, act as the Engineer, see the act, revoke, the next click refused', () => {
  it('runs end to end on the in-memory API', async () => {
    const api = new FakeApi()
    api.addUser('sadia@vextrus.example', 'Sadia Karim', true)
    const { queryClient } = await members(PEOPLE.md, api)

    // The MD invites a Vextrus Engineer.
    const dialog = await openInvite()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Vextrus Engineer' }))
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sadia@vextrus.example')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }))
    await within(dialog).findByText(/^Copy this link/)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // The Engineer accepts in their own browser and acts.
    const token = api.tokenFor('sadia@vextrus.example')
    api.signInAs('sadia@vextrus.example')
    expect((await call(api, 'POST', '/api/invitations/accept', { token })).status).toBe(200)
    vi.setSystemTime(new Date('2026-09-28T09:42:00Z'))
    expect((await call(api, 'POST', '/api/projects', { code: 'NB-04', name: 'Nilgiri Bhaban', address: '' })).status).toBe(201)
    const sadia = api.user('sadia@vextrus.example')

    // The MD sees the act listed under the Engineer's name, marked (Vextrus).
    api.signInAs(PEOPLE.md)
    await queryClient.invalidateQueries()
    const acts = await waitFor(() => within(row(/^Vextrus access$/, 'Sadia Karim')).getByRole('button', { name: named(/^2 acts, last 28 Sep 2026, by Sadia Karim$/) }))
    await userEvent.click(acts)
    expect(acts).toHaveAttribute('aria-expanded', 'true')
    const panel = await screen.findByRole('region', { name: named(/^Sadia Karim \(Vextrus\)$/) })
    expect(within(panel).getByText('Their acts, newest first')).toBeVisible()
    const items = await within(panel).findAllByRole('listitem')
    expect(items.map((li) => text(li))).toEqual([
      'Sadia Karim (Vextrus) created this project · Nilgiri Bhaban · 28 Sep 2026, 15:42',
      'Sadia Karim (Vextrus) accepted the invitation · 28 Sep 2026, 12:00',
    ])
    expect(api.calls()).toContain('GET /api/activity')
    // Esc closes the panel; focus is back on the Acts button.
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('region', { name: named(/Sadia Karim \(Vextrus\)/) })).toBeNull())
    expect(document.activeElement).toBe(acts)

    // Revoke; the Engineer's next request, on the session they already hold, is refused.
    await userEvent.click(within(row(/^Vextrus access$/, 'Sadia Karim')).getByRole('button', { name: /^Revoke / }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'End access' }))
    await screen.findByText(exactly('Sadia Karim’s access has ended.', 'SPAN'))
    api.session = { userId: sadia.id, developerId: api.developer(SHAPLA).id }
    const refused = await call(api, 'GET', '/api/projects')
    expect(refused).toEqual({ status: 403, body: { code: 'platform.auth.no_access', params: {} } })
    const me = (await call(api, 'GET', '/api/me')).body as { ended: { revoked_by: string | null; how: string }[]; ended_membership_id: string | null; developer_id: string | null }
    expect(me.developer_id).toBeNull()
    expect(me.ended[0]).toMatchObject({ how: 'revoked', revoked_by: 'Kamal Uddin' })
    expect(me.ended_membership_id).toBe(api.membershipOf('sadia@vextrus.example', SHAPLA).id)
  })

  it('says "No acts yet" for someone who has done nothing, as words: there is nothing to open (words gate 20a r1)', async () => {
    const api = new FakeApi()
    api.acts = api.acts.filter((a) => a.actorId !== api.user(PEOPLE.engineer).id)
    await members(PEOPLE.md, api)
    const arif = row(/^Vextrus access$/, 'Arif Rahman')
    expect(cells(arif)[5]).toBe('No acts yet')
    expect(within(arif).queryByRole('button', { name: named(/acts/) })).toBeNull()
  })

  it('counts a person’s acts once, on their first row, not again on each ended invitation (design gate 20a r2)', async () => {
    const api = new FakeApi()
    api.addMembership(api.developer('Shapla Homes Ltd'), api.user(PEOPLE.engineer), 'vextrus_engineer', {
      invitedBy: api.user(PEOPLE.md).id,
      since: '2026-09-10T04:00:00Z',
      expiresAt: '2026-09-20T17:59:00Z',
      revokedAt: '2026-09-15T04:00:00Z',
    })
    await members(PEOPLE.md, api)
    const arif = within(table(/^Vextrus access$/))
      .getAllByRole('row')
      .filter((r) => text(r.querySelector('td')) === 'Arif Rahman')
    expect(arif).toHaveLength(2)
    expect(cells(arif[0]!)[5]).toBe('2 acts, last 26 Sep 2026')
    expect(cells(arif[1]!)[5]).toBe('—')
    expect(within(arif[1]!).queryByRole('button', { name: named(/acts/) })).toBeNull()
  })

  it('names whose acts the Acts button opens, its words first (words gate 20a r1)', async () => {
    await members(PEOPLE.md)
    expect(within(row(/^Vextrus access$/, 'Arif Rahman')).getByRole('button', { name: named(/^2 acts, last 26 Sep 2026, by Arif Rahman$/) })).toBeVisible()
    expect(within(row(/^People at/, 'Farhana Kabir')).getByRole('button', { name: named(/^Revoke access for Farhana Kabir$/) })).toBeVisible()
  })
})

describe('what people type is shown as text, never as markup (the trust boundary: XSS)', () => {
  it('renders a name and a project holding markup and a script address as text', async () => {
    const api = new FakeApi()
    const shapla = api.developer(SHAPLA)
    api.addMembership(shapla, api.addUser('xss@example.com', '<img src=x onerror=alert(1)>'), 'qs')
    api.addProject(shapla, 'XS-01', 'javascript:alert(1)', '<img src=x onerror=alert(2)>')
    await members(PEOPLE.md, api)
    expect(cells(row(/^People at/, '<img src=x onerror=alert(1)>'))[0]).toBe('<img src=x onerror=alert(1)>')
    const dialog = await openInvite()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Chosen projects' }))
    await seen(within(dialog).getByRole('checkbox', { name: named(/^XS-01 javascript:alert\(1\)$/) }))
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('a[href^="javascript"]')).toBeNull()
    expect(document.querySelectorAll('[onerror]')).toHaveLength(0)
  })
})

describe('loading (§4.4)', () => {
  it('shows Skeleton rows per section with a line of what is happening', () => {
    render(
      <UiProviders>
        <MembersLoading />
      </UiProviders>,
    )
    expect(screen.getByText('Opening Members and access…')).toBeVisible()
    expect(document.querySelectorAll('.skeleton').length).toBe(7)
  })
})
