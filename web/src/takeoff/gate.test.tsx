/*
 * Ticket 22's design gate, walk 1 (29 Sep 2026): each must it failed, pinned on the acceptance fake
 * (KR-01 after reading, §7) fed the API's shapes. M1: the issue date comes as an ISO date and shows as
 * "20 Aug 2026". M4: every Question card has its Trace line, and Q3–Q5 a body. M5: the API's pre-pick
 * shows "Picked for you:" with its sources. M9: a focused row draws its focus ring. M10: a range of
 * sheet numbers is one left-to-right isolate. M11: the MD's and a Guest's bar names the QS and offers
 * "Next open Question Q".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page, userEvent as realKeys } from 'vitest/browser'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { activatePseudoRtl } from '@/i18n/pseudo'
import { notationProblems } from '@/ui'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
  activateLanguage(ENGLISH, englishMessages())
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'

/** The acceptance fake, with the progress's `qs` (the names the read-only bar gives) laid over it. */
function kr01(qs: string[] = ['Nusrat Jahan']): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const handle = api.handle
  api.handle = async (request: Request) => {
    const response = await handle(request)
    if (!new URL(request.url, location.origin).pathname.endsWith('/takeoff/step1/progress') || !response.ok) return response
    const body = (await response.json()) as Record<string, unknown>
    return new Response(JSON.stringify({ ...body, qs }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return { api, step1 }
}

async function open(api: FakeApi, as: string = PEOPLE.qs) {
  const app = await mountApp(PATH, { as, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return app
}

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

async function focusRow(number: string) {
  await waitFor(() => rowOf(number))
  await userEvent.click(within(rowOf(number)).getByText(number))
}

const inspector = () => screen.getByRole('complementary')
const card = (tag: string | RegExp) => (name: string) => (typeof tag === 'string' ? clean(name) === `Question ${tag}` : tag.test(clean(name)))

describe('M1: an issue date is the API’s ISO date', () => {
  it('shows S-07’s "2026-08-20" as 20 Aug 2026 in the list, the inspector and Q2’s copies', async () => {
    const { api } = kr01()
    await open(api)
    expect(clean(rowOf('S-07').textContent)).toContain('B, 20 Aug 2026')
    await focusRow('S-07')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('20 Aug 2026'))
    expect(bodyText()).not.toMatch(/\b8 Dec\b|\b20\.08\.2026\b/)
  })
})

describe('M4, M5: the Question cards', () => {
  it('gives every open Question its Trace line, and Q3, Q4 and Q5 a body', async () => {
    const { api } = kr01()
    await open(api)
    await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    const cards = await screen.findAllByRole('region', { name: card(/^Question Q\d$/) })
    expect(cards).toHaveLength(5)
    for (const c of cards) expect(clean(c.textContent), clean(c.getAttribute('aria-label'))).toContain('Trace:')
    const text = (tag: string) => clean(cards.find((c) => clean(c.getAttribute('aria-label')) === `Question ${tag}`)!.textContent)
    expect(text('Q2')).toContain('Both are titled “TYPICAL FLOOR SLAB LAYOUT”. Only one can be read.')
    expect(text('Q2')).toContain('Trace: the title blocks of S-07 rev B and S-07 rev A; the drawing list read on a sheet')
    expect(text('Q3')).toContain('A sheet titled “DOOR AND WINDOW SCHEDULE” in KR-ARC-R0.dwg has an empty number in its title block.')
    expect(text('Q3')).toContain('Trace: the title block of DOOR AND WINDOW SCHEDULE (the number field is empty)')
    expect(text('Q4')).toContain('Its title, “SECTION A-A & ELEVATION”, does not say which kind of sheet A-05 is.')
    expect(text('Q5')).toContain('S-13 is named on the drawing list read on a sheet, and no file added has a sheet with that number.')
    expect(text('Q5')).toContain('Trace: the drawing list read on a sheet')
  })

  it('opens the sheet a Trace link names', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-07')
    const q2 = await screen.findByRole('region', { name: card('Q2') })
    await userEvent.click(within(q2).getByRole('button', { name: (n) => clean(n) === 'S-07 rev A' }))
    await screen.findByRole('group', { name: /S-07/ })
  })

  it('shows Q2’s pre-pick from the API with "Picked for you:" and what answering it does', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-07')
    const q2 = await screen.findByRole('region', { name: card('Q2') })
    expect(clean(q2.textContent)).toContain('Picked for you: the later revision mark and date in the title blocks, and the drawing list read on a sheet naming S-07')
    expect(clean(q2.textContent)).toContain('Answering confirms S-07 (rev B) and excludes S-07 (rev A) as superseded.')
    const picked = within(q2).getAllByRole('radio').find((r) => (r as HTMLInputElement).checked)
    expect(clean(picked?.closest('label')?.textContent)).toContain('Keep rev B (20 Aug 2026); leave rev A out as superseded')
  })
})

describe('M9: focus is visible on the list’s rows', () => {
  it('draws an outline on the row ↓ focuses', async () => {
    const { api } = kr01()
    await open(api)
    screen.getByRole('grid', { name: 'Sheets' }).focus()
    await realKeys.keyboard('{ArrowDown}')
    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('row'))
    const style = getComputedStyle(document.activeElement!)
    expect(style.outlineStyle).not.toBe('none')
    expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2)
  })
})

describe('M10: a range of sheet numbers is one isolate', () => {
  it('reads "S-01–S-13" as one left-to-right notation in pseudo right-to-left', async () => {
    activatePseudoRtl()
    const { api, step1 } = kr01()
    step1.lists = {}
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(document.querySelector('[data-notation="sheet-number"]')).not.toBeNull())
    await waitFor(() => {
      const ranges = [...document.querySelectorAll('[data-notation="sheet-number"]')].map((el) => el.textContent)
      expect(ranges).toContain('A-01–A-07')
      expect(ranges).toContain('E-02–E-03')
    })
    expect(notationProblems(document.body)).toEqual([])
    for (const el of document.querySelectorAll('[data-notation]')) {
      const next = el.nextSibling
      expect(next?.nodeType === Node.TEXT_NODE && /^[–-]$/.test(next.textContent ?? '') && next.nextSibling instanceof HTMLElement && next.nextSibling.dataset.notation, `a split range after ${el.textContent}`).toBeFalsy()
    }
  })
})

describe('M11: the read-only bar names the QS', () => {
  it.each([
    [PEOPLE.md, 'You are reading this as the MD.'],
    [PEOPLE.guest, 'You are reading this as a Guest.'],
  ])('%s reads "Nusrat Jahan (QS) confirms the sheet list" and "Next open Question Q" while Questions are open', async (as, what) => {
    const { api } = kr01()
    await open(api, as)
    expect(bodyText()).toContain(what)
    expect(bodyText()).toContain('Nusrat Jahan (QS) confirms the sheet list; every act shows who did it.')
    const ghost = screen.getByRole('button', { name: /Next open Question/ })
    expect(ghost).toHaveAttribute('aria-keyshortcuts', 'Q')
    await userEvent.click(ghost)
    await waitFor(() => expect(document.activeElement?.getAttribute('data-row')).toMatch(/^q:/))
  })

  it('says "The QS" when no QS is named, and drops the ghost once no Question is open', async () => {
    const { api, step1 } = kr01([])
    step1.questions = []
    await open(api, PEOPLE.md)
    expect(bodyText()).toContain('The QS confirms the sheet list; every act shows who did it.')
    expect(screen.queryByRole('button', { name: /Next open Question/ })).toBeNull()
  })
})
