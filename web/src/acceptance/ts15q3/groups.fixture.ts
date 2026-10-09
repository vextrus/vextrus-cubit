/*
 * S15-Q3's invented Sheets and Questions for the list's group rows (T-W322's screen half of #232, #321,
 * #334). Every number, title, mark and file name is made up for its shape only: a continuation the
 * server groups (`continuation`, `continuation_title`), a series it names (`series`), and one title on
 * twelve numbers asked as a `same_title` Question.
 *
 * Shapes are 22's fake's (`../t22/step1.fixture.ts`) with 21c's Question fields (`proposals`,
 * `withdrawn_by`, `blocking`) and T-W334's three optional Proposal fields: the fake sends them as given.
 */
import type { FakeStep1, ProposalOut as FakeProposal, QuestionOut as FakeQuestion } from '../t22/step1.fixture'

/** A Proposal as 21c and T-W334 send it. */
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

export const FILE = { id: 'f15a3000-0000-4000-8000-000000000001', name: 'QG-ARC-R1.dwg' }

/** One invented architectural Sheet, undecided, agreeing, not held, unless `over` says otherwise. */
export function sheet(number: string, title: string, over: Partial<Proposal> = {}): Proposal {
  return {
    id: uuid('a15a3000'),
    sheet_id: uuid('b15a3000'),
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

/** Three Sheets the server groups as one continuation, its group titled with the ranges joined. */
export const PART_TITLES = ['LINTEL LT-1 TO LT-4 DETAILS', 'LINTEL LT-5 TO LT-8 DETAILS', 'LINTEL LT-9 TO LT-12 DETAILS'] as const
export const GROUP_TITLE = 'LINTEL LT-1 TO LT-12 DETAILS'
export function continuation(): Proposal[] {
  return PART_TITLES.map((title, i) => sheet(`D-${String(41 + i)}`, title, { continuation: 'c7', continuation_title: GROUP_TITLE }))
}

/** Five Sheets of one title on runs the server names one series (D-81 and D-82 run on); one Sheet in none. */
export const SERIES_TITLE = 'PARAPET COPING DETAILS'
export function seriesScene(): { series: Proposal[]; alone: Proposal } {
  const series = ['D-81', 'D-82', 'D-85', 'D-88', 'D-93'].map((n) => sheet(n, SERIES_TITLE, { series: 's4' }))
  return { series, alone: sheet('D-90', 'BOUNDARY GATE ELEVATION', { series: null }) }
}

/** One title on twelve numbers that do not run on: a `same_title` Question (they may draw one thing). */
export const SHARED_TITLE = 'SUNSHADE FIN DETAILS'
export function titleShared(): { sheets: Proposal[]; question: Question } {
  const sheets = Array.from({ length: 12 }, (_, i) => sheet(`D-${String(30 + i * 3)}`, SHARED_TITLE))
  const question: Question = {
    id: uuid('c15a3000'),
    kind: 'conflict',
    status: 'open',
    code: 'engine.conflicts.same_title',
    params: { title: SHARED_TITLE, sheets: 12 },
    options: ['keep_all', 'keep_open'].map((key) => ({ key, picked: false })),
    discipline: 'architectural',
    subject_id: sheets[0]!.sheet_id,
    check_code: null,
    answer: null,
    answered_at: null,
    proposals: sheets.map((p) => p.id),
    withdrawn_by: null,
    blocking: true,
  }
  return { sheets, question }
}

/** 22's fake answering with only these Sheets and Questions, and no drawing list. */
export function stage(step1: FakeStep1, proposals: readonly Proposal[], questions: readonly Question[] = []): void {
  step1.proposals = [...proposals]
  step1.questions = [...questions]
  step1.lists = {}
  step1.notReceived = []
}

/** Text as the eye reads it: the bidi isolates and marks dropped, spaces collapsed. */
export const clean = (s: string | null | undefined) => (s ?? '').replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim()
