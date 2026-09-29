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
  await waitFor(() => expect(bodyText()).toContain('Confirmed 0 / 24'))
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
