/*
 * Projects (m0-screens §4.3; stories 2–4, 56, 99, 102) through the in-memory API, in Chromium: each
 * role's list and header, the keys, the empty and loading states, the New project dialog, a member
 * given chosen projects seeing only those, and the design gate's DOM greps.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { setTransport } from '@/api/client'
import { overrideLanguage } from '@/app/dev-language'
import { FakeApi } from '@/app/seed/api.fixture'
import { PEOPLE, mountApp } from '@/app/testing'
import { unmarkedNotation } from '@/format/unmarked'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { activatePseudoRtl } from '@/i18n/pseudo'
import { UiProviders, expectKeyMapSound, notationProblems } from '@/ui'
import { ProjectsLoading } from './ProjectsPage'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
  overrideLanguage(false)
  activateLanguage(ENGLISH, englishMessages())
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩]/g, '')
/** Dialogs fade in: wait until the element is seen, never only present. */
async function shown(el: HTMLElement) {
  await waitFor(() => expect(el).toBeVisible())
}
const named = (re: RegExp) => (name: string) => re.test(clean(name))
const header = () => screen.getByRole('heading', { name: 'Projects' }).closest('header')!
const countLine = () => clean(header().querySelector('p')?.textContent)
const rows = () => within(screen.getByRole('listbox', { name: 'Projects' })).getAllByRole('option')
const codes = () => rows().map((r) => clean(r.querySelector('bdi')?.textContent))

async function projects(as: string, api?: FakeApi) {
  const app = await mountApp('/projects', { as, api })
  await screen.findByRole('heading', { name: 'Projects' })
  return app
}

/** m0-screens §1.1's words never shown to a QS or an MD, §1.9's Market and currency, §1.10's Building. */
function gateGreps() {
  const text = clean(document.body.textContent)
  for (const word of ['handle', 'entity', 'SDF', 'DXF', 'LibreDWG', 'ACadSharp', 'ezdxf', 'JSON', 'sandbox', 'worker', 'queue', 'hash', 'tenant', 'RLS', 'API', 'null', 'undefined', 'NaN', 'UUID', 'locale', 'Building', 'Bangladesh', 'BDT', '৳', 'imperial', 'metric']) {
    expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`))
  }
  expect(text).not.toMatch(/\b[a-z_]+\.[a-z_]+\.[a-z_]+\b/)
  for (const code of ['%%', '\\P', '\\f', '\\S', '^J', '{\\']) expect(text).not.toContain(code)
  expect(notationProblems(document.body)).toEqual([])
  expect(unmarkedNotation(document.body)).toEqual([])
}

describe('the list, by role (§4.3, §1.4)', () => {
  it('shows the QS every project, the columns, "Members and access" and "New project"', async () => {
    const { keyMap } = await projects(PEOPLE.qs)
    expect(document.title).toBe('Projects · Vextrus')
    expect(countLine()).toBe('3 projects at Shapla Homes Ltd')
    const table = screen.getByRole('listbox', { name: 'Projects' }).parentElement!
    expect(clean(table.firstElementChild?.textContent)).toBe('CodeNameAddressDrawing SetTakeoffUpdated')
    expect(codes()).toEqual(['BP-02', 'KR-01', 'SG-03'])
    expect(clean(rows()[1]!.textContent)).toBe('KR-01Kadam ResidencePlot 14, Road 7, Block C, Dhaka———')
    expect(within(header()).getByRole('link', { name: 'Members and access' })).toHaveAttribute('href', '/members')
    expect(within(header()).getByRole('button', { name: 'New project' })).toBeVisible()
    expect(within(header()).queryByText(/Read only/)).toBeNull()
    expectKeyMapSound(keyMap)
    gateGreps()
  })

  it('shows the MD read only: the chip, "Members and access", no "New project"', async () => {
    await projects(PEOPLE.md)
    expect(within(header()).getByText('Read only: MD')).toBeVisible()
    expect(within(header()).getByRole('link', { name: 'Members and access' })).toBeVisible()
    expect(within(header()).queryByRole('button', { name: 'New project' })).toBeNull()
    gateGreps()
  })

  it('shows the Guest only KR-01, open to them, read only, with no Members and access and no New project', async () => {
    await projects(PEOPLE.guest)
    expect(countLine()).toBe('1 project at Shapla Homes Ltd is open to you')
    expect(codes()).toEqual(['KR-01'])
    expect(within(header()).getByText('Read only: Guest')).toBeVisible()
    expect(within(header()).queryByRole('link', { name: 'Members and access' })).toBeNull()
    expect(within(header()).queryByRole('button', { name: 'New project' })).toBeNull()
    expect(clean(screen.getByTestId('access-chip').textContent)).toBe('Access to KR-01 at Shapla Homes Ltd until 26 Oct 2026')
    gateGreps()
  })

  it('shows a QS given chosen projects only those, and no "New project" (the API refuses them one)', async () => {
    const { api } = await projects(PEOPLE.scopedQs)
    expect(countLine()).toBe('1 project at Shapla Homes Ltd is open to you')
    expect(codes()).toEqual(['BP-02'])
    expect(within(header()).queryByRole('button', { name: 'New project' })).toBeNull()
    expect(clean(screen.getByTestId('access-chip').textContent)).toBe('Access to BP-02 at Shapla Homes Ltd')
    expect(api.calls().filter((c) => c.startsWith('POST'))).toEqual([])
  })

  it('offers the Vextrus Engineer "New project"', async () => {
    await projects(PEOPLE.engineer)
    expect(within(header()).getByRole('button', { name: 'New project' })).toBeVisible()
    expect(clean(screen.getByTestId('access-chip').textContent)).toBe('Vextrus access to Shapla Homes Ltd until 26 Oct 2026')
  })
})

describe('the keys (§2.2: ↑ ↓ Home End move, Enter opens)', () => {
  it('moves with the arrows and opens the focused project with Enter', async () => {
    const { router } = await projects(PEOPLE.qs)
    screen.getByRole('listbox', { name: 'Projects' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(rows()[1]).toHaveAttribute('data-focused')
    await userEvent.keyboard('{End}')
    expect(rows()[2]).toHaveAttribute('data-focused')
    await userEvent.keyboard('{Home}{ArrowDown}{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/KR-01/takeoff/1'))
  })

  it('opens a project with a click', async () => {
    const { router } = await projects(PEOPLE.qs)
    await userEvent.click(screen.getByText('Shimul Garden'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/SG-03/takeoff/1'))
  })

  it('reaches the list by Tab, with a ring', async () => {
    await projects(PEOPLE.qs)
    const list = screen.getByRole('listbox', { name: 'Projects' })
    for (let i = 0; i < 12 && document.activeElement !== list; i++) await userEvent.tab()
    expect(document.activeElement).toBe(list)
    const focused = rows().find((r) => r.hasAttribute('data-focused'))!
    expect(getComputedStyle(focused).outlineStyle).not.toBe('none')
  })
})

describe('empty and loading (§4.3)', () => {
  it('asks the QS to create one for each development', async () => {
    const api = new FakeApi({ extend: (a) => void a.addMembership(a.developer('Kanchan Homes Ltd'), a.addUser('mitu@kanchan-homes.example', 'Mitu Das'), 'qs') })
    await projects('mitu@kanchan-homes.example', api)
    expect(screen.getByText('No projects yet. Create one for each development whose drawings you will take off.')).toBeVisible()
    expect(header().querySelector('p')).toBeNull()
    await userEvent.click(within(screen.getByRole('main')).getAllByRole('button', { name: 'New project' }).at(-1)!)
    expect(await screen.findByRole('dialog', { name: 'New project' })).toBeInTheDocument()
  })

  it('tells the MD the QS creates them, with no action', async () => {
    const api = new FakeApi({ extend: (a) => void a.addMembership(a.developer('Kanchan Homes Ltd'), a.addUser('selina@kanchan-homes.example', 'Selina Parvin'), 'md') })
    await projects('selina@kanchan-homes.example', api)
    expect(screen.getByText('No projects yet. Your QS creates them.')).toBeVisible()
    expect(within(screen.getByRole('main')).queryByRole('button', { name: 'New project' })).toBeNull()
  })

  it('shows a Guest whose projects are gone "No access to anything"', async () => {
    const api = new FakeApi({
      extend: (a) => void a.addMembership(a.developer('Shapla Homes Ltd'), a.addUser('ghost@padma-builders.example', 'Ghost Guest'), 'guest', { projectIds: ['gone-project'] }),
    })
    await projects('ghost@padma-builders.example', api)
    expect(screen.getByText('You have no access to any Developer at the moment. Ask your MD, or Vextrus, for an invitation.')).toBeVisible()
  })

  it('shows five skeleton rows while loading', () => {
    render(
      <UiProviders>
        <ProjectsLoading />
      </UiProviders>,
    )
    const status = screen.getByText('Opening the projects…').closest('[role=status]')!
    expect(status.querySelectorAll('.skeleton')).toHaveLength(5)
    expect(clean(status.textContent)).toBe('Opening the projects…')
  })
})

describe('the New project dialog (§4.3; stories 3, 4, 99)', () => {
  async function open(as: string = PEOPLE.qs, api?: FakeApi) {
    const app = await projects(as, api)
    await userEvent.click(within(header()).getByRole('button', { name: 'New project' }))
    const dialog = await screen.findByRole('dialog', { name: 'New project' })
    return { ...app, dialog }
  }

  it('offers the Market’s Display Units, the default chosen, and no Market, currency or Building field', async () => {
    const { dialog, keyMap } = await open()
    await waitFor(() => expect(within(dialog).getByLabelText('Name')).toBeVisible())
    await shown(within(dialog).getByLabelText('Code'))
    await shown(within(dialog).getByText('Short, like KR-01'))
    await shown(within(dialog).getByLabelText('Address'))
    const units = within(dialog).getByRole('radiogroup', { name: 'Display Units' })
    expect(within(units).getAllByRole('radio').map((r) => [clean(r.textContent), r.getAttribute('aria-checked')])).toEqual([
      ['Imperial (cft, sft, rft)', 'true'],
      ['Metric', 'false'],
    ])
    await shown(within(dialog).getByText('How quantities will be billed. You can change it later.'))
    expect(dialog.textContent).not.toMatch(/Market|currency|Currency|Building|BDT|৳|Bangladesh/)
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(3)
    expectKeyMapSound(keyMap)
  })

  it('refuses a missing name and code under their fields in the API’s words', async () => {
    const { dialog } = await open()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    await shown(await within(dialog).findByText('Give the project a name.'))
    expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Hasnahena Tower')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    await shown(await within(dialog).findByText('Give it a short code, like KR-01.'))
  })

  it('refuses a code already used, naming the project that has it', async () => {
    const { dialog } = await open()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Another Kadam')
    await userEvent.type(within(dialog).getByLabelText('Code'), 'kr-01')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    const refused = await within(dialog).findByText((_, el) => el?.hasAttribute('data-field-error') === true && clean(el.textContent) === 'KR-01 is already used by Kadam Residence. Choose another code.')
    await shown(refused)
  })

  it('creates the project with exactly its four fields, then opens it; the list and the switcher have it', async () => {
    const api = new FakeApi()
    const bodies: unknown[] = []
    const { dialog, router } = await open(PEOPLE.qs, api)
    setTransport(async (request) => {
      if (request.method === 'POST' && request.url.endsWith('/api/projects')) bodies.push(await request.clone().json())
      return api.handle(request)
    })
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Hasnahena Tower')
    await userEvent.type(within(dialog).getByLabelText('Code'), 'HT-04')
    await userEvent.type(within(dialog).getByLabelText('Address'), 'Plot 3, Road 2, Dhaka')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Metric' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create project' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/HT-04/takeoff/1'))
    expect(bodies).toEqual([{ name: 'Hasnahena Tower', code: 'HT-04', address: 'Plot 3, Road 2, Dhaka', unit_system: 'metric' }])
    // Closed before the navigation starts; it leaves the page once its close animation ends.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New project' })).toBeNull())
    expect(await screen.findByTestId('unit-system')).toHaveTextContent('Metric')
  })

  it('never throws typed text away on Esc without asking', async () => {
    const { dialog } = await open()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Hasnahena Tower')
    await userEvent.keyboard('{Escape}')
    await shown(within(dialog).getByText('Close without saving what you entered?'))
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await userEvent.keyboard('{Escape}')
    expect(within(dialog).queryByText('Close without saving what you entered?')).toBeNull()
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Hasnahena Tower')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New project' })).toBeNull())
  })

  it('closes an untouched dialog on Esc', async () => {
    await open()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New project' })).toBeNull())
  })
})

describe('the Project scope, everywhere (§1.4; story 102)', () => {
  it.each([
    ['a QS given BP-02 only', PEOPLE.scopedQs, '/p/KR-01/takeoff/1', 'Kadam Residence'],
    ['the Guest', PEOPLE.guest, '/p/BP-02/takeoff/1', 'Bokul Place'],
    ['the Guest, by a typed address with no step', PEOPLE.guest, '/p/SG-03', 'Shimul Garden'],
  ])('shows %s another project’s address as "Page not found" in one frame, never flashing it', async (_, as, path, name) => {
    const seen: string[] = []
    const observer = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => seen.push(n.textContent ?? ''))))
    observer.observe(document.body, { childList: true, subtree: true })
    await mountApp(path, { as })
    expect(await screen.findByText(/There is nothing at this address\. It may have been a link to another Developer’s project, or to a project you have not been given\./)).toBeVisible()
    observer.disconnect()
    expect(clean(seen.join('\n') + document.body.textContent)).not.toContain(name)
    expect(document.querySelectorAll('[data-frame]')).toHaveLength(1)
    expect(document.body.textContent).not.toMatch(/can’t do this|not allowed|As a Guest/)
  })
})

describe('text is text (the trust boundary: XSS)', () => {
  it('shows a project’s name and address as typed, never as markup or a link', async () => {
    const api = new FakeApi()
    api.project('KR-01').name = '<img src=x onerror=alert(1)>'
    api.project('KR-01').address = 'javascript:alert(1)'
    await projects(PEOPLE.qs, api)
    expect(document.querySelector('img')).toBeNull()
    expect(clean(rows()[1]!.textContent)).toContain('<img src=x onerror=alert(1)>javascript:alert(1)')
    expect(document.querySelector('a[href^="javascript"]')).toBeNull()
  })
})

describe('the pseudo right-to-left language (§1.8)', () => {
  it('mirrors the page: the header’s actions at the start, the codes still left to right', async () => {
    overrideLanguage()
    activatePseudoRtl()
    await mountApp('/projects')
    const main = await screen.findByRole('main')
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
    const title = main.querySelector('h1')!.getBoundingClientRect()
    const create = main.querySelector('header button')!.getBoundingClientRect()
    expect(create.right).toBeLessThan(title.left)
    const code = main.querySelector('[role=option] bdi')!
    expect(getComputedStyle(code).direction).toBe('ltr')
    expect(notationProblems(document.body)).toEqual([])
    expect(clean(main.textContent)).not.toContain('Projects')
  })
})

describe('at 1280 × 800', () => {
  it('keeps the table inside the page, no row wrapping', async () => {
    await page.viewport(1280, 800)
    await projects(PEOPLE.qs)
    const list = screen.getByRole('listbox', { name: 'Projects' })
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
    for (const row of rows()) expect(row.getBoundingClientRect().height).toBe(28)
    expect(within(header()).getByRole('button', { name: named(/New project/) }).getBoundingClientRect().right).toBeLessThanOrEqual(1280 - 80 + 1)
  })
})
