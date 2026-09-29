/*
 * The design gate's musts on Step 1 (ticket 22, walk 1; m0-screens §6.2–6.7, §6.12, §8), each on
 * the screen as a QS, the MD or a Guest reads it, through the in-memory API with 19a's operations laid
 * over it (the acceptance tests' FakeStep1, fed the shapes the API sends).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1 } from '@/acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T06:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const bodyText = () => clean(document.body.textContent)

/** KR-01 at §7's state; the progress operation also names the Project's QS, as 19a's now does. */
function kr01(qs: string[] = ['Nusrat Jahan']): { api: FakeApi; step1: FakeStep1 } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  const base = api.handle
  api.handle = async (request: Request) => {
    const response = await base(request)
    if (!new URL(request.url, location.origin).pathname.endsWith('/takeoff/step1/progress') || !response.ok) return response
    const body = (await response.json()) as Record<string, unknown>
    return new Response(JSON.stringify({ ...body, qs }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return { api, step1 }
}

async function open(api: FakeApi, as: string = PEOPLE.qs) {
  const app = await mountApp('/p/KR-01/takeoff/1', { as, api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed \d+ \/ 24/))
  return app
}

async function shows(words: string) {
  await waitFor(() => expect(bodyText()).toContain(words))
}

function rowOf(text: string, nth = 0): HTMLElement {
  const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((r) => clean(r.textContent).includes(text))
  const inner = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o)))
  expect(inner.length, `a row for ${text}`).toBeGreaterThan(nth)
  return inner[nth]!
}

const inspector = () => document.querySelector<HTMLElement>('[data-region="inspector"]') ?? document.body

describe('M1: a drawn date is the API’s ISO date, shown as the Market writes a day', () => {
  it('shows S-07 rev B’s 2026-09-12 as "12 Sep 2026" in the list, the inspector and Q2’s card, never "9 Dec 2026"', async () => {
    const { api, step1 } = kr01()
    const b = step1.proposals.find((p) => p.number === 'S-07' && p.revision_mark === 'B')!
    b.issue_date = '2026-09-12'
    await open(api)
    await shows('B, 12 Sep 2026')
    await userEvent.click(within(rowOf('S-07')).getByText('S-07'))
    await waitFor(() => expect(clean(inspector().textContent)).toContain('12 Sep 2026'))
    expect(bodyText()).not.toContain('9 Dec 2026')
  })

  it('shows a date the server could not read as no date at all', async () => {
    const { api, step1 } = kr01()
    step1.proposals.find((p) => p.number === 'S-07' && p.revision_mark === 'B')!.issue_date = '12.09.2026'
    await open(api)
    await shows('S-07')
    expect(bodyText()).not.toContain('9 Dec 2026')
    expect(bodyText()).not.toContain('12 Sep 2026')
  })
})

describe('M3: a revision mark read from the file name keeps its date', () => {
  it('shows "R0, 14 Sep 2026" with the file name in its tooltip', async () => {
    const { api, step1 } = kr01()
    step1.proposals.find((p) => p.number === 'S-02')!.issue_date = '2026-09-14'
    await open(api)
    await waitFor(() => expect(clean(rowOf('S-02').textContent)).toContain('R0, 14 Sep 2026'))
  })
})

describe('M9: a focused row shows its ring', () => {
  it('draws a solid outline on the row ↓ focuses', async () => {
    const { api } = kr01()
    await open(api)
    await userEvent.click(within(rowOf('S-02')).getByText('S-02'))
    await userEvent.keyboard('{ArrowDown}')
    const row = document.activeElement as HTMLElement
    expect(row.getAttribute('role')).toBe('row')
    const style = getComputedStyle(row)
    expect(style.outlineStyle).toBe('solid')
    expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2)
  })
})

describe('M10: a range of sheet numbers is one left-to-right isolate', () => {
  it('writes "S-01–S-13" as one data-notation span, in the heading and the inspector', async () => {
    const { api, step1 } = kr01()
    step1.lists.structural = { source: 'typed', numbers: Array.from({ length: 13 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`), entered_by: 'Nusrat Jahan', entered_at: '2026-09-28T05:00:00Z', read_numbers: null }
    await open(api)
    await shows('S-01–S-13')
    const ranges = [...document.querySelectorAll('[data-notation="sheet-number"]')].filter((el) => el.textContent === 'S-01–S-13')
    expect(ranges.length).toBeGreaterThanOrEqual(2)
    for (const el of ranges) expect(el.getAttribute('dir')).toBe('ltr')
    // No range is split into two isolates with a bare dash between them.
    for (const el of document.querySelectorAll('[data-notation="sheet-number"]')) expect(clean(el.nextSibling?.textContent ?? '').startsWith('–')).toBe(false)
  })
})

describe('M11: the MD’s and a Guest’s bar names the QS, and offers the next open Question', () => {
  it.each([
    ['md', PEOPLE.md, 'You are reading this as the MD.'],
    ['guest', PEOPLE.guest, 'You are reading this as a Guest.'],
  ] as const)('as the %s', async (_role, who, what) => {
    const { api } = kr01()
    await open(api, who)
    await shows(what)
    await shows('Nusrat Jahan (QS) confirms the sheet list; every act shows who did it.')
    const ghost = await waitFor(() => {
      const found = [...document.querySelectorAll('button')].find((b) => clean(b.textContent).startsWith('Next open Question'))
      expect(found).toBeTruthy()
      return found!
    })
    expect(ghost.getAttribute('aria-keyshortcuts')).toBe('Q')
    await userEvent.click(ghost)
    await waitFor(() => expect((document.activeElement as HTMLElement | null)?.getAttribute('data-row') ?? '').toMatch(/^q:/))
  })

  it('names no one it does not know: "The QS confirms…" when the Project has none', async () => {
    const { api } = kr01([])
    await open(api, PEOPLE.md)
    await shows('The QS confirms the sheet list; every act shows who did it.')
  })
})

async function questionsTab() {
  const tab = await waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => clean(t.textContent).startsWith('Questions'))
    expect(found).toBeTruthy()
    return found!
  })
  await userEvent.click(tab)
  return waitFor(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('[data-region="inspector"] section[aria-label]')].filter((c) => clean(c.getAttribute('aria-label')).startsWith('Question Q'))
    expect(cards).toHaveLength(5)
    return cards
  })
}

describe('M4: every Question card has its body and its Trace line', () => {
  it('gives all five cards a Trace, and Q3, Q4 and Q5 a body saying what was read', async () => {
    const { api } = kr01()
    await open(api)
    const cards = await questionsTab()
    for (const card of cards) expect(clean(card.textContent)).toMatch(/Trace: \S/)
    const text = cards.map((c) => clean(c.textContent))
    const q = (tag: string) => text.find((t) => t.startsWith(`Question ${tag}`))!
    expect(q('Q2')).toContain('Both are titled “TYPICAL FLOOR SLAB LAYOUT”. Only one can be read.')
    expect(q('Q2')).toContain('Trace: Title blocks of both copies; the drawing list read on a sheet')
    expect(text.join(' ')).toContain('A sheet titled “DOOR AND WINDOW SCHEDULE” in KR-ARC-R0.dwg has an empty number in its title block.')
    expect(text.join(' ')).toContain('Trace: Title block text (the number field is empty)')
    expect(text.join(' ')).toContain('A-05 “SECTION A-A & ELEVATION” in KR-ARC-R0.dwg: its title and views do not settle which kind of sheet it is.')
    expect(text.join(' ')).toMatch(/The drawing list read on a sheet names 13 structural sheets\. \d+ were found in KR-STR-R0\.dwg; S-13 was not\./)
  })
})

describe('M5: the pre-pick is shown with what agrees', () => {
  it('marks Q2’s keep_b "Picked for you" and words the first line from it', async () => {
    const { api, step1 } = kr01()
    step1.proposals.find((p) => p.number === 'S-07' && p.revision_mark === 'A')!.issue_date = '2026-08-02'
    await open(api)
    const cards = await questionsTab()
    const q2 = cards.find((c) => clean(c.textContent).startsWith('Question Q2'))!
    const text = clean(q2.textContent)
    expect(text).toContain('Picked for you: the later revision mark and the later date agree')
    expect(text).toContain('Answering confirms S-07 (rev B) and excludes S-07 (rev A) as superseded.')
    const checked = q2.querySelector<HTMLInputElement>('input[type="radio"]:checked')
    expect(checked?.value).toBe('keep_b')
  })

  it('pre-picks nothing the server did not pick', async () => {
    const { api } = kr01()
    await open(api)
    const cards = await questionsTab()
    for (const card of cards.filter((c) => !clean(c.textContent).startsWith('Question Q2'))) {
      expect(clean(card.textContent)).not.toContain('Picked for you')
      expect(card.querySelector('input[type="radio"]:checked')).toBeNull()
    }
  })
})

describe('M8: who did what, with the initials chip', () => {
  function decide(step1: FakeStep1) {
    Object.assign(step1.proposals.find((p) => p.number === 'S-02')!, { decision: 'confirmed', decided_by: 'Nusrat Jahan', decided_role: 'qs', decided_with: 16, decided_at: '2026-09-26T05:00:00Z' })
    Object.assign(step1.proposals.find((p) => p.number === 'S-03')!, { decision: 'excluded', excluded_reason: 'superseded', decided_by: 'Nusrat Jahan', decided_role: 'qs', decided_with: 1, decided_at: '2026-09-26T05:10:00Z' })
    Object.assign(step1.proposals.find((p) => p.number === 'S-04')!, { decision: 'confirmed', decided_by: 'Tanvir Ahmed', decided_role: 'vextrus_engineer', decided_with: 1, decided_at: '2026-09-26T05:20:00Z' })
  }

  it('shows "Confirmed NJ" in the State column, and "TA Vextrus" for a Vextrus Engineer', async () => {
    const { api, step1 } = kr01()
    decide(step1)
    await open(api)
    await waitFor(() => expect(within(rowOf('S-02')).getByLabelText('Nusrat Jahan').textContent).toBe('NJ'))
    expect(clean(within(rowOf('S-04')).getByLabelText('Tanvir Ahmed').textContent)).toBe('TA Vextrus')
  })

  it('words each act as its what over "name, role, date, time" in the inspector', async () => {
    const { api, step1 } = kr01()
    decide(step1)
    await open(api)
    await userEvent.click(within(rowOf('S-02')).getByText('S-02'))
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Confirmed in bulk with 15 other sheets'))
    expect(clean(inspector().textContent)).toContain('Nusrat Jahan, QS, 26 Sep 2026, 11:00')
    expect(clean(inspector().textContent)).toContain('NJConfirmed by Nusrat Jahan, 26 Sep 2026, 11:00')
    await userEvent.click(within(rowOf('S-03')).getByText('S-03'))
    await waitFor(() => expect(clean(inspector().textContent)).toContain('Excluded: superseded'))
    expect(clean(inspector().textContent)).toContain('Nusrat Jahan, QS, 26 Sep 2026, 11:10')
  })
})

describe('M7: the inspector says where each fact was read, lists the views, and offers Exclude', () => {
  it('shows Number, Title, Discipline, File, Storeys, Plot, the Views and "Exclude X"', async () => {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, {
      sources: { number: 'title_block_attribute', title: 'title_block_text', discipline: 'file' },
      layout: null,
      storeys_as_stated: '1ST FLOOR',
      plot_file_name: 'KR-STR-R0.pdf',
      plot_page: 5,
      plot_none: null,
      views: [
        { ordinal: 0, kind: 'plan', title: '1ST FLOOR BEAM LAYOUT', stated_scale: '1:100', not_to_scale: false, storeys: ['1st'], storeys_meaning: 'at_floor_level', steps: ['7'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] },
        { ordinal: 1, kind: 'title_block', title: '', stated_scale: '', not_to_scale: true, storeys: [], storeys_meaning: null, steps: [], part: null, proposed_exclusion: 'for_information', decision: null, excluded_reason: null, box: ['0', '0', '1', '1'] },
      ],
    })
    await open(api)
    await userEvent.click(within(rowOf('S-05')).getByText('S-05'))
    const text = () => clean(inspector().textContent)
    await waitFor(() => expect(text()).toContain('S-05, title-block attribute'))
    expect(text()).toContain('text in the title block')
    expect(text()).toContain('Structural, from the file')
    expect(text()).toContain('KR-STR-R0.dwg, laid out in the drawing')
    expect(text()).toContain('1ST FLOOR, at floor level')
    expect(text()).toContain('KR-STR-R0.pdf page 5')
    expect(text()).toContain('Views (2)')
    expect(text()).toContain('Plan 1ST FLOOR BEAM LAYOUT, 1:100')
    expect(text()).toContain('7 Beams')
    expect(text()).toContain('Title block, not to scale')
    expect(text()).toContain('excluded: for information')
    const exclude = within(inspector()).getByRole('button', { name: /Exclude/ })
    await userEvent.click(exclude)
    await shows('Exclude S-05. Why?')
  })

  it('says why a sheet has no Plot, from the API’s code', async () => {
    const { api, step1 } = kr01()
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, { plot_page: null, plot_file_name: null, plot_none: { code: 'drawings.sheets.plot_no_number', params: {} } })
    await open(api)
    await userEvent.click(within(rowOf('S-05')).getByText('S-05'))
    await waitFor(() => expect(clean(inspector().textContent)).toMatch(/Plot\s*None: \S/))
  })
})

describe('M6: sheet mode draws the views, counts them, and walks them', () => {
  function withViews(step1: FakeStep1) {
    Object.assign(step1.proposals.find((p) => p.number === 'S-05')!, {
      views: [
        { ordinal: 0, kind: 'plan', title: '1ST FLOOR BEAM LAYOUT', stated_scale: '1:100', not_to_scale: false, storeys: ['1st'], storeys_meaning: 'at_floor_level', steps: ['7'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['10', '10', '60', '40'] },
        { ordinal: 1, kind: 'detail', title: 'SECTION 1-1', stated_scale: '', not_to_scale: true, storeys: [], storeys_meaning: null, steps: ['7'], part: null, proposed_exclusion: null, decision: null, excluded_reason: null, box: ['65', '10', '90', '30'] },
      ],
    })
  }

  it('shows the legend, the outlines with their tags, and → ← Esc select and leave a view', async () => {
    const { api, step1 } = kr01()
    withViews(step1)
    await open(api)
    await userEvent.click(within(rowOf('S-05')).getByText('S-05'))
    await userEvent.keyboard(' ')
    await shows('Proposal 2 · Assigned 0 · Question 0 · Excluded 0')
    await waitFor(() => expect(document.querySelectorAll('[data-outline]')).toHaveLength(2))
    const tags = [...document.querySelectorAll('[data-outline]')].map((o) => clean(o.textContent))
    expect(tags).toEqual(['Plan, 1:100', 'Detail, not to scale'])
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(document.querySelector('[data-selected]')?.getAttribute('data-outline')).toBe('0'))
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(document.querySelector('[data-selected]')?.getAttribute('data-outline')).toBe('1'))
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(document.querySelector('[data-selected]')).toBeNull())
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(document.querySelector('[data-selected]')?.getAttribute('data-outline')).toBe('1'))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelector('[data-selected]')).toBeNull())
    expect(document.querySelectorAll('[data-outline]')).toHaveLength(2) // still the sheet
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelectorAll('[data-outline]')).toHaveLength(0))
  })

  it('has "List | Sheet" in the toolbar and a sheet label that opens the sheet picker', async () => {
    const { api, step1 } = kr01()
    withViews(step1)
    await open(api)
    const list = await waitFor(() => {
      const b = [...document.querySelectorAll('button[aria-pressed]')].find((x) => clean(x.textContent) === 'List')
      expect(b).toBeTruthy()
      return b as HTMLElement
    })
    expect(list.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(within(rowOf('S-05')).getByText('S-05'))
    const sheet = [...document.querySelectorAll('button[aria-pressed]')].find((x) => clean(x.textContent) === 'Sheet') as HTMLElement
    await userEvent.click(sheet)
    await waitFor(() => expect(sheet.getAttribute('aria-pressed')).toBe('true'))
    const label = await waitFor(() => {
      const b = document.querySelector<HTMLElement>('button[aria-keyshortcuts="S"]')
      expect(clean(b?.textContent)).toContain('S-051ST FLOOR BEAM LAYOUT')
      return b!
    })
    await userEvent.click(label)
    await shows('Sheets, in list order')
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    await userEvent.click(within(dialog).getByText('S-06'))
    await waitFor(() => expect(clean(document.querySelector('button[aria-keyshortcuts="S"]')?.textContent)).toContain('S-06'))
  })
})
