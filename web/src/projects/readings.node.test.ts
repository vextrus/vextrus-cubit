/*
 * The Projects list's pure readings (readings.ts): what each cell holds, before it is worded. The words
 * themselves are pinned in the browser by src/acceptance/tw325. Every number and date is invented.
 */
import { describe, expect, it } from 'vitest'
import { driveWords, takeoffWords } from './readings'

const file = (state: string, params: Record<string, string | number> = {}, code = 'drawings.files.read') => ({ state, status: { code, params } })
const row = (discipline: string | null, found: number, confirmed = 0, open_questions = 0, status = 'in_review') => ({
  discipline,
  found,
  confirmed,
  open_questions,
  status,
  listed: null,
  lists_disagree: false,
  total: found,
  outstanding: [],
  plots: [],
})

describe('driveWords', () => {
  it('is none with no files', () => {
    expect(driveWords([])).toEqual({ kind: 'none' })
  })

  it('counts the moving files, with the sheet only for exactly one that counts its sheets', () => {
    const sheet = 'drawings.files.reading_sheet'
    expect(driveWords([file('reading', { position: 3, total: 9 }, sheet), file('read')])).toEqual({ kind: 'reading', files: 1, at: { unit: 'sheet', position: 3, total: 9 } })
    expect(driveWords([file('reading', { position: 3, total: 9, minutes: 4 }, 'drawings.files.reading_sheet_left')])).toEqual({ kind: 'reading', files: 1, at: { unit: 'sheet', position: 3, total: 9 } })
    expect(driveWords([file('reading', { position: 3, total: 9 }, sheet), file('waiting')])).toEqual({ kind: 'reading', files: 2, at: null })
    expect(driveWords([file('retrying', { position: 0, total: 0 }, sheet)])).toEqual({ kind: 'reading', files: 1, at: null })
    expect(driveWords([file('stopping', { position: '2', total: 5 }, sheet)])).toEqual({ kind: 'reading', files: 1, at: null })
  })

  it('counts a PDF’s pages as pages, never as sheets', () => {
    expect(driveWords([file('reading', { position: 2, total: 11 }, 'drawings.files.reading_page')])).toEqual({ kind: 'reading', files: 1, at: { unit: 'page', position: 2, total: 11 } })
    expect(driveWords([file('reading', { position: 2, total: 11, minutes: 1 }, 'drawings.files.reading_page_left')])).toEqual({ kind: 'reading', files: 1, at: { unit: 'page', position: 2, total: 11 } })
  })

  it('says no count for a status that counts nothing, whatever its params', () => {
    expect(driveWords([file('reading', { position: 2, total: 11 }, 'drawings.files.reading_drawing')])).toEqual({ kind: 'reading', files: 1, at: null })
  })

  it('counts each settled state in its group', () => {
    const list = ['read', 'read', 'held', 'failed', 'unreadable', 'refused', 'cancelled', 'cancelled'].map((s) => file(s))
    expect(driveWords(list)).toEqual({ kind: 'read', read: 2, held: 1, trouble: 2, refused: 1, stopped: 2 })
  })
})

describe('takeoffWords', () => {
  it('is not started when no Discipline found a sheet', () => {
    expect(takeoffWords({ disciplines: [row('structural', 0)], not_received: [] })).toEqual({ kind: 'not_started' })
  })

  it('with none confirmed: the Questions, else the sheets left, else not yet confirmed', () => {
    expect(takeoffWords({ disciplines: [row('structural', 6, 2, 1), row('electrical', 3, 0, 2)], not_received: [] })).toEqual({ kind: 'questions', open: 3 })
    expect(takeoffWords({ disciplines: [row('structural', 6, 2), row('electrical', 3, 3)], not_received: [] })).toEqual({ kind: 'to_confirm', sheets: 4 })
    expect(takeoffWords({ disciplines: [row('structural', 6, 6)], not_received: [] })).toEqual({ kind: 'not_confirmed' })
  })

  it('never counts a negative number of sheets left', () => {
    expect(takeoffWords({ disciplines: [row('structural', 4, 7), row('fire', 2, 1)], not_received: [] })).toEqual({ kind: 'to_confirm', sheets: 1 })
  })

  it('with one confirmed: each Discipline with sheets is a part, in PartsLine’s order of rules', () => {
    const progress = {
      disciplines: [row('structural', 5, 5, 0, 'confirmed'), row('electrical', 8, 6, 2), row('plumbing', 4, 4, 1), row('fire', 2, 2), row('mechanical', 0)],
      not_received: [],
    }
    expect(takeoffWords(progress)).toEqual({
      kind: 'parts',
      parts: [
        { discipline: 'structural', kind: 'confirmed' },
        { discipline: 'electrical', kind: 'left', sheets: 2 },
        { discipline: 'plumbing', kind: 'questions', open: 1 },
        { discipline: 'fire', kind: 'unaccounted' },
      ],
    })
  })

  it('is confirmed only when every Discipline with sheets is and none is still to come', () => {
    const disciplines = [row('structural', 5, 5, 0, 'confirmed'), row('architectural', 2, 2, 0, 'confirmed')]
    expect(takeoffWords({ disciplines, not_received: [] })).toEqual({ kind: 'confirmed' })
    expect(takeoffWords({ disciplines, not_received: ['electrical'] }).kind).toBe('parts')
  })
})
