/*
 * Ticket T-W324's acceptance tests on the mounted Step 1 screen (gh issue #324, G1 #1 findings f-16,
 * f-38 and f-12):
 * - the toolbar's Count and the open step rail's Step 1 count read N without the sheets the read proposed
 *   out with no number (the server's `_counted_sheet`, vextrus/takeoff/services/step1.py; m0-screens 4.7);
 * - the Coverage panel's reason block, which lists every view excluded or only proposed out (the server's
 *   `by_reason`), is titled "Excluded or proposed out, by reason" (m0-screens 6.11), beside a status line
 *   whose "k excluded" counts only the decided ones.
 *
 * Through ticket 22's in-memory fake (`../t22/step1.fixture.ts`, read only), its proposals and coverage
 * set by the test; its progress reply is answered server-shaped here (`found` counts only the sheets
 * `_counted_sheet` keeps). Every literal is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T05:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const PATH = '/p/KR-01/takeoff/1'

let serial = 0
function sheet(discipline: string | null, number: string | null, over: Partial<ProposalOut> = {}): ProposalOut {
  serial += 1
  const id = String(serial).padStart(12, '0')
  return {
    id: `a3240000-0000-4000-8000-${id}`,
    sheet_id: `b3240000-0000-4000-8000-${id}`,
    number,
    title: `SYNTH PLATE ${serial}`,
    revision_mark: 'R2',
    revision_mark_source: 'file_name',
    issue_date: '',
    discipline,
    file_id: 'd3240000-0000-4000-8000-000000000001',
    file_name: 'QX-SET-R2.dwg',
    kind: null,
    jev_pick: null,
    held: false,
    proposed_exclusion: null,
    decision: null,
    confirmed_kind: null,
    excluded_reason: null,
    excluded_text: '',
    decided_by: null,
    decided_at: null,
    agrees: true,
    ...over,
  }
}

/** The server's `_counted_sheet`: counted unless proposed out with no number and not confirmed in. */
const counted = (p: ProposalOut) => !(p.proposed_exclusion && !p.number) || p.decision === 'confirmed'

/** Structural 6 numbered, Architectural 4 numbered and an unnumbered cover, an unnumbered blank of no Discipline: 12 proposals, N = 10. */
function proposedOutSet(): ProposalOut[] {
  return [
    ...['ST-201', 'ST-202', 'ST-203', 'ST-204', 'ST-205', 'ST-206'].map((n) => sheet('structural', n)),
    ...['AR-501', 'AR-502', 'AR-503', 'AR-504'].map((n) => sheet('architectural', n)),
    sheet('architectural', null, { proposed_exclusion: 'cover_index' }),
    sheet(null, null, { proposed_exclusion: 'blank' }),
  ]
}

function project(coverage?: FakeStep1['coverage']) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  step1.proposals = proposedOutSet()
  step1.questions = []
  step1.lists = {}
  step1.notReceived = []
  step1.coverage = coverage ?? { views: 30, assigned: 0, excluded: 0, proposed: 30, unaccounted: 0, used: 0, by_step: {}, by_reason: {} }
  // The progress reply as the server sends it: one row per Discipline (no Discipline last), counted sheets only.
  const inner = api.handle
  api.handle = async (request: Request) => {
    const url = new URL(request.url, location.origin)
    if (request.method === 'GET' && url.pathname === `/api/projects/${step1.projectId}/takeoff/step1/progress`) {
      const kept = step1.proposals.filter(counted)
      const order = [...new Set(kept.map((p) => p.discipline))].sort((a, b) => (a === null ? 1 : b === null ? -1 : 0))
      const disciplines = order.map((d) => {
        const mine = kept.filter((p) => p.discipline === d)
        return { discipline: d, confirmed: mine.filter((p) => p.decision !== null).length, found: mine.length, listed: null, lists_disagree: false, total: mine.length, open_questions: 0, status: '', outstanding: [], plots: [] }
      })
      return new Response(JSON.stringify({ disciplines, not_received: [], qs: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return inner(request)
  }
  return { api, step1 }
}

const toolbar = () => clean(document.querySelector('[data-region="toolbar"]')?.textContent)

describe('the header counts what the Discipline rows count (#324, f-16 f-38; m0-screens 4.7)', () => {
  it('reads "Confirmed 0 / 10" in the toolbar and 10 in the open rail’s Step 1 count, without the two sheets proposed out with no number', async () => {
    const { api } = project()
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(toolbar()).toMatch(/Confirmed \d+ \/ \d+/))
    await waitFor(() => expect(toolbar()).toMatch(/Confirmed 0 \/ 10(?!\d)/))
    expect(toolbar(), 'nothing is excluded yet').not.toContain('excluded')
    await userEvent.click(screen.getByRole('button', { name: 'Open the step rail' }))
    const rail = document.querySelector('[data-region="rail"]')!
    const step1 = rail.querySelector('a[aria-current="page"]')
    expect(step1, 'Step 1 in the open rail').not.toBeNull()
    await waitFor(() => expect(clean(step1!.textContent)).toMatch(/0 \/ 10$/))
  })
})

describe('the Coverage panel says what its reason block counts (#324, f-12; m0-screens 6.11)', () => {
  it('titles the reason block "Excluded or proposed out, by reason", its rows in order, beside a status line of "3 excluded"', async () => {
    const { api } = project({ views: 58, assigned: 4, excluded: 3, proposed: 51, unaccounted: 0, used: 0, by_step: {}, by_reason: { for_information: 41, cover_index: 6 } })
    await mountApp(PATH, { as: PEOPLE.qs, api })
    const line = await waitFor(() => {
      const b = screen.getAllByRole('button').find((el) => clean(el.textContent).startsWith('Coverage '))
      expect(b, 'the status bar’s Coverage').toBeDefined()
      return b!
    })
    expect(clean(line.textContent)).toBe('Coverage 58 views: 4 assigned, 3 excluded, 51 proposed, 0 unaccounted')
    await userEvent.click(line)
    await screen.findByText('Coverage, every view on every sheet read')
    const title = await screen.findByText('Excluded or proposed out, by reason')
    const block = title.closest('section')!
    const rows = [...block.querySelectorAll('dl > div')].map((r) => `${clean(r.querySelector('dt')?.textContent)} ${clean(r.querySelector('dd')?.textContent)}`)
    expect(rows).toEqual(['for information 41', 'cover or index 6'])
    expect(screen.queryByText('Excluded, by reason'), 'the old title').toBeNull()
  })
})
