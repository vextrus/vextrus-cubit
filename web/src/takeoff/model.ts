/*
 * Step 1's list as the QS reads it (m0-screens §5, §6.2, §6.3, §6.4), worked out from 19a's rows with
 * no words in it: the sections and their rows, the Questions in queue order with their tags (Q1…),
 * continuation sheets as one row, each Discipline's numbering where it has no drawing list, and what
 * the bulk act would confirm and leave out. Pure, so it is tested in node (model.node.test.ts).
 */
import type { DrawingListOut, ProposalOut, QuestionOut, Step1Data } from './data'

/** The Takeoff's order of Disciplines (ADR 0040): Structural, Architectural, then each MEP one. */
export const DISCIPLINE_ORDER = ['structural', 'architectural', 'electrical', 'plumbing', 'fire', 'mechanical', 'lift', 'gas'] as const

/** The Disciplines Steps 1–13 take off (ADR 0040); every other one is an MEP Part, taken off from M3. */
export const STEP_DISCIPLINES: ReadonlySet<string> = new Set(DISCIPLINE_ORDER.slice(0, 2))

/** Where a view's Part goes: a Structural or Architectural sheet's own drawing (a legend) goes to Step 2's Notes. */
export const NOTES_STEP = 2

function disciplineRank(key: string | null): number {
  if (key === null) return Number.MAX_SAFE_INTEGER
  const i = (DISCIPLINE_ORDER as readonly string[]).indexOf(key)
  return i === -1 ? DISCIPLINE_ORDER.length : i
}

/** A sheet number as a series and a running number: "S-07" → ("S-", 7, ""); none when it has no digits. */
export function numberParts(number: string): { prefix: string; running: number; width: number; suffix: string } | null {
  const m = /^(.*?)(\d+)(\D*)$/.exec(number.trim())
  if (!m) return null
  return { prefix: m[1]!, running: Number(m[2]), width: m[2]!.length, suffix: m[3]! }
}

/** Natural order: S-2 before S-10; a sheet with no number last. */
export function compareNumbers(a: string | null, b: string | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
}

export type RowKind = 'sheet' | 'copies' | 'file' | 'entry'

export interface Row {
  /** Stable for focus: `p:<proposal>` for a sheet or continuation, `q:<question>` for a Question's row. */
  key: string
  kind: RowKind
  /** The printed sheets it stands for (a continuation's several; a Question's copies). */
  sheets: readonly ProposalOut[]
  /** "S-02", "E-02–E-03"; a numbering gap's "A-03–A-05"; null for a sheet with no number or a file. */
  number: string | null
  /** The last number of a continuation; the first number after a numbering gap. */
  numberTo: string | null
  question: QuestionEntry | null
}

export interface QuestionEntry {
  question: QuestionOut
  /** "Q2": its place in the queue. */
  tag: string
  /** The sheets it holds (answering settles them). */
  holds: readonly ProposalOut[]
  /** Open, answered "keep open, ask the consultant" (21c has no `kept_open` status: the orchestrator's ruling). */
  kept: boolean
  /** Withdrawn when the sheets it holds were left out: confirming them back in waits for its answer (21c's 409). */
  withdrawn: boolean
}

export interface DisciplineSection {
  discipline: string
  rows: readonly Row[]
  found: number
  settled: number
  /** N: the drawing list's count, else the sheets found; null ("—") while two lists disagree. */
  total: number | null
  openQuestions: number
  list: DrawingListOut | null
  /** With no drawing list: the numbering's first and last, the numbers missing between and those twice. */
  numbering: { first: string; last: string; missing: readonly string[]; twice: readonly string[] } | null
  /** Every sheet settled, none of its Questions open, no view unaccounted (m0-screens §5). */
  confirmed: boolean
}

export interface Bulk {
  confirm: readonly ProposalOut[]
  leaveOut: readonly ProposalOut[]
  /** The reasons left out, each once, in the pick list's order. */
  reasons: readonly string[]
}

export interface Step1Model {
  needsYou: readonly Row[]
  /** The Questions withdrawn when their sheets were left out, each a row holding those sheets (after Needs you). */
  withdrawn: readonly Row[]
  proposedOut: readonly Row[]
  disciplines: readonly DisciplineSection[]
  notReceived: readonly string[]
  /** The open Questions in queue order (Q1…); the withdrawn ones are not in it (they are `withdrawn`'s rows, tagged after it). */
  queue: readonly QuestionEntry[]
  /** The answered Questions, in the order they were answered, tagged on after the open and withdrawn ones. */
  answered: readonly QuestionEntry[]
  bulk: Bulk
  /** Every row in list order: what ↑ ↓ walk. */
  rows: readonly Row[]
  /** Sheets confirmed, excluded and found: the toolbar's Count. */
  confirmed: number
  excluded: number
  found: number
  /** Sheets that have one source and are still to confirm (6.4's "Nothing left but sheets with one source"). */
  oneSource: readonly ProposalOut[]
  /** Every Discipline received is confirmed. */
  allConfirmed: boolean
  /** Views neither assigned nor excluded (6.11). */
  unaccounted: number
  fileNames: Readonly<Record<string, string>>
  /** The names of the Project's QS members, for the read-only bar (§6.12); empty when not sent. */
  qs: readonly string[]
}

export const REASONS = ['superseded', 'duplicate', 'cover_index', 'for_information', 'by_others', 'blank', 'other'] as const
export type Reason = (typeof REASONS)[number]

const KIND_RANK: Record<string, number> = { file_misread: 0, conflict: 1, missing: 2, low_confidence: 3 }

const open = (q: QuestionOut) => q.status === 'open'
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Kept open: status `open`, its answer's option `keep_open` (the ruling of session 08: no `kept_open` status). */
export const isKeptOpen = (q: QuestionOut) => q.status === 'open' && isRecord(q.answer) && q.answer.option === 'keep_open'

/**
 * The sheets a withdrawn Question held that were left out, when an exclusion withdrew it. 21c sends
 * top-level `withdrawn_by` (that exclusion) and `blocking` (still answerable, and holding the sheet from
 * being confirmed back in); a Question a newer one replaced has neither. Before 21c, neither field
 * exists: then every sheet it holds is excluded. Else none.
 */
function leftOut(q: QuestionOut, holds: readonly ProposalOut[]): ProposalOut[] {
  if (q.status !== 'withdrawn') return []
  const out = holds.filter((p) => p.decision === 'excluded')
  const sent = q as { withdrawn_by?: unknown; blocking?: unknown }
  const byExclusion =
    'withdrawn_by' in sent || 'blocking' in sent ? (typeof sent.withdrawn_by === 'string' && sent.withdrawn_by !== '') || sent.blocking === true : out.length === holds.length
  return byExclusion ? out : []
}

/**
 * The sheets a Question holds: those 21c links to it (`proposals`, in list order); before 21c, its
 * subject, and for two sheets of one number, every copy.
 */
function held(q: QuestionOut, proposals: readonly ProposalOut[]): ProposalOut[] {
  const linked = new Set<string>(Array.isArray(q.proposals) ? q.proposals : [])
  if (linked.size > 0) {
    const found = proposals.filter((p) => linked.has(p.id))
    if (found.length > 0) return found
  }
  const subject = proposals.find((p) => p.sheet_id === q.subject_id || p.id === q.subject_id)
  const number = typeof q.params.number === 'string' ? q.params.number : subject?.number
  if (q.kind === 'conflict' && number) {
    return proposals.filter((p) => p.number === number && (q.discipline === null || p.discipline === q.discipline))
  }
  return subject ? [subject] : []
}

/** Section 5's queue: the held file first, then those holding the most sheets, then by kind, then sheet order. */
export function questionQueue(questions: readonly QuestionOut[], proposals: readonly ProposalOut[]): QuestionEntry[] {
  const entries = questions.filter(open).map((question) => ({ question, holds: held(question, proposals) }))
  entries.sort((a, b) => {
    const file = Number(b.question.kind === 'file_misread') - Number(a.question.kind === 'file_misread')
    if (file) return file
    if (b.holds.length !== a.holds.length) return b.holds.length - a.holds.length
    const kind = (KIND_RANK[a.question.kind] ?? 9) - (KIND_RANK[b.question.kind] ?? 9)
    if (kind) return kind
    return compareNumbers(a.holds[0]?.number ?? null, b.holds[0]?.number ?? null)
  })
  return entries.map((e, i) => ({ ...e, tag: `Q${i + 1}`, kept: isKeptOpen(e.question), withdrawn: false }))
}

/** The Questions withdrawn by an exclusion, in sheet order, tagged on from the queue (Q6… after Q1–Q5). */
export function withdrawnQueue(questions: readonly QuestionOut[], proposals: readonly ProposalOut[], after: number): QuestionEntry[] {
  const entries = questions.map((question) => ({ question, holds: leftOut(question, held(question, proposals)) })).filter((e) => e.holds.length > 0)
  entries.sort((a, b) => compareNumbers(a.holds[0]!.number, b.holds[0]!.number))
  return entries.map((e, i) => ({ ...e, tag: `Q${after + i + 1}`, kept: false, withdrawn: true }))
}

/** The answered Questions, in the order answered, tagged on after `after` (Q7… after Q1–Q6). */
export function answeredQueue(questions: readonly QuestionOut[], proposals: readonly ProposalOut[], after: number): QuestionEntry[] {
  const entries = questions.filter((q) => q.status === 'answered').map((question) => ({ question, holds: held(question, proposals) }))
  entries.sort((a, b) => (a.question.answered_at ?? '').localeCompare(b.question.answered_at ?? ''))
  return entries.map((e, i) => ({ ...e, tag: `Q${after + i + 1}`, kept: false, withdrawn: false, answered: true }))
}

const decided = (p: ProposalOut) => p.decision !== null
const sameState = (a: ProposalOut, b: ProposalOut) => a.decision === b.decision && a.excluded_reason === b.excluded_reason

/** Consecutive numbers of one series with the same title: one continuation (m0-screens §5, Q3). */
function continues(a: ProposalOut, b: ProposalOut): boolean {
  if (!a.number || !b.number || a.title.trim() === '' || a.title !== b.title || a.discipline !== b.discipline || !sameState(a, b)) return false
  const x = numberParts(a.number)
  const y = numberParts(b.number)
  return !!x && !!y && x.prefix === y.prefix && x.suffix === y.suffix && y.running === x.running + 1
}

function sheetRows(sheets: readonly ProposalOut[]): Row[] {
  const rows: Row[] = []
  for (const p of sheets) {
    const last = rows.at(-1)
    if (last && continues(last.sheets.at(-1)!, p)) {
      rows[rows.length - 1] = { ...last, sheets: [...last.sheets, p], numberTo: p.number }
      continue
    }
    rows.push({ key: `p:${p.id}`, kind: 'sheet', sheets: [p], number: p.number, numberTo: null, question: null })
  }
  return rows
}

/** With no drawing list: the Discipline's numbering, from its first number to its last, and what is missing. */
export function numberingOf(sheets: readonly ProposalOut[]): DisciplineSection['numbering'] {
  const parts = sheets.map((p) => (p.number ? { number: p.number, parts: numberParts(p.number) } : null)).filter((x) => x !== null)
  const series = new Set(parts.map((x) => (x.parts ? `${x.parts.prefix}\u0001${x.parts.suffix}` : null)))
  if (parts.length === 0 || series.size !== 1 || series.has(null)) return null
  const sorted = [...parts].sort((a, b) => a.parts!.running - b.parts!.running)
  const first = sorted[0]!
  const last = sorted.at(-1)!
  const have = new Set(sorted.map((x) => x.parts!.running))
  const seen = new Set<number>()
  const twice: string[] = []
  for (const x of sorted) {
    if (seen.has(x.parts!.running) && !twice.includes(x.number)) twice.push(x.number)
    seen.add(x.parts!.running)
  }
  const missing: string[] = []
  for (let n = first.parts!.running + 1; n < last.parts!.running && missing.length <= 50; n++) {
    if (!have.has(n)) missing.push(`${first.parts!.prefix}${String(n).padStart(first.parts!.width, '0')}${first.parts!.suffix}`)
  }
  return { first: first.number, last: last.number, missing, twice }
}

/** A numbering-gap Question's two numbers, the last before the gap and the first after it; else null. */
export function gapOf(q: QuestionOut): { after: string; before: string } | null {
  const { after, before } = q.params
  return q.code === 'engine.register_check.gap' && typeof after === 'string' && typeof before === 'string' ? { after, before } : null
}

export function step1Model(data: Step1Data): Step1Model {
  const proposals = [...data.proposals].sort(
    (a, b) =>
      disciplineRank(a.discipline) - disciplineRank(b.discipline) ||
      compareNumbers(a.number, b.number) ||
      // Of two copies of one number, the later revision first.
      b.revision_mark.localeCompare(a.revision_mark, 'en', { numeric: true }),
  )
  const queue = questionQueue(data.questions, proposals)
  const withdrawnEntries = withdrawnQueue(data.questions, proposals, queue.length)
  const answered = answeredQueue(data.questions, proposals, queue.length + withdrawnEntries.length)
  const heldBy = new Map<string, QuestionEntry>()
  for (const entry of [...queue, ...withdrawnEntries]) for (const p of entry.holds) if (!heldBy.has(p.id)) heldBy.set(p.id, entry)

  const needsYou: Row[] = queue.map((entry) => {
    const q = entry.question
    const holds = entry.holds
    if (holds.length > 1) return { key: `q:${q.id}`, kind: 'copies', sheets: holds, number: holds[0]!.number, numberTo: null, question: entry }
    if (holds.length === 1) return { key: `q:${q.id}`, kind: 'sheet', sheets: holds, number: holds[0]!.number, numberTo: null, question: entry }
    // Only a held file's row is a file's (ticket 164): a numbering gap's row names its two numbers, a
    // drawing-list entry's its number; neither holds a file.
    if (q.kind === 'file_misread') return { key: `q:${q.id}`, kind: 'file', sheets: [], number: null, numberTo: null, question: entry }
    const gap = gapOf(q)
    if (gap) return { key: `q:${q.id}`, kind: 'entry', sheets: [], number: gap.after, numberTo: gap.before, question: entry }
    const number = typeof q.params.number === 'string' ? q.params.number : null
    return { key: `q:${q.id}`, kind: 'entry', sheets: [], number, numberTo: null, question: entry }
  })

  const withdrawn: Row[] = withdrawnEntries.map((entry) => ({
    key: `q:${entry.question.id}`,
    kind: entry.holds.length > 1 ? 'copies' : 'sheet',
    sheets: entry.holds,
    number: entry.holds[0]!.number,
    numberTo: null,
    question: entry,
  }))

  const free = proposals.filter((p) => !heldBy.has(p.id))
  const proposedOut = sheetRows(free.filter((p) => !decided(p) && p.proposed_exclusion !== null))
  const outIds = new Set(proposedOut.flatMap((r) => r.sheets.map((p) => p.id)))

  const coverageDone = data.coverage.unaccounted === 0
  const progressOf = new Map(data.progress.disciplines.map((d) => [d.discipline, d]))
  const keys = [...new Set(proposals.map((p) => p.discipline))].sort((a, b) => disciplineRank(a) - disciplineRank(b))
  const disciplines: DisciplineSection[] = keys
    .filter((k): k is string => k !== null)
    .map((discipline) => {
      const mine = proposals.filter((p) => p.discipline === discipline)
      const progress = progressOf.get(discipline)
      const list = data.lists[discipline] ?? null
      const hasList = list !== null && list.source !== null && list.numbers.length > 0
      const openQuestions = progress?.open_questions ?? queue.filter((e) => e.question.discipline === discipline).length
      const settled = mine.filter(decided).length
      return {
        discipline,
        rows: sheetRows(mine.filter((p) => !heldBy.has(p.id) && !outIds.has(p.id))),
        found: progress?.found ?? mine.length,
        settled,
        total: progress ? progress.total ?? null : mine.length,
        openQuestions,
        list: hasList ? list : null,
        numbering: hasList ? null : numberingOf(mine),
        confirmed: mine.length > 0 && settled === mine.length && openQuestions === 0 && coverageDone,
      }
    })

  const bulkConfirm = free.filter((p) => !decided(p) && p.agrees && p.proposed_exclusion === null && !p.held)
  // "Other" needs the QS's words, which a Proposal does not carry (and the server refuses without them).
  const bulkOut = free.filter((p) => !decided(p) && p.proposed_exclusion !== null && p.proposed_exclusion !== 'other' && !p.held)
  const reasons = REASONS.filter((r) => bulkOut.some((p) => p.proposed_exclusion === r))

  const rows = [...needsYou, ...withdrawn, ...proposedOut, ...disciplines.flatMap((d) => d.rows)]
  return {
    needsYou,
    withdrawn,
    proposedOut,
    disciplines,
    notReceived: data.progress.not_received,
    queue,
    answered,
    bulk: { confirm: bulkConfirm, leaveOut: bulkOut, reasons },
    rows,
    confirmed: proposals.filter((p) => p.decision === 'confirmed').length,
    excluded: proposals.filter((p) => p.decision === 'excluded').length,
    found: proposals.length,
    oneSource: free.filter((p) => !decided(p) && !p.agrees && p.proposed_exclusion === null),
    allConfirmed: disciplines.length > 0 && disciplines.every((d) => d.confirmed),
    unaccounted: data.coverage.unaccounted,
    fileNames: data.fileNames ?? {},
    qs: data.progress.qs ?? [],
  }
}

/** The state a sheet row shows (6.2's State column), as data the screen words. */
export type RowState =
  | { kind: 'question'; tag: string; kept: boolean }
  | { kind: 'withdrawn'; tag: string }
  | { kind: 'confirmed' }
  | { kind: 'excluded'; reason: string | null; text: string }
  | { kind: 'proposed-out'; reason: string }
  | { kind: 'proposal'; oneSource: boolean }

export function rowState(row: Row): RowState {
  if (row.question?.withdrawn) return { kind: 'withdrawn', tag: row.question.tag }
  if (row.question) return { kind: 'question', tag: row.question.tag, kept: row.question.kept }
  const p = row.sheets[0]!
  if (p.decision === 'confirmed') return { kind: 'confirmed' }
  if (p.decision === 'excluded') return { kind: 'excluded', reason: p.excluded_reason, text: p.excluded_text }
  if (p.proposed_exclusion) return { kind: 'proposed-out', reason: p.proposed_exclusion }
  return { kind: 'proposal', oneSource: row.sheets.some((s) => !s.agrees) }
}

/** Why a sheet has one source (6.5), for the bar to say. */
export type OneSourceWhy = 'not-listed' | 'gap' | 'no-list-no-plot' | 'other'

export function whyOneSource(sheet: ProposalOut, section: DisciplineSection | undefined): OneSourceWhy {
  if (!section) return 'other'
  if (section.list) {
    const parts = sheet.number ? numberParts(sheet.number) : null
    const named = section.list.numbers.some((n) => {
      if (n === sheet.number) return true
      const q = numberParts(n)
      return !!parts && !!q && q.prefix === parts.prefix && q.running === parts.running && q.suffix === parts.suffix
    })
    return named ? 'other' : 'not-listed'
  }
  const run = section.numbering
  if (!run || run.missing.length > 0 || run.twice.length > 0) return 'gap'
  return 'no-list-no-plot'
}

/** The first open row after `key` (wrapping), for "Next open item": a Question's row or an undecided sheet. */
export function nextOpenRow(rows: readonly Row[], key: string | null, questionsOnly = false): Row | null {
  const at = key ? rows.findIndex((r) => r.key === key) : -1
  const ring = [...rows.slice(at + 1), ...rows.slice(0, at + 1)]
  // A withdrawn Question is not open: it waits until its sheet is to be confirmed back in.
  return ring.find((r) => (r.question ? !r.question.withdrawn : !questionsOnly && r.sheets.some((s) => s.decision === null))) ?? null
}

/** The sheet a Discipline's drawing list was read on, when it is one of its sheets ("on the drawing list on S-01"). */
export function listSheet(section: Pick<DisciplineSection, 'list' | 'rows'>): ProposalOut | undefined {
  const on = section.list?.read_on
  return on ? section.rows.flatMap((r) => [...r.sheets]).find((p) => p.sheet_id === on) : undefined
}
