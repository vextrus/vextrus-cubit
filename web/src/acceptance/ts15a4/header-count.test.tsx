/*
 * Ticket S15-A4 (gh #545; walk #324's number_wrong): the server is the one source of every Step 1 count.
 * The toolbar's Count ("Confirmed n / N, k excluded"; m0-screens 4.7, 6.1) and the open step rail's
 * Step 1 count read the server's `count` in the progress reply (`{found, confirmed, excluded}`), and the
 * web derives no count of its own from the Proposals: no mirror of the server's rule (#444's
 * `countedSheet` is withdrawn).
 *
 * To tell a shown count from a derived one, the fake server's count differs from anything the Proposals
 * alone would give: 14 Proposals, every one numbered and none proposed out, of which the server counts
 * 10 found, 3 confirmed and 2 excluded (as if four of them were sheets the read could not count). A web
 * that counts the Proposals, by any rule, reads 14 or 4 or 3 and fails.
 *
 * Through ticket 22's in-memory fake (`../t22/step1.fixture.ts`, read only), its progress reply answered
 * here. Every literal is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    id: `a5a40000-0000-4000-8000-${id}`,
    sheet_id: `b5a40000-0000-4000-8000-${id}`,
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

/** The server's reply: its Discipline rows and its header count, which the web shows as sent. */
const PROGRESS = {
  disciplines: [
    { discipline: 'structural', confirmed: 5, found: 6, listed: null, lists_disagree: false, total: 6, open_questions: 0, status: 'in_review', outstanding: [], plots: [] },
    { discipline: 'architectural', confirmed: 0, found: 4, listed: null, lists_disagree: false, total: 4, open_questions: 0, status: 'in_review', outstanding: [], plots: [] },
  ],
  count: { found: 10, confirmed: 3, excluded: 2 },
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

const toolbar = () => clean(document.querySelector('[data-region="toolbar"]')?.textContent)

describe('Step 1 shows the server’s count and derives none (S15-A4; m0-screens 4.7, 6.1)', () => {
  it('reads "Confirmed 3 / 10, 2 excluded" in the toolbar, the server’s count, not one counted from the 14 Proposals', async () => {
    const { api } = project()
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(toolbar()).toMatch(/Confirmed \d+ \/ \d+/))
    await waitFor(() => expect(toolbar()).toMatch(/Confirmed 3 \/ 10, 2 excluded(?!\d)/))
  })

  it('reads the same 3 / 10 as the Step 1 count in the open step rail', async () => {
    const { api } = project()
    await mountApp(PATH, { as: PEOPLE.qs, api })
    await waitFor(() => expect(toolbar()).toMatch(/Confirmed \d+ \/ \d+/))
    await userEvent.click(screen.getByRole('button', { name: 'Open the step rail' }))
    const rail = document.querySelector('[data-region="rail"]')!
    const step1 = rail.querySelector('a[aria-current="page"]')
    expect(step1, 'Step 1 in the open rail').not.toBeNull()
    await waitFor(() => expect(clean(step1!.textContent)).toMatch(/3 \/ 10$/))
  })
})
