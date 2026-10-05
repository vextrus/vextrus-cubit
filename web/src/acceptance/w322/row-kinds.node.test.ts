/*
 * T-W322's acceptance tests, the model (issue #322, FL9 f-28): `step1Model(data)` says what a Question
 * row's Sheets are. The ticket's seam: a row's `kind` is one of 'sheet' | 'copies' | 'number-shared' |
 * 'title-shared' | 'sheets' | 'file' | 'entry'; `copies` only for two or more Sheets of one number AND
 * one title (titles equal after trimming, collapsing spaces and ignoring case); `number-shared` for one
 * number and titles not all equal; `title-shared` for one title and numbers not all equal (a `same_title`
 * Question); `sheets` for any other two or more. A withdrawn Question's row takes the same rule.
 */
import { describe, expect, it } from 'vitest'
import type { ProposalOut, QuestionOut, Step1Data } from '@/takeoff/data'
import { step1Model } from '@/takeoff/model'
import { copies, numberShared, sameStorey, titleShared, type Proposal, type Question } from './sheets.fixture'

function data(proposals: readonly Proposal[], questions: readonly Question[]): Step1Data {
  return {
    proposals: proposals as unknown as ProposalOut[],
    questions: questions as unknown as QuestionOut[],
    coverage: { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {}, unaccounted_views: [], unread_sheets: 0 } as unknown as Step1Data['coverage'],
    progress: { disciplines: [], not_received: [], qs: [] } as unknown as Step1Data['progress'],
    lists: {},
  }
}

describe('what a Question row says its Sheets are (T-W322, FL9)', () => {
  it('keeps "copies" for one number and one title, the titles equal but for case and spaces', () => {
    const { sheets, question } = copies('  balcony   Railing details ')
    const model = step1Model(data(sheets, [question]))
    expect(model.needsYou).toHaveLength(1)
    expect(model.needsYou[0]!.kind).toBe('copies')
  })

  it('makes one number on two differently titled Sheets "number-shared", not copies', () => {
    const { sheets, question } = numberShared()
    const model = step1Model(data(sheets, [question]))
    expect(model.needsYou).toHaveLength(1)
    expect(model.needsYou[0]!.kind).toBe('number-shared')
  })

  it('makes a same_title Question over twelve numbers "title-shared", not copies', () => {
    const { sheets, question } = titleShared()
    const model = step1Model(data(sheets, [question]))
    expect(model.needsYou).toHaveLength(1)
    expect(model.needsYou[0]!.sheets).toHaveLength(12)
    expect(model.needsYou[0]!.kind).toBe('title-shared')
  })

  it('makes a same_storey Question over two numbers and two titles "sheets", not copies', () => {
    const { sheets, question } = sameStorey(2)
    const model = step1Model(data(sheets, [question]))
    expect(model.needsYou).toHaveLength(1)
    expect(model.needsYou[0]!.kind).toBe('sheets')
  })

  it('gives a withdrawn Question’s row the same rule: two numbers, two titles left out read "sheets"', () => {
    const { sheets, question } = sameStorey(2)
    const out = sheets.map((p) => ({ ...p, decision: 'excluded' as const, excluded_reason: 'by_others', decided_by: 'Rafiq Hasan', decided_at: '2026-09-30T05:00:00Z' }))
    const withdrawn: Question = { ...question, status: 'withdrawn', withdrawn_by: 'e3220000-0000-4000-8000-000000000001', blocking: true }
    const model = step1Model(data(out, [withdrawn]))
    expect(model.withdrawn).toHaveLength(1)
    expect(model.withdrawn[0]!.kind).toBe('sheets')
  })
})
