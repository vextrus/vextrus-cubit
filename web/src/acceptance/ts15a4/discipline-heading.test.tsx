/*
 * Ticket S15-A4, f-11 (gh #322): each Discipline's heading shows the server's numbers, its "N found"
 * and its "n / N settled" (m0-screens 6.3), and the web counts neither from the Proposals: so excluding
 * a sheet, or confirming it back in, moves them only as the server's row moves.
 *
 * The fake server's Structural row says 6 found, 4 settled, of 8 Proposals of which 5 are decided: a web
 * that counts the Proposals reads 8 or 5 and fails. Through ticket 22's in-memory fake
 * (`../t22/step1.fixture.ts`, read only). Every literal is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '../t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T05:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
const PATH = '/p/KR-01/takeoff/1'
const QS = { decided_by: 'Rumana Q', decided_at: '2026-10-05T04:00:00Z' }

let serial = 0
function sheet(discipline: string, number: string, over: Partial<ProposalOut> = {}): ProposalOut {
  serial += 1
  const id = String(serial).padStart(12, '0')
  return {
    id: `a5a41000-0000-4000-8000-${id}`,
    sheet_id: `b5a41000-0000-4000-8000-${id}`,
    number,
    title: `SYNTH PLATE ${serial}`,
    revision_mark: 'R4',
    revision_mark_source: 'file_name',
    issue_date: '',
    discipline,
    file_id: 'd5a40000-0000-4000-8000-000000000001',
    file_name: 'QX-SET-R4.dwg',
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

/** Structural 8 (3 confirmed, 2 excluded), Architectural 6: 14 Proposals, all numbered, none proposed out. */
function set(): ProposalOut[] {
  return [
    ...['S-31', 'S-32', 'S-33'].map((n) => sheet('structural', n, { decision: 'confirmed', ...QS })),
    ...['S-34', 'S-35'].map((n) => sheet('structural', n, { decision: 'excluded', excluded_reason: 'superseded', ...QS })),
    ...['S-36', 'S-37', 'S-38'].map((n) => sheet('structural', n)),
    ...['A-61', 'A-62', 'A-63', 'A-64', 'A-65', 'A-66'].map((n) => sheet('architectural', n)),
  ]
}

/** The server's reply: its Discipline rows and its header count, which the web shows as sent (Structural: 4 of 6 settled). */
const PROGRESS = {
  disciplines: [
    { discipline: 'structural', confirmed: 4, found: 6, listed: null, lists_disagree: false, total: 6, open_questions: 0, status: 'in_review', outstanding: [], plots: [] },
    { discipline: 'architectural', confirmed: 0, found: 4, listed: null, lists_disagree: false, total: 4, open_questions: 0, status: 'in_review', outstanding: [], plots: [] },
  ],
  count: { found: 10, confirmed: 3, excluded: 1 },
  not_received: [],
  qs: [],
}

function project() {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  step1.proposals = set()
  step1.questions = []
  step1.lists = {}
  step1.notReceived = []
  step1.coverage = { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {} }
  const inner = api.handle
  api.handle = async (request: Request) => {
    const url = new URL(request.url, location.origin)
    if (request.method === 'GET' && url.pathname === `/api/projects/${step1.projectId}/takeoff/step1/progress`) {
      return new Response(JSON.stringify(PROGRESS), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return inner(request)
  }
  return { api, step1 }
}

const text = () => clean(document.querySelector('main')?.textContent ?? document.body.textContent)

describe('each Discipline heading shows the server’s N found and n / N settled (S15-A4 f-11; m0-screens 6.3)', () => {
  it('reads "Structural 6 found" and "4 / 6 settled", the server’s row, not counts of the 8 Structural Proposals', async () => {
    const { api } = project()
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(text()).toMatch(/Structural \d+ found/))
    expect(text()).toMatch(/Structural 6 found(?!\d)/)
    await waitFor(() => expect(text()).toMatch(/(?<!\d)4 \/ 6 settled/))
    expect(text()).toMatch(/(?<!\d)0 \/ 4 settled/)
  })
})
