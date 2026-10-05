/*
 * T-W322's invented Sheets and Questions (issue #322; #321 and #334's web words). Every number, title,
 * mark, date and file name here is made up for its shape only: two Sheets of one number and two
 * titles, a title on many numbers, a same-storey pair, a read-anyway file's held Sheets, a continuation
 * the server groups (`continuation`, `continuation_title`) and a series it names (`series`).
 *
 * Shapes are 22's fake's (`../t22/step1.fixture.ts`) with 21c's Question fields (`proposals`,
 * `withdrawn_by`, `blocking`) and T-W334's three optional Proposal fields, which the server does not
 * send yet: the fake sends them as given, and an older server's Proposal simply lacks them.
 */
import type { FakeApi } from '@/app/seed/api.fixture'
import type { FakeStep1, ProposalOut as FakeProposal, QuestionOut as FakeQuestion } from '../t22/step1.fixture'

/** A Proposal as 21c and T-W334 send it (the generated type's fields, and the three T-W334 adds). */
export type Proposal = FakeProposal & {
  decided_act: string | null
  decided_by_role: string | null
  decided_with: number
  number_source: string
  title_source: string
  storeys_as_stated: string
  layout: string | null
  plot_file: string | null
  plot_page: number | null
  plot_residual: number | null
  plot_none: string | null
  views: unknown[]
  continuation?: string | null
  continuation_title?: string | null
  series?: string | null
}

export type Question = FakeQuestion & { proposals: string[]; withdrawn_by: string | null; blocking: boolean }

let serial = 0
const uuid = (block: string) => `${block}-0000-4000-8000-${String(++serial).padStart(12, '0')}`

export const FILE = { id: 'f3220000-0000-4000-8000-000000000001', name: 'QV-ARC-R3.dwg' }
export const HELD_FILE = { id: 'f3220000-0000-4000-8000-000000000002', name: 'QV-ARC-ANNEX-R1.dwg' }

/** One invented architectural Sheet, undecided, agreeing, not held, unless `over` says otherwise. */
export function sheet(number: string | null, title: string, over: Partial<Proposal> = {}): Proposal {
  return {
    id: uuid('a3220000'),
    sheet_id: uuid('b3220000'),
    number,
    title,
    revision_mark: 'R0',
    revision_mark_source: 'title_block',
    issue_date: '',
    discipline: 'architectural',
    file_id: FILE.id,
    file_name: FILE.name,
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
    decided_act: null,
    agrees: true,
    decided_by_role: null,
    decided_with: 0,
    number_source: 'title_block_attribute',
    title_source: 'title_block_attribute',
    storeys_as_stated: '',
    layout: null,
    plot_file: null,
    plot_page: null,
    plot_residual: null,
    plot_none: null,
    views: [],
    ...over,
  }
}

/** The options 21c raises each conflict with (m0-screens §5; `proposals.py`), `picked` as given. */
export const CONFLICT_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  'engine.conflicts.same_number': ['keep_latest', 'keep_all', 'keep_open'],
  'engine.conflicts.same_title': ['keep_all', 'keep_open'],
  'engine.conflicts.same_storey': ['keep_all', 'keep_open'],
}

/** An open conflict Question holding `holds` (listed by Proposal id, as 21c lists them). */
export function conflict(code: string, params: Record<string, unknown>, holds: readonly Proposal[], over: Partial<Question> = {}): Question {
  const picked = over.options ? null : code === 'engine.conflicts.same_number' ? 'keep_latest' : null
  return {
    id: uuid('c3220000'),
    kind: 'conflict',
    status: 'open',
    code,
    params,
    options: (CONFLICT_OPTIONS[code] ?? ['keep_open']).map((key) => ({ key, picked: key === picked })),
    discipline: 'architectural',
    subject_id: holds[0]?.sheet_id ?? null,
    check_code: null,
    answer: null,
    answered_at: null,
    proposals: holds.map((p) => p.id),
    withdrawn_by: null,
    blocking: true,
    ...over,
  }
}

// The scenes ---------------------------------------------------------------------------------------

/** Two Sheets of one number, titled apart (the later, R2, dated after the other). */
export const SPLIT_TITLES = ['LOUVRE SCREEN ELEVATIONS (LS-1 TO LS-3)', 'LOUVRE SCREEN ELEVATIONS (LS-4 TO LS-6)'] as const
export function numberShared(): { sheets: Proposal[]; question: Question } {
  const later = sheet('D-14', SPLIT_TITLES[0], { revision_mark: 'R2', issue_date: '2026-07-12' })
  const earlier = sheet('D-14', SPLIT_TITLES[1], { revision_mark: 'R1', issue_date: '2026-05-03' })
  const question = conflict('engine.conflicts.same_number', { number: 'D-14', copies: 2 }, [later, earlier])
  return { sheets: [later, earlier], question }
}

/** Two copies of one number and one title (a later and an earlier revision). */
export const COPY_TITLE = 'BALCONY RAILING DETAILS'
export function copies(secondTitle: string = COPY_TITLE): { sheets: Proposal[]; question: Question } {
  const later = sheet('D-15', COPY_TITLE, { revision_mark: 'R2', issue_date: '2026-07-12' })
  const earlier = sheet('D-15', secondTitle, { revision_mark: 'R1', issue_date: '2026-05-03' })
  const question = conflict('engine.conflicts.same_number', { number: 'D-15', copies: 2 }, [later, earlier])
  return { sheets: [later, earlier], question }
}

/** One title on twelve numbers that do not run on: a `same_title` Question (they may draw one thing). */
export const SHARED_TITLE = 'SUNSHADE FIN DETAILS'
export function titleShared(): { sheets: Proposal[]; question: Question } {
  const sheets = Array.from({ length: 12 }, (_, i) => sheet(`D-${String(30 + i * 3)}`, SHARED_TITLE))
  const question = conflict('engine.conflicts.same_title', { title: SHARED_TITLE, sheets: 12 }, sheets)
  return { sheets, question }
}

/** Plans of one storey on `n` Sheets of different numbers and titles: a `same_storey` Question. */
export const STOREY_TITLES = ['MEZZANINE CEILING PLAN', 'MEZZANINE REFLECTED CEILING LAYOUT', 'MEZZANINE SOFFIT PLAN'] as const
export function sameStorey(n: 2 | 3, sheetsParam: number | null = n): { sheets: Proposal[]; question: Question } {
  const sheets = STOREY_TITLES.slice(0, n).map((title, i) => sheet(`D-${String(51 + i * 4)}`, title))
  const params: Record<string, unknown> = {
    views: n,
    first: sheets[0]!.number,
    first_named: 'number',
    second: sheets[1]!.number,
    second_named: 'number',
    titled: 'differ',
    plan: STOREY_TITLES[0],
    other: STOREY_TITLES[1],
    layer: '',
  }
  if (sheetsParam !== null) params.sheets = sheetsParam
  const question = conflict('engine.conflicts.same_storey', params, sheets)
  return { sheets, question }
}

/** Five Sheets: three of a read-anyway file (two of them one continuation), two of an ordinary file. */
export function heldScene(): { held: Proposal[]; free: Proposal[] } {
  const on = { held: true, file_id: HELD_FILE.id, file_name: HELD_FILE.name }
  const held = [sheet('D-61', 'CANOPY TRUSS DETAILS', on), sheet('D-62', 'CANOPY TRUSS DETAILS', on), sheet('D-65', 'SKYLIGHT FRAME SECTIONS', on)]
  const free = [sheet('D-70', 'LOBBY FLOORING PATTERN'), sheet('D-71', 'LIFT CORE WALL ELEVATIONS')]
  return { held, free }
}

/** Three Sheets the server groups as one continuation, its group titled for all three. */
export const PART_TITLES = ['LINTEL LT-1 TO LT-4 DETAILS', 'LINTEL LT-5 TO LT-8 DETAILS', 'LINTEL LT-9 TO LT-12 DETAILS'] as const
export const GROUP_TITLE = 'LINTEL LT-1 TO LT-12 DETAILS'
export function continuation(sent = true): Proposal[] {
  const group = sent ? { continuation: 'c7', continuation_title: GROUP_TITLE } : {}
  return PART_TITLES.map((title, i) => sheet(`D-${String(41 + i)}`, title, group))
}

/** Five Sheets of one title on runs that do not join (D-81 and D-82 run on), the server's one series; one Sheet in none. */
export const SERIES_TITLE = 'PARAPET COPING DETAILS'
export function seriesScene(): { series: Proposal[]; alone: Proposal } {
  const series = ['D-81', 'D-82', 'D-85', 'D-88', 'D-93'].map((n) => sheet(n, SERIES_TITLE, { series: 's4' }))
  return { series, alone: sheet('D-90', 'BOUNDARY GATE ELEVATION', { series: null }) }
}

// Staging ------------------------------------------------------------------------------------------

/** 22's fake answering with only these Sheets and Questions, and no drawing list. */
export function stage(step1: FakeStep1, proposals: readonly Proposal[], questions: readonly Question[] = []): void {
  step1.proposals = [...proposals]
  step1.questions = [...questions]
  step1.lists = {}
  step1.notReceived = []
}

/**
 * The Architectural drawing list as read on the drawings, giving `number` the mark `mark`: with a later
 * mark and date, the second source that lets the card show "Picked for you" (pickSources). 22's fake
 * sends no `read_on` or `read_revisions`, so its drawing-list answer is laid over here.
 */
export function listGives(api: FakeApi, step1: FakeStep1, numbers: readonly string[], number: string, mark: string): void {
  const base = api.handle
  api.handle = async (request: Request) => {
    const url = new URL(request.url, location.origin)
    if (request.method === 'GET' && url.pathname === `/api/projects/${step1.projectId}/takeoff/step1/drawing-list` && url.searchParams.get('discipline') === 'architectural') {
      const body = {
        discipline: 'architectural',
        source: 'sheet',
        numbers: [...numbers],
        ignored: 0,
        entered_by: null,
        entered_at: null,
        read_numbers: [...numbers],
        read_on: null,
        read_revisions: { [number]: mark },
        agrees: true,
      }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return base(request)
  }
  step1.lists = { architectural: { source: 'sheet', numbers: [...numbers], entered_by: null, entered_at: null, read_numbers: [...numbers] } }
}

/** Text as the eye reads it: the bidi isolates and marks dropped, spaces collapsed. */
export const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
