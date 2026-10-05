/*
 * Nothing says Step 1 is confirmed while a sheet waits on the QS (PR #444 review, round 1): N leaves out a
 * blank the read proposed out with no number (the server's `_counted_sheet`), but until the QS decides it
 * the rail's Step 1 mark, the toolbar's ✓ and the inspector's Discipline line all read open; once it is
 * decided all three read confirmed. Every number and title here is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { page } from 'vitest/browser'
import { FakeApi, PEOPLE, mountApp } from '@/app/testing'
import { FakeStep1, type ProposalOut } from '../acceptance/t22/step1.fixture'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T07:00:00Z'))
  await page.viewport(1440, 900)
})

afterEach(() => {
  vi.useRealTimers()
})

const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()

let serial = 0
function sheet(number: string | null, over: Partial<ProposalOut> = {}): ProposalOut {
  serial += 1
  const id = String(serial).padStart(12, '0')
  return {
    id: `c4440000-0000-4000-8000-${id}`,
    sheet_id: `d4440000-0000-4000-8000-${id}`,
    number,
    title: `MOCK LEAF ${serial}`,
    revision_mark: 'R5',
    revision_mark_source: 'file_name',
    issue_date: '',
    discipline: 'structural',
    file_id: 'e4440000-0000-4000-8000-000000000001',
    file_name: 'ZQ-STR-R5.dwg',
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

const QS = { decided_by: 'Tahmid K', decided_at: '2026-10-04T03:00:00Z' }
const counted = (p: ProposalOut) => !(p.proposed_exclusion && !p.number) || p.decision === 'confirmed'

/** Two numbered sheets confirmed, and an unnumbered blank proposed out: undecided, or excluded by the QS. */
function project(blankDecided: boolean) {
  const api = new FakeApi()
  const step1 = new FakeStep1(api, 'KR-01')
  step1.proposals = [
    sheet('SX-71', { decision: 'confirmed', ...QS }),
    sheet('SX-72', { decision: 'confirmed', ...QS }),
    sheet(null, { proposed_exclusion: 'blank', ...(blankDecided ? { decision: 'excluded', excluded_reason: 'blank', ...QS } : {}) }),
  ]
  step1.questions = []
  step1.lists = {}
  step1.notReceived = []
  step1.coverage = { views: 6, assigned: 4, excluded: 2, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {} }
  // The server's progress reply: counted sheets only.
  const inner = api.handle
  api.handle = async (request: Request) => {
    const url = new URL(request.url, location.origin)
    if (request.method === 'GET' && url.pathname === `/api/projects/${step1.projectId}/takeoff/step1/progress`) {
      const kept = step1.proposals.filter(counted)
      const disciplines = [{ discipline: 'structural', confirmed: kept.filter((p) => p.decision !== null).length, found: kept.length, listed: null, lists_disagree: false, total: kept.length, open_questions: 0, status: '', outstanding: [], plots: [] }]
      return new Response(JSON.stringify({ disciplines, not_received: [], qs: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return inner(request)
  }
  return api
}

const toolbar = () => document.querySelector('[data-region="toolbar"]')!
const railMark = () => document.querySelector('[data-region="rail"] a[aria-current="page"] svg[role="img"]')?.getAttribute('aria-label')
const parts = () => clean(document.querySelector('[data-region="inspector"]')?.textContent).match(/Structural (confirmed|\d+ \/ \d+ settled|\d+ to confirm)/)?.[0]
const tick = () => toolbar().querySelector('svg.text-confirmed')

describe('Step 1 reads confirmed only when no sheet waits, counted or not (#444 round 1)', () => {
  it('keeps the rail, the toolbar and the inspector open while an unnumbered blank is undecided', async () => {
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: project(false) })
    await waitFor(() => expect(clean(toolbar().textContent)).toMatch(/Confirmed 2 \/ 2(?!\d)/))
    await waitFor(() => expect(railMark()).toBe('Proposals ready'))
    expect(tick(), 'no ✓ beside the Count').toBeNull()
    await waitFor(() => expect(parts(), 'the inspector’s Discipline line').toBeTruthy())
    expect(parts()).not.toMatch(/Structural confirmed/)
  })

  it('reads confirmed in all three once the QS has decided the blank', async () => {
    await mountApp('/p/KR-01/takeoff/1', { as: PEOPLE.qs, api: project(true) })
    await waitFor(() => expect(clean(toolbar().textContent)).toMatch(/Confirmed 2 \/ 2(?!\d)/))
    await waitFor(() => expect(railMark()).toBe('Confirmed'))
    expect(tick(), 'the ✓ beside the Count').not.toBeNull()
    await waitFor(() => expect(parts()).toMatch(/Structural confirmed/))
  })
})
