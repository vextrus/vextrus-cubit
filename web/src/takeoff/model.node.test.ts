/*
 * Step 1's list model (model.ts): the bulk act takes only agreeing, undecided sheets no Question holds
 * (m0-screens §5 "What 'agrees' means", §6.4); continuations are one row only while their titles and
 * decisions match (§5, Q3); a Discipline with no drawing list names its numbering and its gaps (§6.3,
 * Q4); the Questions queue as section 5 orders them.
 */
import { describe, expect, it } from 'vitest'
import type { ProposalOut, QuestionOut, Step1Data } from './data'
import { compareNumbers, nextOpenRow, numberingOf, questionQueue, rowState, step1Model } from './model'

let n = 0
function sheet(number: string | null, over: Partial<ProposalOut> = {}): ProposalOut {
  n += 1
  return {
    id: `p${n}`,
    sheet_id: `s${n}`,
    number,
    title: `TITLE ${n}`,
    revision_mark: 'R0',
    revision_mark_source: 'file_name',
    issue_date: '',
    discipline: 'structural',
    file_id: 'f1',
    file_name: 'KR-STR-R0.dwg',
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

function question(kind: string, over: Partial<QuestionOut> = {}): QuestionOut {
  n += 1
  // 21c adds `proposals`; cast so this fixture compiles before and after its merge.
  return { id: `q${n}`, kind, status: 'open', code: 'x.y.z', params: {}, options: [], discipline: 'structural', subject_id: null, check_code: null, answer: null, answered_at: null, proposals: [], ...over } as QuestionOut
}

function data(proposals: ProposalOut[], questions: QuestionOut[] = []): Step1Data {
  return {
    proposals,
    questions,
    // 21c adds `unaccounted_views` and `unread_sheets`; cast so this compiles before and after its merge.
    coverage: { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {}, unaccounted_views: [], unread_sheets: 0 } as Step1Data['coverage'],
    progress: { disciplines: [], not_received: [], qs: [] },
    lists: {},
  }
}

describe('the bulk act', () => {
  it('confirms agreeing undecided sheets and leaves out proposed exclusions, never one a Question holds or with one source', () => {
    const a = sheet('S-01')
    const b = sheet('S-02', { agrees: false })
    const c = sheet('S-03', { proposed_exclusion: 'for_information' })
    const d = sheet('S-04', { decision: 'confirmed' })
    const e = sheet('S-05')
    const f = sheet('S-06', { held: true })
    const q = question('low_confidence', { subject_id: e.sheet_id })
    const model = step1Model(data([a, b, c, d, e, f], [q]))
    expect(model.bulk.confirm.map((p) => p.number)).toEqual(['S-01'])
    expect(model.bulk.leaveOut.map((p) => p.number)).toEqual(['S-03'])
    expect(model.bulk.reasons).toEqual(['for_information'])
    expect(model.oneSource.map((p) => p.number)).toEqual(['S-02'])
  })

  it('leaves an "other" proposed exclusion out of the bulk act: a Proposal carries no words for it', () => {
    const model = step1Model(data([sheet('S-01'), sheet('S-02', { proposed_exclusion: 'other' }), sheet('S-03', { proposed_exclusion: 'blank' })]))
    expect(model.bulk.leaveOut.map((p) => p.number)).toEqual(['S-03'])
  })

  it('holds every copy of a number two sheets share, in one row', () => {
    const b = sheet('S-07', { revision_mark: 'B' })
    const a = sheet('S-07', { revision_mark: 'A' })
    const q = question('conflict', { subject_id: b.sheet_id, params: { number: 'S-07', copies: 2 } })
    const model = step1Model(data([a, b], [q]))
    expect(model.needsYou).toHaveLength(1)
    expect(model.needsYou[0]!.sheets.map((p) => p.revision_mark)).toEqual(['B', 'A'])
    expect(model.disciplines[0]!.rows).toEqual([])
    expect(model.bulk.confirm).toEqual([])
  })
})

describe('continuations (Q3)', () => {
  it('makes consecutive numbers with one title one row, and splits it where a decision differs', () => {
    const rows = (ps: ProposalOut[]) => step1Model(data(ps)).disciplines[0]!.rows.map((r) => [r.number, r.numberTo, r.sheets.length])
    const same = { title: 'COLUMN SCHEDULE' }
    expect(rows([sheet('S-09', same), sheet('S-10', same), sheet('S-11', same)])).toEqual([['S-09', 'S-11', 3]])
    expect(rows([sheet('S-09', same), sheet('S-11', same)])).toEqual([
      ['S-09', null, 1],
      ['S-11', null, 1],
    ])
    expect(rows([sheet('S-09', same), sheet('S-10', { ...same, decision: 'confirmed' })])).toEqual([
      ['S-09', null, 1],
      ['S-10', null, 1],
    ])
  })
})

describe('numbering with no drawing list (Q4)', () => {
  it('runs from the first to the last, naming what is missing', () => {
    expect(numberingOf([sheet('A-01'), sheet('A-02'), sheet('A-03')])).toEqual({ first: 'A-01', last: 'A-03', missing: [], twice: [] })
    expect(numberingOf([sheet('01'), sheet('04'), sheet('02')])).toEqual({ first: '01', last: '04', missing: ['03'], twice: [] })
    expect(numberingOf([sheet('A-01'), sheet(null), sheet('A-02')])).toEqual({ first: 'A-01', last: 'A-02', missing: [], twice: [] })
  })

  it('names a number drawn twice', () => {
    expect(numberingOf([sheet('S-06'), sheet('S-07'), sheet('S-07'), sheet('S-08')])).toEqual({ first: 'S-06', last: 'S-08', missing: [], twice: ['S-07'] })
  })

  it('is none for two series', () => {
    expect(numberingOf([sheet('A-01'), sheet('B-02')])).toBeNull()
  })
})

describe('order', () => {
  it('sorts numbers naturally, a sheet with no number last', () => {
    expect(['S-10', null, 'S-2', 'S-1'].sort(compareNumbers)).toEqual(['S-1', 'S-2', 'S-10', null])
  })

  it('queues the held file first, then those holding the most sheets, then by kind', () => {
    const s1 = sheet('S-01')
    const s2 = sheet('S-02')
    const s3 = sheet('S-02')
    const check = question('check', { params: { number: 'S-13' } })
    const kind = question('low_confidence', { subject_id: s1.sheet_id })
    const missing = question('missing', { subject_id: s1.sheet_id })
    const conflict = question('conflict', { subject_id: s2.sheet_id, params: { number: 'S-02', copies: 2 } })
    const file = question('file_misread', { subject_id: 'f9' })
    const queue = questionQueue([check, kind, missing, conflict, file], [s1, s2, s3])
    expect(queue.map((e) => [e.tag, e.question.kind])).toEqual([
      ['Q1', 'file_misread'],
      ['Q2', 'conflict'],
      ['Q3', 'missing'],
      ['Q4', 'low_confidence'],
      ['Q5', 'check'],
    ])
  })
})

describe('kept open and withdrawn Questions (the review of 22, round 4, F4; the ruling of session 08)', () => {
  it('reads a Question as kept open from its answer’s option, its status still open', () => {
    const a = sheet('S-01')
    const b = sheet('S-02')
    const kept = question('low_confidence', { subject_id: a.sheet_id, answer: { option: 'keep_open', by: 'Nusrat Jahan' } })
    const plain = question('low_confidence', { subject_id: b.sheet_id })
    const queue = questionQueue([kept, plain], [a, b])
    expect(queue.map((e) => [e.question.id, e.kept])).toEqual([
      [kept.id, true],
      [plain.id, false],
    ])
    // A status the API never sends is not open.
    expect(questionQueue([question('low_confidence', { subject_id: a.sheet_id, status: 'kept_open' })], [a])).toEqual([])
  })

  it('shows a Question withdrawn by an exclusion as its own row, after Needs you, tagged on from the queue', () => {
    const a = sheet('A-05', { discipline: 'architectural', decision: 'excluded', excluded_reason: 'for_information' })
    const b = sheet('A-06', { discipline: 'architectural' })
    const c = sheet('A-07', { discipline: 'architectural', decision: 'excluded', excluded_reason: 'blank' })
    const open = question('low_confidence', { subject_id: b.sheet_id })
    // 21c names the exclusion that withdrew it, top level (its round 4), with `blocking`.
    const byAct = question('low_confidence', { subject_id: a.sheet_id, status: 'withdrawn', withdrawn_by: 'act-1', blocking: true } as Partial<QuestionOut>)
    // Before 21c: withdrawn, and every sheet it holds is excluded.
    const bySheet = question('missing', { subject_id: c.sheet_id, status: 'withdrawn' })
    const model = step1Model(data([a, b, c], [byAct, open, bySheet]))
    expect(model.queue.map((e) => e.tag)).toEqual(['Q1'])
    expect(model.withdrawn.map((r) => [r.question!.tag, r.number, r.question!.withdrawn])).toEqual([
      ['Q2', 'A-05', true],
      ['Q3', 'A-07', true],
    ])
    expect(rowState(model.withdrawn[0]!)).toEqual({ kind: 'withdrawn', tag: 'Q2' })
    // Reachable by ↑ ↓: in the rows, after Needs you, and not also in the Discipline's section.
    expect(model.rows.map((r) => r.key)).toEqual([`q:${open.id}`, `q:${byAct.id}`, `q:${bySheet.id}`])
    expect(model.disciplines[0]!.rows).toEqual([])
    // Not open: Q and "Next open item" pass it by.
    expect(nextOpenRow(model.rows, `q:${open.id}`, true)?.key).toBe(`q:${open.id}`)
  })

  it('leaves out a Question withdrawn for another reason (its sheet not excluded), and an answered one', () => {
    const a = sheet('S-01')
    const b = sheet('S-02', { decision: 'excluded', excluded_reason: 'blank' })
    const other = question('low_confidence', { subject_id: a.sheet_id, status: 'withdrawn' })
    const answered = question('low_confidence', { subject_id: b.sheet_id, status: 'answered', answer: { option: 'section', by: 'Nusrat Jahan' } })
    // 21c: a Question a newer one replaced, its sheet excluded, has neither `withdrawn_by` nor `blocking`.
    const c = sheet('S-03', { decision: 'excluded', excluded_reason: 'blank' })
    const replaced = question('missing', { subject_id: c.sheet_id, status: 'withdrawn', withdrawn_by: null, blocking: false } as Partial<QuestionOut>)
    // An old answer's shape is not read: only the top-level field.
    const oldShape = question('missing', { subject_id: b.sheet_id, status: 'withdrawn', answer: { withdrawn_by: 'act-1' }, withdrawn_by: null, blocking: false } as Partial<QuestionOut>)
    const model = step1Model(data([a, b, c], [other, answered, replaced, oldShape]))
    expect(model.withdrawn).toEqual([])
    expect(model.queue).toEqual([])
  })
})

describe('Questions holding no sheet (ticket 164: every one was worded as a held file)', () => {
  it('makes a file’s row only for a held file; a numbering gap’s row names its two numbers, a drawing-list entry’s its number', () => {
    const a = sheet('A-03', { discipline: 'architectural' })
    const file = question('file_misread', { subject_id: 'f9' })
    const gap = question('check', { code: 'engine.register_check.gap', discipline: 'architectural', params: { after: 'A-03', before: 'A-05', missing: 1 } })
    const entry = question('check', { code: 'engine.register_check.not_found', params: { number: 'S-13' } })
    const other = question('check', { code: 'engine.register_check.something_new' })
    const model = step1Model(data([a], [file, gap, entry, other]))
    const byId = (q: QuestionOut) => model.needsYou.find((r) => r.key === `q:${q.id}`)!
    expect([file, gap, entry, other].map((q) => [byId(q).kind, byId(q).number, byId(q).numberTo])).toEqual([
      ['file', null, null],
      ['entry', 'A-03', 'A-05'],
      ['entry', 'S-13', null],
      ['entry', null, null],
    ])
    // Each is its own row, reachable by ↑ ↓.
    expect(new Set(model.needsYou.map((r) => r.key)).size).toBe(4)
  })
})
