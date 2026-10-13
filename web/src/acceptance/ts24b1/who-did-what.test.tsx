/*
 * S24-B1 (M0-FL10 and FL8; issues #314, #678, #689 item 1; PR #706's design-gate walk, defects 2 and 3):
 * the inspector's "Who did what" lists every act on the sheet from the event log, oldest first, under its
 * actor; a typed value's provenance names the person; the not_listed Question has its own evidence.
 *
 * docs/design/m0-screens.md §6.6 item 5: "Who did what: every act on the sheet, oldest first, each "what"
 * over "name, role, time" with the initials chip: … "Excluded: for information"; "Confirmed back in: … /
 * Tanvir Ahmed, Vextrus Engineer, 26 Sep 2026, 11:20". None yet: "Proposed by Vextrus from the file; no one
 * has acted on it yet."" §6.9: ""Who did what" records "Corrected: number — → S-12; title; …"". §6.12:
 * the MD and a Guest see every act ("every act shows who did it"). #689 item 1 (the design gate's words):
 * "corrected by <name>; read <old> from the title-block attribute". §5's table (drawing list against
 * sheets): a sheet in a file but not on the list has its own option, "Not part of this set: record it,
 * then exclude it in the list".
 *
 * Named by the acceptance writer (the builder meets them; the API side is pinned in
 * vextrus/takeoff/tests/acceptance/ts24b1/history.py): the screen reads a sheet's acts from
 * `GET …/takeoff/step1/proposals/{proposal id}/history`, `{ acts: [{ code, actor, actor_role, at, … }] }`
 * oldest first; an excluded act carries `reason`, a confirmed act `sheets`, a corrected act
 * `changes: { number?: { old, new, old_source }, title?: { … } }`. A corrected Proposal carries
 * `corrected: true` and `number_source: 'typed'` (PR #706).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
const PATH = '/p/KR-01/takeoff/1'

interface Act {
  code: string
  actor: string
  actor_role: string
  at: string
  sheets?: number
  reason?: string
  text?: string
  changes?: Record<string, { old: string; new: string; old_source: string | null }>
}

const NUSRAT = { actor: 'Nusrat Jahan', actor_role: 'qs' }
const ARIF = { actor: 'Arif Rahman', actor_role: 'vextrus_engineer' }

/** KR-01's acceptance fake, each sheet's history answered from `acts` (by Proposal id; none: no acts). */
function kr01(): { api: FakeApi; step1: FakeStep1; acts: Map<string, Act[]>; asked: string[] } {
  const api = new FakeApi()
  const step1 = new FakeStep1(api)
  const acts = new Map<string, Act[]>()
  const asked: string[] = []
  const handle = api.handle
  api.handle = async (request: Request) => {
    const path = new URL(request.url, location.origin).pathname
    const hit = /\/takeoff\/step1\/proposals\/([^/]+)\/history$/.exec(path)
    if (request.method === 'GET' && hit && path.startsWith(`/api/projects/${step1.projectId}/`)) {
      const id = decodeURIComponent(hit[1]!)
      asked.push(id)
      if (!step1.proposals.some((p) => p.id === id)) return new Response(JSON.stringify({ code: 'platform.auth.not_found', params: {} }), { status: 404, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ acts: acts.get(id) ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return handle(request)
  }
  return { api, step1, acts, asked }
}

const sheetOf = (step1: FakeStep1, number: string) => step1.proposals.find((p) => p.number === number)!

async function open(api: FakeApi, as: string = PEOPLE.qs) {
  await mountApp(PATH, { as, api })
  await waitFor(() => expect(bodyText()).toMatch(/Confirmed \d+ \/ 24/))
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

/** The text of the inspector's "Who did what" block (its heading's section). */
function whoDidWhat(): string {
  const heading = within(inspector()).getByText('Who did what')
  return clean((heading.closest('section') ?? heading.parentElement)?.textContent)
}

/** Each of `words` in the text, in this order. */
function inOrder(text: string, words: string[]) {
  let from = 0
  for (const w of words) {
    const at = text.indexOf(w, from)
    expect(at, `"${w}" after position ${from} in: ${text}`).toBeGreaterThanOrEqual(0)
    from = at + w.length
  }
}

const count = (text: string, word: string) => text.split(word).length - 1

/** S-04 excluded "for information" by Nusrat, then confirmed back in by Arif (the Vextrus Engineer). */
function excludedThenBackIn() {
  const kr = kr01()
  const s04 = sheetOf(kr.step1, 'S-04')
  Object.assign(s04, { decision: 'confirmed', decided_by: 'Arif Rahman', decided_by_role: 'vextrus_engineer', decided_at: '2026-09-26T05:20:00Z', decided_with: 1 })
  kr.acts.set(s04.id, [
    { code: 'takeoff.step1.excluded', ...NUSRAT, at: '2026-09-26T04:00:00Z', sheets: 1, reason: 'for_information', text: '' },
    { code: 'takeoff.step1.confirmed_back_in', ...ARIF, at: '2026-09-26T05:20:00Z', sheets: 1 },
  ])
  return kr
}

describe('Who did what lists every act, oldest first (§6.6 item 5, #314)', () => {
  it('shows "Excluded: for information" and then "Confirmed back in", each under its actor, role and date', async () => {
    const { api } = excludedThenBackIn()
    await open(api)
    await focusRow('S-04')
    await waitFor(() => expect(whoDidWhat()).toContain('Confirmed back in'))
    inOrder(whoDidWhat(), ['Excluded: for information', 'Nusrat Jahan, QS, 26 Sep 2026', 'Confirmed back in', 'Arif Rahman, Vextrus Engineer, 26 Sep 2026'])
  })

  for (const [who, as] of [
    ['the MD', PEOPLE.md],
    ['a Guest', PEOPLE.guest],
  ] as const) {
    it(`shows ${who} every act on the sheet (§6.12)`, async () => {
      const { api } = excludedThenBackIn()
      await open(api, as)
      await focusRow('S-04')
      await waitFor(() => expect(whoDidWhat()).toContain('Confirmed back in'))
      inOrder(whoDidWhat(), ['Excluded: for information', 'Nusrat Jahan', 'Confirmed back in', 'Arif Rahman'])
    })
  }

  it('keeps "Confirmed in bulk with 2 other sheets" listed before the exclusion that followed it', async () => {
    const { api, step1, acts } = kr01()
    const s03 = sheetOf(step1, 'S-03')
    Object.assign(s03, { decision: 'excluded', excluded_reason: 'superseded', decided_by: 'Nusrat Jahan', decided_by_role: 'qs', decided_at: '2026-09-26T05:00:00Z', decided_with: 1 })
    acts.set(s03.id, [
      { code: 'takeoff.step1.confirmed', ...NUSRAT, at: '2026-09-26T04:42:00Z', sheets: 3 },
      { code: 'takeoff.step1.excluded', ...NUSRAT, at: '2026-09-26T05:00:00Z', sheets: 1, reason: 'superseded', text: '' },
    ])
    await open(api)
    await focusRow('S-03')
    await waitFor(() => expect(whoDidWhat()).toContain('Confirmed in bulk with 2 other sheets'))
    inOrder(whoDidWhat(), ['Confirmed in bulk with 2 other sheets', 'Nusrat Jahan, QS, 26 Sep 2026', 'Excluded: superseded', 'Nusrat Jahan, QS, 26 Sep 2026'])
  })
})

describe('Who did what records each correction (§6.9, #678)', () => {
  it('lists a sheet two people corrected as two corrections, and no longer says no one has acted on it', async () => {
    const { api, step1, acts } = kr01()
    const s04 = sheetOf(step1, 'S-04')
    Object.assign(s04, { title: 'Ground floor beams', title_source: 'typed', corrected: true })
    acts.set(s04.id, [
      { code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { title: { old: 'GROUND FLOOR BEAM LAYOUT', new: 'Ground beam layout', old_source: 'title_block_attribute' } } },
      { code: 'takeoff.step1.corrected', ...ARIF, at: '2026-09-27T05:00:00Z', sheets: 1, changes: { title: { old: 'Ground beam layout', new: 'Ground floor beams', old_source: 'typed' } } },
    ])
    await open(api)
    await focusRow('S-04')
    await waitFor(() => expect(count(whoDidWhat(), 'Corrected:')).toBe(2))
    expect(whoDidWhat()).not.toContain('no one has acted on it yet')
    inOrder(whoDidWhat(), ['Corrected: title', 'Nusrat Jahan, QS, 27 Sep 2026', 'Corrected: title', 'Arif Rahman, Vextrus Engineer, 27 Sep 2026'])
  })

  it('words a number correction "Corrected: number S-05 → S-51"', async () => {
    const { api, step1, acts } = kr01()
    const s05 = sheetOf(step1, 'S-05')
    Object.assign(s05, { number: 'S-51', number_source: 'typed', corrected: true })
    acts.set(s05.id, [{ code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { number: { old: 'S-05', new: 'S-51', old_source: 'title_block_attribute' } } }])
    await open(api)
    await focusRow('S-51')
    await waitFor(() => expect(whoDidWhat()).toContain('Corrected: number S-05 → S-51'))
    inOrder(whoDidWhat(), ['Corrected: number S-05 → S-51', 'Nusrat Jahan, QS, 27 Sep 2026'])
  })

  it('keeps an undone correction listed, followed by its undo', async () => {
    const { api, step1, acts } = kr01()
    const s05 = sheetOf(step1, 'S-05')
    acts.set(s05.id, [
      { code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { number: { old: 'S-05', new: 'S-51', old_source: 'title_block_attribute' } } },
      { code: 'takeoff.step1.undone', ...NUSRAT, at: '2026-09-27T04:05:00Z', sheets: 1 },
    ])
    await open(api)
    await focusRow('S-05')
    await waitFor(() => expect(whoDidWhat()).toContain('Corrected: number S-05 → S-51'))
    inOrder(whoDidWhat(), ['Corrected: number S-05 → S-51', 'Undone'])
    expect(whoDidWhat()).not.toContain('no one has acted on it yet')
  })

  it('asks the sheet’s history and, with no acts, says "Proposed by Vextrus from the file; no one has acted on it yet."', async () => {
    const { api, step1, asked } = kr01()
    await open(api)
    await focusRow('S-06')
    await waitFor(() => expect(asked).toContain(sheetOf(step1, 'S-06').id))
    await waitFor(() => expect(whoDidWhat()).toContain('Proposed by Vextrus from the file; no one has acted on it yet.'))
  })
})

describe('a typed value names the person (#689 item 1)', () => {
  it('reads "corrected by Nusrat Jahan; read S-05 from the title-block attribute" for a corrected number', async () => {
    const { api, step1, acts } = kr01()
    const s05 = sheetOf(step1, 'S-05')
    Object.assign(s05, { number: 'S-51', number_source: 'typed', title_source: 'title_block_attribute', corrected: true })
    acts.set(s05.id, [{ code: 'takeoff.step1.corrected', ...NUSRAT, at: '2026-09-27T04:00:00Z', sheets: 1, changes: { number: { old: 'S-05', new: 'S-51', old_source: 'title_block_attribute' } } }])
    await open(api)
    await focusRow('S-51')
    await waitFor(() => expect(clean(inspector().textContent)).toContain('corrected by Nusrat Jahan; read S-05 from the title-block attribute'))
    expect(clean(inspector().textContent)).not.toContain('S-51 title-block attribute')
  })
})

describe('the not_listed Question has its own evidence (PR #706 walk, defect 2)', () => {
  it('does not say a number that is in a file is in no file', async () => {
    const { api, step1 } = kr01()
    const s02 = sheetOf(step1, 'S-02')
    Object.assign(s02, { number: 'S-02A', number_source: 'typed', corrected: true, agrees: false })
    step1.questions.push({
      id: 'c2240000-0000-4000-8000-000000000001',
      kind: 'check',
      status: 'open',
      code: 'engine.register_check.not_listed',
      params: { number: 'S-02A' },
      options: [
        { key: 'not_in_set', picked: false },
        { key: 'keep_open', picked: false },
      ],
      discipline: 'structural',
      subject_id: s02.sheet_id,
      check_code: 'register',
      answer: null,
      answered_at: null,
    })
    await open(api)
    await userEvent.click(screen.getByRole('tab', { name: /Questions/ }))
    const cards = await screen.findAllByRole('region', { name: (name: string) => /^Question Q\d+$/.test(clean(name)) })
    const mine = cards.filter((c) => clean(c.textContent).includes('S-02A') && clean(c.textContent).includes('Not part of this set: record it, then exclude it in the list'))
    expect(mine, 'one card for S-02A with the not_listed option').toHaveLength(1)
    expect(clean(mine[0]!.textContent)).not.toContain('no file added has a sheet with that number')
  })
})
