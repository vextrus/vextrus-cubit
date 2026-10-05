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
import { FakeDrawingSet, file, msg } from '@/acceptance/t20b/drawings.fixture'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'
import { overrideLanguage } from '@/app/dev-language'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { activateLanguage } from '@/i18n/activate'
import { englishMessages } from '@/i18n/catalogues'
import { ENGLISH } from '@/i18n/languages'
import { activatePseudoRtl } from '@/i18n/pseudo'
import { notationProblems } from '@/ui'
import { statedKeys } from './storeys'

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

/**
 * en-XB for the whole mount (T2): without overrideLanguage the Market's language took the screen back
 * to English and these cases ran left to right. Call it before mountApp, then `expectRtl()`.
 */
function pseudoRtl(): void {
  overrideLanguage()
  activatePseudoRtl()
}
const expectRtl = () => expect(document.documentElement.dir).toBe('rtl')

/** The held file's row: its title cell carries the file name (found by structure, not English words). */
function heldFileRow(): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="row"][data-row]')].find((r) => r.querySelectorAll('[role="gridcell"]')[2]?.querySelector('[data-notation="file-name"]'))
  expect(found).toBeTruthy()
  return found!
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)
const PATH = '/p/KR-01/takeoff/1'

/** The acceptance fake, with the progress's `qs` (the names the read-only bar gives) laid over it. */
function kr01(qs: string[] = ['Nusrat Jahan'], files: ReturnType<typeof file>[] = []): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  if (files.length > 0) new FakeDrawingSet(api, 'KR-01').files = files
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

/** The Structural drawing list read on a sheet also sends these fields (the fixture's list sends neither). */
function listGives(api: FakeApi, extra: { read_on: string; read_revisions: Record<string, string> }) {
  const base = api.handle
  api.handle = async (request: Request) => {
    const response = await base(request)
    const url = new URL(request.url, location.origin)
    if (request.method !== 'GET' || !url.pathname.endsWith('/takeoff/step1/drawing-list') || url.searchParams.get('discipline') !== 'structural') return response
    return new Response(JSON.stringify({ ...(await response.json()), ...extra }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}
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

describe('M3: the Revision column keeps the date', () => {
  it('shows "R0, 14 Sep 2026" for a mark read from the file name, and "—" with neither', async () => {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-02')!, { issue_date: '2026-09-14' })
    Object.assign(step1.proposals.find((p) => p.number === 'S-03')!, { revision_mark: '', revision_mark_source: null })
    await open(api)
    expect(clean(rowOf('S-02').textContent)).toContain('R0, 14 Sep 2026')
    expect(clean(rowOf('S-03').textContent)).toContain('—')
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
    expect(text('Q2')).toContain('Trace: the title blocks of S-07 rev B and S-07 rev A; the drawing list found in the drawings')
    expect(text('Q3')).toContain('A sheet titled “DOOR AND WINDOW SCHEDULE” in KR-ARC-R0.dwg has an empty number in its title block.')
    expect(text('Q3')).toContain('Trace: the title block of DOOR AND WINDOW SCHEDULE (the number field is empty)')
    expect(text('Q4')).toContain('Its title, “SECTION A-A & ELEVATION”, does not say which kind of sheet A-05 is.')
    expect(text('Q5')).toContain('S-13 is named on the drawing list found in the drawings, and no file added has a sheet with that number.')
    expect(text('Q5')).toContain('Trace: the drawing list found in the drawings')
  })

  it('opens the sheet a Trace link names', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-07')
    const q2 = await screen.findByRole('region', { name: card('Q2') })
    await userEvent.click(within(q2).getByRole('button', { name: (n) => clean(n) === 'S-07 rev A' }))
    await screen.findByRole('group', { name: /S-07/ })
  })

  it('M14: pre-picks Q2 only where two sources agree, naming the drawing list on S-01', async () => {
    const { api, step1 } = kr01()
    listGives(api, { read_on: step1.proposals.find((p) => p.number === 'S-01')!.sheet_id, read_revisions: { 'S-07': 'B' } })
    await open(api)
    await focusRow('S-07')
    const q2 = await screen.findByRole('region', { name: card('Q2') })
    expect(clean(q2.textContent)).toContain('Picked for you: the later revision mark and the drawing list on S-01 agree')
    // keep_b (the seed's key) is recorded by 21c and changes no sheet (#156's words gate): the line promises nothing.
    expect(clean(q2.textContent)).toContain('Answering records your pick; the copies stay as they are, to confirm or exclude in the list.')
    const picked = within(q2).getAllByRole('radio').find((r) => (r as HTMLInputElement).checked)
    expect(clean(picked?.closest('label')?.textContent)).toContain('Keep rev B (20 Aug 2026); leave rev A out as superseded')
  })

  it('M14: pre-picks no other kind of Question, whose sources the card cannot name', async () => {
    const { api, step1 } = kr01()
    const q4 = step1.questions.find((q) => q.kind === 'low_confidence')!
    q4.options = q4.options.map((o, i) => ({ ...o, picked: i === 0 }))
    await open(api)
    await focusRow('A-05')
    const card4 = await screen.findByRole('region', { name: card(/^Question Q\d$/) })
    expect(within(card4).getAllByRole('radio').some((r) => (r as HTMLInputElement).checked)).toBe(false)
  })

  it('M14: shows no pre-pick when only the title block can be named', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-07')
    const q2 = await screen.findByRole('region', { name: card('Q2') })
    expect(clean(q2.textContent)).not.toContain('Picked for you')
    expect(within(q2).getAllByRole('radio').some((r) => (r as HTMLInputElement).checked)).toBe(false)
  })

  it('M14: shows no pre-pick when the drawing list gives the other copy’s mark', async () => {
    const { api, step1 } = kr01()
    listGives(api, { read_on: step1.proposals.find((p) => p.number === 'S-01')!.sheet_id, read_revisions: { 'S-07': 'A' } })
    await open(api)
    await focusRow('S-07')
    const q2 = await screen.findByRole('region', { name: card('Q2') })
    expect(clean(q2.textContent)).not.toContain('Picked for you')
  })
})

describe('M7, M8: the inspector’s sheet and who did what', () => {
  it('shows where each fact was read, the views with their chips, and the Exclude action', async () => {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, {
      number_source: 'title_block_attribute',
      title_source: 'title_block_text',
      layout: null,
      plot_file: null,
      plot_page: null,
      plot_none: null,
      views: [
        { id: 'v1', ordinal: 1, kind: 'plan', title: '1ST FLOOR BEAM LAYOUT', stated_scale: '1:100', not_to_scale: false, storeys: ['floor_1'], storeys_as_stated: '1ST FLOOR', storeys_meaning: 'at_floor_level', steps: ['beams'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] },
        { id: 'v2', ordinal: 2, kind: 'title_block', title: 'TITLE BLOCK', stated_scale: '', not_to_scale: true, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: [], part: null, proposed_exclusion: 'for_information', decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] },
      ],
    })
    await open(api)
    await focusRow('S-05')
    const facts = () => clean(inspector().textContent)
    await waitFor(() => expect(facts()).toContain('Proposal: where each was read'))
    expect(facts()).toContain('S-05 title-block attribute')
    expect(facts()).toContain('text in the title block')
    expect(facts()).toContain('Structural from the file')
    expect(facts()).toContain('laid out in the drawing')
    expect(facts()).toContain('1st, at floor level')
    expect(facts()).toContain('None: no PDF page is matched to it')
    expect(facts()).toContain('Views (2)')
    expect(facts()).toContain('7 Beams')
    expect(facts()).toContain('excluded: for information')
    expect(facts()).toContain('Proposed by Vextrus from the file; no one has acted on it yet.')
    await userEvent.click(within(inspector()).getByRole('button', { name: /Exclude/ }))
    await waitFor(() => expect(bodyText()).toContain('Exclude S-05. Why?'))
  })

  it('shows the initials chip on a confirmed row and the act over "name, role, time"', async () => {
    const { api, step1 } = kr01()
    step1.settleAllBut('electrical')
    for (const p of step1.proposals) if (p.decision) Object.assign(p, { decided_by_role: 'qs', decided_with: 20 })
    await mountApp(PATH, { as: PEOPLE.md, api })
    await waitFor(() => rowOf('S-02'))
    expect(within(rowOf('S-02')).getByTitle('Nusrat Jahan, QS')).toHaveTextContent('NJ')
    await focusRow('S-02')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Confirmed in bulk with 19 other sheets'))
    expect(clean(inspector().textContent)).toContain('Nusrat Jahan, QS, 26 Sep 2026, 11:00')
    expect(within(inspector()).getByTitle('Nusrat Jahan, QS')).toHaveTextContent('NJ')
    expect(clean(inspector().textContent)).toContain('Confirmed by Nusrat Jahan, 26 Sep 2026')
    expect(within(inspector()).queryByRole('button', { name: /Exclude|Confirm back in/ })).toBeNull()
    await focusRow('A-07')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Excluded: for information'))
  })
})

describe('M6: sheet mode', () => {
  const views = [
    { id: 'v1', ordinal: 1, kind: 'plan', title: '1ST FLOOR BEAM LAYOUT', stated_scale: '1:100', not_to_scale: false, storeys: ['floor_1'], storeys_as_stated: '1ST FLOOR', storeys_meaning: 'at_floor_level', steps: ['beams'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['10', '10', '60', '50'] },
    { id: 'v2', ordinal: 2, kind: 'detail', title: 'BEAM SECTION', stated_scale: '', not_to_scale: true, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: ['beams'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['70', '10', '90', '30'] },
    { id: 'v3', ordinal: 3, kind: 'title_block', title: 'TITLE BLOCK', stated_scale: '', not_to_scale: true, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: [], part: null, proposed_exclusion: 'for_information', decision: null, excluded_reason: null, box: ['95', '0', '120', '20'] },
  ]

  async function openS05() {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { views })
    await open(api)
    await focusRow('S-05')
    await userEvent.keyboard(' ')
    await screen.findByRole('group', { name: /S-05/ })
    await waitFor(() => expect(document.querySelectorAll('[data-outline]')).toHaveLength(3))
  }

  it('draws the views’ outlines with their tags and the legend counting views', async () => {
    await openS05()
    const tags = [...document.querySelectorAll('[data-outline]')].map((el) => clean(el.getAttribute('aria-label')))
    expect(tags).toEqual(['Plan, 1:100', 'Detail, not to scale', 'Title block, not to scale'])
    // A view proposed out is still a Proposal until its sheet is confirmed (6.11).
    expect(bodyText()).toContain('Proposal 3 · Assigned 0 · Question 0 · Excluded 0')
  })

  it('steps through the views with → and ←, and Esc leaves the view before the sheet', async () => {
    await openS05()
    const pressed = () => document.querySelector('[data-outline][aria-pressed="true"]')?.getAttribute('data-outline') ?? null
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(pressed()).toBe('v1'))
    expect(inspector().querySelector('[data-view="v1"]')).toHaveAttribute('aria-current', 'true')
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(pressed()).toBe('v2'))
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(pressed()).toBe('v1'))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(pressed()).toBeNull())
    expect(screen.getByRole('group', { name: /S-05/ })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('group', { name: /S-05/ })).toBeNull())
  })

  it('offers the sheet picker from the sheet’s label and "List | Sheet" in the toolbar', async () => {
    await openS05()
    await userEvent.click(screen.getByRole('button', { name: /S-05.*1ST FLOOR BEAM LAYOUT/ }))
    const picker = await screen.findByRole('dialog', { name: 'Sheets, in list order' })
    await userEvent.click(within(picker).getByRole('button', { name: /A-02/ }))
    await screen.findByRole('group', { name: /A-02/ })
    expect(screen.getByRole('button', { name: 'Sheet' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true'))
    expect(document.activeElement?.getAttribute('data-row')).toBeTruthy()
  })
})

describe('M2: the files band and the Storeys and Views columns', () => {
  it('shows a chip per file above the header, and a click opens its report in the inspector', async () => {
    const { api } = kr01(['Nusrat Jahan'], [
      file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read', { sheets: 13 }), sheets_found: 13 }),
      file({ name: 'KR-STR-old.dwg', state: 'held', status: msg('drawings.files.held') }),
    ])
    await open(api)
    const band = await screen.findByRole('list', { name: /files/ })
    expect(clean(band.textContent)).toContain('✓ KR-STR-R0.dwg 13 sheets')
    expect(clean(band.textContent)).toContain('KR-STR-old.dwg held')
    const chips = within(band).getAllByRole('listitem')
    expect(chips.length).toBeGreaterThan(0)
    await userEvent.click(within(chips[0]!).getByRole('button'))
    const name = clean(within(chips[0]!).getByRole('button').querySelector('[data-notation="file-name"]')?.textContent)
    await waitFor(() => expect(clean(inspector().textContent)).toContain(name))
  })

  it('shows each row’s storeys with the strip and its number of views', async () => {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-06')!, {
      views: [
        { id: 'w1', ordinal: 1, kind: 'plan', title: '3RD, 5TH & 7TH FLOOR BEAM LAYOUT', stated_scale: '1:100', not_to_scale: false, storeys: ['floor_3', 'floor_5', 'floor_7'], storeys_as_stated: '3RD, 5TH & 7TH FLOOR', storeys_meaning: 'at_floor_level', steps: ['beams'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] },
        { id: 'w2', ordinal: 2, kind: 'title_block', title: 'TITLE BLOCK', stated_scale: '', not_to_scale: true, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: [], part: null, proposed_exclusion: 'for_information', decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] },
      ],
    })
    Object.assign(step1.proposals.find((p) => p.number === 'S-04')!, {
      views: [{ id: 'w3', ordinal: 1, kind: 'plan', title: 'PLAN', stated_scale: '', not_to_scale: false, storeys: ['floor_2', 'floor_3', 'floor_4', 'floor_5'], storeys_as_stated: '', storeys_meaning: 'floor_to_floor', steps: [], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] }],
    })
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, {
      views: [{ id: 'w4', ordinal: 1, kind: 'plan', title: 'PLAN', stated_scale: '', not_to_scale: false, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: [], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] }],
    })
    await open(api)
    expect(clean(rowOf('S-06').textContent)).toContain('3rd, 5th, 7th')
    expect(clean(within(rowOf('S-06')).getAllByRole('gridcell')[6]!.textContent)).toBe('2')
    expect(clean(rowOf('S-04').textContent)).toContain('2nd–5th')
    expect(clean(rowOf('S-05').textContent)).toContain('not stated')
    expect(rowOf('S-06').querySelector('[aria-hidden] > span')).not.toBeNull()
    expect(screen.getAllByRole('columnheader').map((h) => clean(h.textContent))).toEqual(expect.arrayContaining(['Views']))
  })
})

describe('M12: a title that states its storeys never reads "not stated" (as T-W318 amended it)', () => {
  it('shows a plan’s storeys taken from its sheet’s title "as titled", never fills a plan’s missing keys from text, and words a sheet with no plan by its title', async () => {
    const { api, step1 } = kr01()
    const plan = (id: string, storeys: string[], asStated = '', source: string | null = null) => ({ id, ordinal: 1, kind: 'plan', title: 'PLAN', stated_scale: '', not_to_scale: false, storeys, storeys_as_stated: asStated, storeys_meaning: storeys.length ? 'at_floor_level' : null, storeys_source: source, steps: [], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] })
    const section = { ...plan('m7', []), kind: 'section', title: 'SECTION' }
    Object.assign(step1.proposals.find((p) => p.number === 'S-06')!, { storeys_as_stated: '3RD, 5TH & 7TH FLOOR', views: [plan('m1', ['floor_3', 'floor_5', 'floor_7'], '3RD, 5TH & 7TH FLOOR', 'sheet_title')] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { storeys_as_stated: '', views: [plan('m2', [], '2ND  FLOOR')] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-04')!, { storeys_as_stated: 'TYPICAL FLOOR', views: [plan('m3', ['typical'], 'TYPICAL FLOOR', 'sheet_title')] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-03')!, { storeys_as_stated: '4TH FLOOR', views: [plan('m4', ['not_stated']), plan('m8', ['not_stated'])] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-02')!, { storeys_as_stated: 'EL. +16\'-6"', views: [plan('m5', ['not_stated'])] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-08')!, { storeys_as_stated: '6TH FLOOR TO ROOF', views: [plan('m6', ['floor_6', 'roof', 'top'], '6TH FLOOR TO ROOF', 'sheet_title')] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-01')!, { storeys_as_stated: '2ND & 9TH FLOOR', storeys_titled: ['floor_2', 'floor_9'], views: [section] })
    await open(api)
    expect(clean(rowOf('S-06').textContent)).toContain('3rd, 5th, 7th as titled')
    expect(clean(rowOf('S-06').textContent)).not.toContain('not stated')
    // The engine decided: a plan with no keys is "not stated", whatever text it carries.
    expect(clean(rowOf('S-05').textContent)).toContain('not stated')
    for (const [said, keys] of [
      ['2ND BASEMENT FLOOR', ['basement_2']],
      ['6TH FLOOR TO ROOF', ['floor_6', 'top', 'roof']],
      ['GROUND TO 5TH FLOOR', null],
      ['2ND TO 4TH FLOOR', ['floor_2', 'floor_3', 'floor_4']],
      ['GF', null],
      ['6TH TO 2ND FLOOR', null],
      ['2ND TO 5TH BASEMENT', null],
      ['3RD & 5TH FLOOR', ['floor_3', 'floor_5']],
    ] as const)
      expect(statedKeys(said), said).toEqual(keys)
    // A level is not a storey: amber "not stated" beside its Question (6.8), never the level as text.
    expect(clean(rowOf('S-02').textContent)).toContain('not stated')
    expect(clean(rowOf('S-02').textContent)).not.toContain('16')
    expect(clean(rowOf('S-08').textContent)).toContain('6th to Roof (floors between from Step 3) as titled')
    expect(clean(rowOf('S-04').textContent)).toContain('typical (range from Step 3)')
    // Two plans stating none stay "not stated", whatever the sheet's title states (the owner's ruling).
    expect(clean(rowOf('S-03').textContent)).toContain('not stated')
    expect(clean(rowOf('S-03').textContent)).not.toContain('4th')
    // No plan view: the title's storeys, from the API's keys, muted, as titled.
    expect(clean(rowOf('S-01').textContent)).toContain('2nd, 9th as titled')
  })
})

describe('M13: a Structural legend goes to Step 2, not to M3', () => {
  it('reads "2 Notes" for S-01’s legend and "Electrical, M3 onwards" only for an MEP Part', async () => {
    const { api, step1 } = kr01()
    const view = (id: string, part: string) => ({ id, ordinal: 1, kind: 'legend', title: 'LEGEND', stated_scale: '', not_to_scale: true, storeys: [], storeys_as_stated: '', storeys_meaning: null, steps: [], part, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-01')!, { views: [view('l1', 'structural')] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-02')!, { views: [view('l2', 'electrical')] })
    await open(api)
    const facts = () => clean(inspector().textContent)
    await focusRow('S-01')
    await waitFor(() => expect(facts()).toContain('Views (1)'))
    expect(facts()).toContain('2 Notes')
    expect(facts()).not.toContain('M3 onwards')
    await focusRow('S-02')
    await waitFor(() => expect(facts()).toContain('Electrical, M3 onwards'))
  })
})

describe('M15: a sheet a Question holds is not "one source"', () => {
  it('says "held by Question Q2" for S-07 and "held by Question Q4" for A-05', async () => {
    const { api } = kr01()
    await open(api)
    const facts = () => clean(inspector().textContent)
    await focusRow('S-07')
    await waitFor(() => expect(facts()).toContain('Sources'))
    expect(facts()).toMatch(/Sources ?held by Question Q2/)
    expect(facts()).not.toContain('one source')
    await focusRow('A-05')
    await waitFor(() => expect(facts()).toMatch(/Sources ?held by Question Q\d/))
    expect(facts()).not.toContain('one source')
  })
})

describe('M16: a click anywhere in a row focuses it', () => {
  it('opens the clicked sheet on Space after a click on its Discipline or Revision cell', async () => {
    const { api } = kr01()
    await open(api)
    for (const [number, cell] of [['S-05', 3], ['S-03', 4]] as const) {
      await userEvent.click(within(rowOf(number)).getAllByRole('gridcell')[cell]!.firstElementChild ?? within(rowOf(number)).getAllByRole('gridcell')[cell]!)
      await waitFor(() => expect(document.activeElement).toBe(rowOf(number)))
      await userEvent.keyboard(' ')
      await screen.findByRole('group', { name: new RegExp(number) })
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(document.activeElement).toBe(rowOf(number)))
    }
  })
})

describe('M17: Space goes back to the list from anywhere in the sheet', () => {
  async function inSheet(number: string) {
    const { api } = kr01()
    await open(api)
    await focusRow(number)
    await realKeys.keyboard(' ')
    await screen.findByRole('group', { name: new RegExp(number) })
  }
  const inCanvas = () => !!document.activeElement?.closest('[data-region="canvas"]')

  it('after F6 comes round to the canvas region, Space and the ? overlay both work', async () => {
    await inSheet('S-02')
    await realKeys.keyboard('{F6}')
    for (let i = 0; i < 8 && !inCanvas(); i++) await realKeys.keyboard('{F6}')
    expect(inCanvas()).toBe(true)
    await realKeys.keyboard('?')
    const overlay = await screen.findByRole('dialog')
    expect(clean(overlay.textContent)).toContain('Open the focused sheet, or go back to the list')
    await realKeys.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await realKeys.keyboard(' ')
    await waitFor(() => expect(screen.queryByRole('group', { name: /S-02/ })).toBeNull())
  })

  it('after the sheet picker closes, Space goes back to the list', async () => {
    await inSheet('S-02')
    await realKeys.keyboard('s')
    await screen.findByLabelText('Sheets, in list order')
    await realKeys.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByLabelText('Sheets, in list order')).toBeNull())
    expect(inCanvas()).toBe(true)
    await realKeys.keyboard(' ')
    await waitFor(() => expect(screen.queryByRole('group', { name: /S-02/ })).toBeNull())
  })
})

describe('6.2: the File column, from 1000 px', () => {
  it('names each row’s file at 1440 and is not shown at 1280', async () => {
    const { api, step1 } = kr01()
    const s05 = step1.proposals.find((p) => p.number === 'S-05')!
    await open(api)
    const headers = () => screen.getAllByRole('columnheader').map((h) => clean(h.textContent))
    expect(headers()).toContain('File')
    const cells = within(rowOf('S-05')).getAllByRole('gridcell').map((c) => clean(c.textContent))
    expect(cells[7]).toBe(s05.file_name)
    await page.viewport(1280, 800)
    await waitFor(() => expect(headers()).not.toContain('File'))
    expect(within(rowOf('S-05')).getAllByRole('gridcell').map((c) => clean(c.textContent))).not.toContain(s05.file_name)
  })
})

describe('the files band by keyboard', () => {
  it('reaches a file’s chip with Tab and opens its report with Enter', async () => {
    const { api } = kr01(['Nusrat Jahan'], [file({ name: 'KR-STR-R0.dwg', state: 'read', status: msg('drawings.files.read', { sheets: 13 }), sheets_found: 13 })])
    await open(api)
    const band = await screen.findByRole('list', { name: /files/ })
    ;(document.activeElement as HTMLElement | null)?.blur()
    for (let i = 0; i < 60 && !band.contains(document.activeElement); i++) await realKeys.keyboard('{Tab}')
    expect(band.contains(document.activeElement)).toBe(true)
    const name = clean(document.activeElement!.querySelector('[data-notation="file-name"]')?.textContent)
    await realKeys.keyboard('{Enter}')
    await waitFor(() => expect(clean(inspector().textContent)).toContain(name))
  })
})

describe('M18: each copy of S-07 opens as itself', () => {
  it('opens rev A from Q2’s Trace, the picker and [ ], labelled and described as rev A', async () => {
    const { api } = kr01()
    await open(api)
    await focusRow('S-07')
    const q2 = await screen.findByRole('region', { name: card('Q2') })
    await userEvent.click(within(q2).getByRole('button', { name: (n) => clean(n) === 'S-07 rev A' }))
    await screen.findByRole('group', { name: (n) => clean(n) === 'Sheet S-07 rev A' })
    const revision = () => clean([...inspector().querySelectorAll('dt')].find((d) => clean(d.textContent) === 'Revision')?.nextElementSibling?.textContent)
    await waitFor(() => expect(revision()).toMatch(/^A\b|rev A/))
    await realKeys.keyboard('[[')
    await screen.findByRole('group', { name: (n) => clean(n) === 'Sheet S-07 rev B' })
    await waitFor(() => expect(revision()).toMatch(/^B\b|rev B/))
    await realKeys.keyboard(']')
    await screen.findByRole('group', { name: (n) => clean(n) === 'Sheet S-07 rev A' })
    await realKeys.keyboard('[[')
    await screen.findByRole('group', { name: (n) => clean(n) === 'Sheet S-07 rev B' })
    await realKeys.keyboard('s')
    const picker = await screen.findByLabelText('Sheets, in list order')
    const items = within(picker).getAllByRole('button').filter((b) => /^S-07 ?rev A/.test(clean(b.textContent)))
    expect(items.length).toBeGreaterThan(0)
    await userEvent.click(items[0]!)
    await screen.findByRole('group', { name: (n) => clean(n) === 'Sheet S-07 rev A' })
  })
})

describe('M19: a copies row keeps its title and its count in right-to-left', () => {
  it('shows S-07’s title, cut only at its own end, and ", 2 copies" whole in en-XB at 1280', async () => {
    pseudoRtl()
    await page.viewport(1280, 800)
    const { api, step1 } = kr01()
    for (const p of step1.proposals.filter((p) => p.number === 'S-07')) p.title = 'TYPICAL FLOOR SLAB LAYOUT WITH TOP AND BOTTOM REINFORCEMENT DETAILS'
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(document.querySelector('[data-notation="sheet-number"]')).not.toBeNull())
    expectRtl()
    const row = await waitFor(() => rowOf('S-07'))
    const cell = within(row).getAllByRole('gridcell')[2]!
    const title = cell.querySelector('bdi')!
    const box = cell.getBoundingClientRect()
    const t = title.getBoundingClientRect()
    // The title's part the cell shows, not only its own box (the cell clipped it to "…").
    expect(Math.min(t.right, box.right) - Math.max(t.left, box.left)).toBeGreaterThan(60)
    const count = [...cell.querySelectorAll('span')].find((s) => /2/.test(s.textContent ?? '') && !s.contains(title))!
    const c = count.getBoundingClientRect()
    expect(c.width).toBeGreaterThan(0)
    expect(c.left).toBeGreaterThanOrEqual(box.left - 1)
    expect(c.right).toBeLessThanOrEqual(box.right + 1)
  })
})

describe('M21: the held file’s row names its file whole', () => {
  for (const rtl of [false, true])
    it(`shows the file name whole at 1280${rtl ? ' in en-XB' : ''}`, async () => {
      if (rtl) pseudoRtl()
      await page.viewport(1280, 800)
      const { api, step1 } = kr01()
      const held = step1.questions.find((q) => q.kind === 'file_misread')!.subject_id!
      new FakeDrawingSet(api, 'KR-01').files = [file({ id: held, name: 'KR-STR-old.dwg', state: 'held', status: msg('drawings.files.held') })]
      await mountApp(PATH, { as: PEOPLE.qs, api })
      const row = await waitFor(heldFileRow)
      if (rtl) expectRtl()
      const cell = within(row).getAllByRole('gridcell')[2]!
      const name = cell.querySelector<HTMLElement>('[data-notation="file-name"]')!
      expect(clean(name.textContent)).toMatch(/\.dwg$/)
      const n = name.getBoundingClientRect()
      const box = cell.getBoundingClientRect()
      expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1)
      expect(n.left).toBeGreaterThanOrEqual(box.left - 1)
      expect(n.right).toBeLessThanOrEqual(box.right + 1)
    })
})

/**
 * What a cut file name shows on screen, by layout (T1): each character of its head is measured with a
 * DOM Range and counts only if it ends before the head's edge less the ellipsis's width; the tail and
 * the extension always show. `stem` is the visible characters of the name without its extension.
 */
function shownName(name: HTMLElement): { text: string; stem: string } {
  const head = name.querySelector<HTMLElement>('[data-file-head]')!
  const text = head.firstChild as Text
  const edge = head.getBoundingClientRect().right
  const cut = head.scrollWidth > head.clientWidth + 0.5
  const context = document.createElement('canvas').getContext('2d')!
  context.font = getComputedStyle(head).font
  const ellipsis = cut ? context.measureText('…').width : 0
  let visible = ''
  for (let i = 0; i < text.length; i++) {
    const range = document.createRange()
    range.setStart(text, i)
    range.setEnd(text, i + 1)
    if (range.getBoundingClientRect().right > edge - ellipsis + 0.5) break
    visible += text.data[i]
  }
  const rest = clean([...name.children].filter((e) => e !== head).map((e) => e.textContent).join(''))
  const extension = /\.[^.]*$/.exec(rest)?.[0] ?? ''
  return { text: `${visible}${cut ? '…' : ''}${rest}`, stem: `${visible}${rest.slice(0, rest.length - extension.length)}` }
}

describe('T1: two held files sharing a long prefix', () => {
  const PREFIX = 'KADAM-RESIDENCE-STRUCTURAL-DRAWINGS-SET-02-ISSUED-FOR-CONSTRUCTION-AUG-2026'
  for (const width of [1280, 1024])
    it(`read apart by their ends when cut ("…-R0.dwg", "…-old.dwg") at ${width}`, async () => {
      await page.viewport(width, 800)
      const { api, step1 } = kr01()
      const first = step1.questions.find((q) => q.kind === 'file_misread')!
      const second = { ...first, id: 'c2200000-0000-4000-8000-0000000000f2', subject_id: 'c2200000-0000-4000-8000-0000000000f3' }
      step1.questions.splice(1, 0, second)
      new FakeDrawingSet(api, 'KR-01').files = [
        file({ id: first.subject_id!, name: `${PREFIX}-R0.dwg`, state: 'held', status: msg('drawings.files.held') }),
        file({ id: second.subject_id!, name: `${PREFIX}-old.dwg`, state: 'held', status: msg('drawings.files.held') }),
      ]
      await mountApp(PATH, { as: PEOPLE.qs, api })
      const names = await waitFor(() => {
        const found = [...document.querySelectorAll<HTMLElement>('[role="row"][data-row] [role="gridcell"]:nth-child(3) [data-notation="file-name"]')]
        expect(found).toHaveLength(2)
        return found
      })
      const shown = names.map((n) => shownName(n).text)
      expect(shown[0]).not.toBe(shown[1])
      for (const t of shown) expect(t).toMatch(/…/)
      expect(shown.some((t) => t.endsWith('-R0.dwg'))).toBe(true)
      expect(shown.some((t) => t.endsWith('-old.dwg'))).toBe(true)
    })
})

describe('F2: a long file name is cut in its middle and leaves the held reason its width (the review of 22, round 4)', () => {
  const LONG = 'KADAM-RESIDENCE-STRUCTURAL-DRAWINGS-SET-02-ISSUED-FOR-CONSTRUCTION-REVISED-AUG-2026-R0.dwg'
  for (const width of [1280, 1024])
  for (const rtl of [false, true])
    it(`keeps ".dwg", at least 8 characters of the name, the whole name in the text and the tooltip, and the reason visible, at ${width}${rtl ? ' in en-XB' : ''}`, async () => {
      expect(LONG.length).toBeGreaterThanOrEqual(80)
      if (rtl) pseudoRtl()
      await page.viewport(width, 800)
      const { api, step1 } = kr01()
      const held = step1.questions.find((q) => q.kind === 'file_misread')!.subject_id!
      new FakeDrawingSet(api, 'KR-01').files = [file({ id: held, name: LONG, state: 'held', status: msg('drawings.files.held') })]
      await mountApp(PATH, { as: PEOPLE.qs, api })
      const row = await waitFor(heldFileRow)
      if (rtl) expectRtl()
      const cell = within(row).getAllByRole('gridcell')[2]!
      const box = cell.getBoundingClientRect()
      const name = cell.querySelector<HTMLElement>('[data-notation="file-name"]')!
      // The whole name is what is read and what the tooltip shows.
      expect(clean(name.textContent)).toBe(LONG)
      expect(clean(name.getAttribute('title'))).toBe(LONG)
      // It lies inside its cell, cut: its extension shows whole.
      const n = name.getBoundingClientRect()
      expect(n.left).toBeGreaterThanOrEqual(box.left - 1)
      expect(n.right).toBeLessThanOrEqual(box.right + 1)
      const extension = [...name.querySelectorAll<HTMLElement>('span')].find((e) => clean(e.textContent).endsWith('.dwg') && !e.hasAttribute('data-file-head'))!
      expect(extension).toBeTruthy()
      const x = extension.getBoundingClientRect()
      expect(x.width).toBeGreaterThan(10)
      expect(x.left).toBeGreaterThanOrEqual(box.left - 1)
      expect(x.right).toBeLessThanOrEqual(box.right + 1)
      // The re-check of round 4 (T1): a name cut to its first letter ("K….dwg") cannot tell two held
      // files apart. Counted by layout: at least 8 of the stem's characters show, besides the ellipsis.
      const shown = shownName(name)
      expect(shown.stem.length, shown.text).toBeGreaterThanOrEqual(8)
      expect(shown.text).toMatch(/…[^…]*-R0\.dwg$/)
      // The held reason keeps a width, inside the cell.
      // The reason is the name's next sibling (in any language).
      const reason = name.nextElementSibling as HTMLElement
      expect(reason).toBeTruthy()
      expect(clean(reason.textContent).length).toBeGreaterThan(0)
      const r = reason.getBoundingClientRect()
      // The reason truncates first (the re-check of round 4): "Held: the tw…" still reads, in a cell
      // the 1280 and 1024 layouts both make 193 px wide.
      expect(r.width).toBeGreaterThanOrEqual(72)
      expect(r.left).toBeGreaterThanOrEqual(box.left - 0.5)
      expect(r.right).toBeLessThanOrEqual(box.right + 0.5)
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
    pseudoRtl()
    const { api, step1 } = kr01()
    step1.lists = {}
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(document.querySelector('[data-notation="sheet-number"]')).not.toBeNull())
    expectRtl()
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

describe('the words gate’s fixes', () => {
  const plan = (id: string, storeys: string[], meaning: string | null = 'at_floor_level') => ({ id, ordinal: 1, kind: 'plan', title: 'PLAN', stated_scale: '', not_to_scale: false, storeys, storeys_as_stated: '', storeys_meaning: meaning, steps: [], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] })

  it('words the engine’s not_stated and a run to the top, and never prints a key', async () => {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-04')!, { views: [plan('n1', ['not_stated'])] })
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { views: [plan('n2', ['floor_1', 'top'], 'floor_to_floor')] })
    await open(api)
    expect(clean(rowOf('S-04').textContent)).toContain('not stated')
    expect(clean(rowOf('S-04').textContent)).not.toContain('not_stated')
    expect(clean(rowOf('S-05').textContent)).toContain('1st to top (top from Step 3)')
    await focusRow('S-04')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Storeysnot stated'))
    expect(clean(inspector().textContent)).not.toContain('not stated, at floor level')
  })

  it('reads a run to the roof, a Plot that matched nothing and a Discipline with no PDF', async () => {
    const { api, step1 } = kr01(['Nusrat Jahan'], [
      file({ name: 'KR-STR-R0.pdf', state: 'read', status: msg('drawings.files.plot_matched', { matched: 0, pages: 13 }) }),
    ])
    Object.assign(step1.proposals.find((p) => p.number === 'S-04')!, { views: [plan('r1', ['floor_6', 'roof', 'top'])], plot_none: { code: 'drawings.sheets.plot_no_pdf', params: { discipline: 'Structural' } } })
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { views: [plan('r2', ['floor_6', 'roof', 'stair_room_roof', 'top'])] })
    await open(api)
    expect(clean(rowOf('S-04').textContent)).toContain('6th to Roof (floors between from Step 3)')
    expect(clean(rowOf('S-05').textContent)).toContain('6th to Roof (floors between from Step 3), Stair-room roof')
    const band = await screen.findByRole('list', { name: /files/ })
    expect(clean(band.textContent)).toContain('KR-STR-R0.pdf: no page matched a sheet')
    expect(clean(band.textContent)).not.toContain('✓')
    await focusRow('S-04')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('None: no PDF has been added for Structural'))
  })

  it('says why there is no Plot once, from the reason’s code', async () => {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-04')!, { plot_none: { code: 'drawings.sheets.plot_no_page', params: { plot_file: 'KR-STR-R0.pdf' } } })
    await open(api)
    await focusRow('S-04')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('None: no page of KR-STR-R0.pdf matched it'))
    expect(clean(inspector().textContent)).not.toMatch(/None: No Plot/)
  })

  it('names a Vextrus Engineer as such, and tells the MD only "→ walks them"', async () => {
    const { api, step1 } = kr01(['Nusrat Jahan', 'Rafiq Hasan'])
    step1.settleAllBut('electrical')
    for (const p of step1.proposals) if (p.decision) Object.assign(p, { decided_by: 'Arif Rahman', decided_by_role: 'vextrus_engineer', decided_with: 1 })
    await mountApp(PATH, { as: PEOPLE.md, api })
    await waitFor(() => expect(bodyText()).toContain('Nusrat Jahan and Rafiq Hasan (QS) confirm the sheet list; every act shows who did it.'))
    await focusRow('S-02')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Confirmed by Arif Rahman (Vextrus), 26 Sep 2026'))
    expect(clean(inspector().textContent)).toContain('Arif Rahman, Vextrus Engineer, 26 Sep 2026, 11:00')
    expect(clean(inspector().textContent)).not.toContain('X excludes')
  })
})

describe('the gate’s mays', () => {
  it('offers "Review one by one" beside the bulk act, and "Open S-02 Space" with a sheet focused', async () => {
    const { api } = kr01()
    await open(api)
    expect(screen.getByRole('button', { name: 'Review one by one' })).toBeInTheDocument()
    expect(document.title).toContain('Step 1, Sheets')
    await focusRow('S-02')
    const ghost = await screen.findByRole('button', { name: (n) => clean(n).startsWith('Open S-02') })
    expect(ghost).toHaveAttribute('aria-keyshortcuts', 'Space')
  })

  it('says "Nothing is waiting." in the inspector of a project with no sheets', async () => {
    const api = new FakeApi()
    new FakeStep1(api, 'SG-03', true)
    await mountApp('/p/SG-03/takeoff/1', { as: PEOPLE.qs, api })
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Nothing is waiting.'))
  })
})
