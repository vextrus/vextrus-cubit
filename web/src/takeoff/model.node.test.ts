/*
 * Step 1's list model (model.ts): the bulk act takes only agreeing, undecided sheets no Question holds
 * (m0-screens §5 "What 'agrees' means", §6.4); continuations are one row only while their titles and
 * decisions match (§5, Q3); a Discipline with no drawing list names its numbering and its gaps (§6.3,
 * Q4); the Questions queue as section 5 orders them.
 */
import { describe, expect, it } from 'vitest'
import type { ProposalOut, QuestionOut, Step1Data } from './data'
import { compareNumbers, numberingOf, questionQueue, step1Model } from './model'

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
    ...over,
  }
}

function question(kind: string, over: Partial<QuestionOut> = {}): QuestionOut {
  n += 1
  return { id: `q${n}`, kind, status: 'open', code: 'x.y.z', params: {}, options: [], discipline: 'structural', subject_id: null, check_code: null, answer: null, answered_at: null, ...over }
}

function data(proposals: ProposalOut[], questions: QuestionOut[] = []): Step1Data {
  return {
    proposals,
    questions,
    coverage: { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {} },
    progress: { disciplines: [], not_received: [] },
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
