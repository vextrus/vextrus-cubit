/*
 * The app frame on the seed (docs/design/m0-screens.md §4.1, §4.7, §1.4, §1.5, §1.8–1.10, §2.2), in
 * Chromium at the design gate's sizes, signed in through the in-memory API (src/app/testing.tsx);
 * Step 1's counts, which 19a will send, are the seed's static copy.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { actStarted, resetSaves } from '@/api/saves'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { PSEUDO_RTL, activatePseudoRtl } from '@/i18n/pseudo'
import { FormatProvider, lengthFromInches, createFormat } from '@/format'
import { unmarkedNotation } from '@/format/unmarked'
import { LtrCanvas, expectKeyMapSound, notationProblems } from '@/ui'
import { i18n } from '@lingui/core'
import { overrideLanguage } from './dev-language'
import { BANGLADESH, STEP1 } from './seed/demo.fixture'
import { PEOPLE, mountApp, sessionAs, sheetRowNotationProblems } from './testing'
import { openList, seed } from '../acceptance/ts15w2/keys.fixture'

const QS = PEOPLE.qs
const MD = PEOPLE.md
const ENGINEER = PEOPLE.engineer
const GUEST = PEOPLE.guest

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
  overrideLanguage(false)
  activateLanguage(ENGLISH, englishMessages())
})

/** Visible text: without the isolates the message layer puts round every value. */
const clean = (s: string | null | undefined) => (s ?? '').replace(/[\u2066-\u2069]/g, '')
/** A role query's name matcher that ignores the isolates. */
const named = (re: RegExp) => (name: string) => re.test(clean(name))

const region = (name: string) => document.querySelector<HTMLElement>(`[data-region="${name}"]`)!
const box = (el: Element) => el.getBoundingClientRect()

async function takeoff(path = '/p/KR-01/takeoff/1', as: string = QS) {
  const app = await mountApp(path, { as, step1: STEP1 })
  await waitFor(() => expect(document.querySelector('[data-region="rail"]')).not.toBeNull())
  return app
}

describe('the canvas frame (m0-screens §4.1)', () => {
  it('lays out the top bar, rail, toolbar, canvas, inspector and status bar at 1440×900: canvas 1072 × 804', async () => {
    await takeoff()
    expect(box(region('top-bar')).height).toBe(40)
    expect(box(region('toolbar')).height).toBe(32)
    expect(box(region('status-bar')).height).toBe(24)
    expect(box(region('inspector')).width).toBe(320)
    expect(box(region('rail')).width).toBe(48)
    const canvas = box(region('canvas'))
    expect([canvas.width, canvas.height]).toEqual([1072, 804])
    expect(canvas.width / 1440).toBeGreaterThanOrEqual(0.7)
  })

  it('keeps the canvas at 912 × 704 (71%) at 1280×800', async () => {
    await page.viewport(1280, 800)
    await takeoff()
    const canvas = box(region('canvas'))
    expect([canvas.width, canvas.height]).toEqual([912, 704])
    expect(canvas.width / 1280).toBeGreaterThanOrEqual(0.7)
  })

  it('shows only Takeoff and Drawing Set in the top bar, the project switcher, and no building anywhere (§1.10)', async () => {
    await takeoff()
    const nav = within(region('top-bar')).getByRole('navigation', { name: 'Project' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Takeoff', 'Drawing Set'])
    expect(within(nav).getByRole('link', { name: 'Takeoff' })).toHaveAttribute('aria-current', 'page')
    expect(within(region('top-bar')).getByRole('button', { name: named(/Project: Kadam Residence/) })).toBeVisible()
    expect(document.body.textContent).not.toMatch(/Building/)
    expect(document.body.textContent).not.toMatch(/Bangladesh|BDT|৳/)
  })

  it('shows Step 1, Sheets and its Count in the toolbar, the open Questions, and the unit system’s name', async () => {
    await takeoff()
    const toolbar = region('toolbar')
    expect(clean(toolbar.textContent)).toContain('Step 1')
    expect(toolbar.textContent).toContain('Sheets')
    expect(toolbar.textContent?.replace(/[⁦-⁩]/g, '')).toContain('Confirmed 0 / 24')
    expect(within(region('inspector')).getByRole('tab', { name: /Questions/ }).textContent).toContain('5')
    expect(within(region('inspector')).getByRole('tab', { name: 'Selection' })).toHaveAttribute('aria-selected', 'true')
    expect(within(region('status-bar')).getByTestId('unit-system').textContent).toBe('Imperial')
  })

  it('lists the 14 Takeoff Steps, Step 1 open with its Question mark and the rest not open yet', async () => {
    await takeoff()
    const steps = within(region('rail')).getAllByRole('link')
    expect(steps).toHaveLength(14)
    expect(clean(steps[0]!.textContent)).toBe('Step 1, Sheets')
    expect(steps[0]).toHaveAttribute('aria-current', 'page')
    expect(clean(steps[6]!.textContent)).toBe('Step 7, Beams: not open yet')
    expect(within(steps[0]!).getByRole('img', { name: 'Questions open' })).toBeInTheDocument()
  })

  it('opens the rail over the canvas without moving it, and Esc closes it', async () => {
    await takeoff()
    const before = box(region('canvas'))
    await userEvent.click(screen.getByRole('button', { name: 'Open the step rail' }))
    await waitFor(() => expect(box(region('rail')).width).toBe(288))
    expect(box(region('canvas'))).toEqual(before)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(box(region('rail')).width).toBe(48))
  })

  it('shows a step that is not open yet, with the way back to Step 1', async () => {
    const { router } = await takeoff('/p/KR-01/takeoff/7')
    expect(clean(region('canvas').textContent)).toContain('Step 7, Beams, is not open yet. It will read the sheets you confirm in Step 1.')
    expect(region('toolbar').textContent).toContain('Beams')
    await userEvent.click(screen.getByRole('link', { name: 'Back to Step 1' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/KR-01/takeoff/1'))
  })

  it('shows no ?perf readout slot without the flag, one with it for the tab’s session, and none after ?perf=0 (§1.6)', async () => {
    const { router } = await takeoff()
    const perf = () => document.querySelector('[data-slot-outlet="status.perf"]')
    expect(perf()).toBeNull()
    router.history.push('/p/KR-01/takeoff/1?perf')
    await waitFor(() => expect(perf()).not.toBeNull())
    router.history.push('/p/KR-01/takeoff/7')
    await waitFor(() => expect(clean(region('toolbar').textContent)).toContain('Beams'))
    expect(perf()).not.toBeNull()
    router.history.push('/p/KR-01/takeoff/1?perf=0')
    await waitFor(() => expect(perf()).toBeNull())
  })

  it('shows the ErrorBar under the top bar while Vextrus can’t be reached', async () => {
    await takeoff()
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => onlineManager.setOnline(false))
    const bar = await screen.findByRole('alert')
    expect(bar.textContent).toBe('Vextrus can’t be reached. Check your connection; this page keeps trying.')
    expect(box(bar).top).toBe(box(region('top-bar')).bottom)
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

describe('"Page not found" (§4.1; the Project scope)', () => {
  it.each([
    ['another Developer’s project', '/p/MG-01/takeoff/1', QS],
    ['a project the Guest was not given', '/p/BP-02/takeoff/1', GUEST],
    ['a step that does not exist', '/p/KR-01/takeoff/15', QS],
    ['an address nothing matches', '/nowhere', QS],
    ['an address under a project that nothing matches', '/p/KR-01/nothing/here', QS],
  ])('for %s, inside the frame', async (_, path, as) => {
    const { keyMap } = await mountApp(path, { as })
    expect(await screen.findByText(/There is nothing at this address\. It may have been a link to another Developer’s project, or to a project you have not been given\./)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Your projects' })).toHaveAttribute('href', '/projects')
    expect(region('top-bar')).toBeVisible()
    // One frame, never a frame inside a frame (two top bars would bind every global key twice).
    expect(document.querySelectorAll('[data-region="top-bar"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-frame]')).toHaveLength(1)
    expectKeyMapSound(keyMap)
    expect(document.body.textContent).not.toContain('Meghna Heights')
  })
})

// Jump to's Sheets group: the sheets the demo seed (STEP1) puts in Kadam Residence's Step 1, as the seed numbers and titles them.
const SEEDED_SHEETS = Array.from({ length: STEP1['KR-01']?.found ?? 0 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0')
  return `ProposalS-${n}Seeded sheet ${n}`
})

describe('roles on the frame (§1.4)', () => {
  it('names the Guest’s projects and end date on the AccessChip, and gives no Members and access', async () => {
    await takeoff('/p/KR-01/takeoff/1', GUEST)
    expect(screen.getByTestId('access-chip').textContent?.replace(/[⁦-⁩]/g, '')).toBe('Access to KR-01 at Shapla Homes Ltd until 26 Oct 2026')
    expect(within(region('toolbar')).getByText('Read only: Guest')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: named(/Farhana Kabir, Guest/) }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByText('Members and access')).toBeNull()
    expect(within(menu).getByText('Sign out')).toBeInTheDocument()
  })

  it('lists only the Guest’s project in the switcher and in Jump to', async () => {
    await takeoff('/p/KR-01/takeoff/1', GUEST)
    await userEvent.click(screen.getByRole('button', { name: named(/Project: Kadam Residence/) }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((i) => clean(i.textContent))).toEqual(['Kadam ResidenceKR-01', 'All projects'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await userEvent.keyboard('{Control>}k{/Control}')
    const jump = await screen.findByRole('dialog')
    const options = within(jump).getAllByRole('option').map((o) => clean(o.textContent))
    expect(options).toEqual(['Drawing Set', 'Step 1, Sheets', ...SEEDED_SHEETS, 'Kadam ResidenceKR-01'])
  })

  it('shows the Engineer’s Vextrus access with its end date', async () => {
    await takeoff('/p/KR-01/takeoff/1', ENGINEER)
    expect(clean(screen.getByTestId('access-chip').textContent)).toBe('Vextrus access to Shapla Homes Ltd until 26 Oct 2026')
    expect(within(region('top-bar')).getByRole('button', { name: named(/Arif Rahman, Vextrus Engineer/) })).toBeVisible()
  })

  it('shows the MD read only, and no AccessChip for a member with all projects and no end date', async () => {
    await takeoff('/p/KR-01/takeoff/1', MD)
    expect(within(region('toolbar')).getByText('Read only: MD')).toBeVisible()
    expect(screen.queryByTestId('access-chip')).toBeNull()
  })

  it('lists every project the QS may open in Jump to, and places in this one', async () => {
    await takeoff()
    await userEvent.keyboard('{Control>}k{/Control}')
    const jump = await screen.findByRole('dialog')
    expect(within(jump).getAllByRole('option').map((o) => clean(o.textContent))).toEqual([
      'Drawing Set',
      'Step 1, Sheets',
      'Members and access',
      ...SEEDED_SHEETS,
      'Bokul PlaceBP-02',
      'Kadam ResidenceKR-01',
      'Shimul GardenSG-03',
    ])
  })
})

describe('the global keys (§2.2)', () => {
  it('registers ?, Ctrl K, F6 and Shift F6 with labels, soundly, and ? lists them', async () => {
    const { keyMap } = await takeoff()
    expectKeyMapSound(keyMap)
    await userEvent.keyboard('?')
    const overlay = await screen.findByRole('dialog', { name: 'Keys' })
    const everywhere = within(overlay).getByRole('region', { name: 'Everywhere' })
    expect(within(everywhere).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Open or close the keys overlay'),
        expect.stringContaining('Jump to a project, a place or a sheet'),
        expect.stringContaining('Move to the next region'),
        expect.stringContaining('Move to the previous region'),
      ]),
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Keys' })).toBeNull())
  })

  it('moves focus region by region with F6 and back with Shift F6', async () => {
    await takeoff()
    const order: string[] = []
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard('{F6}')
      order.push(document.activeElement?.closest('[data-region]')?.getAttribute('data-region') ?? '')
    }
    expect(order).toEqual(['top-bar', 'rail', 'toolbar', 'canvas', 'inspector', 'status-bar'])
    await userEvent.keyboard('{Shift>}{F6}{/Shift}')
    expect(document.activeElement?.closest('[data-region]')?.getAttribute('data-region')).toBe('inspector')
  })
})

describe('the keys overlay opens and closes with ? (§2.2), and lists Esc (§2.1)', () => {
  it('? opens it, ? again closes it; Esc is listed under Everywhere and closes it too', async () => {
    const { keyMap } = await takeoff()
    await userEvent.keyboard('?')
    const overlay = await screen.findByRole('dialog', { name: 'Keys' })
    const everywhere = within(overlay).getByRole('region', { name: 'Everywhere' })
    const listed = within(everywhere).getAllByRole('listitem').map((li) => clean(li.textContent))
    expect(listed).toEqual(expect.arrayContaining([expect.stringContaining('Open or close the keys overlay'), expect.stringContaining('Close the top-most layer')]))
    await userEvent.keyboard('?')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Keys' })).toBeNull())
    await userEvent.keyboard('?')
    await screen.findByRole('dialog', { name: 'Keys' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Keys' })).toBeNull())
    expectKeyMapSound(keyMap)
  })
})

describe('a project’s address opens its current Takeoff Step (screens.md 5: nothing opens looking empty)', () => {
  it.each([['/p/KR-01'], ['/p/KR-01/'], ['/p/KR-01/takeoff'], ['/p/KR-01/takeoff/']])('%s goes to /p/KR-01/takeoff/1, with Takeoff current', async (path) => {
    const { router } = await mountApp(path)
    await waitFor(() => expect(router.state.location.pathname).toBe('/p/KR-01/takeoff/1'))
    await waitFor(() => expect(document.querySelector('[data-region="rail"]')).not.toBeNull())
    const nav = within(region('top-bar')).getByRole('navigation', { name: 'Project' })
    expect(within(nav).getByRole('link', { name: 'Takeoff' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the Drawing Set from the top bar, in the frame, marked current (20b)', async () => {
    await mountApp('/p/KR-01/drawing-set', { as: QS })
    expect(await screen.findByRole('heading', { name: 'Drawing Set' })).toBeVisible()
    const nav = within(region('top-bar')).getByRole('navigation', { name: 'Project' })
    expect(within(nav).getByRole('link', { name: 'Drawing Set' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Takeoff' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByText(/There is nothing at this address/)).toBeNull()
  })

  it('marks Takeoff current on every takeoff address', async () => {
    await takeoff('/p/KR-01/takeoff/7')
    const nav = within(region('top-bar')).getByRole('navigation', { name: 'Project' })
    expect(within(nav).getByRole('link', { name: 'Takeoff' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Drawing Set' })).not.toHaveAttribute('aria-current')
  })

  it('shows another Developer’s project as Page not found, never redirecting into it', async () => {
    const { router } = await mountApp('/p/MG-01')
    expect(await screen.findByText(/There is nothing at this address/)).toBeVisible()
    expect(router.state.location.pathname).toBe('/p/MG-01')
  })
})

describe('focus stays visible (§4.1, §8.7; WCAG 2.4.7)', () => {
  it.each([
    [1440, 900],
    [1280, 800],
  ])('draws every F6 stop’s ring inside the viewport and inside its region at %i×%i', async (w, h) => {
    await page.viewport(w, h)
    await takeoff()
    const seen: string[] = []
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard('{F6}')
      const el = document.activeElement as HTMLElement
      const regionEl = el.closest<HTMLElement>('[data-region]')!
      seen.push(regionEl.getAttribute('data-region')!)
      const style = getComputedStyle(el)
      expect(el.matches(':focus-visible'), `${seen.at(-1)}: focus-visible`).toBe(true)
      expect(style.outlineStyle, `${seen.at(-1)}: a ring`).not.toBe('none')
      const reach = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
      const r = el.getBoundingClientRect()
      const ring = { left: r.left - reach, top: r.top - reach, right: r.right + reach, bottom: r.bottom + reach }
      const inside = box(regionEl)
      expect(ring.left, `${seen.at(-1)}: left`).toBeGreaterThanOrEqual(Math.max(0, inside.left))
      expect(ring.top, `${seen.at(-1)}: top`).toBeGreaterThanOrEqual(Math.max(0, inside.top))
      expect(ring.right, `${seen.at(-1)}: right`).toBeLessThanOrEqual(Math.min(w, inside.right))
      expect(ring.bottom, `${seen.at(-1)}: bottom`).toBeLessThanOrEqual(Math.min(h, inside.bottom))
    }
    expect(seen).toEqual(['top-bar', 'rail', 'toolbar', 'canvas', 'inspector', 'status-bar'])
  })
})

describe('the gate’s minors', () => {
  it('leads from Page not found to the projects list, which 20a builds', async () => {
    const { router } = await mountApp('/nowhere')
    await userEvent.click(await screen.findByRole('link', { name: 'Your projects' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeVisible()
    expect(document.querySelectorAll('[data-frame]')).toHaveLength(1)
  })

  it('names Jump to’s search box', async () => {
    await takeoff()
    await userEvent.keyboard('{Control>}k{/Control}')
    const jump = await screen.findByRole('dialog')
    expect(within(jump).getByRole('combobox', { name: 'Jump to' })).toBeInTheDocument()
  })

  it('gives the canvas screen a main landmark holding the toolbar and the canvas', async () => {
    await takeoff()
    const main = screen.getByRole('main')
    expect(main.contains(region('toolbar'))).toBe(true)
    expect(main.contains(region('canvas'))).toBe(true)
  })

  it('announces the ErrorBar: it is an alert', async () => {
    await takeoff()
    act(() => onlineManager.setOnline(false))
    const bar = await screen.findByRole('alert')
    expect(bar).toHaveAttribute('role', 'alert')
    act(() => onlineManager.setOnline(true))
  })
})

describe('desktop only (§1.5)', () => {
  it('shows the narrow notice above the frame at 1100 px, and keeps the 1280 px layout', async () => {
    await page.viewport(1100, 800)
    await takeoff()
    expect(screen.getByRole('note').textContent).toContain('This screen is built for')
    expect(box(region('top-bar')).width).toBe(1280)
  })

  it('replaces the frame with the phone notice at 390 px', async () => {
    await page.viewport(390, 844)
    await mountApp('/p/KR-01/takeoff/1')
    expect(await screen.findByRole('heading', { name: 'Vextrus needs a desktop' })).toBeVisible()
    expect(document.querySelector('[data-region="top-bar"]')).toBeNull()
    expect(clean(document.body.textContent)).toContain('Your work is saved; nothing is lost.')
  })

  it('does not promise that the work is saved at 390 px while an act is lost', async () => {
    onTestFinished(() => resetSaves())
    await page.viewport(390, 844)
    await mountApp('/p/KR-01/takeoff/1')
    expect(await screen.findByRole('heading', { name: 'Vextrus needs a desktop' })).toBeVisible()
    // (mountApp starts from a clean network; the act is lost after, as when the connection drops mid-work.)
    act(() => actStarted()('dropped'))
    await waitFor(() => expect(clean(document.body.textContent)).not.toContain('nothing is lost'))
    const words = clean(document.body.textContent)
    expect(words).toContain('Open it on a screen 1280 px wide or more.')
    expect(words).not.toMatch(/saved|nothing is lost/i)
  })
})

describe('the page’s language from the Market’s language data (§1.8, §1.9)', () => {
  it('is lang="en" dir="ltr" for Bangladesh', async () => {
    await takeoff()
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('follows a Market whose language data is right to left', async () => {
    const session = { ...(await sessionAs(QS)), market: { ...BANGLADESH, language: PSEUDO_RTL } }
    await mountApp('/p/KR-01/takeoff/1', { session })
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
    expect(document.documentElement.lang).toBe(PSEUDO_RTL.code)
  })
})

describe('the pseudo right-to-left language (U9; m0-screens §1.8)', () => {
  async function rtl() {
    overrideLanguage()
    activatePseudoRtl()
    return takeoff()
  }

  it('mirrors the chrome: the rail and the inspector swap sides, the toolbar runs from the right', async () => {
    await rtl()
    expect(getComputedStyle(document.body).direction).toBe('rtl')
    expect(box(region('rail')).left).toBeGreaterThan(box(region('canvas')).right - 1)
    expect(box(region('inspector')).right).toBeLessThanOrEqual(box(region('canvas')).left + 1)
    const toolbar = box(region('toolbar'))
    const first = region('toolbar').firstElementChild!
    expect(toolbar.right - box(first).right).toBeLessThan(12)
    // The top bar too: the brand mark at the right-hand end.
    const brand = region('top-bar').querySelector('a')!
    expect(box(region('top-bar')).right - box(brand).right).toBeLessThan(16)
  })

  it('keeps an LtrCanvas in the canvas left to right and untransformed, with 14′-6″ in order', async () => {
    await rtl()
    const host = document.createElement('div')
    host.style.height = '100%'
    region('canvas').append(host)
    const f = createFormat(BANGLADESH, 'imperial', i18n)
    render(
      <FormatProvider profile={BANGLADESH}>
        <LtrCanvas data-testid="canvas">
          <p style={{ fontSize: 20 }}>{f.length(lengthFromInches(174))}</p>
        </LtrCanvas>
      </FormatProvider>,
      { container: host },
    )
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('dir')).toBe('ltr')
    expect(getComputedStyle(canvas).direction).toBe('ltr')
    expect(getComputedStyle(canvas).transform).toBe('none')
    const length = canvas.querySelector('[data-notation="length"]')!
    const text = length.firstChild as Text
    const range = document.createRange()
    const xs = [...text.data].map((_, i) => {
      range.setStart(text, i)
      range.setEnd(text, i + 1)
      return range.getBoundingClientRect().left
    })
    expect(xs.every((x, i) => i === 0 || x > xs[i - 1]!)).toBe(true)
    expect(notationProblems(document.body)).toEqual([])
  })

  it('words every string of the frame from the catalogue: no unaccented English is left', async () => {
    await rtl()
    const words = region('toolbar').textContent + region('status-bar').textContent + region('inspector').textContent + region('top-bar').textContent
    for (const english of ['Step', 'Sheets', 'Confirmed', 'Imperial', 'Selection', 'Questions', 'Takeoff', 'Drawing Set', 'Jump to']) {
      expect(words).not.toContain(english)
    }
  })
})

describe('drawing notation on the frame (U9: the DOM test)', () => {
  it('finds no element marked data-notation that is not a left-to-right isolate, and no formatted figure unmarked', async () => {
    await takeoff()
    expect(notationProblems(document.body)).toEqual([])
    expect(unmarkedNotation(document.body)).toEqual([])
  })

  it('finds none in the open Jump to dialog: its sheet rows hold the number, the revision and the title as drawing notation', async () => {
    const s = seed()
    // Two copies of S-04, told apart by revision mark and date, as Jump to shows them.
    Object.assign(s.of('S-04'), { revision_mark: 'Rev A', issue_date: '2026-09-12' })
    Object.assign(s.of('S-05'), { number: 'S-04', title: 'SECOND COPY', revision_mark: 'Rev B', issue_date: '2026-09-20' })
    await openList(s)
    await userEvent.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog')
    const sheets = await within(dialog).findByRole('group', { name: 'Sheets' })
    await waitFor(() => expect(within(sheets).getAllByRole('option').length).toBeGreaterThan(1))
    expect(notationProblems(dialog)).toEqual([])
    expect(sheetRowNotationProblems(sheets, ['Rev A', 'Rev B'])).toEqual([])
    // The mark and the date, as the list's Revision column words them; the title is isolated in its own direction.
    expect(clean(sheets.textContent)).toContain('Rev A, 12 Sep 2026')
    expect(sheets.querySelector('[data-notation="sheet-number"]')!.closest('[role="option"]')!.querySelector('bdi[dir="auto"]')).not.toBeNull()
  })

  it('would find a sheet number or a revision mark in Jump to written without data-notation', () => {
    const rows = document.createElement('div')
    rows.innerHTML =
      '<div role="option"><bdi dir="ltr" class="num">S-04</bdi><bdi dir="auto">GROUND FLOOR</bdi><span><bdi dir="ltr">Rev A</bdi>, 12 Sep 2026</span></div>' +
      '<div role="option"><bdi dir="ltr" data-notation="sheet-number">S-05</bdi><bdi dir="auto">ROOF</bdi><span><bdi dir="ltr">Rev B</bdi></span></div>'
    expect(sheetRowNotationProblems(rows, ['Rev A', 'Rev B'])).toEqual([
      'S-04GROUND FLOORRev A, 12 Sep 2026: the sheet number has no data-notation="sheet-number"',
      'S-04GROUND FLOORRev A, 12 Sep 2026: the revision mark Rev A has no data-notation="revision"',
      'S-05ROOFRev B: the revision mark Rev B has no data-notation="revision"',
    ])
  })

  it('would find a formatted figure left unmarked', () => {
    const p = document.createElement('p')
    p.innerHTML = 'Width 14′-6″, scale <bdi dir="ltr" data-notation="scale">1:100</bdi>, level −3.200\u00a0m'
    expect(unmarkedNotation(p)).toEqual(['Width 14′-6″, scale ', ', level −3.200\u00a0m'])
  })
})
