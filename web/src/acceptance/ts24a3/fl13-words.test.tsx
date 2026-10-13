/*
 * Ticket S24-A3's acceptance tests, the web half (G1 item M0-FL13; issues #666, #581, #667, #580).
 *
 * docs/design/m0-screens.md §4.1: "Status bar (24 px, canvas screens only), left to right. Cursor
 * "X 42′-7½″  Y 18′-3″" (coordinate kind; "X —  Y —" off the sheet); the stated scale …; "Imperial" …;
 * then on the right Coverage and the save state: "All changes saved" / "Saving…" / "Not saved: the
 * connection dropped. Trying again."" §4.6: "Status bar items it registers: the cursor in ft-in".
 *
 * §6.3: "Needs you (amber band): "8 Questions open, in the order Enter takes them"" is the QS's line.
 * §6.12: the MD reads everything and acts on nothing ("A key that would change something (Enter, …)
 * shows the toast of 1.4"); the Guest "the same as the MD's, in the Guest's words". So the MD and the
 * Guest still see each open Question's row, and their heading never promises that Enter takes them
 * (#580, #667). The MD's and the Guest's own heading words are not given by m0-screens and are not pinned.
 *
 * Run at /p/KR-01/takeoff/1 through t22's in-memory API (../t22/step1.fixture.ts) and S15-W2's
 * sheet-mode seed (../ts15w2/keys.fixture.ts); the pointer is the browser's own (Playwright `hover`).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page, userEvent as pointer } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'
import { PLAN_VIEW, openSheet, seed, statusBar } from '../ts15w2/keys.fixture'

beforeEach(async () => {
  await page.viewport(1440, 900)
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const barText = () => clean(statusBar().textContent)

function kr01(): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  return { api, step1: new FakeStep1(api) }
}

async function open(api: FakeApi, as: string) {
  const app = await mountApp('/p/KR-01/takeoff/1', { as, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  return app
}

/** The list's rows (role "row") that carry an open Question's label, "Question Q1" … "Question Q5". */
const questionRows = () =>
  [...document.querySelectorAll<HTMLElement>('[role="row"]')]
    .map((r) => clean(r.textContent))
    .map((text) => /Question (Q\d+)/.exec(text)?.[1])
    .filter((q): q is string => q !== undefined)

describe('"Needs you" is worded for who reads it (§6.3, §6.12; #580, #667)', () => {
  it('tells the QS "Needs you: 5 Questions open, in the order Enter takes them"', async () => {
    const { api } = kr01()
    await open(api, PEOPLE.qs)
    expect(bodyText()).toContain('Needs you: 5 Questions open, in the order Enter takes them')
  })

  it('never tells the MD the Questions are "in the order Enter takes them"', async () => {
    const { api } = kr01()
    await open(api, PEOPLE.md)
    await waitFor(() => expect(questionRows()).toHaveLength(5))
    expect(bodyText()).not.toContain('in the order Enter takes them')
  })

  it('never tells a Guest the Questions are "in the order Enter takes them"', async () => {
    const { api } = kr01()
    await open(api, PEOPLE.guest)
    await waitFor(() => expect(questionRows()).toHaveLength(5))
    expect(bodyText()).not.toContain('in the order Enter takes them')
  })

  it('shows the MD each open Question’s row, Q1 to Q5, as the QS sees them', async () => {
    const { api } = kr01()
    await open(api, PEOPLE.md)
    await waitFor(() => expect(questionRows()).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']))
  })
})

describe('the save state on the status bar (§4.1; #581, #666)', () => {
  it('shows "All changes saved" on Step 1’s status bar', async () => {
    const { api } = kr01()
    await open(api, PEOPLE.qs)
    await waitFor(() => expect(barText()).toContain('All changes saved'))
  })

  it('shows "Saving…" while an act is on its way, then "All changes saved"', async () => {
    const { api } = kr01()
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const inner = api.handle
    api.handle = async (request: Request) => {
      if (request.method === 'POST' && new URL(request.url, location.origin).pathname.endsWith('/takeoff/step1/confirm')) await held
      return inner(request)
    }
    await open(api, PEOPLE.qs)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(barText()).toContain('Saving…'))
    expect(barText()).not.toContain('All changes saved')
    release()
    await waitFor(() => expect(bodyText()).toContain('Confirmed 16 / 24'))
    await waitFor(() => expect(barText()).toContain('All changes saved'))
    expect(barText()).not.toContain('Saving…')
  })

  it('shows "Not saved: the connection dropped. Trying again." when an act cannot reach the server', async () => {
    const { api } = kr01()
    const inner = api.handle
    api.handle = async (request: Request) => {
      if (request.method === 'POST' && new URL(request.url, location.origin).pathname.endsWith('/takeoff/step1/confirm')) throw new TypeError('Failed to fetch')
      return inner(request)
    }
    await open(api, PEOPLE.qs)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(barText()).toContain('Not saved: the connection dropped. Trying again.'))
    expect(barText()).not.toContain('All changes saved')
  })
})

describe('the cursor on the status bar (§4.1, §4.6; #581, #666)', () => {
  it('shows "X — Y —" in sheet mode while the pointer is not on the sheet', async () => {
    await openSheet(seed(), 'S-02')
    await waitFor(() => expect(barText()).toContain('X — Y —'))
  })

  it('shows the cursor in feet and inches ("X 42′-7½″ Y 18′-3″") with the pointer over the sheet', async () => {
    await openSheet(seed(), 'S-02')
    const plan = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(`[data-outline="${PLAN_VIEW}"]`)
      expect(el, 'the plan view’s outline').not.toBeNull()
      return el!
    })
    await pointer.hover(plan)
    const ftIn = '−?\\d+′-\\d+[⅛¼⅜½⅝¾⅞]?″'
    await waitFor(() => expect(barText()).toMatch(new RegExp(`X ${ftIn} Y ${ftIn}`)))
    expect(barText()).not.toContain('X — Y —')
  })
})
