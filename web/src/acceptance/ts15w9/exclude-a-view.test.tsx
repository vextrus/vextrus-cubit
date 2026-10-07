/*
 * Ticket S15-W9's acceptance tests: in sheet mode, X with a view selected excludes that view, not its
 * sheet (docs/design/m0-screens.md §6.9): "Exclusion (`X`), per sheet or per view. With a view selected
 * (sheet mode), `X` excludes the view; otherwise the focused sheet"; the picker's first line "Exclude
 * the view "8th floor beam layout". Why?" with "Coverage keeps the reason. Esc cancels"; `1`–`7` pick
 * (4 is "Presentation, 3D or for information"); the toast ""8th floor beam layout" excluded: for
 * information. Coverage keeps the reason."
 *
 * On ticket 22's acceptance fake (KR-01 after reading, §7), S-04 given two views; a view is selected
 * with → (§6.5, as ticket 22's gate tests do). The product's quotation marks are typographic (“…”) and
 * a view's title is shown as the drawing gives it: both are read as the same words here, and the title
 * in any case.
 *
 * Chosen by the acceptance writer where no authority names it (the report says so): the view's
 * exclusion is `POST …/takeoff/step1/exclude` with `{"proposals": [<the view's id>], "reason": …}`, the
 * view's `id` as `GET …/proposals` gives it in the sheet's `views` (the API's acceptance test,
 * vextrus/takeoff/tests/acceptance/ts15w9, pins the same body).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) =>
  (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'

const PLAN = 'f9150000-0000-4000-8000-000000000001'
const SECTION = 'f9150000-0000-4000-8000-000000000002'
const SECTION_TITLE = 'BEAM SECTION 1-1'

function s04Views() {
  return [
    { id: PLAN, ordinal: 1, kind: 'plan', title: 'GROUND FLOOR BEAM LAYOUT', stated_scale: '1:100', not_to_scale: false, storeys: ['ground'], storeys_as_stated: 'GROUND FLOOR', storeys_meaning: 'at_floor_level', steps: ['beams'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['10', '10', '60', '50'] },
    { id: SECTION, ordinal: 2, kind: 'section', title: SECTION_TITLE, stated_scale: '', not_to_scale: true, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: ['beams'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['70', '10', '90', '30'] },
  ]
}

/** The words with `title` in them, its letters in either case (a title is shown as the drawing gives it). */
function saying(before: string, title: string, after: string): RegExp {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const anyCase = [...title].map((c) => (c.toLowerCase() !== c.toUpperCase() ? `[${c.toLowerCase()}${c.toUpperCase()}]` : escape(c))).join('')
  return new RegExp(`${escape(before)}${anyCase}${escape(after)}`)
}
const VIEW_PICKER = saying('Exclude the view "', SECTION_TITLE, '". Why?')
const VIEW_TOAST = saying('"', SECTION_TITLE, '" excluded: for information. Coverage keeps the reason.')

/**
 * KR-01 with S-04's views, and the API's exclusion of a view (by its id, see the header) laid over the
 * fake, which knows only sheets: each such request is kept in `views`, and the view is excluded with
 * the reason given.
 */
function kr01() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const s04 = step1.proposals.find((p) => p.number === 'S-04')!
  const views = s04Views()
  Object.assign(s04, { views })
  const posted: Record<string, unknown>[] = []
  const base = api.handle
  api.handle = async (request: Request) => {
    const url = new URL(request.url, location.origin)
    if (request.method === 'POST' && url.pathname.endsWith('/takeoff/step1/exclude')) {
      const body = (await request.clone().json()) as Record<string, unknown>
      const ids = (body.proposals as string[] | undefined) ?? []
      const hit = views.filter((v) => ids.includes(v.id))
      if (hit.length > 0) {
        posted.push(body)
        if (hit.length !== ids.length) return new Response(JSON.stringify({ code: 'platform.auth.not_found', params: {} }), { status: 404, headers: { 'Content-Type': 'application/json' } })
        for (const v of hit) Object.assign(v, { decision: 'excluded', excluded_reason: body.reason })
        const act = { confirmation_id: 'e9150000-0000-4000-8000-000000000001', act: 'excluded', sheets: hit.length, by: 'Nusrat Jahan', at: '2026-09-28T06:00:00.000Z' }
        return new Response(JSON.stringify(act), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    }
    return base(request)
  }
  return { api, step1, s04, posted }
}

function rowOf(text: string): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner, `one row for ${text}`).toHaveLength(1)
  return inner[0]!
}

/** Step 1 open on S-04 in sheet mode, its two outlines drawn, no view selected. */
async function openS04(api: FakeApi) {
  await mountApp(PATH, { as: PEOPLE.qs, api })
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
  await waitFor(() => rowOf('S-04'))
  await userEvent.click(within(rowOf('S-04')).getByText('S-04'))
  await userEvent.keyboard(' ')
  await screen.findByRole('group', { name: /S-04/ })
  await waitFor(() => expect(document.querySelectorAll('[data-outline]')).toHaveLength(2))
}

const pressed = () => document.querySelector('[data-outline][aria-pressed="true"]')?.getAttribute('data-outline') ?? null

/** → twice: "BEAM SECTION 1-1", the sheet's second view in reading order. */
async function selectTheSection() {
  await userEvent.keyboard('{ArrowRight}')
  await userEvent.keyboard('{ArrowRight}')
  await waitFor(() => expect(pressed()).toBe(SECTION))
}

describe('X with a view selected excludes the view (§6.9)', () => {
  it('opens the picker naming the view: "Exclude the view "BEAM SECTION 1-1". Why?" and "Coverage keeps the reason. Esc cancels"', async () => {
    const { api } = kr01()
    await openS04(api)
    await selectTheSection()
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toMatch(VIEW_PICKER))
    expect(bodyText()).toContain('Coverage keeps the reason. Esc cancels')
    expect(bodyText()).not.toContain('Exclude S-04. Why?')
  })

  it('posts the view’s exclusion with the reason picked, not the sheet’s', async () => {
    const { api, step1, s04, posted } = kr01()
    await openS04(api)
    await selectTheSection()
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toMatch(VIEW_PICKER))
    await userEvent.keyboard('4')
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ proposals: [SECTION], reason: 'for_information' })
    // The sheet itself is never sent: nothing reached the fake's sheet exclusion.
    expect(step1.calls()).not.toContain('POST /exclude')
    expect(s04.decision).toBeNull()
  })

  it('toasts ""BEAM SECTION 1-1" excluded: for information. Coverage keeps the reason."', async () => {
    const { api } = kr01()
    await openS04(api)
    await selectTheSection()
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toMatch(VIEW_PICKER))
    await userEvent.keyboard('4')
    await waitFor(() => expect(screen.getAllByRole('status').map((s) => clean(s.textContent)).join(' | ')).toMatch(VIEW_TOAST))
    expect(bodyText()).not.toContain('S-04 excluded')
  })

  it('cancels the view’s picker with Esc, excluding nothing', async () => {
    const { api, step1, posted } = kr01()
    await openS04(api)
    await selectTheSection()
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toMatch(VIEW_PICKER))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(bodyText()).not.toMatch(VIEW_PICKER))
    expect(posted).toEqual([])
    expect(step1.calls()).not.toContain('POST /exclude')
  })
})

describe('X with no view selected excludes the sheet (§6.9: "otherwise the focused sheet")', () => {
  it('opens "Exclude S-04. Why?" in sheet mode and posts S-04', async () => {
    const { api, step1, s04, posted } = kr01()
    await openS04(api)
    expect(pressed()).toBeNull()
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toContain('Exclude S-04. Why?'))
    await userEvent.keyboard('1')
    await waitFor(() => expect(step1.calls()).toContain('POST /exclude'))
    expect(step1.seen.find((s) => s.call === 'POST /exclude')?.body).toMatchObject({ proposals: [s04.id], reason: 'superseded' })
    expect(posted).toEqual([])
  })

  it('excludes the sheet again once Esc has left the view', async () => {
    const { api, step1, s04, posted } = kr01()
    await openS04(api)
    await selectTheSection()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(pressed()).toBeNull())
    await userEvent.keyboard('x')
    await waitFor(() => expect(bodyText()).toContain('Exclude S-04. Why?'))
    await userEvent.keyboard('1')
    await waitFor(() => expect(step1.calls()).toContain('POST /exclude'))
    expect(step1.seen.find((s) => s.call === 'POST /exclude')?.body).toMatchObject({ proposals: [s04.id], reason: 'superseded' })
    expect(posted).toEqual([])
  })
})
